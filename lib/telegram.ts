// Telegram bot: onboarding, daily brief, post-match rating, teaching. Plain Bot API over fetch.
import { env } from "./env.ts";
import { q, one, cacheGet, cacheSet } from "./db.ts";
import { lockBrief, lockLine } from "./lock.ts";
import { BRAND } from "./brand.ts";
import { purposeKey } from "./auth.ts";
import { askMemory } from "./extras2.ts";
import { ownUrl } from "./own.ts";
import { duoCode, duoPick, holdInvite, pair, parseDuoCode, takeInvite, unpair, type DuoPick } from "./duo.ts";
import { enqueueMemory, namespaceFor } from "./memory.ts";
import { buildBrief, type BriefResult, type UserRow } from "./picker.ts";
import { preferenceMemory, ratingMemory, kickBucket, limitMemory, RATING_WORD } from "./taste.ts";
import { dashboardUrl } from "./auth.ts";
import { dramaSummary } from "./drama.ts";
import { localParts, fmtLocalTime, isValidTz, slug } from "./util.ts";
import type { Drama, Rating } from "./contract.ts";
import { fixturesBetween } from "./feed.ts";
import { missedLastNight } from "./extras.ts";

type Kb = { text: string; callback_data?: string; url?: string }[][];

export async function tg(method: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${env.telegramToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j: any = await r.json();
  if (!j.ok && !/message is not modified/.test(j.description || "")) throw new Error(`telegram ${method}: ${j.description}`);
  return j.result;
}

export const send = (chat_id: number, text: string, keyboard?: Kb) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined });

export const edit = (chat_id: number, message_id: number, text: string, keyboard?: Kb) =>
  tg("editMessageText", { chat_id, message_id, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

const TZ_OPTIONS: [string, string][] = [
  ["Vietnam / Thailand (UTC+7)", "Asia/Ho_Chi_Minh"],
  ["Singapore / Manila (UTC+8)", "Asia/Singapore"],
  ["Japan / Korea (UTC+9)", "Asia/Tokyo"],
  ["India (UTC+5:30)", "Asia/Kolkata"],
  ["UK / Portugal", "Europe/London"],
  ["Central Europe", "Europe/Berlin"],
  ["US East", "America/New_York"],
  ["US West", "America/Los_Angeles"],
];
const WINDOWS: [string, number, number][] = [
  ["19:00 to midnight", 19, 24],
  ["19:00 to 02:00", 19, 26],
  ["21:00 to 04:00 (night owl)", 21, 28],
  ["Any time in the next 24h", 12, 36],
];
const LEAGUES: [string, string][] = [
  ["Champions League", "2000001032"],
  ["Premier League", "2000000000"],
  ["LaLiga", "2000000037"],
  ["Serie A", "2000000026"],
  ["Bundesliga", "2000000019"],
  ["Ligue 1", "2000000018"],
  ["V.League 1", "2000000092"],
  ["Nations League", "504"],
  ["AFC Champions League", "2000001033"],
  ["MLS", "2000000103"],
];

/** How people actually name competitions in a sentence (accents stripped before matching). */
const COMP_ALIASES: Record<string, string[]> = {
  "2000001032": ["champions league", "ucl", "c1"],
  "2000000000": ["premier league", "epl", "english league", "prem"],
  "2000000037": ["laliga", "la liga", "primera division", "spanish league"],
  "2000000026": ["serie a", "italian league", "calcio"],
  "2000000019": ["bundesliga", "german league"],
  "2000000018": ["ligue 1", "french league"],
  "2000000092": ["v.league", "v league", "vleague", "vietnamese league"],
  "504": ["nations league"],
  "2000001033": ["afc champions league", "acl elite", "acle"],
  "2000000103": ["mls"],
  "2000001041": ["europa league", "uel"],
};

export async function getUser(id: number): Promise<(UserRow & { onboard_step: string; active: boolean; last_brief_date: string | null }) | null> {
  const u = await one<any>(`select * from users where id = $1`, [id]);
  return u ? { ...u, id: Number(u.id), chat_id: Number(u.chat_id) } : null;
}

async function startUser(from: any, chatId: number, payload?: string) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "there";
  await q(
    `insert into users (id, chat_id, name, username, namespace) values ($1,$2,$3,$4,$5)
     on conflict (id) do update set chat_id = excluded.chat_id, name = excluded.name, username = excluded.username, active = true`,
    [from.id, chatId, name, from.username ?? null, namespaceFor(from.id)],
  );
  const u = await getUser(from.id);
  const inviter = parseDuoCode(payload);
  const inv = inviter && inviter !== from.id ? await getUser(inviter) : null;
  if (inv && u?.onboard_step === "done") return linkDuo(u, inv);
  if (inv) await holdInvite(from.id, inv.id);
  if (u?.onboard_step === "done") return sendHelp(chatId, true);
  await q(`update users set onboard_step = 'tz' where id = $1`, [from.id]);
  await send(
    chatId,
    `<b>Hi ${esc(name)}, I'm ${BRAND.name}.</b>\nEvery evening: the 3 matches worth your time, at hours you can watch. No spoilers.\n\n⚽ Picks at the hour you choose\n⏰ A reminder before kick-off\n🔥 A ping when a game turns\n🧠 One tap after full time teaches me your taste\n\n${inv ? `👥 ${esc(String(inv.name).split(" ")[0])} invited you to watch together. After setup you'll both get one shared pick a night.\n\n` : ""}<blockquote expandable>What I learn is kept in your own memory, encrypted on Walrus and checkable on Sui mainnet. No wallet needed.</blockquote>\nFour quick taps. First, where are you?`,
    TZ_OPTIONS.map(([label, tz]) => [{ text: label, callback_data: `tz:${tz}` }]),
  );
}

async function askBriefHour(chatId: number) {
  await send(chatId, "When should I send tonight's picks?", [[16, 17, 18].map((h) => ({ text: hh(h), callback_data: `bh:${h}` })), [19, 20, 21].map((h) => ({ text: hh(h), callback_data: `bh:${h}` }))]);
}
async function askWindow(chatId: number) {
  await send(chatId, "When can you actually watch?", WINDOWS.map(([label, s, e]) => [{ text: label, callback_data: `win:${s}-${e}` }]));
}
async function leaguesKeyboard(userId: number): Promise<Kb> {
  const sel = (await cacheGet<string[]>(`onb:leagues:${userId}`)) ?? [];
  const rows: Kb = [];
  for (let i = 0; i < LEAGUES.length; i += 2) {
    rows.push(LEAGUES.slice(i, i + 2).map(([label, id]) => ({ text: `${sel.includes(id) ? "✅ " : ""}${label}`, callback_data: `lg:${id}` })));
  }
  rows.push([{ text: sel.length ? `Done (${sel.length})` : "Skip, surprise me", callback_data: "lg:done" }]);
  return rows;
}

export function briefText(user: UserRow, b: BriefResult, dayIndex: number, missed?: { home: string; away: string; competition: string; drama: number } | null, duo?: DuoPick | null): string {
  // Scannable first (what, when, why in one line each); the how-it-works detail sits in a collapsed quote.
  const lines = [`<b>⚽ Tonight's picks</b> · day ${dayIndex}`, `${b.considered} fixtures checked for ${hh(user.window_start)} to ${hh(user.window_end)}`, ""];
  for (const p of [...b.picks].sort((a, c) => a.slot - c.slot)) {
    lines.push(`<b>${p.slot} · ${esc(p.c.localKick)}  ${esc(p.c.f.home)} v ${esc(p.c.f.away)}</b>`);
    lines.push(`${esc(p.c.label)} · ${p.score}/100${p.neutral[0] ? `\n<i>${esc(p.neutral[0])}</i>` : ""}`);
    lines.push("");
  }
  if (!b.picks.length) lines.push("Nothing kicks off in your window tonight. I'll look again tomorrow.", "");
  if (duo) lines.push(`👥 Watch together with ${esc(duo.partnerName)}: <b>${esc(duo.home)} v ${esc(duo.away)}</b> · ${esc(duo.mineLocal)} (${esc(duo.theirsLocal)} for them)`);
  if (missed) lines.push(`📼 Last night's best, for the highlights: <b>${esc(missed.home)} v ${esc(missed.away)}</b> · drama ${missed.drama}`);
  if (duo || missed) lines.push("");
  const memory = b.memoriesUsed
    ? `🧠 Shaped by ${b.memoriesUsed} memories recalled from Walrus in ${(b.recallMs / 1000).toFixed(1)}s.`
    : b.recallOk
      ? "🧠 Day one: no memories yet, so these are a neutral fan's picks. Rate them after full time and I start learning."
      : "⚠️ I couldn't reach your memory tonight, so these ran without it.";
  const detail = [
    memory,
    b.picks.length ? "🔒 Locked on Walrus before kick-off. One pick ran with memory off; which one stays sealed until the last full time, then I'll show you." : "",
  ].filter(Boolean);
  lines.push(`<blockquote expandable>${detail.join("\n")}</blockquote>`);
  return lines.join("\n");
}

export async function sendBrief(user: UserRow, now = new Date()) {
  const b = await buildBrief(user, now);
  await lockBrief(user, b).catch(() => null);
  const missed = await missedLastNight(user, now).catch(() => null);
  const duo = await duoPick(user as any, now).catch(() => null);
  const days = Math.max(1, Math.floor((now.getTime() - new Date(user.created_at).getTime()) / 86_400_000) + 1);
  await send(user.chat_id, briefText(user, b, days, missed, duo), [[{ text: "Why these picks?", url: dashboardUrl(user.id) }]]);
  await q(`update users set last_brief_date = $2 where id = $1`, [user.id, b.briefDate]);
  return b;
}

export function ratingKeyboard(pickId: string): Kb {
  return [
    [
      { text: "😍 Loved it", callback_data: `r:${pickId}:l` },
      { text: "🙂 Fine", callback_data: `r:${pickId}:f` },
    ],
    [
      { text: "😴 Bailed", callback_data: `r:${pickId}:b` },
      { text: "🙈 Didn't watch", callback_data: `r:${pickId}:s` },
    ],
  ];
}

/** Full-time result with the drama breakdown (shown after the user has answered, or always if they opted in). */
export function resultText(p: any): string {
  const d: Drama | null = p.drama;
  if (!hasScore(p)) return `<b>FT · ${esc(p.home)} v ${esc(p.away)}</b>\n${esc(p.competition)} · no final score in the feed`;
  return `<b>FT · ${esc(p.home)} ${p.home_score}–${p.away_score} ${esc(p.away)}</b>\n${esc(p.competition)}${d ? `\nDrama ${d.score}/100 · ${esc(dramaSummary(d))}` : ""}`;
}

const hasScore = (p: any) => p.home_score !== null && p.home_score !== undefined && p.away_score !== null && p.away_score !== undefined;

/** The post-match question. Spoiler-free by default: no score until you answer. */
export function askText(p: any, showScores = false): string {
  if (!hasScore(p)) return `<b>Full time · ${esc(p.home)} v ${esc(p.away)}</b>\nHow was it? The feed has no result for this competition, so your tap is all I learn from.`;
  if (showScores) return `${resultText(p)}\n\nHow was it?`;
  return `<b>Full time · ${esc(p.home)} v ${esc(p.away)}</b>\nHow was it? Score after you answer, no spoilers.`;
}

export function alertKeyboard(matchId: string): Kb {
  return [[{ text: "📺 Switching on", callback_data: `al:${matchId}:y` }, { text: "Not now", callback_data: `al:${matchId}:n` }]];
}

async function handleAlertResponse(cb: any, matchId: string, code: string) {
  const a = await one<any>(`select a.*, u.tz, u.namespace from alerts a join users u on u.id = a.user_id where a.user_id = $1 and a.match_id = $2`, [cb.from.id, matchId]);
  if (!a || a.response) return tg("answerCallbackQuery", { callback_query_id: cb.id, text: a ? "Got it already." : "That alert has expired." });
  const yes = code === "y";
  await q(`update alerts set response = $3 where user_id = $1 and match_id = $2`, [cb.from.id, matchId, yes ? "switched-on" : "not-now"]);
  const date = localParts(new Date(), a.tz).date;
  const bucket = kickBucket(localParts(new Date(a.sent_at), a.tz).hour);
  const sigs = (a.signals ?? []) as string[];
  const text = yes
    ? `[alert] ${date} · Switched on for ${a.home} v ${a.away} (${a.competition}) at ${Math.round(a.minute)}' when it was close. The live alert was useful. tags: verdict=0.60 comp=${a.comp_id} ${sigs.map((s) => `signal=${s}`).join(" ")} kick=${bucket}`
    : `[alert] ${date} · Passed on a live alert for ${a.home} v ${a.away} at ${Math.round(a.minute)}'. tags: verdict=-0.25 kick=${bucket}`;
  await enqueueMemory({ userId: cb.from.id, namespace: a.namespace, kind: "preference", text, idem: `alert:${cb.from.id}:${matchId}` });
  await tg("answerCallbackQuery", { callback_query_id: cb.id, text: yes ? "Enjoy it. Noted in your memory." : "Noted. I'll be pickier." });
  if (cb.message) await tg("editMessageReplyMarkup", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
}

const RATING_CODE: Record<string, Rating> = { l: "loved", f: "fine", b: "bailed", s: "skipped" };

async function handleRating(cb: any, pickId: string, code: string) {
  const rating = RATING_CODE[code];
  const p = await one<any>(`select p.*, u.tz, u.namespace from picks p join users u on u.id = p.user_id where p.id = $1 and p.user_id = $2`, [pickId, cb.from.id]);
  if (!p || !rating) return tg("answerCallbackQuery", { callback_query_id: cb.id, text: "That pick has expired." });
  if (p.rating) return tg("answerCallbackQuery", { callback_query_id: cb.id, text: `Already saved: ${p.rating}.` });
  await q(`update picks set rating = $2, rated_at = now() where id = $1`, [pickId, rating]);
  const lp = localParts(new Date(p.kickoff), p.tz);
  const localKick = `${String(lp.hour).padStart(2, "0")}:${String(lp.minute).padStart(2, "0")}`;
  const text = ratingMemory({
    date: localParts(new Date(), p.tz).date,
    rating,
    home: p.home,
    away: p.away,
    homeScore: p.home_score,
    awayScore: p.away_score,
    competition: p.competition,
    compId: p.comp_id,
    stage: p.stage,
    drama: p.drama,
    localKick,
    bucket: kickBucket(lp.hour),
  });
  const msgId = cb.message?.message_id;
  await enqueueMemory({ userId: p.user_id, namespace: p.namespace, kind: "rating", text, idem: `rating:${pickId}`, notifyChat: cb.message?.chat?.id, notifyMessage: msgId });
  await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Saved. Writing it to your Walrus memory…" });
  if (msgId) {
    const lock = await lockLine({ ...p, rating }).catch(() => "");
    await edit(cb.message.chat.id, msgId, `${resultText(p)}\n\nYou: <b>${RATING_WORD[rating]}</b> · ⏳ saving to Walrus…\n${reveal(p)}${lock ? `\n<blockquote expandable>${lock}</blockquote>` : ""}`);
  }
}

/** After a rating, unblind the pick: was it chosen with memory, and which memories? */
export function reveal(p: any): string {
  const f = p.features ?? {};
  if (p.arm === "control") return "🔓 <b>Memory-off pick</b>: the control in your A/B test.";
  const why: string[] = f.memoryReasons ?? [];
  const n = (p.cites ?? []).length;
  return `🔓 <b>Memory pick</b>${why.length ? `: ${esc(why[0])}` : ": no memories yet, so it ranked like a neutral fan"}${n ? ` (${n} memor${n === 1 ? "y" : "ies"} cited)` : ""}`;
}

async function teach(user: UserRow, text: string) {
  const clean = text.trim().slice(0, 400);
  if (clean.length < 4) return send(user.chat_id, "Tell me something like: <i>I love late comebacks</i>, or <i>no matches after 2am on weekdays</i>.");
  const negative = /\b(hate|don'?t|do not|never|avoid|boring|skip|no more|not into|dislike|not after|nothing after)\b|\bno (late )?(matches|games|football|kick-?offs)\b/i.test(clean);
  const tags: string[] = [];
  const lower = clean.toLowerCase();
  const plain = lower.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  for (const [id, names] of Object.entries(COMP_ALIASES)) if (names.some((n) => new RegExp(`(^|[^a-z])${n.replace(/[.]/g, "\\.")}([^a-z]|$)`).test(plain))) tags.push(`comp=${id}`);
  // teams playing in the next week, matched by name
  const soon = await fixturesBetween(new Date(), new Date(Date.now() + 7 * 86_400_000)).catch(() => []);
  const seen = new Set<string>();
  for (const f of soon) for (const n of [f.home, f.away]) if (n.length > 3 && !seen.has(n) && lower.includes(n.toLowerCase())) { seen.add(n); tags.push(`team=${slug(n)}`); }
  const SIGNALS: [RegExp, string][] = [[/late (goal|drama|winner)|stoppage/i, "late-goals"], [/comeback/i, "comeback"], [/goals|high.scoring|open game/i, "high-scoring"], [/0-0|goalless|cagey/i, "goalless"], [/tight|close|tense/i, "tense"]];
  for (const [re, sig] of SIGNALS) if (re.test(clean)) tags.push(`signal=${sig}`);
  const date = localParts(new Date(), user.tz).date;
  const late = /after (midnight|1am|2am|3am|1|2|3)\b|too late|late night/i.test(clean);
  const memText = late && negative ? limitMemory(date, clean, "late") : preferenceMemory(date, clean, tags, negative ? -1 : 1);
  const r = await enqueueMemory({ userId: user.id, namespace: user.namespace, kind: late && negative ? "limit" : "preference", text: memText });
  const m = await send(user.chat_id, `Noted${r.removed ? " (I removed something that looked like a secret)" : ""}: <i>${esc(clean)}</i>\n${tags.length ? `I'll weigh: ${tags.map((t) => t.split("=")[1]).join(", ")}.` : "I'll keep it in mind."}\n⏳ writing to Walrus…`);
  await q(`update memory_jobs set notify_chat = $2, notify_message = $3 where id = $1`, [r.id, user.chat_id, m.message_id]);
}

async function ask(user: UserRow, question: string) {
  const qText = question.trim().slice(0, 300);
  if (qText.length < 3) return send(user.chat_id, "Ask me anything about your taste, e.g. <i>/ask which leagues do I enjoy?</i> or <i>/ask what did I think of late kick-offs?</i>");
  await tg("sendChatAction", { chat_id: user.chat_id, action: "typing" }).catch(() => {});
  const a = await askMemory(user, qText);
  const lines = [`🧠 <b>From your memory on Walrus</b>`];
  if (a.pulls.length) lines.push(`👍 ${a.pulls.map((p) => `<b>${esc(p.label)}</b>`).join(", ")}`);
  if (a.pushes.length) lines.push(`👎 ${a.pushes.map((p) => `<b>${esc(p.label)}</b>`).join(", ")}`);
  if (!a.hits.length) lines.push("Nothing in your memory about that yet. Rate a few matches or tell me what you like.");
  else {
    const items = a.hits.map((h) => {
      const body = h.text.split(" tags: ")[0].replace(/^\[\w+\]\s*/, "").replace(/^\d{4}-\d{2}-\d{2} · /, "");
      return `• ${esc(body.length > 140 ? `${body.slice(0, 137)}…` : body)} <a href="https://walruscan.com/mainnet/blob/${h.blobId}">↗</a>`;
    });
    lines.push(`\n${a.hits.length} matching memories, found in ${(a.latencyMs / 1000).toFixed(1)}s:`, `<blockquote expandable>${items.join("\n")}</blockquote>`);
  }
  return send(user.chat_id, lines.join("\n"));
}

async function sendCard(user: UserRow) {
  const url = `${env.appUrl()}/api/card/${purposeKey("card", user.id)}?v=${Date.now().toString(36)}`;
  await tg("sendChatAction", { chat_id: user.chat_id, action: "upload_photo" }).catch(() => {});
  try {
    await tg("sendPhoto", { chat_id: user.chat_id, photo: url, caption: `Your football taste, learned by ${BRAND.name} from your own Walrus memory. Forward it to a friend, or share it anywhere.\n${BRAND.botUrl}` });
  } catch {
    await send(user.chat_id, "I couldn't draw your card just now. Try again in a minute.");
  }
}

async function sendCalendar(user: UserRow) {
  const https = `${env.appUrl()}/api/cal/${purposeKey("cal", user.id)}.ics`;
  return send(
    user.chat_id,
    `🗓 <b>Your picks in your calendar</b>\nSubscribe once; every evening's picks appear on their own, with a reminder 20 min before kick-off.\n\nTap to copy:\n<code>${https}</code>\n<blockquote expandable><b>Google Calendar</b> (web): Other calendars → + → From URL → paste\n<b>iPhone</b>: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste\n<b>Mac</b>: Calendar → File → New Calendar Subscription → paste\nKeep this link private: it shows your picks.</blockquote>`,
  );
}

async function linkDuo(u: any, inviter: any, announceToJoiner = true) {
  if (Number(u.id) === Number(inviter.id)) return;
  await pair(Number(u.id), Number(inviter.id));
  const a = String(u.name || "your friend").split(" ")[0];
  const b = String(inviter.name || "your friend").split(" ")[0];
  if (announceToJoiner) await send(Number(u.chat_id), `👥 You and ${esc(b)} are paired. From tonight, your brief includes one match picked for both of your tastes and both watch windows. Send /duo off to stop.`);
  else await send(Number(u.chat_id), `👥 You and ${esc(b)} are paired: one shared pick a night from now on.`);
  await send(Number(inviter.chat_id), `👥 ${esc(a)} joined. You're paired: from tonight your brief includes one match picked for both of your tastes. Send /duo off to stop.`);
}

async function duoCommand(u: any, arg: string) {
  if (arg === "off") {
    const was = await unpair(u.id);
    if (was) {
      const p = await getUser(was);
      if (p) await send(p.chat_id, `👥 ${esc(String(u.name).split(" ")[0])} ended your watch-together pairing.`);
    }
    return send(u.chat_id, was ? "Pairing ended. Your picks are yours alone again." : "You aren't paired with anyone.");
  }
  if (u.duo_partner) {
    const p = await getUser(Number(u.duo_partner));
    return send(u.chat_id, `👥 You're paired with ${esc(String(p?.name ?? "a friend").split(" ")[0])}. Each evening's brief includes one match for both of you. Send /duo off to stop.`);
  }
  const link = `https://t.me/${env.botUsername()}?start=${duoCode(u.id)}`;
  return send(
    u.chat_id,
    `<b>Watch together</b>\nForward this link to a friend. When they join, you'll both get one extra pick a night that suits both of your tastes and both of your watch windows. Neither of you sees the other's memories.\n\n${link}`,
    [[{ text: "Share with a friend", url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Let's find football worth watching together with Pocket Pundit")}` }]],
  );
}

/** Tonight's picks: send the brief if there isn't one yet, otherwise a compact list with how each went. */
async function picksCommand(u: any) {
  const date = localParts(new Date(), u.tz).date;
  const rows = await q<any>(`select * from picks where user_id = $1 and brief_date = $2 order by slot`, [u.id, date]);
  if (!rows.length) {
    if (u.onboard_step !== "done") return send(u.chat_id, "Finish the setup questions above first.");
    return sendBrief(u);
  }
  const RATED: Record<string, string> = { loved: "😍 loved", fine: "🙂 fine", bailed: "😴 bailed", skipped: "🙈 didn't watch" };
  const lines = ["<b>⚽ Tonight's picks</b>", ""];
  for (const p of rows) {
    lines.push(`<b>${p.slot} · ${esc(fmtLocalTime(new Date(p.kickoff).toISOString(), u.tz))}  ${esc(p.home)} v ${esc(p.away)}</b>`);
    lines.push(`${esc(p.competition)} · ${Math.round(p.score)}/100${p.rating ? ` · you: ${RATED[p.rating] ?? p.rating}` : ""}`);
    lines.push("");
  }
  return send(u.chat_id, lines.join("\n").trim(), [[{ text: "Why these picks?", url: dashboardUrl(u.id) }]]);
}

async function sendHelp(chatId: number, returning = false) {
  await send(
    chatId,
    `${returning ? "Welcome back. " : ""}<b>What I can do</b>\n⚽ /picks · tonight's three\n🧠 /ask · ask your memory\n🪪 /card · your taste as an image\n🗓 /calendar · picks in your calendar\n👥 /duo · a shared pick with a friend\n\nOr just type what you like, e.g. <i>I love late comebacks</i>.\n<blockquote expandable>/me · your dashboard\n/export · download your memory\n/own · keep it in your own wallet's account (optional)\n/alerts on|off · "worth switching on" pings\n/spoilers on|off · scores in full-time messages\n/settings · time zone, brief time, watch window\n/teach · save a preference</blockquote>`,
    [
      [{ text: "⚽ Tonight's picks", callback_data: "cmd:picks" }, { text: "🧠 Ask my memory", callback_data: "cmd:ask" }],
      [{ text: "👥 Invite a friend", callback_data: "cmd:duo" }, { text: "⚙️ Settings", callback_data: "cmd:settings" }],
    ],
  );
}

async function showSettings(u: UserRow) {
  await send(u.chat_id, `<b>Settings</b>\nTime zone: ${esc(u.tz)}\nPicks arrive: ${hh(u.brief_hour)}\nWatch window: ${hh(u.window_start)} to ${hh(u.window_end)}\nMemory namespace: <code>${u.namespace}</code>`, [
    [{ text: "Change time zone", callback_data: "set:tz" }],
    [{ text: "Change brief time", callback_data: "set:bh" }],
    [{ text: "Change watch window", callback_data: "set:win" }],
  ]);
}

export async function handleUpdate(update: any) {
  if (update.message) {
    const m = update.message;
    if (m.chat?.type !== "private" || !m.from) return;
    const text: string = m.text ?? "";
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const command = cmd?.startsWith("/") ? cmd.split("@")[0].toLowerCase() : null;
    if (command === "/start") return startUser(m.from, m.chat.id, rest[0]);
    const u = await getUser(m.from.id);
    if (!u) return startUser(m.from, m.chat.id);
    if (command === "/help") return sendHelp(u.chat_id);
    if (command === "/me") return send(u.chat_id, "Your memory, picks and what I've learned:", [[{ text: "Open dashboard", url: dashboardUrl(u.id) }]]);
    if (command === "/settings") return showSettings(u);
    if (command === "/spoilers") {
      const on = (rest[0] || "").toLowerCase() === "on";
      await q(`update users set show_scores = $2 where id = $1`, [u.id, on]);
      return send(u.chat_id, on ? "Scores will show in full-time messages." : "Spoiler-free: I'll hide scores until you've answered.");
    }
    if (command === "/alerts") {
      const off = (rest[0] || "").toLowerCase() === "off";
      await q(`update users set alerts = $2 where id = $1`, [u.id, !off]);
      return send(u.chat_id, off ? "Live alerts off." : "Live alerts on: at most twice a day, I'll ping you when a match in your window is worth switching on.");
    }
    if (command === "/tz" && rest[0]) {
      if (!isValidTz(rest[0])) return send(u.chat_id, "That isn't a time zone I know. Try e.g. <code>/tz Asia/Ho_Chi_Minh</code>.");
      await q(`update users set tz = $2 where id = $1`, [u.id, rest[0]]);
      return send(u.chat_id, `Time zone set to ${esc(rest[0])}.`);
    }
    if (command === "/picks") return picksCommand(u);
    if (command === "/ask") return ask(u, rest.join(" "));
    if (command === "/duo") return duoCommand(u as any, (rest[0] || "").toLowerCase());
    if (command === "/own") {
      const own = (u as any).memwal_account as string | null;
      const token = dashboardUrl(u.id).split("?t=")[1];
      return send(
        u.chat_id,
        own
          ? `🔑 Your memory lives in your own account:\n<code>${own}</code>\nRemove my key any time to cut me off.`
          : "🔑 <b>Own your memory</b> (optional)\nMove it into a Walrus Memory account your own Sui wallet controls. One or two signatures, about 0.01 SUI in fees. Remove my access any time.\n<blockquote expandable>No wallet? Nothing changes. Your memory stays encrypted on Walrus in Pocket Pundit's account, and the bot works the same.</blockquote>",
        [[{ text: own ? "Manage ownership" : "Take ownership", url: ownUrl(token) }]],
      );
    }
    if (command === "/export") return send(u.chat_id, "Everything your pundit knows about you, as one file: every memory with its Walrus blob link, plus the taste weights they add up to. It's yours to keep or take to another app.", [[{ text: "Download my memory (JSON)", url: `${env.appUrl()}/api/me/export?t=${encodeURIComponent(dashboardUrl(u.id).split("?t=")[1])}` }]]);
    if (command === "/card") return sendCard(u);
    if (command === "/calendar") return sendCalendar(u);
    if (command === "/teach") return teach(u, rest.join(" "));
    if (!command && text && u.onboard_step === "done") return teach(u, text);
    if (u.onboard_step !== "done") return send(u.chat_id, "Let's finish setup first. Tap one of the buttons above, or /start to begin again.");
    return sendHelp(u.chat_id);
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const data: string = cb.data ?? "";
    const chatId = cb.message?.chat?.id;
    const u = await getUser(cb.from.id);
    if (!u || !chatId) return tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Send /start first." });
    const [kind, a, b] = data.split(":");
    if (kind === "r") return handleRating(cb, a, b);
    if (kind === "al") return handleAlertResponse(cb, a, b);
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    if (kind === "cmd") {
      if (u.onboard_step !== "done") return send(chatId, "Let's finish setup first. Tap one of the buttons above, or /start to begin again.");
      if (a === "picks") return picksCommand(u);
      if (a === "ask") return send(chatId, "Ask me anything about your taste. Type it like this:\n<i>/ask which leagues do I enjoy?</i>");
      if (a === "duo") return duoCommand(u as any, "");
      if (a === "settings") return showSettings(u);
    }
    if (kind === "set") {
      if (a === "tz") return send(chatId, "Where are you?", TZ_OPTIONS.map(([label, tz]) => [{ text: label, callback_data: `tz:${tz}` }]));
      if (a === "bh") return askBriefHour(chatId);
      if (a === "win") return askWindow(chatId);
    }
    if (kind === "tz") {
      const tz = data.slice(3);
      if (!isValidTz(tz)) return;
      await q(`update users set tz = $2 where id = $1`, [u.id, tz]);
      if (u.onboard_step === "tz") {
        await q(`update users set onboard_step = 'brief' where id = $1`, [u.id]);
        return askBriefHour(chatId);
      }
      return send(chatId, `Time zone set to ${esc(tz)}.`);
    }
    if (kind === "bh") {
      await q(`update users set brief_hour = $2 where id = $1`, [u.id, Number(a)]);
      if (u.onboard_step === "brief") {
        await q(`update users set onboard_step = 'window' where id = $1`, [u.id]);
        return askWindow(chatId);
      }
      return send(chatId, `Picks will arrive at ${hh(Number(a))}.`);
    }
    if (kind === "win") {
      const [s, e] = a.split("-").map(Number);
      await q(`update users set window_start = $2, window_end = $3 where id = $1`, [u.id, s, e]);
      if (u.onboard_step === "window") {
        await q(`update users set onboard_step = 'leagues' where id = $1`, [u.id]);
        return send(chatId, "Last one: which competitions do you follow? Tap any, then Done.", await leaguesKeyboard(u.id));
      }
      return send(chatId, `Watch window set to ${hh(s)} to ${hh(e)}.`);
    }
    if (kind === "lg") {
      if (a !== "done") {
        const sel = (await cacheGet<string[]>(`onb:leagues:${u.id}`)) ?? [];
        const next = sel.includes(a) ? sel.filter((x) => x !== a) : [...sel, a];
        await cacheSet(`onb:leagues:${u.id}`, next, 3600);
        return tg("editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: await leaguesKeyboard(u.id) } });
      }
      const sel = (await cacheGet<string[]>(`onb:leagues:${u.id}`)) ?? [];
      const date = localParts(new Date(), u.tz).date;
      for (const id of sel) {
        const label = LEAGUES.find((l) => l[1] === id)?.[0] ?? id;
        await enqueueMemory({ userId: u.id, namespace: u.namespace, kind: "preference", text: preferenceMemory(date, `I follow ${label}.`, [`comp=${id}`], 1), idem: `pref:${u.id}:comp:${id}` });
      }
      const fresh = (await getUser(u.id))!;
      await q(`update users set onboard_step = 'done' where id = $1`, [u.id]);
      await edit(chatId, cb.message.message_id, sel.length ? `Saved ${sel.length} competition${sel.length === 1 ? "" : "s"} to your memory.` : "No problem. I'll learn from your ratings.");
      if (fresh.onboard_step !== "done") {
        const inviterId = await takeInvite(u.id);
        const inviterRow = inviterId ? await getUser(inviterId) : null;
        if (inviterRow) await linkDuo({ ...fresh, onboard_step: "done" } as any, inviterRow, false);
        await send(chatId, `All set. Picks arrive at ${hh(fresh.brief_hour)} (${esc(fresh.tz)}). Here's tonight, from a standing start:`);
        return sendBrief(fresh);
      }
    }
  }
}
