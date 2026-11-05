"use client";

// Wallet Standard only (no JSON-RPC): the wallet signs and submits the two Move calls itself; our server then
// confirms the result on Sui through Tatum before switching the viewer's memory to their own account.
import { useCallback, useEffect, useMemo, useState } from "react";
import { getWallets, type Wallet, type WalletAccount } from "@mysten/wallet-standard";
import { Transaction } from "@mysten/sui/transactions";
import { BRAND } from "@/lib/brand";

interface OwnConfig {
  packageId: string;
  registryId: string;
  publicKeyHex: string;
  label: string;
}
interface Lookup {
  accountId: string | null;
  hasKey: boolean;
  reason?: string | null;
}
type Phase = "idle" | "connecting" | "checking" | "creating" | "adding" | "claiming" | "done" | "removing" | "released";

const CHAIN = "sui:mainnet";
const CLOCK = "0x6";
const suiscan = (id: string) => `https://suiscan.xyz/mainnet/object/${id}`;
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const hexBytes = (hex: string) => Array.from(hex.match(/.{2}/g) ?? [], (b) => parseInt(b, 16));

function suiWallets(): Wallet[] {
  return getWallets()
    .get()
    .filter((w) => "sui:signAndExecuteTransaction" in w.features && "standard:connect" in w.features && w.chains.some((c) => c === CHAIN));
}

export function OwnFlow() {
  const [token, setToken] = useState<string | null>(null);
  const [config, setConfig] = useState<OwnConfig | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [look, setLook] = useState<Lookup | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    setToken(t);
    fetch(t ? `/api/own/config?t=${encodeURIComponent(t)}` : "/api/own/config").then((r) => r.json()).then(setConfig).catch(() => setError("Couldn't load the setup details. Refresh to try again."));
    const api = getWallets();
    const refresh = () => setWallets(suiWallets());
    refresh();
    const offA = api.on("register", refresh);
    const offB = api.on("unregister", refresh);
    return () => {
      offA();
      offB();
    };
  }, []);

  const lookup = useCallback(async (address: string): Promise<Lookup> => {
    const r = await fetch(`/api/own/lookup?address=${address}`, { cache: "no-store" });
    if (!r.ok) throw new Error("Couldn't read Sui right now. Try again in a moment.");
    const j = (await r.json()) as Lookup;
    setLook(j);
    return j;
  }, []);

  /** Tatum's index can lag a few seconds behind the wallet; poll until the change shows. */
  const waitFor = useCallback(
    async (address: string, ok: (l: Lookup) => boolean) => {
      for (let i = 0; i < 25; i++) {
        const l = await lookup(address).catch(() => null);
        if (l && ok(l)) return l;
        await new Promise((res) => setTimeout(res, 3000));
      }
      throw new Error("The transaction went through, but Sui hasn't shown it yet. Refresh this page in a minute.");
    },
    [lookup],
  );

  async function connect(w: Wallet) {
    setError(null);
    setPhase("connecting");
    try {
      const feature = w.features["standard:connect"] as { connect: () => Promise<{ accounts: readonly WalletAccount[] }> };
      const { accounts } = await feature.connect();
      const a = accounts.find((x) => x.chains.includes(CHAIN)) ?? accounts[0];
      if (!a) throw new Error("That wallet didn't share an account.");
      setWallet(w);
      setAccount(a);
      setPhase("checking");
      await lookup(a.address);
      setPhase("idle");
    } catch (e: any) {
      setPhase("idle");
      setError(e?.message || "Couldn't connect to the wallet.");
    }
  }

  async function run(build: (tx: Transaction) => void) {
    if (!wallet || !account) throw new Error("Connect a wallet first.");
    const tx = new Transaction();
    tx.setSender(account.address);
    build(tx);
    const feature = wallet.features["sui:signAndExecuteTransaction"] as {
      signAndExecuteTransaction: (input: { transaction: { toJSON: () => Promise<string> }; account: WalletAccount; chain: string }) => Promise<{ digest: string }>;
    };
    return feature.signAndExecuteTransaction({ transaction: { toJSON: () => tx.toJSON() }, account, chain: CHAIN });
  }

  async function createAccount() {
    if (!config || !account) return;
    setError(null);
    setPhase("creating");
    try {
      await run((tx) => tx.moveCall({ target: `${config.packageId}::account::create_account`, arguments: [tx.object(config.registryId), tx.object(CLOCK)] }));
      await waitFor(account.address, (l) => !!l.accountId);
      setPhase("idle");
    } catch (e: any) {
      setPhase("idle");
      setError(e?.message || "The wallet didn't complete the transaction.");
    }
  }

  async function addKey() {
    if (!config || !account || !look?.accountId) return;
    setError(null);
    setPhase("adding");
    try {
      const accountId = look.accountId;
      await run((tx) =>
        tx.moveCall({
          target: `${config.packageId}::account::add_delegate_key`,
          arguments: [tx.object(accountId), tx.object(config.registryId), tx.pure.vector("u8", hexBytes(config.publicKeyHex)), tx.pure.string(config.label), tx.object(CLOCK)],
        }),
      );
      await waitFor(account.address, (l) => l.hasKey);
      await claim(accountId);
    } catch (e: any) {
      setPhase("idle");
      setError(e?.message || "The wallet didn't complete the transaction.");
    }
  }

  async function claim(accountId: string) {
    if (!token) {
      setPhase("idle");
      setError("Open this page from the link the bot sends with /own, so it knows who you are.");
      return;
    }
    setPhase("claiming");
    const r = await fetch(`/api/own/claim?t=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setPhase("idle");
      setError(j.error || "The server couldn't confirm the account yet.");
      return;
    }
    setCopied(j.copied ?? 0);
    setPhase("done");
  }

  async function removeKey() {
    if (!config || !account || !look?.accountId || !token) return;
    setError(null);
    setPhase("removing");
    try {
      const accountId = look.accountId;
      await run((tx) =>
        tx.moveCall({ target: `${config.packageId}::account::remove_delegate_key`, arguments: [tx.object(accountId), tx.object(config.registryId), tx.pure.vector("u8", hexBytes(config.publicKeyHex))] }),
      );
      await fetch(`/api/own/release?t=${encodeURIComponent(token)}`, { method: "POST" });
      await waitFor(account.address, (l) => !l.hasKey).catch(() => null);
      setPhase("released");
    } catch (e: any) {
      setPhase("idle");
      setError(e?.message || "The wallet didn't complete the transaction.");
    }
  }

  const busy = phase === "connecting" || phase === "checking" || phase === "creating" || phase === "adding" || phase === "claiming" || phase === "removing";
  const step = useMemo(() => {
    if (!account) return 1;
    if (!look?.accountId) return 2;
    if (!look.hasKey) return 3;
    return 4;
  }, [account, look]);

  return (
    <section aria-labelledby="own-steps" className="card p-6 md:p-7">
      <h2 id="own-steps" className="text-xl font-semibold">Take ownership</h2>
      {!token ? <p className="mt-3 rounded-[10px] bg-ink-2 p-3 text-sm text-chalk-2">Open this page from the link the bot sends with <span className="mono">/own</span>, so it knows which viewer you are.</p> : null}

      <ol className="mt-5 grid gap-4">
        <Step n={1} title="Connect a Sui wallet" done={step > 1} active={step === 1}>
          {account ? (
            <p className="text-sm text-chalk-2">
              Connected: <span className="mono text-chalk">{short(account.address)}</span>
            </p>
          ) : wallets.length ? (
            <div className="flex flex-wrap gap-2">
              {wallets.map((w) => (
                <button key={w.name} type="button" className="btn btn-ghost !min-h-[44px]" disabled={busy} onClick={() => connect(w)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {w.icon ? <img src={w.icon} alt="" width={20} height={20} className="h-5 w-5 rounded" /> : null}
                  {w.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-chalk-2">
              No Sui wallet found in this browser. Install one such as <a className="underline" href="https://slush.app" target="_blank" rel="noopener noreferrer">Slush</a>, then refresh.
            </p>
          )}
        </Step>

        <Step n={2} title="Create your memory account" done={step > 2} active={step === 2}>
          {step === 2 ? (
            <>
              <p className="text-sm text-chalk-2">Your wallet doesn&rsquo;t have a Walrus Memory account yet. One signature creates it (one per wallet).</p>
              <button type="button" className="btn btn-primary mt-3" disabled={busy} onClick={createAccount}>
                {phase === "creating" ? "Waiting for your wallet…" : "Create account"}
              </button>
            </>
          ) : look?.accountId ? (
            <p className="text-sm text-chalk-2">
              Account <a className="mono underline" href={suiscan(look.accountId)} target="_blank" rel="noopener noreferrer">{short(look.accountId)}</a>
            </p>
          ) : null}
        </Step>

        <Step n={3} title={`Give ${BRAND.name} a key`} done={step > 3} active={step === 3}>
          {step === 3 ? (
            <>
              <p className="text-sm text-chalk-2">Adds Pocket Pundit&rsquo;s delegate key so it can keep writing your memories there. You can remove it later from this page or any Walrus Memory app.</p>
              <button type="button" className="btn btn-primary mt-3" disabled={busy} onClick={addKey}>
                {phase === "adding" ? "Waiting for your wallet…" : phase === "claiming" ? "Checking on Sui…" : "Add key and move my memory"}
              </button>
            </>
          ) : null}
        </Step>

        <Step n={4} title="Done" done={phase === "done"} active={step === 4}>
          {phase === "done" ? (
            <p className="text-sm text-chalk-2" role="status">
              Your memory now lives in your account. {copied ? `${copied} memories are being copied across.` : ""} The bot has confirmed it in Telegram.
            </p>
          ) : phase === "released" ? (
            <p className="text-sm text-chalk-2" role="status">Key removed. Pocket Pundit now writes to its shared account again; your account keeps what it holds.</p>
          ) : step === 4 ? (
            <div className="grid gap-3">
              <p className="text-sm text-chalk-2">Pocket Pundit&rsquo;s key is on your account.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => look?.accountId && claim(look.accountId)}>
                  {phase === "claiming" ? "Checking on Sui…" : "Use my account"}
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={removeKey}>
                  {phase === "removing" ? "Waiting for your wallet…" : "Remove Pocket Pundit's key"}
                </button>
              </div>
            </div>
          ) : null}
        </Step>
      </ol>

      {error ? (
        <p className="mt-4 rounded-[10px] border border-[var(--line-strong)] bg-ink-2 p-3 text-sm text-chalk" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-5 text-xs text-chalk-3">Your wallet signs and sends each transaction itself. This page never sees a private key.</p>
    </section>
  );
}

function Step({ n, title, done, active, children }: { n: number; title: string; done: boolean; active: boolean; children?: React.ReactNode }) {
  return (
    <li className={`rounded-[12px] p-4 ${active ? "bg-ink-2 hairline" : ""}`} aria-current={active ? "step" : undefined}>
      <div className="flex items-center gap-3">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? "bg-ok text-ink-0" : active ? "bg-flare text-ink-0" : "bg-ink-2 text-chalk-3"}`}>{done ? "✓" : n}</span>
        <h3 className={`font-semibold ${active || done ? "text-chalk" : "text-chalk-3"}`}>{title}</h3>
      </div>
      {children ? <div className="mt-3 pl-10">{children}</div> : null}
    </li>
  );
}
