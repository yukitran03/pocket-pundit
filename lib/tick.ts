// One scheduler pass: settle memory writes, send due briefs, settle finished matches, write daily lessons.
// Safe to run often and concurrently (lease), from Vercel cron, GitHub Actions, or the local runner.
import { q, withLease } from "./db.ts";
import { processMemoryQueue } from "./memory.ts";
import { matchState, timeline } from "./feed.ts";
import { computeDrama } from "./drama.ts";
import { askText, edit, ratingKeyboard, reveal, send, sendBrief, tg } from "./telegram.ts";
import { localParts, walruscan } from "./util.ts";
import { enqueueMemory } from "./memory.ts";
import { buildTaste, lessonMemory, parseMemory, humanKey } from "./taste.ts";
import type { UserRow } from "./picker.ts";
import { KNOWN_COMPS } from "./views.ts";

export interface TickReport {
  memory: { submitted: number; stored: number; failed: number };
  briefs: number;
  settled: number;
  asked: number;
  lessons: number;
  errors: string[];
  ms: number;
}

export async function tick(now = new Date()): Promise<TickReport | null> {
  return withLease("tick", 280, async () => {
    const t0 = Date.now();
    const errors: string[] = [];
    const rep: TickReport = { memory: { submitted: 0, stored: 0, failed: 0 }, briefs: 0, settled: 0, asked: 0, lessons: 0, errors, ms: 0 };
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
      for (const s of m.stored) {
        if (!s.notifyChat || !s.notifyMessage) continue;
        await notifyStored(s.notifyChat, s.notifyMessage, s.blobId).catch(() => {});
      }
    });

    await guard("briefs", async () => {
      const users = await q<any>(`select * from users where active and onboard_step = 'done'`);
      for (const raw of users) {
        const u: UserRow = { ...raw, id: Number(raw.id), chat_id: Number(raw.chat_id) };
        const lp = localParts(now, u.tz);
        if (lp.hour < u.brief_hour || raw.last_brief_date === lp.date) continue;
        await guard(`brief ${u.id}`, async () => {
          await sendBrief(u, now);
          rep.briefs++;
        });
      }
    });

    await guard("settle", async () => {
      const due = await q<any>(
        `select p.*, u.chat_id from picks p join users u on u.id = p.user_id
         where p.settled_at is null and p.kickoff < now() - interval '110 minutes' and p.kickoff > now() - interval '4 days'
         order by p.kickoff asc limit 12`,
      );
      for (const p of due) {
        await guard(`settle ${p.id}`, async () => {
          const st = await matchState(p.match_id);
          if (!st) return;
          if (st.status === 0) {
            const ev = await timeline(p.match_id);
            const drama = computeDrama(ev, st.homeScore, st.awayScore);
            await q(`update picks set status='finished', home_score=$2, away_score=$3, drama=$4::jsonb, settled_at=now() where id=$1`, [p.id, st.homeScore, st.awayScore, JSON.stringify(drama)]);
            rep.settled++;
            const fresh = { ...p, home_score: st.homeScore, away_score: st.awayScore, drama };
            const msg = await send(Number(p.chat_id), askText(fresh), ratingKeyboard(p.id));
            await q(`update picks set asked_at=now(), ask_message_id=$2 where id=$1`, [p.id, msg.message_id]);
            rep.asked++;
          } else if (st.status !== 1 && st.status !== 3 && Date.parse(p.kickoff) < now.getTime() - 6 * 3600_000) {
            await q(`update picks set status='void', settled_at=now() where id=$1`, [p.id]);
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
    await edit(chatId, messageId, `${askText(p).replace("\n\nDid you watch it?", "")}\n\nYou: <b>${p.rating}</b> · ✅ stored on Walrus · <a href="${walruscan(blobId)}">${short}</a>
${reveal(p)}`);
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
  const rows = await q<any>(`select blob_id, text from memory_jobs where user_id = $1 and status = 'stored' and kind in ('rating','preference','limit') order by id`, [userId]);
  if (!rows.length) return null;
  const taste = buildTaste(rows.map((r) => parseMemory(r.blob_id, r.text)), date);
  const top = [...taste.weights.entries()].filter(([k]) => !k.startsWith("team:")).sort((a, b) => b[1].w - a[1].w);
  const pulls = top.filter(([, v]) => v.w > 0.1).slice(0, 2).map(([k, v]) => `${labelFor(k)} (${v.w >= 0 ? "+" : ""}${v.w.toFixed(2)})`);
  const pushes = top.filter(([, v]) => v.w < -0.1).slice(-2).map(([k, v]) => `${labelFor(k)} (${v.w.toFixed(2)})`);
  const ab = await q<any>(
    `select arm, count(*)::int n, avg(case rating when 'loved' then 2 when 'fine' then 1 when 'bailed' then 0 end)::float s
     from picks where user_id = $1 and rating is not null and rating <> 'skipped' group by arm`,
    [userId],
  );
  const arm = (a: string) => ab.find((x) => x.arm === a);
  const m = arm("memory");
  const c = arm("control");
  const abText = m && c ? ` Memory picks average ${Number(m.s).toFixed(2)} vs ${Number(c.s).toFixed(2)} for memory-off picks (n=${m.n}/${c.n}; loved=2, fine=1, bailed=0).` : "";
  return lessonMemory(date, `After ${rows.length} memories:${pulls.length ? ` strongest pulls are ${pulls.join(" and ")}.` : ""}${pushes.length ? ` Strongest pushes away: ${pushes.join(" and ")}.` : ""}${abText}`.replace(/:\s*$/, "."));
}

function labelFor(k: string) {
  if (k.startsWith("comp:")) return KNOWN_COMPS[k.slice(5)] ?? "one competition";
  return humanKey(k).toLowerCase();
}
