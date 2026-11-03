import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name}: 400 fixtures tonight, three worth your evening. A Telegram bot that picks football matches for you, spoiler-free, and learns your taste.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Fetch the display face (TTF) for the card. Falls back to the built-in font if offline at build time. */
async function displayFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Big+Shoulders:opsz,wght@72,800&display=swap", {
      headers: { "user-agent": "node" },
      signal: AbortSignal.timeout(5000),
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

const CHALK = "rgba(238,243,236,0.6)";

export default async function OpengraphImage() {
  const font = await displayFont();
  const display = font ? "Big Shoulders" : "sans-serif";

  // Pitch in perspective as a trapezoid. Plain SVG, no external assets.
  const pitch = (
    <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <radialGradient id="g" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#23714a" />
          <stop offset="1" stopColor="#0d2e1f" />
        </radialGradient>
      </defs>
      <polygon points="700,330 1130,330 1200,600 630,600" fill="url(#g)" />
      <polygon points="700,330 1130,330 1200,600 630,600" fill="none" stroke={CHALK} strokeWidth="3" />
      <line x1="915" y1="330" x2="915" y2="600" stroke={CHALK} strokeWidth="3" />
      <ellipse cx="915" cy="462" rx="78" ry="40" fill="none" stroke={CHALK} strokeWidth="3" />
      <polygon points="684,392 760,392 752,540 662,540" fill="none" stroke={CHALK} strokeWidth="3" />
      <polygon points="1070,392 1146,392 1168,540 1078,540" fill="none" stroke={CHALK} strokeWidth="3" />
      <ellipse cx="915" cy="462" rx="7" ry="4" fill="#eef3ec" />
      <path d="M760 180 Q 840 230 915 300" fill="none" stroke="#f0531c" strokeWidth="3" />
      <path d="M850 120 Q 890 210 915 300" fill="none" stroke="#f0531c" strokeWidth="3" />
      <path d="M1080 170 Q 990 220 915 300" fill="none" stroke="#f0531c" strokeWidth="3" />
    </svg>
  );

  const dots: [number, number, string, boolean][] = [
    [744, 166, "#f0531c", true], [836, 106, "#f0531c", true], [1066, 156, "#f0531c", true],
    [1000, 220, "#d55181", false], [700, 250, "#c98500", false], [1130, 250, "#9085e9", false], [960, 120, "#008300", false],
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#060e0b", color: "#eef3ec", fontFamily: "sans-serif" }}>
        {pitch}
        {dots.map(([x, y, c, on], i) => (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: on ? 34 : 26, height: on ? 22 : 17, borderRadius: 4, background: c, boxShadow: on ? "0 0 36px 10px rgba(240,83,28,0.5)" : "none", display: "flex" }} />
        ))}
        <div style={{ position: "absolute", left: 878, top: 276, width: 76, height: 48, borderRadius: 6, background: "#eef3ec", border: "4px solid #f0531c", boxShadow: "0 0 60px 18px rgba(240,83,28,0.45)", display: "flex" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 72px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, border: "4px solid #eef3ec", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#eef3ec", display: "flex" }} />
            </div>
            <div style={{ fontFamily: display, fontSize: 38, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", display: "flex" }}>{BRAND.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: display, fontWeight: 800, fontSize: 92, lineHeight: 0.94 }}>
            <span style={{ display: "flex" }}>400 fixtures</span>
            <span style={{ display: "flex" }}>tonight.</span>
            <span style={{ display: "flex" }}>
              <span style={{ color: "#f0531c", marginRight: 20 }}>Three</span>
              <span>worth</span>
            </span>
            <span style={{ display: "flex" }}>your evening.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 24, color: "#b9c6bc" }}>
            <span style={{ display: "flex" }}>Your football pundit, in Telegram</span>
            <span style={{ display: "flex" }}>Spoiler-free picks, in your time zone</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Big Shoulders", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
