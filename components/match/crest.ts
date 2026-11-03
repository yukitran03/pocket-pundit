// Pure crest helpers (no React), shared by server and client components.
// Deterministic: the same team name always gives the same colours and initials.

// Field / ink pairs. Initials on the field are at least 4.5:1, and every field is set off from the dark
// page by a light outline, so all of them read on ink-1 (and on a light page, by the same outline).
// Flare and steel are left out on purpose: on this site they mean "memory" and "memory off".
export const CREST_PALETTE: { field: string; ink: string; tint: string; a?: number }[] = [
  { field: "#b3243a", ink: "#fbeed6", tint: "179 36 58" }, // crimson
  { field: "#1f3f94", ink: "#eef2fb", tint: "31 63 148" }, // navy
  { field: "#2456c7", ink: "#ffe08a", tint: "36 86 199" }, // royal + gold
  { field: "#0f7a4a", ink: "#f3f7ef", tint: "15 122 74" }, // emerald
  { field: "#1f5e3b", ink: "#f2cf5b", tint: "31 94 59" }, // forest + gold
  { field: "#6d1f3a", ink: "#a7dcff", tint: "109 31 58" }, // claret + sky
  { field: "#7fc4ef", ink: "#0b1f3a", tint: "127 196 239", a: 0.26 }, // sky
  { field: "#d9a520", ink: "#1b1405", tint: "217 165 32", a: 0.32 }, // gold
  { field: "#1c1f22", ink: "#f2f2f2", tint: "150 160 170", a: 0.3 }, // black
  { field: "#5b2a8c", ink: "#f3e8ff", tint: "91 42 140" }, // purple
  { field: "#0e7c86", ink: "#ecfeff", tint: "14 124 134" }, // teal
  { field: "#7a1d1d", ink: "#f2c14e", tint: "122 29 29" }, // maroon + gold
  { field: "#eef0ec", ink: "#1d2a52", tint: "238 240 236", a: 0.16 }, // white + navy
];

/** FNV-1a, 32-bit: small, stable, good enough to spread names over the palette. */
export function hashName(name: string) {
  let h = 0x811c9dc5;
  const s = name.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function teamColors(name: string) {
  return CREST_PALETTE[hashName(name) % CREST_PALETTE.length];
}

const SKIP = new Set(["fc", "afc", "cf", "sc", "ac", "as", "ss", "sv", "fk", "sk", "cd", "ud", "rc", "rcd", "club", "de", "del", "la", "le", "los", "las", "the", "of", "and", "&", "1.", "calcio", "vfb", "vfl", "tsg", "bsc", "ssc", "fsv", "tsv", "spvgg"]);

/** "Buriram United" → "BU", "FC Internazionale Milano" → "IM", "PSV" → "PSV", "Como" → "C". */
export function teamInitials(name: string) {
  const plain = name.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const words = plain.split(/[\s\-/]+/).filter(Boolean);
  const keep = words.filter((w) => !SKIP.has(w.toLowerCase()) && /[A-Za-z]/.test(w));
  const use = keep.length ? keep : words;
  let out: string;
  if (use.length === 1) {
    const w = use[0].replace(/[^A-Za-z0-9]/g, "");
    out = w.length <= 3 && w === w.toUpperCase() ? w : w.slice(0, 1).toUpperCase();
  } else {
    out = use
      .slice(0, use.length >= 3 ? 3 : 2)
      .map((w) => w.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase())
      .join("");
  }
  // A crest that reads "VS" next to the VS plate is confusing: fall back to the last word's initial.
  return out === "VS" ? use[use.length - 1].slice(0, 1).toUpperCase() : out;
}
