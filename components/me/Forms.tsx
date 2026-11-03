"use client";

import { useEffect, useMemo, useState } from "react";
import type { MeResponse, MemoryRow } from "@/lib/contract";
import { addMemory, saveSettings } from "@/lib/client/api";
import { fmtHour, shortId } from "@/lib/client/format";
import { IconCheck, IconAlert } from "@/components/site/Icons";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; msg: string } | { kind: "error"; msg: string };

function StatusLine({ s }: { s: Status }) {
  if (s.kind === "ok") return <p role="status" className="flex items-center gap-2 text-sm text-ok"><IconCheck size={16} /> <span className="text-chalk-2">{s.msg}</span></p>;
  if (s.kind === "error") return <p role="alert" className="flex items-center gap-2 text-sm text-bad"><IconAlert size={16} /> <span className="text-chalk-2">{s.msg}</span></p>;
  return <p aria-hidden className="text-sm">&nbsp;</p>;
}

export function TeachForm({ token, memories, onAdded }: { token: string; memories: MemoryRow[]; onAdded: (m: MemoryRow) => void }) {
  const [text, setText] = useState("");
  const [supersedes, setSupersedes] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const correctable = useMemo(() => memories.filter((m) => m.blobId && m.status === "stored" && m.kind !== "system"), [memories]);
  const max = 280;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t.length < 4) {
      setStatus({ kind: "error", msg: "Write a few words. For example: “I don’t mind 0–0s if both teams attack.”" });
      return;
    }
    setStatus({ kind: "busy" });
    try {
      const r = await addMemory(token, { text: t, ...(supersedes ? { supersedes } : {}) });
      onAdded(r.data);
      setText("");
      setSupersedes("");
      setStatus({ kind: "ok", msg: supersedes ? "Correction queued. Recall will prefer it over the original from the next brief." : "Queued. It will be encrypted and stored on Walrus in a minute or so." });
    } catch (err) {
      setStatus({ kind: "error", msg: (err as Error).message || "Couldn’t save that. Try again." });
    }
  };

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-5 md:p-6" aria-labelledby="teach-title">
      <div>
        <h3 id="teach-title" className="text-lg font-semibold">Teach it something</h3>
        <p className="mt-1 text-sm text-chalk-3">Add a preference in your own words, or correct a memory that’s wrong.</p>
      </div>
      <div>
        <label htmlFor="teach-text" className="label">Preference</label>
        <textarea
          id="teach-text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, max))}
          rows={3}
          className="field resize-y"
          placeholder="e.g. Weekend afternoons I’ll happily watch the women’s game."
          aria-describedby="teach-count"
        />
        <p id="teach-count" className="mono mt-1 text-right text-[0.7rem] text-chalk-4">{text.length}/{max}</p>
      </div>
      <div>
        <label htmlFor="teach-sup" className="label">Corrects (optional)</label>
        <select id="teach-sup" value={supersedes} onChange={(e) => setSupersedes(e.target.value)} className="field">
          <option value="">Nothing, this is a new memory</option>
          {correctable.map((m) => (
            <option key={m.blobId!} value={m.blobId!}>
              {m.text.length > 70 ? `${m.text.slice(0, 68)}…` : m.text} ({shortId(m.blobId!, 4, 3)})
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-chalk-3">The original stays on Walrus; the new memory supersedes it, so history stays auditable.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusLine s={status} />
        <button type="submit" className="btn btn-primary" disabled={status.kind === "busy"}>
          {status.kind === "busy" ? "Saving…" : supersedes ? "Save correction" : "Save memory"}
        </button>
      </div>
    </form>
  );
}

const FALLBACK_TZ = ["UTC", "Europe/London", "Europe/Madrid", "Europe/Berlin", "Africa/Lagos", "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Ho_Chi_Minh", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "America/Sao_Paulo", "America/New_York", "America/Los_Angeles"];

export function SettingsForm({ token, user, onSaved }: { token: string; user: MeResponse["user"]; onSaved: (u: Partial<MeResponse["user"]>) => void }) {
  const [tz, setTz] = useState(user.tz);
  const [briefHour, setBriefHour] = useState(user.briefHour);
  const [ws, setWs] = useState(user.windowStart);
  const [we, setWe] = useState(user.windowEnd);
  const [zones, setZones] = useState<string[]>(FALLBACK_TZ);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    try {
      const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
      if (list?.length) setZones(list.includes(user.tz) ? list : [user.tz, ...list]);
    } catch {
      /* keep fallback */
    }
  }, [user.tz]);

  const endOptions = Array.from({ length: 12 }, (_, i) => ws + 2 + i).filter((h) => h <= 30);
  const dirty = tz !== user.tz || briefHour !== user.briefHour || ws !== user.windowStart || we !== user.windowEnd;
  const invalid = we <= ws;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setStatus({ kind: "busy" });
    try {
      const body = { tz, briefHour, windowStart: ws, windowEnd: we };
      await saveSettings(token, body);
      onSaved(body);
      setStatus({ kind: "ok", msg: "Saved. Your next brief uses these settings." });
    } catch (err) {
      setStatus({ kind: "error", msg: (err as Error).message || "Couldn’t save settings." });
    }
  };

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-5 md:p-6" aria-labelledby="settings-title">
      <div>
        <h3 id="settings-title" className="text-lg font-semibold">When you watch</h3>
        <p className="mt-1 text-sm text-chalk-3">Picks are scored against this window. Kickoff times show in your time zone.</p>
      </div>
      <div>
        <label htmlFor="set-tz" className="label">Time zone</label>
        <select id="set-tz" value={tz} onChange={(e) => setTz(e.target.value)} className="field">
          {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="set-brief" className="label">Brief arrives</label>
          <select id="set-brief" value={briefHour} onChange={(e) => setBriefHour(Number(e.target.value))} className="field mono">
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="set-ws" className="label">Window starts</label>
          <select
            id="set-ws"
            value={ws}
            onChange={(e) => {
              const v = Number(e.target.value);
              setWs(v);
              if (we <= v) setWe(Math.min(30, v + 4));
            }}
            className="field mono"
          >
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="set-we" className="label">Window ends</label>
          <select id="set-we" value={we} onChange={(e) => setWe(Number(e.target.value))} className="field mono" aria-invalid={invalid}>
            {!endOptions.includes(we) ? <option value={we}>{fmtHour(we)}{we >= 24 ? " +1d" : ""}</option> : null}
            {endOptions.map((h) => <option key={h} value={h}>{fmtHour(h)}{h >= 24 ? " +1d" : ""}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusLine s={invalid ? { kind: "error", msg: "The window has to end after it starts." } : status} />
        <button type="submit" className="btn btn-ghost" disabled={!dirty || invalid || status.kind === "busy"}>
          {status.kind === "busy" ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
