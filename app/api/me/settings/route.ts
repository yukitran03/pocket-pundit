import { verifyUserToken } from "@/lib/auth.ts";
import { q } from "@/lib/db.ts";
import { isValidTz } from "@/lib/util.ts";
import type { SettingsBody } from "@/lib/contract.ts";

export const runtime = "nodejs";

function hour(x: unknown, max: number): number | null {
  return Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max ? (x as number) : null;
}

export async function POST(req: Request) {
  const uid = verifyUserToken(new URL(req.url).searchParams.get("t"));
  if (!uid) return Response.json({ error: "invalid link" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as SettingsBody;
  const tz = typeof b.tz === "string" && isValidTz(b.tz) ? b.tz : null;
  const bh = hour(b.briefHour, 23);
  const ws = hour(b.windowStart, 23);
  const we = hour(b.windowEnd, 36);
  if (ws !== null && we !== null && we <= ws) return Response.json({ error: "The watch window must end after it starts." }, { status: 400 });
  await q(
    `update users set tz = coalesce($2, tz), brief_hour = coalesce($3, brief_hour), window_start = coalesce($4, window_start), window_end = coalesce($5, window_end) where id = $1`,
    [uid, tz, bh, ws, we],
  );
  return Response.json({ ok: true });
}
