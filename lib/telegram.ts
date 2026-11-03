// Telegram bot: onboarding, daily brief, post-match rating, teaching. Plain Bot API over fetch.
import { env } from "./env.ts";
import { q, one, cacheGet, cacheSet } from "./db.ts";
import { lockBrief, lockLine } from "./lock.ts";
import { BRAND } from "./brand.ts";
import { purposeKey } from "./auth.ts";
import { askMemory } from "./extras2.ts";
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

export async function getUser(id: number): Promise<(UserRow & { onboard_step: string; active: boolean; last_brief_date: string | null }) | null> {
  const u = await one<any>(`select * from users where id = $1`, [id]);
  return u ? { ...u, id: Number(u.id), chat_id: Number(u.chat_id) } : null;
}

async function startUser(from: any, chatId: number) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "there";
  await q(
    `insert into users (id, chat_id, name, username, namespace) values ($1,$2,$3,$4,$5)
     on conflict (id) do update set chat_id = excluded.chat_id, name = excluded.name, username = excluded.username, active = true`,
    [from.id, chatId, name, from.username ?? null, namespaceFor(from.id)],
  );
  const u = await getUser(from.id);
  if (u?.onboard_step === "done") return sendHelp(chatId, true);
  await q(`update users set onboard_step = 'tz' where id = $1`, [from.id]);
  await send(
    chatId,
    `<b>Hi ${esc(name)}, I'm ${BRAND.name}.</b>\n\nEvery evening I go through the day's fixtures (often 400+) and send you the three most worth your time, inside the hours you can actually watch. No spoilers, a reminder before kick-off, and a ping if a game turns into a thriller.\n\nAfter full time, one tap tells me how it was. I check what really happened in the match and keep what I learn in <b>your own memory</b>, encrypted on Walrus and verifiable on Sui. No wallet needed.\n\nFour quick questions, then tonight's picks. First, where are you?`,
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

export function briefText(user: UserRow, b: BriefResult, dayIndex: number, missed?: { home: string; away: string; competition: string; drama: number } | null): string {
  const lines = [`<b>Tonight's picks · day ${dayIndex}</b>`, `I scanned ${b.considered} fixtures in your window (${hh(user.window_start)} to ${hh(user.window_end)}).`, ""];
  for (const p of [...b.picks].sort((a, c) => a.slot - c.slot)) {
    lines.push(`<b>${p.slot}. ${esc(p.c.f.home)} v ${esc(p.c.f.away)}</b>`);
    lines.push(`${esc(p.c.label)} · ${p.c.localKick} · <b>${p.score}</b>/100`);
    for (const r of p.neutral) lines.push(`• ${esc(r)}`);
    lines.push("");
  }
  if (!b.picks.length) lines.push("Nothing kicks off in your window tonight. I'll look again tomorrow.");
  if (b.picks.length) lines.push("🔒 Locked on Walrus before kick-off. Which pick ran with memory off stays sealed until the last full time.", "");
  if (missed) lines.push(`📼 Worth the highlights from last night: <b>${esc(missed.home)} v ${esc(missed.away)}</b> (${esc(missed.competition)}), drama ${missed.drama}/100. No score here.`, "");
  lines.push(
    b.memoriesUsed
      ? `🧠 Shaped by ${b.memoriesUsed} memories recalled from Walrus (${(b.recallMs / 1000).toFixed(1)}s). One of these three was picked with memory off. Your ratings tell me which approach works.`
      : b.recallOk
        ? "🧠 Day one: no memories yet, so these are a neutral fan's picks. Rate them after full time and I'll start learning."
        : "⚠️ I couldn't reach your memory tonight, so these picks ran without it.",
  );
  return lines.join("\n");
}

export async function sendBrief(user: UserRow, now = new Date()) {
  const b = await buildBrief(user, now);
  await lockBrief(user, b).catch(() => null);
  const missed = await missedLastNight(user, now).catch(() => null);
  const days = Math.max(1, Math.floor((now.getTime() - new Date(user.created_at).getTime()) / 86_400_000) + 1);
  await send(user.chat_id, briefText(user, b, days, missed),[[{ text: "Why these? Open your memory", url: dashboardUrl(user.id) }]]);
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
  if (!hasScore(p)) return `<b>FT · ${esc(p.home)} v ${esc(p.away)}</b>\n${esc(p.competition)}\nThe data feed has no final score for this one, so your answer is what I learn from.`;
  return `<b>FT · ${esc(p.home)} ${p.home_score}–${p.away_score} ${esc(p.away)}</b>\n${esc(p.competition)}${d ? `\nDrama ${d.score}/100: ${esc(dramaSummary(d))}.` : ""}`;
}

const hasScore = (p: any) => p.home_score !== null && p.home_score !== undefined && p.away_score !== null && p.away_score !== undefined;

/** The post-match question. Spoiler-free by default: no score until you answer. */
export function askText(p: any, showScores = false): string {
  if (!hasScore(p)) return `<b>Full time · ${esc(p.home)} v ${esc(p.away)}</b>\n${esc(p.competition)}\n\nDid you watch it? The data feed has no result for this competition, so your tap is the whole signal tonight.`;
  if (showScores) return `${resultText(p)}\n\nDid you watch it?`;
  return `<b>Full time · ${esc(p.home)} v ${esc(p.away)}</b>\n${esc(p.competition)}\n\nDid you watch it? (No spoilers: I'll show the score once you answer.)`;
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
    await edit(cb.message.chat.id, msgId, `${resultText(p)}\n\nYou: <b>${RATING_WORD[rating]}</b> · ⏳ writing to Walrus…\n${reveal(p)}${lock ? `\n${lock}` : ""}`);
  }
}

/** After a rating, unblind the pick: was it chosen with memory, and which memories? */
export function reveal(p: any): string {
  const f = p.features ?? {};
  if (p.arm === "control") return "🔓 That was the <b>memory-off</b> pick (the control in your A/B).";
  const why: string[] = f.memoryReasons ?? [];
  const n = (p.cites ?? []).length;
  return `🔓 That was a <b>memory</b> pick${why.length ? `: ${esc(why[0])}` : " (no memories yet, so it ranked like a neutral fan)"}${n ? ` · cited ${n} memor${n === 1 ? "y" : "ies"}` : ""}.`;
}

async function teach(user: UserRow, text: string) {
  const clean = text.trim().slice(0, 400);
  if (clean.length < 4) return send(user.chat_id, "Tell me something like: <i>I love late comebacks</i>, or <i>no matches after 2am on weekdays</i>.");
  const negative = /\b(hate|don'?t|do not|never|avoid|boring|skip|no more|not into|dislike)\b/i.test(clean);
  const tags: string[] = [];
  const lower = clean.toLowerCase();
  for (const [label, id] of LEAGUES) if (lower.includes(label.toLowerCase())) tags.push(`comp=${id}`);
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
  const lines = [`<b>From your memory on Walrus</b> · ${a.hits.length} relevant, ${(a.latencyMs / 1000).toFixed(1)}s`];
  if (a.pulls.length || a.pushes.length) {
    lines.push("");
    if (a.pulls.length) lines.push(`Pulls you in: ${a.pulls.map((p) => `<b>${esc(p.label)}</b> (${p.n})`).join(", ")}`);
    if (a.pushes.length) lines.push(`Not for you: ${a.pushes.map((p) => `<b>${esc(p.label)}</b> (${p.n})`).join(", ")}`);
  }
  if (!a.hits.length) lines.push("", "Nothing in your memory about that yet. Rate a few matches or /teach me something.");
  for (const h of a.hits) {
    const body = h.text.split(" tags: ")[0].replace(/^\[(\w+)\]\s*/, (_, k) => `${k}: `);
    lines.push("", `• ${esc(body.length > 220 ? `${body.slice(0, 217)}…` : body)} <a href="https://walruscan.com/mainnet/blob/${h.blobId}">blob</a>`);
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
    `<b>Your picks in your calendar</b>\nSubscribe once. Every evening's picks then appear on their own, each with a reminder 20 minutes before kick-off.\n\n<code>${https}</code>\n\n<b>Google Calendar</b> (web): Other calendars → + → From URL → paste.\n<b>iPhone</b>: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste.\n<b>Mac</b>: Calendar → File → New Calendar Subscription → paste.\n\nKeep this link to yourself: it shows your picks.`,
  );
}

async function sendHelp(chatId: number, returning = false) {
  await send(
    chatId,
    `${returning ? "Welcome back. " : ""}<b>What I can do</b>\n/picks: tonight's three\n/ask &lt;question&gt;: ask your memory, e.g. <i>/ask which leagues do I enjoy?</i>\n/card: your football taste as a shareable image\n/calendar: add your picks to Google or Apple Calendar\n/teach &lt;text&gt;: tell me a preference\n/me: your private dashboard\n/alerts on|off: "worth switching on" pings during matches\n/spoilers on|off: show scores in full-time messages\n/settings: time zone, brief time, watch window\n\nOr just type a preference, e.g. <i>I love late comebacks</i>.`,
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
    if (command === "/start") return startUser(m.from, m.chat.id);
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
    if (command === "/picks") {
      const date = localParts(new Date(), u.tz).date;
      const rows = await q(`select * from picks where user_id = $1 and brief_date = $2 order by slot`, [u.id, date]);
      if (!rows.length) {
        if (u.onboard_step !== "done") return send(u.chat_id, "Finish the setup questions above first.");
        return sendBrief(u);
      }
      return send(u.chat_id, rows.map((p) => `<b>${p.slot}. ${esc(p.home)} v ${esc(p.away)}</b>\n${esc(p.competition)} · ${fmtLocalTime(new Date(p.kickoff).toISOString(), u.tz)} · ${Math.round(p.score)}/100${p.rating ? ` · you: ${p.rating}` : ""}`).join("\n\n"), [[{ text: "Open dashboard", url: dashboardUrl(u.id) }]]);
    }
    if (command === "/ask") return ask(u, rest.join(" "));
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
        await send(chatId, `All set. Picks arrive at ${hh(fresh.brief_hour)} (${esc(fresh.tz)}). Here's tonight, from a standing start:`);
        return sendBrief(fresh);
      }
    }
  }
}
