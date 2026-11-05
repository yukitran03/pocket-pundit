// One scheduler pass: settle memory writes, send due briefs, settle finished matches, write daily lessons.
// Safe to run often and concurrently (lease), from Vercel cron, GitHub Actions, or the local runner.
import { q, withLease } from "./db.ts";
import { processMemoryQueue } from "./memory.ts";
import { matchState, timeline } from "./feed.ts";
import { computeDrama } from "./drama.ts";
import { alertKeyboard, askText, edit, ratingKeyboard, resultText, reveal, send, sendBrief, tg } from "./telegram.ts";
import { dueReminders, liveAlertsFor, liveNow } from "./extras.ts";
import { fmtLocalTime } from "./util.ts";
import { localParts, localToUtc, walruscan } from "./util.ts";
import { enqueueMemory } from "./memory.ts";
import { buildTaste, lessonMemory, parseMemory, humanKey } from "./taste.ts";
import type { UserRow } from "./picker.ts";
import { KNOWN_COMPS } from "./views.ts";
import { lockLine } from "./lock.ts";
import { stillOwned } from "./own.ts";
import { tonightView } from "./tonight.ts";
import { coverageMap } from "./coverage.ts";

export interface TickReport {
  memory: { submitted: number; stored: number; failed: number };
  briefs: number;
  settled: number;
  asked: number;
  lessons: number;
  reminders: number;
  alerts: number;
  /** When the next pass has work (ISO), or null when nothing is due; the heartbeat paces itself on this. */
  next: string | null;
  errors: string[];
  ms: number;
}

/**
 * When the scheduler next has work, in ms: `now` while anything is in motion (memory writes settling, a match to
 * settle, a user inside their alert window), otherwise the earliest upcoming deadline (a brief, a kick-off reminder,
 * a full time, an alert window opening), or null if there is none. Lets the heartbeat sleep through quiet hours so
 * the database can scale to zero.
 */
export async function nextWorkAt(now: Date, live = true): Promise<number | null> {
  const t = now.getTime();
  const iso = now.toISOString();
  const [busy] = await q<any>(
    `select (select count(*)::int from memory_jobs where (status = 'queued' and attempts < 6) or status = 'pending') as mem,
            (select count(*)::int from picks where kickoff < $1::timestamptz - interval '110 minutes' and kickoff > $1::timestamptz - interval '4 days'
               and (settled_at is null or (status = 'finished' and asked_at is null and rating is null))) as settle`,
    [iso],
  );
  if (busy?.mem || busy?.settle) return t;
  const marks: number[] = [];
  const picks = await q<any>(`select kickoff, reminded_at, rating from picks where settled_at is null and kickoff >= $1::timestamptz - interval '110 minutes'`, [iso]);
  for (const p of picks) {
    const k = Date.parse(p.kickoff);
    if (!p.reminded_at && !p.rating && k > t) marks.push(k - 33 * 60_000);
    marks.push(k + 110 * 60_000);
  }
  const users = await q<any>(`select tz, brief_hour, window_start, window_end, alerts, last_brief_date from users where active and onboard_step = 'done'`);
  for (const u of users) {
    const lp = localParts(now, u.tz);
    const tomorrow = localParts(new Date(t + 86_400_000), u.tz).date;
    marks.push(localToUtc(u.last_brief_date === lp.date ? tomorrow : lp.date, u.brief_hour, u.tz).getTime());
    if (!u.alerts) continue;
    // Same window as liveAlertsFor: an hour before the window opens until it closes (it may run past midnight).
    const start = localToUtc(lp.date, u.window_start - 1, u.tz).getTime();
    const end = localToUtc(lp.date, u.window_end <= u.window_start ? u.window_end + 24 : u.window_end, u.tz).getTime();
    const inside = (t >= start && t <= end) || (t >= start - 86_400_000 && t <= end - 86_400_000);
    if (inside && live) return t;
    marks.push(start > t ? start : start + 86_400_000);
  }
  return marks.length ? Math.max(t, Math.min(...marks)) : null;
}

export async function tick(now = new Date()): Promise<TickReport | null> {
  return withLease("tick", 280, async () => {
    const t0 = Date.now();
    const errors: string[] = [];
    // `next` defaults to now (keep the 5-minute pace) in case planning fails.
    const rep: TickReport = { memory: { submitted: 0, stored: 0, failed: 0 }, briefs: 0, settled: 0, asked: 0, lessons: 0, reminders: 0, alerts: 0, next: now.toISOString(), errors, ms: 0 };
    let liveCount = 1; // assume matches are live unless the feed says otherwise
    const guard = async (label: string, fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (e: any) {
        errors.push(`${label}: ${String(e?.message || e).slice(0, 200)}`);
      }
    };

    await guard("memory", async () => {
      const m = await processMemoryQueue();
      rep.memory = { submitted: m.submitted, stored: m.stored.length, failed: m.failed };
      // Notify from the table, not from this pass: a job may have been settled by the webhook's own queue run.
      const due = await q<any>(
        `select id, notify_chat, notify_message, blob_id from memory_jobs
         where status = 'stored' and notify_chat is not null and notify_message is not null and notified_at is null
           and updated_at > now() - interval '2 hours' order by id limit 20`,
      );
      for (const s of due) {
        await notifyStored(Number(s.notify_chat), Number(s.notify_message), s.blob_id).catch(() => {});
        await q(`update memory_jobs set notified_at = now() where id = $1`, [s.id]);
      }
    });

    await guard("briefs", async () => {
      const users = await q<any>(`select * from users where active and onboard_step = 'done'`);
      for (const raw of users) {
        const u: UserRow = { ...raw, id: Number(raw.id), chat_id: Number(raw.chat_id) };
        const lp = localParts(now, u.tz);
        if (lp.hour < u.brief_hour || raw.last_brief_date === lp.date) continue;
        await guard(`brief ${u.id}`, async () => {
          if (raw.memwal_account && (await stillOwned(u.id)) === "revoked") {
            await send(u.chat_id, "🔑 Pocket Pundit's key is no longer on your Walrus Memory account, so I've stopped writing there. New memories go to Pocket Pundit's shared account again; /own to reconnect.");
          }
          await sendBrief(u, now);
          rep.briefs++;
        });
      }
      // Get tonight's brief locks onto Walrus right away rather than on the next tick.
      if (rep.briefs) {
        const m = await processMemoryQueue(6);
        rep.memory.submitted += m.submitted;
      }
    });

    await guard("settle", async () => {
      // Unsettled picks past full time, plus settled ones whose ask never went out. A pick is marked settled in the
      // same write that records the ask, after Telegram accepted it, so a failed send is retried on the next pass.
      const due = await q<any>(
        `select p.*, u.chat_id, u.show_scores from picks p join users u on u.id = p.user_id
         where p.kickoff < now() - interval '110 minutes' and p.kickoff > now() - interval '4 days'
           and (p.settled_at is null or (p.status = 'finished' and p.asked_at is null and p.rating is null))
         order by p.kickoff asc limit 12`,
      );
      const asked = async (p: any, msg: any) =>
        q(`update picks set status='finished', settled_at=coalesce(settled_at, now()), asked_at=now(), ask_message_id=$2 where id=$1`, [p.id, msg.message_id]);
      for (const p of due) {
        await guard(`settle ${p.id}`, async () => {
          if (p.settled_at) {
            await asked(p, await send(Number(p.chat_id), askText(p, !!p.show_scores), ratingKeyboard(p.id)));
            rep.asked++;
            return;
          }
          const st = await matchState(p.match_id);
          const kickMs = Date.parse(p.kickoff);
          const hasResult = !!st && st.status === 0 && st.homeScore !== null && st.awayScore !== null;
          // Some competitions never get a result in the feed. Ask anyway once the match must be over, so the
          // rating (and what it teaches) isn't lost; there is just no score or drama to attach.
          const noResult = !hasResult && ((!!st && (st.status === 1 || st.status === 0) && kickMs < now.getTime() - 150 * 60_000) || (!st && kickMs < now.getTime() - 6 * 3600_000));
          if (noResult) {
            await asked(p, await send(Number(p.chat_id), askText({ ...p, home_score: null, away_score: null, drama: null }, false), ratingKeyboard(p.id)));
            rep.settled++;
            rep.asked++;
            return;
          }
          if (!st) return;
          if (hasResult) {
            const ev = await timeline(p.match_id);
            const drama = computeDrama(ev, st.homeScore, st.awayScore);
            const fresh = { ...p, home_score: st.homeScore, away_score: st.awayScore, drama };
            const msg = await send(Number(p.chat_id), askText(fresh, !!p.show_scores), ratingKeyboard(p.id));
            await q(`update picks set status='finished', home_score=$3, away_score=$4, drama=$5::jsonb, settled_at=now(), asked_at=now(), ask_message_id=$2 where id=$1`, [
              p.id,
              msg.message_id,
              st.homeScore,
              st.awayScore,
              JSON.stringify(drama),
            ]);
            rep.settled++;
            rep.asked++;
          } else if (st.status !== 1 && st.status !== 3 && Date.parse(p.kickoff) < now.getTime() - 6 * 3600_000) {
            await q(`update picks set status='void', settled_at=now() where id=$1`, [p.id]);
          }
        });
      }
    });

    await guard("reminders", async () => {
      for (const p of await dueReminders()) {
        const mins = Math.max(1, Math.round((Date.parse(p.kickoff) - now.getTime()) / 60_000));
        await send(Number(p.chat_id), `⏰ Kicks off in ${mins} min (${fmtLocalTime(new Date(p.kickoff).toISOString(), p.tz)}): <b>${escHtml(p.home)} v ${escHtml(p.away)}</b> · ${escHtml(p.competition)}`);
        await q(`update picks set reminded_at = now() where id = $1`, [p.id]);
        rep.reminders++;
      }
    });

    await guard("alerts", async () => {
      const live = await liveNow();
      liveCount = live.length;
      if (!live.length) return;
      const users = await q<any>(`select * from users where active and onboard_step = 'done' and alerts`);
      for (const u of users) {
        await guard(`alerts ${u.id}`, async () => {
          for (const a of await liveAlertsFor({ ...u, id: Number(u.id) }, now, live)) {
            const score = u.show_scores ? ` ${a.f.homeScore ?? 0}–${a.f.awayScore ?? 0} ` : " v ";
            const text = `🔥 <b>Worth switching on</b> · ${Math.round(a.f.minute)}'
<b>${escHtml(a.f.home)}${score}${escHtml(a.f.away)}</b> · ${escHtml(a.f.competition)}
${escHtml(a.why)}${u.show_scores ? "" : " (Score hidden.)"}`;
            const inserted = await q(
              `insert into alerts (user_id, match_id, kind, competition, home, away, comp_id, minute, home_score, away_score, signals) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) on conflict do nothing returning match_id`,
              [u.id, a.f.matchId, a.kind, a.f.competition, a.f.home, a.f.away, a.f.compId, a.f.minute, a.f.homeScore, a.f.awayScore, JSON.stringify(a.signals)],
            );
            if (!inserted.length) continue;
            const msg = await send(Number(u.chat_id), text, alertKeyboard(a.f.matchId));
            await q(`update alerts set message_id = $3 where user_id = $1 and match_id = $2`, [u.id, a.f.matchId, msg.message_id]);
            rep.alerts++;
          }
        });
      }
    });

    await guard("lessons", async () => {
      const users = await q<any>(`select * from users where active and onboard_step = 'done'`);
      for (const u of users) {
        const lp = localParts(now, u.tz);
        if (lp.hour < 12 || u.last_lesson_date === lp.date) continue;
        const fresh = await q(`select count(*)::int as n from picks where user_id = $1 and rated_at > coalesce((select max(created_at) from memory_jobs where user_id = $1 and kind = 'lesson'), 'epoch'::timestamptz)`, [u.id]);
        if (!fresh[0]?.n) continue;
        await guard(`lesson ${u.id}`, async () => {
          const text = await composeLesson(Number(u.id), lp.date);
          if (text) {
            await enqueueMemory({ userId: Number(u.id), namespace: u.namespace, kind: "lesson", text, idem: `lesson:${u.id}:${lp.date}` });
            rep.lessons++;
          }
          await q(`update users set last_lesson_date = $2 where id = $1`, [u.id, lp.date]);
        });
      }
    });

    // Keep the public Tonight board warm so the landing page never waits on a cold ranking.
    await guard("tonight", async () => {
      await tonightView("UTC", now);
      await coverageMap(now); // which competitions the feed settles; used by tomorrow's briefs
    });

    await guard("plan", async () => {
      const at = await nextWorkAt(now, liveCount > 0);
      rep.next = at == null ? null : new Date(at).toISOString();
    });

    rep.ms = Date.now() - t0;
    return rep;
  });
}

async function notifyStored(chatId: number, messageId: number, blobId: string) {
  // Re-render the rating/teach message with the stored proof appended.
  const short = `${blobId.slice(0, 6)}…${blobId.slice(-4)}`;
  const job = await q<any>(`select p.* from picks p where p.ask_message_id = $1 limit 1`, [messageId]);
  if (job[0]) {
    const p = job[0];
    const lock = await lockLine(p).catch(() => "");
    await edit(chatId, messageId, `${resultText(p)}\n\nYou: <b>${p.rating}</b> · ✅ stored on Walrus · <a href="${walruscan(blobId)}">${short}</a>\n${reveal(p)}${lock ? `\n<blockquote expandable>${lock}</blockquote>` : ""}`);
  } else {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `✅ Stored on Walrus · <a href="${walruscan(blobId)}">${short}</a>`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
    });
  }
}

/** A narrative lesson from the user's stored memories + A/B so far (recorded on Walrus, shown on the dashboard). */
export async function composeLesson(userId: number, date: string): Promise<string | null> {
  const rows = await q<any>(`select blob_id, text from memory_jobs where user_id = $1 and status = 'stored' and not archived and kind in ('rating','preference','limit') order by id`, [userId]);
  if (!rows.length) return null;
  const taste = buildTaste(rows.map((r) => parseMemory(r.blob_id, r.text)), date);
  const top = [...taste.weights.entries()].filter(([k]) => !k.startsWith("team:")).sort((a, b) => b[1].w - a[1].w);
  const pulls = top.filter(([, v]) => v.w > 0.1).slice(0, 2).map(([k]) => labelFor(k));
  const pushes = top.filter(([, v]) => v.w < -0.1).slice(-2).map(([k]) => labelFor(k));
  const ab = await q<any>(
    `select arm, count(*)::int n, avg(case rating when 'loved' then 2 when 'fine' then 1 when 'bailed' then 0 end)::float s
     from picks where user_id = $1 and rating is not null and rating <> 'skipped' group by arm`,
    [userId],
  );
  const arm = (a: string) => ab.find((x) => x.arm === a);
  const m = arm("memory");
  const c = arm("control");
  // Written for people (it's shown on the dashboard and the landing feed); lessons carry no weight tags.
  const ratings = (x: any) => `${x.n} rating${x.n === 1 ? "" : "s"}`;
  const abText = m && c ? ` So far memory picks rate ${Number(m.s).toFixed(1)} out of 2 and memory-off picks ${Number(c.s).toFixed(1)} (${ratings(m)} vs ${ratings(c)}).` : "";
  const lean = pulls.length ? ` you lean towards ${pulls.join(" and ")}` : "";
  const away = pushes.length ? `${lean ? "," : ""} you're cooler on ${pushes.join(" and ")}` : "";
  return lessonMemory(date, `After ${rows.length} memories${lean || away ? ":" : "."}${lean}${away}${lean || away ? "." : ""}${abText}`);
}

function labelFor(k: string) {
  if (k.startsWith("comp:")) return KNOWN_COMPS[k.slice(5)] ?? "one competition";
  return humanKey(k).toLowerCase();
}

function escHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
