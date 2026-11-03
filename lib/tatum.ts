// Tatum is how this app reads Sui mainnet: native gRPC (sui.rpc.v2) for objects and chain status,
// GraphQL for owned-object listings. Both go through Tatum's gateway with the API key, server-side only.
import path from "node:path";
import { env, MEMWAL_PACKAGE, WALRUS_BLOB_TYPE } from "./env.ts";
import { sleep } from "./util.ts";

const GQL = "https://sui-mainnet.gateway.tatum.io/graphql";
const GRPC_HOST = "sui-mainnet-grpc.gateway.tatum.io:443";

// Free plan: 3 requests/second. Keep a process-wide gap and back off on 429.
let lastCall = 0;
async function throttle() {
  const wait = Math.max(0, lastCall + 380 - Date.now());
  if (wait) await sleep(wait);
  lastCall = Date.now();
}

export async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await throttle();
    const r = await fetch(GQL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.tatumKey() },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 429) {
      await sleep(1100 * (attempt + 1));
      continue;
    }
    const j: any = await r.json();
    if (j.errors?.length) throw new Error(`tatum graphql: ${j.errors[0].message}`);
    return j.data as T;
  }
  throw new Error("tatum graphql: rate limited");
}

// ---------- native gRPC ----------
let grpcClients: { ledger: any; state: any; md: any } | null = null;

async function grpc() {
  if (grpcClients) return grpcClients;
  const grpcJs = (await import("@grpc/grpc-js")).default;
  const loader = (await import("@grpc/proto-loader")).default;
  const root = path.join(process.cwd(), "proto");
  const def = loader.loadSync(["sui/rpc/v2/ledger_service.proto", "sui/rpc/v2/state_service.proto"], {
    includeDirs: [root],
    keepCase: true,
    longs: String,
    enums: String,
    defaults: false,
    oneofs: true,
  });
  const pkg: any = (grpcJs.loadPackageDefinition(def) as any).sui.rpc.v2;
  const creds = grpcJs.credentials.createSsl();
  const md = new grpcJs.Metadata();
  md.set("x-api-key", env.tatumKey());
  grpcClients = { ledger: new pkg.LedgerService(GRPC_HOST, creds), state: new pkg.StateService(GRPC_HOST, creds), md };
  return grpcClients;
}

async function grpcCall<T = any>(svc: "ledger" | "state", method: string, req: unknown): Promise<T> {
  const c = await grpc();
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    try {
      return await new Promise<T>((resolve, reject) =>
        c[svc][method](req, c.md, { deadline: Date.now() + 15_000 }, (e: any, r: T) => (e ? reject(e) : resolve(r))),
      );
    } catch (e: any) {
      if (e?.code === 8 /* RESOURCE_EXHAUSTED */ || /429|exceeded/i.test(String(e?.details))) {
        await sleep(1100 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`tatum grpc ${method}: rate limited`);
}

/** google.protobuf.Value (as decoded by proto-loader) → plain JSON. */
export function pbValue(v: any): any {
  if (!v || typeof v !== "object") return v;
  switch (v.kind) {
    case "structValue":
      return Object.fromEntries(Object.entries(v.structValue?.fields ?? {}).map(([k, x]) => [k, pbValue(x)]));
    case "listValue":
      return (v.listValue?.values ?? []).map(pbValue);
    case "stringValue":
      return v.stringValue;
    case "numberValue":
      return v.numberValue;
    case "boolValue":
      return v.boolValue;
    case "nullValue":
      return null;
    default:
      return null;
  }
}

export async function chainInfo(): Promise<{ epoch: string | null; checkpoint: string | null; chain: string | null }> {
  const r: any = await grpcCall("ledger", "GetServiceInfo", {});
  return { epoch: r.epoch ?? null, checkpoint: r.checkpoint_height ?? null, chain: r.chain ?? null };
}

export interface AccountInfo {
  id: string;
  owner: string;
  active: boolean;
  delegateKeys: { label: string; publicKeyHex: string; suiAddress: string; createdAt: string }[];
  previousTransaction: string | null;
}

export async function memwalAccount(accountId = env.memwalAccountId()): Promise<AccountInfo> {
  const r: any = await grpcCall("ledger", "GetObject", {
    object_id: accountId,
    read_mask: { paths: ["object_id", "object_type", "json", "previous_transaction"] },
  });
  const o = r.object;
  if (!o?.object_type?.startsWith(`${MEMWAL_PACKAGE}::account::MemWalAccount`)) throw new Error("not a MemWalAccount");
  const j = pbValue(o.json) ?? {};
  return {
    id: o.object_id,
    owner: j.owner,
    active: !!j.active,
    delegateKeys: (j.delegate_keys ?? []).map((k: any) => ({
      label: k.label,
      publicKeyHex: Buffer.from(k.public_key, "base64").toString("hex"),
      suiAddress: k.sui_address,
      createdAt: new Date(Number(k.created_at)).toISOString(),
    })),
    previousTransaction: o.previous_transaction ?? null,
  };
}

export interface ChainBlob {
  objectId: string;
  blobIdU256: string;
  size: number;
  endEpoch: number | null;
  certifiedEpoch: number | null;
}

/** Every Walrus Blob object owned by the account owner (gRPC ListOwnedObjects, paginated). */
export async function ownedBlobs(owner: string, maxPages = 20): Promise<ChainBlob[]> {
  const out: ChainBlob[] = [];
  let page_token: any = undefined;
  for (let i = 0; i < maxPages; i++) {
    const r: any = await grpcCall("state", "ListOwnedObjects", {
      owner,
      page_size: 500,
      page_token,
      object_type: WALRUS_BLOB_TYPE,
      read_mask: { paths: ["object_id", "json"] },
    });
    for (const o of r.objects ?? []) {
      const j = pbValue(o.json) ?? {};
      out.push({
        objectId: o.object_id,
        blobIdU256: String(j.blob_id),
        size: Number(j.size ?? 0),
        endEpoch: j.storage?.end_epoch ?? null,
        certifiedEpoch: j.certified_epoch ?? null,
      });
    }
    if (!r.next_page_token || (Buffer.isBuffer(r.next_page_token) && r.next_page_token.length === 0)) break;
    page_token = r.next_page_token;
  }
  return out;
}

/**
 * When did this object last change on Sui? GetObject → previous_transaction, then GetTransaction → checkpoint
 * and its timestamp. For a Walrus Blob that is the certification (or a later storage extension), so it proves
 * the memory existed on-chain by that time.
 */
export async function objectLastWrite(objectId: string): Promise<{ digest: string; checkpoint: string | null; at: string | null } | null> {
  const o: any = await grpcCall("ledger", "GetObject", { object_id: objectId, read_mask: { paths: ["object_id", "previous_transaction"] } });
  const digest = o.object?.previous_transaction;
  if (!digest) return null;
  const t: any = await grpcCall("ledger", "GetTransaction", { digest, read_mask: { paths: ["digest", "checkpoint", "timestamp"] } });
  const ts = t.transaction?.timestamp;
  const at = ts?.seconds ? new Date(Number(ts.seconds) * 1000 + Math.floor(Number(ts.nanos ?? 0) / 1e6)).toISOString() : null;
  return { digest, checkpoint: t.transaction?.checkpoint ?? null, at };
}

/** Delegate-key history for the account (GraphQL events, sent by the account owner). */
export async function delegateKeyEvents(owner: string, accountId = env.memwalAccountId()) {
  const d = await gql<any>(
    `query($t: String!, $s: SuiAddress!) { events(last: 50, filter: { type: $t, sender: $s }) { nodes { timestamp contents { json } transaction { digest } } } }`,
    { t: `${MEMWAL_PACKAGE}::account::DelegateKeyAdded`, s: owner },
  );
  return (d.events?.nodes ?? [])
    .filter((n: any) => n.contents?.json?.account_id === accountId)
    .map((n: any) => ({ at: n.timestamp, label: n.contents.json.label, digest: n.transaction?.digest }));
}
