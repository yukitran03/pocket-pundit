// Taste passport: everything the pundit knows about one viewer, in one portable document.
// Every memory carries its Walrus blob id, so another app (or the viewer) can check it against Sui.
import { q, one } from "./db.ts";
import { env } from "./env.ts";
import { buildTaste, parseMemory, tasteToContract } from "./taste.ts";
import { KNOWN_COMPS } from "./views.ts";
import { formLabels } from "./night.ts";
import { localParts, walruscan, slug } from "./util.ts";

export const PASSPORT_FORMAT = "pocket-pundit.taste-passport/v1";

export async function tastePassport(userId: number) {
  const u = await one<any>(`select * from users where id = $1`, [userId]);
  if (!u) return null;
  const jobs = await q<any>(`select kind, text, blob_id, status, created_at from memory_jobs where user_id = $1 and not archived order by id`, [userId]);
  const stored = jobs.filter((j) => j.status === "stored" && j.blob_id);
  const today = localParts(new Date(), u.tz).date;
  const labels = new Map<string, string>(Object.entries(KNOWN_COMPS).map(([id, l]) => [`comp:${id}`, l]));
  for (const p of await q<any>(`select distinct comp_id, competition, home, away from picks where user_id = $1`, [userId])) {
    labels.set(`comp:${p.comp_id}`, p.competition);
    labels.set(`team:${slug(p.home)}`, p.home);
    labels.set(`team:${slug(p.away)}`, p.away);
  }
  for (const [id, label] of await formLabels(userId)) if (!labels.has(`comp:${id}`)) labels.set(`comp:${id}`, label);
  return {
    format: PASSPORT_FORMAT,
    generatedAt: new Date().toISOString(),
    about: "Football taste learned from real matches and one-tap ratings. Each memory is a Seal-encrypted blob on Walrus mainnet; the sentence format is documented at docs/MEMORY-FORMAT.md in the project repository.",
    walrusMemory: { accountId: u.memwal_account ?? process.env.MEMWAL_ACCOUNT_ID ?? null, ownedByYou: !!u.memwal_account, owner: u.memwal_owner ?? null, namespace: u.namespace, relayer: env.memwalServerUrl() },
    settings: { timeZone: u.tz, briefHour: u.brief_hour, watchWindow: { startHour: u.window_start, endHour: u.window_end } },
    taste: tasteToContract(buildTaste(stored.map((j) => parseMemory(j.blob_id, j.text)), today), labels),
    memories: stored.map((j) => ({
      kind: j.kind,
      text: j.text,
      blobId: j.blob_id,
      walruscan: walruscan(j.blob_id),
      createdAt: new Date(j.created_at).toISOString(),
    })),
  };
}
