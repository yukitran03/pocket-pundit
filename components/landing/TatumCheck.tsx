"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ProofResponse } from "@/lib/contract";
import { getProof } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { fmtBriefDate, fmtInt, fmtLead, fmtTime, visitorTz } from "@/lib/client/format";
import { useInView } from "@/components/three/hooks";
import { DataSourceBadge, ErrorState, Skeleton } from "@/components/site/States";
import { IconArrowRight, IconCheck } from "@/components/site/Icons";

type Row = { call: string; title: string; value: ReactNode; detail: ReactNode; state: "ok" | "idle" | "missing" };

const called = (d: ProofResponse, method: string) => d.chain.via.some((v) => v.includes(method));

function rows(d: ProofResponse, tz: string): Row[] {
  const a = d.account;
  const total = d.verified.matched + d.verified.missing;
  const locks = d.locks ?? [];
  const certified = locks.filter((l) => l.certifiedAt);
  const latest = certified[0];
  const before = certified.filter((l) => (l.minutesBefore ?? -1) >= 0).length;

  return [
    {
      call: "LedgerService/GetServiceInfo",
      title: "Sui mainnet is live",
      value: d.chain.epoch ? <>Epoch {fmtInt(Number(d.chain.epoch))}</> : "No answer",
      detail: d.chain.checkpoint ? <>Latest checkpoint {fmtInt(Number(d.chain.checkpoint))}</> : "Checkpoint not returned in this check",
      state: called(d, "GetServiceInfo") ? "ok" : "missing",
    },
    {
      call: "LedgerService/GetObject",
      title: "The memory account exists",
      value: a ? (a.active ? "Active" : "Inactive") : "Not found",
      detail: a ? <>{a.delegateKeys.length} {a.delegateKeys.length === 1 ? "key is" : "keys are"} allowed to write memories</> : "The account object wasn't returned",
      state: called(d, "GetObject") && a ? "ok" : "missing",
    },
    {
      call: "StateService/ListOwnedObjects",
      title: "Memories are really stored",
      value: <>{fmtInt(d.blobs.onChainCount)} on-chain</>,
      detail: total ? <>{fmtInt(d.verified.matched)} of {fmtInt(total)} saved memories matched{d.verified.missing ? `, ${fmtInt(d.verified.missing)} still being certified` : ", none missing"}</> : "No saved memories to match yet",
      state: called(d, "ListOwnedObjects") ? "ok" : "missing",
    },
    {
      call: "LedgerService/GetTransaction",
      title: "Picks were locked before kick-off",
      value: latest
        ? (latest.minutesBefore ?? 0) >= 0
          ? <>{fmtLead(latest.minutesBefore ?? 0)} before</>
          : <>{fmtLead(-(latest.minutesBefore ?? 0))} after</>
        : locks.length
          ? "Waiting"
          : "First lock tonight",
      detail: latest
        ? <>{fmtBriefDate(latest.date)}: certified at {fmtTime(latest.certifiedAt!, tz)} your time. {before} of {certified.length} certified before the first kick-off.</>
        : locks.length
          ? "Tonight's picks are written; the Sui certificate isn't in yet."
          : "Tonight's three picks are written to Walrus before the first game. The certificate time appears here.",
      state: called(d, "GetTransaction") && latest ? "ok" : "idle",
    },
  ];
}

/** Live panel for the "checked on Sui, through Tatum" section. Fetches /api/proof only when it nears the viewport. */
export function TatumCheck() {
  const box = useRef<HTMLDivElement>(null);
  const near = useInView(box, "600px");
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (near) setArmed(true);
  }, [near]);
  const p = useApi<ProofResponse>((s) => getProof(s), armed ? "proof" : null);

  return (
    <div ref={box} className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <p className="text-sm font-medium text-chalk">
          Live check
          {p.status === "ok" ? <span className="font-normal text-chalk-3"> · read at {fmtTime(p.data.checkedAt, visitorTz())} your time</span> : null}
        </p>
        {p.status === "ok" ? <DataSourceBadge source={p.source} updatedAt={p.data.checkedAt} /> : null}
      </div>

      {p.status === "error" ? (
        <div className="p-4"><ErrorState compact title="Couldn’t read Sui right now" detail={`${p.error.message}. Tatum or the relayer may be busy.`} onRetry={p.reload} /></div>
      ) : p.status === "ok" ? (
        <ol className="divide-y divide-[var(--line-faint)]">
          {rows(p.data, visitorTz()).map((r) => (
            <li key={r.call} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 px-5 py-4 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4">
              <StateIcon state={r.state} />
              <div className="min-w-0">
                <p className="font-medium text-chalk">{r.title}</p>
                <p className="mt-0.5 text-sm text-chalk-3">{r.detail}</p>
                <p className="mt-1.5"><span className="chip chip-id !h-[22px]" title={`Tatum gRPC · sui.rpc.v2 · ${r.call}`}>{r.call}</span></p>
              </div>
              <p className={`col-start-2 mt-2 font-display text-[1.6rem] font-extrabold leading-none sm:col-start-3 sm:mt-0 sm:text-right ${r.state === "idle" ? "text-chalk-3" : ""}`}>{r.value}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="divide-y divide-[var(--line-faint)]" role="status" aria-label="Reading Sui mainnet through Tatum">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-4 px-5 py-5">
              <Skeleton className="h-5 w-5 !rounded-full" />
              <div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64 max-w-full" /></div>
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--line)] px-5 py-4 text-xs text-chalk-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Native gRPC (<span className="chip-id">sui.rpc.v2</span>) at <span className="chip-id break-all">sui-mainnet-grpc.gateway.tatum.io</span>, plus GraphQL. Read-only, from our server.
        </p>
        <Link href="/proof" className="btn btn-quiet shrink-0 !min-h-[32px] !text-xs">
          Full proof <IconArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: Row["state"] }) {
  if (state === "ok")
    return (
      <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-[rgb(12_163_12/0.16)] text-ok sm:mt-0" role="img" aria-label="Answered in this check">
        <IconCheck size={14} />
      </span>
    );
  return (
    <span
      className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full sm:mt-0 ${state === "missing" ? "text-warn" : "text-chalk-4"}`}
      style={{ boxShadow: "inset 0 0 0 1.5px currentColor" }}
      role="img"
      aria-label={state === "missing" ? "Not answered in this check" : "Nothing to check yet"}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}
