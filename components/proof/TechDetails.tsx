import { IconCheck, IconChevron } from "@/components/site/Icons";

/** What each plain-language check reads on Sui, for developers and judges. */
export const TATUM_CALLS = [
  { title: "Sui mainnet is live", method: "LedgerService/GetServiceInfo", reads: "the current epoch and latest checkpoint" },
  { title: "The memory account exists", method: "LedgerService/GetObject", reads: "the MemWal account object: owner, active flag and delegate keys" },
  { title: "Memories are really stored", method: "StateService/ListOwnedObjects", reads: "every Walrus Blob object the account owns, with its storage end epoch" },
  { title: "Picks were locked before kick-off", method: "LedgerService/GetTransaction", reads: "when Sui certified each evening's brief" },
] as const;

/**
 * Collapsed by default on the landing page; open on /proof. Method names, endpoints and protocols live
 * here so normal visitors only see the plain-language rows.
 */
export function TechDetails({ via, open = false, className = "" }: { via: string[]; open?: boolean; className?: string }) {
  return (
    <details className={`group min-w-0 text-xs text-chalk-3 ${className}`} open={open}>
      <summary className="inline-flex min-h-[32px] items-center gap-1.5 hover:text-chalk">
        Technical details (for developers)
        <IconChevron size={13} className="transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-2 space-y-3 pb-1">
        <p className="leading-relaxed">
          Native gRPC (<span className="chip-id">sui.rpc.v2</span>) at <span className="chip-id break-all">sui-mainnet-grpc.gateway.tatum.io</span>, plus GraphQL at{" "}
          <span className="chip-id break-all">sui-mainnet.gateway.tatum.io/graphql</span>. Read-only and server-side, so the API key never reaches your browser.
        </p>
        <ul className="space-y-2">
          {TATUM_CALLS.map((c) => {
            const ok = via.some((v) => v.includes(c.method));
            return (
              <li key={c.method} className="flex gap-2">
                <span className={`mt-[3px] shrink-0 ${ok ? "text-ok" : "text-chalk-4"}`} aria-label={ok ? "Answered in this check" : "Not called in this check"} role="img">
                  {ok ? <IconCheck size={12} /> : <span className="block h-3 w-3 rounded-full" style={{ boxShadow: "inset 0 0 0 1.5px currentColor" }} />}
                </span>
                <span className="min-w-0">
                  <span className="chip chip-id !h-[20px] align-middle">{c.method}</span>{" "}
                  <span className="text-chalk-3">reads {c.reads} (&ldquo;{c.title}&rdquo;).</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
