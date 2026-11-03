"use client";

import { useState } from "react";
import type { ProofResponse } from "@/lib/contract";
import { getProof } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { suiscanAccount, suiscanObject, walruscanBlob } from "@/lib/client/chain";
import { fmtBriefDate, fmtBytes, fmtInt, fmtLead, fmtTime, shortId, visitorTz } from "@/lib/client/format";
import { DataSourceBadge, EmptyState, ErrorState, Skeleton } from "@/components/site/States";
import { IconCheck, IconExternal, IconLock, IconRefresh } from "@/components/site/Icons";
import { TechDetails } from "./TechDetails";

export function ProofView() {
  const p = useApi<ProofResponse>((s) => getProof(s), "proof");

  if (p.status === "error") return <ErrorState title="Couldn’t read the chain right now" detail={`${p.error.message}. The Tatum gateway or the relayer may be busy. Try again in a moment.`} onRetry={p.reload} />;
  if (p.status === "loading") return <ProofSkeleton />;

  const d = p.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-xs text-chalk-3">
          <span className="chip !text-chalk-2">Sui {d.network}</span>
          <span>Checked at <time dateTime={d.checkedAt}>{fmtTime(d.checkedAt, visitorTz())}</time> your time</span>
          <DataSourceBadge source={p.source} />
        </p>
        <button type="button" onClick={p.reload} className="btn btn-ghost !min-h-[38px]">
          <IconRefresh size={16} /> Re-check now
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <AccountCard d={d} />
        <ChainCard d={d} />
      </div>
      <Reconcile d={d} />
      <Locks d={d} />
      <BlobTable d={d} />
    </div>
  );
}

function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet !min-h-[28px] !px-2 !text-xs"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? <IconCheck size={14} /> : "Copy"}
    </button>
  );
}

function IdLine({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <dt className="text-sm text-chalk-2">{label}</dt>
      <dd className="flex items-center gap-1">
        <a href={href} target="_blank" rel="noopener noreferrer" className="chip chip-id" title={value} aria-label={`${label} ${value}, open on Suiscan`}>
          {shortId(value, 8, 6)} <IconExternal size={11} />
        </a>
        <Copy value={value} label={label} />
      </dd>
    </div>
  );
}

function AccountCard({ d }: { d: ProofResponse }) {
  const a = d.account;
  return (
    <section className="card p-5 md:p-6 lg:col-span-7" aria-labelledby="acct-h">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="micro">MemWal account object</p>
          <h2 id="acct-h" className="mt-1 text-xl font-semibold">Who owns the memories</h2>
        </div>
        {a ? (
          <span className="chip" style={{ color: a.active ? "var(--ok)" : "var(--bad)", boxShadow: `inset 0 0 0 1px ${a.active ? "rgb(12 163 12 / .45)" : "rgb(208 59 59 / .45)"}` }}>
            {a.active ? <IconCheck size={12} /> : null}
            <span className="text-chalk-2">{a.active ? "Active" : "Inactive"}</span>
          </span>
        ) : null}
      </div>
      {!a ? (
        <div className="mt-5"><EmptyState title="Account object not found">Tatum returned no MemWalAccount for the configured ID. We show this as it is instead of hiding it.</EmptyState></div>
      ) : (
        <>
          <dl className="mt-5 grid gap-4">
            <IdLine label="Account object ID" value={a.id} href={d.links.account || suiscanObject(a.id)} />
            <IdLine label="Owner address" value={a.owner} href={d.links.owner || suiscanAccount(a.owner)} />
          </dl>
          <h3 className="micro mt-6">Delegate keys ({a.delegateKeys.length})</h3>
          {a.delegateKeys.length ? (
            <ul className="mt-2 divide-y divide-[var(--line-faint)] rounded-xl bg-ink-0/50 hairline">
              {a.delegateKeys.map((k) => (
                <li key={k.suiAddress} className="grid gap-1 p-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{k.label}</p>
                    <p className="mt-0.5 truncate text-xs text-chalk-3" title={k.publicKeyHex}>Public key <span className="chip-id">{shortId(k.publicKeyHex, 8, 6)}</span></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <a href={suiscanAccount(k.suiAddress)} target="_blank" rel="noopener noreferrer" className="chip" aria-label={`Delegate address ${k.suiAddress} on Suiscan`}>
                      {shortId(k.suiAddress, 6, 4)} <IconExternal size={11} />
                    </a>
                    <span className="text-xs text-chalk-4">added {fmtBriefDate(k.createdAt.slice(0, 10))}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-chalk-3">No delegate keys registered.</p>
          )}
        </>
      )}
    </section>
  );
}

function ChainCard({ d }: { d: ProofResponse }) {
  return (
    <section className="card flex flex-col p-5 md:p-6 lg:col-span-5" aria-labelledby="chain-h">
      <p className="micro">Chain status</p>
      <h2 id="chain-h" className="mt-1 text-xl font-semibold">Read live from Sui mainnet</h2>
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--line)]">
        <div className="flex flex-col-reverse bg-ink-1 p-4">
          <dt className="mt-1 text-xs text-chalk-3">Sui epoch</dt>
          <dd className="font-display text-4xl font-extrabold leading-none">{d.chain.epoch ?? <span className="text-chalk-4">–</span>}</dd>
        </div>
        <div className="flex flex-col-reverse bg-ink-1 p-4">
          <dt className="mt-1 text-xs text-chalk-3">Checkpoint</dt>
          <dd className="mono text-lg font-semibold leading-tight text-chalk tnum">{d.chain.checkpoint ? fmtInt(Number(d.chain.checkpoint)) : <span className="text-chalk-4">–</span>}</dd>
        </div>
      </dl>
      <p className="mt-5 flex items-center gap-2.5 text-sm text-chalk-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/tatum-on-dark.svg" alt="Tatum" width={73} height={18} className="block h-[18px] w-auto" />
        Read live from Sui through Tatum. Nothing here comes from our own database.
      </p>
      <TechDetails via={d.chain.via} open className="mt-4 border-t border-[var(--line-faint)] pt-3" />
    </section>
  );
}

function Reconcile({ d }: { d: ProofResponse }) {
  const { matched, missing } = d.verified;
  const total = matched + missing;
  const share = total ? matched / total : 0;
  return (
    <section className="card p-5 md:p-6" aria-labelledby="rec-h">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="micro">Reconciliation</p>
          <h2 id="rec-h" className="mt-1 text-xl font-semibold">Relayer memories vs Walrus Blob objects on Sui</h2>
        </div>
        <p className="text-sm text-chalk-3">{fmtInt(d.relayer.namespaces)} user namespaces</p>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--line)] md:grid-cols-4">
        {[
          ["Blob objects on-chain", d.blobs.onChainCount, "Owned by the account owner, read via Tatum"],
          ["Memories on the relayer", d.relayer.memories, "What the agent thinks it stored"],
          ["Matched", matched, "Relayer memory has a Blob object"],
          ["Missing", missing, missing ? "Usually writes still pending certification" : "Nothing missing"],
        ].map(([l, v, n]) => (
          <div key={l as string} className="flex flex-col bg-ink-1 p-4">
            <dt className="text-sm text-chalk-2">{l as string}</dt>
            <dd className="order-first mb-3 font-display text-[2.6rem] font-extrabold leading-none" style={l === "Missing" && missing ? { color: "var(--warn)" } : undefined}>{fmtInt(v as number)}</dd>
            <dd className="mt-1 text-xs text-chalk-3">{n as string}</dd>
          </div>
        ))}
      </dl>
      {total ? (
        <div className="mt-5">
          <div
            className="flex h-7 w-full gap-[2px] overflow-hidden rounded-[4px]"
            role="img"
            aria-label={`${matched} of ${total} relayer memories matched on-chain (${(share * 100).toFixed(1)}%), ${missing} missing`}
          >
            <div className="flex items-center rounded-[4px] bg-ok px-2.5 text-xs font-semibold text-[#03150a]" style={{ width: `${share * 100}%` }} title={`Matched: ${matched}`}>
              {share > 0.15 ? `${(share * 100).toFixed(1)}% matched` : ""}
            </div>
            {missing ? <div className="rounded-[4px] bg-warn" style={{ width: `${(1 - share) * 100}%`, minWidth: 4 }} title={`Missing: ${missing}`} /> : null}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-chalk-2" aria-label="Legend">
            <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-ok" /> Matched ({fmtInt(matched)})</li>
            <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-warn" /> Missing ({fmtInt(missing)})</li>
          </ul>
        </div>
      ) : (
        <p className="mt-5 text-sm text-chalk-3">No relayer memories to reconcile yet.</p>
      )}
    </section>
  );
}

/** Brief locks: each evening's picks, written to Walrus before the first kick-off. Optional in the API. */
function Locks({ d }: { d: ProofResponse }) {
  const locks = d.locks;
  if (!locks?.length) return null;
  const tz = visitorTz();
  return (
    <section className="card p-5 md:p-6" aria-labelledby="locks-h">
      <p className="micro">Locked briefs</p>
      <h2 id="locks-h" className="mt-1 text-xl font-semibold">Picks written down before kick-off</h2>
      <p className="mt-1 max-w-2xl text-sm text-chalk-3">Every evening&rsquo;s three picks are stored on Walrus before the first game starts, so nobody can change them after the fact. Which pick ran with memory off is sealed as a hash.</p>
      <ul className="mt-5 divide-y divide-[var(--line-faint)] rounded-xl bg-ink-0/50 hairline">
        {locks.map((l) => (
          <li key={l.blobId} className="grid gap-2 p-3.5 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <span className="text-sm font-medium text-chalk">{fmtBriefDate(l.date)}</span>
            <span className="flex min-w-0 items-start gap-2 text-sm text-chalk-2">
              <IconLock size={14} className="mt-[3px] shrink-0 text-flare" />
              <span>
                {l.minutesBefore !== null ? `Locked ${fmtLead(l.minutesBefore)} before first kick-off` : "Locked before kick-off"}
                <span className="text-chalk-3"> · {l.certifiedAt ? `certified on Sui at ${fmtTime(l.certifiedAt, tz)} your time (via Tatum)` : "Sui certificate pending"}</span>
              </span>
            </span>
            <span className="flex flex-wrap gap-1.5 sm:justify-end">
              <a href={walruscanBlob(l.blobId)} target="_blank" rel="noopener noreferrer" className="chip chip-id" title={l.blobId} aria-label={`Locked brief blob ${l.blobId} on Walruscan`}>
                {shortId(l.blobId, 5, 4)} <IconExternal size={11} />
              </a>
              {l.objectId ? (
                <a href={suiscanObject(l.objectId)} target="_blank" rel="noopener noreferrer" className="chip" aria-label={`Sui object ${l.objectId} on Suiscan`}>
                  Suiscan <IconExternal size={11} />
                </a>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlobTable({ d }: { d: ProofResponse }) {
  const rows = d.blobs.sample;
  return (
    <section className="card overflow-hidden" aria-labelledby="blobs-h">
      <div className="p-5 md:p-6">
        <p className="micro">Sample</p>
        <h2 id="blobs-h" className="mt-1 text-xl font-semibold">Walrus Blob objects</h2>
        <p className="mt-1 text-sm text-chalk-3">Every row is a Sui object you can open on Suiscan, wrapping a blob you can open on Walruscan.</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 pb-6"><EmptyState title="No Blob objects returned">The owner holds no Walrus Blob objects yet, or the gateway returned none.</EmptyState></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table min-w-[680px]">
            <caption className="sr-only">Sample of Walrus Blob objects owned by the account owner</caption>
            <thead>
              <tr>
                <th scope="col">Sui object</th>
                <th scope="col">Blob ID</th>
                <th scope="col">Namespace</th>
                <th scope="col" className="num">Size</th>
                <th scope="col" className="num">Stored until epoch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.objectId}>
                  <td>
                    <a className="mono link inline-flex items-center gap-1 text-xs !text-chalk-2" href={suiscanObject(b.objectId)} target="_blank" rel="noopener noreferrer" aria-label={`Object ${b.objectId} on Suiscan`}>
                      {shortId(b.objectId, 8, 6)} <IconExternal size={11} />
                    </a>
                  </td>
                  <td>
                    <a className="mono link inline-flex items-center gap-1 text-xs !text-chalk-2" href={walruscanBlob(b.blobId)} target="_blank" rel="noopener noreferrer" aria-label={`Blob ${b.blobId} on Walruscan`}>
                      {shortId(b.blobId, 10, 6)} <IconExternal size={11} />
                    </a>
                  </td>
                  <td className="mono text-xs text-chalk-3">{b.namespace ?? <span className="text-chalk-4">not tagged</span>}</td>
                  <td className="num text-xs">{fmtBytes(b.size)}</td>
                  <td className="num mono text-xs">{b.endEpoch ?? "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProofSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Reading Sui mainnet via Tatum">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-5 lg:grid-cols-12">
        <Skeleton className="h-[340px] !rounded-[var(--radius-card)] lg:col-span-7" />
        <Skeleton className="h-[340px] !rounded-[var(--radius-card)] lg:col-span-5" />
      </div>
      <Skeleton className="h-[260px] !rounded-[var(--radius-card)]" />
      <span className="sr-only">Reading Sui mainnet via Tatum…</span>
    </div>
  );
}
