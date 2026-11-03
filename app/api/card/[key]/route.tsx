import { ImageResponse } from "next/og";
import { verifyPurposeKey } from "@/lib/auth.ts";
import { cardData } from "@/lib/extras2.ts";
import { BRAND } from "@/lib/brand.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INK = "#060e0b";
const CHALK = "#eef3ec";
const DIM = "#9fb0a4";
const FLARE = "#f0531c";
const STEEL = "#6aa6d8";

let fontCache: Promise<ArrayBuffer | null> | null = null;
/** The display face (Big Shoulders 800, from Google Fonts). Falls back to the built-in font if unreachable. */
function displayFont(): Promise<ArrayBuffer | null> {
  fontCache ??= (async () => {
    try {
      const css = await fetch("https://fonts.googleapis.com/css2?family=Big+Shoulders:opsz,wght@72,800&display=swap", {
        headers: { "user-agent": "node" },
        signal: AbortSignal.timeout(5000),
      }).then((r) => r.text());
      const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
      return url ? await fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => r.arrayBuffer()) : null;
    } catch {
      return null;
    }
  })();
  return fontCache;
}

/** The shareable "football taste" card: what the agent has learned, straight from the stored memories. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const uid = verifyPurposeKey("card", (await ctx.params).key);
  if (!uid) return new Response("not found", { status: 404 });
  const [d, font] = await Promise.all([cardData(uid), displayFont()]);
  if (!d) return new Response("not found", { status: 404 });
  const display = font ? "Big Shoulders" : "sans-serif";

  const bar = (w: number, color: string) => (
    <div style={{ display: "flex", width: 240, height: 14, borderRadius: 7, background: "rgba(238,243,236,0.10)" }}>
      <div style={{ display: "flex", width: Math.max(12, Math.round(Math.abs(w) * 240)), height: 14, borderRadius: 7, background: color }} />
    </div>
  );
  const row = (p: { label: string; w: number; n: number }, color: string) => (
    <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
      <span style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ display: "flex", fontSize: 32 }}>{p.label}</span>
        {p.n ? <span style={{ display: "flex", fontSize: 18, color: DIM }}>{`${p.n} ${p.n === 1 ? "memory" : "memories"}`}</span> : null}
      </span>
      {bar(p.w, color)}
    </div>
  );
  const rated = d.ab.memory !== null && d.ab.control !== null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: INK, backgroundImage: "radial-gradient(circle at 90% 6%, rgba(240,83,28,0.26), rgba(240,83,28,0) 42%)", color: CHALK, padding: "56px 64px", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: DIM }}>
          <span style={{ display: "flex", fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: 2, textTransform: "uppercase", color: CHALK }}>{BRAND.name}</span>
          <span style={{ display: "flex" }}>{`Day ${d.dayIndex}`}</span>
        </div>
        <div style={{ display: "flex", fontFamily: display, fontSize: 92, fontWeight: 800, marginTop: 22, lineHeight: 0.95 }}>{`${d.name}'s football taste`}</div>
        <div style={{ display: "flex", fontSize: 26, color: DIM, marginTop: 12 }}>Learned from real matches and one tap after each, not a quiz.</div>

        <div style={{ display: "flex", marginTop: 36, gap: 56, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 20, color: FLARE, letterSpacing: 3, textTransform: "uppercase" }}>Pulls me in</div>
            {d.pulls.length ? d.pulls.slice(0, 3).map((p) => row(p, FLARE)) : <span style={{ display: "flex", fontSize: 30, color: DIM }}>Still learning. Rate a few matches.</span>}
            {d.pushes.length ? <div style={{ display: "flex", fontSize: 20, color: STEEL, letterSpacing: 3, textTransform: "uppercase", marginTop: 10 }}>Not for me</div> : null}
            {d.pushes.slice(0, 1).map((p) => row(p, STEEL))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 290, gap: 30, borderLeft: "2px solid rgba(238,243,236,0.12)", paddingLeft: 40 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ display: "flex", fontFamily: display, fontSize: 110, fontWeight: 800, lineHeight: 0.9 }}>{String(d.memories)}</span>
              <span style={{ display: "flex", fontSize: 24, color: DIM, marginTop: 8 }}>{d.memories === 1 ? "memory on Walrus" : "memories on Walrus"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {rated ? (
                <span style={{ display: "flex", fontFamily: display, fontSize: 54, fontWeight: 800, lineHeight: 1 }}>{`${d.ab.memory!.toFixed(2)} vs ${d.ab.control!.toFixed(2)}`}</span>
              ) : (
                <span style={{ display: "flex", fontFamily: display, fontSize: 44, fontWeight: 800, lineHeight: 1 }}>A/B pending</span>
              )}
              <span style={{ display: "flex", fontSize: 22, color: DIM, marginTop: 8 }}>{rated ? `memory picks vs memory off (${d.ab.n} rated)` : "starts after the first ratings"}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: DIM }}>
          <span style={{ display: "flex" }}>Encrypted on Walrus · verifiable on Sui mainnet</span>
          <span style={{ display: "flex" }}>{`Get your own pundit: ${BRAND.botHandle}`}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: "Big Shoulders", data: font, weight: 800, style: "normal" }] : undefined,
      headers: { "cache-control": "private, max-age=300" },
    },
  );
}
