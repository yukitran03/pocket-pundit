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

/** The shareable "football taste" card: what the agent has learned, straight from the stored memories. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const uid = verifyPurposeKey("card", (await ctx.params).key);
  if (!uid) return new Response("not found", { status: 404 });
  const d = await cardData(uid);
  if (!d) return new Response("not found", { status: 404 });

  const bar = (w: number, color: string) => (
    <div style={{ display: "flex", width: 260, height: 14, borderRadius: 7, background: "rgba(238,243,236,0.10)" }}>
      <div style={{ display: "flex", width: Math.max(10, Math.round(Math.abs(w) * 260)), height: 14, borderRadius: 7, background: color }} />
    </div>
  );
  const fmt = (x: number | null) => (x === null ? "–" : x.toFixed(2));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: INK, color: CHALK, padding: "56px 64px", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", right: -120, top: -160, width: 520, height: 520, borderRadius: 999, background: "radial-gradient(closest-side, rgba(240,83,28,0.35), rgba(240,83,28,0))", display: "flex" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: DIM }}>
          <span style={{ display: "flex", letterSpacing: 3, textTransform: "uppercase" }}>{BRAND.name}</span>
          <span style={{ display: "flex" }}>Day {d.dayIndex}</span>
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 800, marginTop: 26, lineHeight: 1.02 }}>{`${d.name}'s football taste`}</div>
        <div style={{ display: "flex", fontSize: 26, color: DIM, marginTop: 10 }}>Learned from real matches and taps, not a quiz.</div>

        <div style={{ display: "flex", marginTop: 40, gap: 56, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 22, color: FLARE, letterSpacing: 2, textTransform: "uppercase" }}>Pulls me in</div>
            {(d.pulls.length ? d.pulls : [{ label: "Still learning: rate a few matches", w: 0.1, n: 0 }]).map((p) => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                <span style={{ display: "flex", fontSize: 30, maxWidth: 360 }}>{p.label}</span>
                {bar(p.w, FLARE)}
              </div>
            ))}
            {d.pushes.length ? <div style={{ display: "flex", fontSize: 22, color: STEEL, letterSpacing: 2, textTransform: "uppercase", marginTop: 12 }}>Not for me</div> : null}
            {d.pushes.map((p) => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                <span style={{ display: "flex", fontSize: 30, maxWidth: 360 }}>{p.label}</span>
                {bar(p.w, STEEL)}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 300, gap: 28, borderLeft: "2px solid rgba(238,243,236,0.12)", paddingLeft: 40 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1 }}>{String(d.memories)}</span>
              <span style={{ display: "flex", fontSize: 24, color: DIM }}>memories on Walrus</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>{`${fmt(d.ab.memory)} vs ${fmt(d.ab.control)}`}</span>
              <span style={{ display: "flex", fontSize: 24, color: DIM }}>{`memory vs memory-off picks (n=${d.ab.n})`}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: DIM }}>
          <span style={{ display: "flex" }}>Encrypted on Walrus · verifiable on Sui mainnet</span>
          <span style={{ display: "flex" }}>Get yours on Telegram</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "private, max-age=300" } },
  );
}
