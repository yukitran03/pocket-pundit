# Pocket Pundit: design notes

The product name, tagline and bot link live in `lib/brand.ts` (`BRAND`). UI code never hard-codes them, so a rename is a one-file change.

The direction for the web front end, and the tokens and specs that keep it consistent.
The code uses these names: `app/globals.css` holds the tokens, `components/**` holds the inventory, and `components/three/**` holds the scenes.

## 1. References (inspiration only, nothing copied)

| Reference | What we took |
|---|---|
| https://linear.app/ | The ink hierarchy (four text greys from primary to quaternary), hairlines at about 8% white instead of boxes, tight negative tracking on display sizes, and "Fig 0.x" editorial numbering for sections. We used the ideas and kept none of the values or fonts. |
| https://onefootball.com/ | A condensed, heavy display face gives football its scoreboard energy, and one loud accent sits against greys. We picked our own accent, a flare orange, instead of their lime. |
| https://statsbomb.com/ (Hudl) | A display family plus a matching condensed face for data labels, and data shown as precise, quiet marks. |
| https://theanalyst.com/ (Opta Analyst) | Scorelines written as `3–1`, percentages to one decimal place, and data headlines that put the number first. |
| https://vercel.com/ (Geist) | Elevation drawn with a 1px inset ring plus a soft shadow instead of a border, and a strict surface ladder. |
| https://www.yuusuke.work/ | The idea of a burning-paper dissolve, a gooey (blur + alpha threshold) title morph, smooth scrolling and soft reveals. Looked at for the idea only; the shader, the morph and every line of code here were written from scratch, and no text, image or asset was taken. |
| https://threejs-journey.com/ | Using 3D as atmosphere behind real content rather than as the content, plus a mono face for technical strings. |
| Awwwards "FEVER" case study (https://www.awwwards.com/case-study-fever.html) | Abstract, data-driven 3D for football events: each match event becomes a light mark, not an illustration. |

The raw HTML/CSS of these pages was saved to the session scratchpad (`ui-refs/`) and read only for type scales and token structure. None of their scripts, assets or fonts are in this repo.

## 2. Direction: "Floodlit night match"

The page should feel like a pitch at 21:00 seen from the stands: deep pitch-ink, chalk lines, floodlight haze and one hot colour.

- **Base:** green-black ink. Every surface is a step on the same ladder.
- **Lines:** chalk white at low alpha, used the way a pitch uses paint. They divide and frame, and are never decoration.
- **Accent:** a single *flare* orange (`#f0531c`) that always means one thing: memory influence. It marks recalled memories, the memory arm, the "lean in" side of a taste weight, and the primary CTA. Nothing else is orange.
- **Counter-pole:** *steel* blue (`#3987e5`), meaning "without memory": the control arm and the "steer away" side of a taste weight. Hot means memory and cold means no memory, so the A/B reads at a glance.
- **Layout:** an asymmetric editorial grid. Section indexes and labels sit in a narrow left rail (`01 / Recall`) and content takes the right nine columns. Headlines are left-aligned, and nothing is centred except the score on a match card.
- **Type:** a condensed stadium-signage display face for headlines and big numbers, a sturdy grotesque for reading, and a mono face for anything you could paste into an explorer (blob IDs, object IDs, epochs).
- Clichés we avoid: cream, serif and terracotta; purple-blue gradients; emoji markers; a centred hero; Inter-only.

The site is dark-only by design (a night match). All colour goes through tokens on `:root`, so a light theme could be added under `[data-theme="light"]` without touching components.

## 3. Tokens

### Colour (dark, the only theme)

| Token | Hex | Use |
|---|---|---|
| `--ink-0` | `#060e0b` | page |
| `--ink-1` | `#0c1a14` | card / chart surface (palette validated against this) |
| `--ink-2` | `#122219` | raised, hover |
| `--ink-3` | `#1a2e23` | pressed, track |
| `--pitch` | `#123d28` | pitch stripes, 3D ground |
| `--line` | `rgb(226 238 228 / 0.10)` | hairline |
| `--line-strong` | `rgb(226 238 228 / 0.18)` | focus-adjacent, axes |
| `--chalk` | `#eef3ec` | primary text |
| `--chalk-2` | `#b9c6bc` | secondary text |
| `--chalk-3` | `#83958a` | muted text, axis labels (4.9:1 on ink-1) |
| `--chalk-4` | `#5a6b61` | disabled, quaternary |
| `--flare` | `#f0531c` | accent: memory, CTA, "lean in" |
| `--flare-ink` | `#1a0700` | text on flare |
| `--steel` | `#3987e5` | control arm, "steer away" |
| `--ok` | `#0ca30c` | stored (status) |
| `--warn` | `#fab219` | pending / queued (status) |
| `--bad` | `#d03b3b` | failed (status) |

Memory-kind palette (categorical, all-pairs validated on `#0c1a14`, always paired with a shape and a text label):

| Kind | Hex | 3D shape |
|---|---|---|
| rating | `#c98500` amber | sphere |
| preference | `#9085e9` violet | rounded cube |
| lesson | `#008300` green | octahedron |
| limit | `#d55181` magenta | torus (a boundary) |
| taste / system | `#83958a` chalk-3 (folded into "Other") | small tetrahedron |
| brief ("Locked brief", not taste) | `#e2d6b4` parchment | hexagonal seal |

Validation was run with the dataviz validator (`--mode dark --surface #0c1a14`):
- flare and steel: CVD ΔE 27.3 and normal ΔE 34.6, both passing.
- The four kinds pass all-pairs at the normal-vision floor (19.3). Their CVD result is a WARN at 6.9 for amber against green, so they are only ever shown with a shape and a label.

### Type

| Role | Family | Settings |
|---|---|---|
| Display / big numbers | **Big Shoulders** (variable, opsz + wght, OFL) | 800, `opsz 72`, line-height 0.88–0.95, uppercase only for short labels |
| Text | **Archivo** (variable wght, OFL) | 400 / 500 / 600, 16px base, line-height 1.6 |
| Mono / data | **JetBrains Mono** (variable, OFL) | 400 / 500, `tabular-nums`, used for IDs, epochs, kickoffs and tables |

The fallback stack for each face is `ui-sans-serif` / `ui-monospace` with `size-adjust` via next/font.

Scale (fluid `clamp`):
- `display-xl`: 3.25rem → 7.5rem
- `display-l`: 2.5rem → 4.75rem
- `display-m`: 1.875rem → 3rem
- `title`: 1.25rem
- `body`: 1rem
- `small`: 0.875rem
- `micro`: 0.75rem (mono, +0.06em tracking, uppercase)

Numbers in tables, axes, kickoffs and IDs use `font-variant-numeric: tabular-nums`. Hero and stat-tile figures stay proportional.

### Spacing, radius, elevation

- Spacing runs on a 4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96 and 128. Sections are separated by `clamp(72px, 10vw, 144px)`. The side gutter is 16px on phones, 24px on tablets and 40px on desktop, and the max content width is 1280px.
- Chips use the text face (Archivo 500, 0.75rem). Only IDs you could paste into an explorer use `.chip-id` (JetBrains Mono 0.7rem, shortened with an ellipsis, full value in `title`).
- Radius is 4px on chips and pills, 10px on inputs and buttons, and 16px on cards. Pitch lines have square corners.
- Elevation is `inset 0 0 0 1px var(--line)` plus `0 24px 48px -24px rgb(0 0 0 / .6)`. We never use borders and shadows together.

## 4. Component inventory

- **Site:** `Header` (sticky, blurred ink), `Footer`, `Logo` (a centre-circle mark with a recall node), `SectionHead` (rail index + title + lede), `ExternalLink`, `DataSourceBadge` (states that data is Demo, Sample fallback or Live).
- **Pick:** `PickCard` reads top to bottom: teams (display face, two lines, no score placeholder before kick-off), kick-off time with a relative hint ("in 2 h", "Live now", "Full time"), competition, one `Meter` for worth-watching (flare for memory picks, steel for control, chalk while blind), up to three reasons, a single "Shaped by N memories on Walrus" disclosure (one-line quotes with a blob chip each), then a quiet status row: sample label, arm badge and `LockChip` ("Locked on Walrus 2 h before kick-off", linking to the brief blob when `Pick.lock.blobId` is set). Blind mode: on unrated picks the memories stay folded and opening them warns that it unblinds the pick. Finished picks add the rating and a compact drama line.
- **Landing:** `HowItWorks` (3 steps + sample card), `Features` (six time-savers with their commands), `TonightBoard` (live `/api/tonight`: ranked list + spoiler-free replays + CTA), `LiveNumbers` / `ABFromStats` / `LessonsFeed`, `Ownership`, `Faq`.
- **Charts** (SVG, server-renderable, with hover titles and a text table):
  - `ArmCompare`: mean rating dot with a 95% CI whisker on a 0–2 axis, plus grouped bars of the rating mix. It adds an honest-n note.
  - `DivergingBars`: taste weights from −1 to 1, with the value at the tip and the evidence count.
- **Memory:** `KindTag` (swatch, shape glyph and label), `StatusPill` (queued, pending, stored or failed, each with an icon and a label), `MemoryTable` (search uses recall, has a highlight link to the 3D room, and turns into a card list under 720px), `TeachForm` (add, or correct with supersedes), `SettingsForm`.
- **Proof:** `AccountCard`, `ChainStatus`, `BlobReconcile` (on-chain count vs relayer, with a matched/missing bar), `BlobTable`, `ProofExplainer`.
- **States:** `Skeleton`, `ErrorState` (with retry), `EmptyState`. Each one says what the user is looking at and why.

## 5. 3D scene specs (React Three Fiber)

### Hero: "Night pitch"

- **Camera:** a perspective camera at fov 32, placed at (0, 9.5, 13.5) and looking at (0, 0, -1), so the pitch sits about 38° below the horizon. It drifts slowly, by 2° of azimuth, with pointer parallax capped at 0.4 units.
- **Pitch:** a 105×68 m pitch scaled to 16×10.4 units, made of 12 mowed stripes (two greens) on a ground plane. Chalk lines are built from real markings: touchlines, the halfway line, the centre circle (r 9.15 m), penalty and goal areas, the penalty arcs and the spots. They are drawn as flat meshes so they keep their thickness. The surround uses an exponential fog of ink colour.
- **Floodlights:** four corner masts, each with an emissive light bank, a soft additive cone (an open cylinder with a gradient alpha), and a pool of light on the grass from radial-gradient planes. There are no real-time shadows.
- **Memories:** N glowing cards above the pitch, with N = clamp(memoriesStored, 18, 64) taken from `/api/stats` (default 28 while loading). Each card is a small rounded plane with an additive halo, tinted by kind, bobbing on its own phase.
- **Recall loop:** every 4.5s, 3–4 memories brighten to flare and quadratic Bézier lines draw (drawRange animation) from each one to *tonight's pick*: a beacon ring at the centre spot that pulses once. The cycle then fades out and repeats with different memories.
- **Reduced motion:** a single static frame (`frameloop="demand"`) with one recall drawn and nothing moving.
- **Pausing:** an IntersectionObserver sets `frameloop="never"` while the canvas is off-screen.

### /me: "Taste room"

- **Layout:** the user's memories sit in an amphitheatre, as tiles in curved stands around a small pitch. Rows follow age: newest at the front, oldest at the back.
- **Encoding:**
  - Colour and shape show the kind (see the palette table).
  - Size shows evidence: 1 by default, and 1.35 for memories cited today.
  - Brightness shows storage life. Opacity and emissive fall linearly over the last 3 Walrus epochs before `endEpoch` (current epoch = `currentWalrusEpoch` if the API provides it, otherwise an estimate from the epoch-1 date and 14-day epochs, marked "≈"). Expired memories render as a wireframe.
- **Tonight's picks:** three beacons on the pitch. Memories cited by a pick glow flare and are linked to their beacon by a line.
- **Interaction:** hovering shows a DOM tooltip with the kind, text, blob ID and end epoch. Clicking pins the memory and syncs it with the table row; selecting a row highlights the object. Orbit controls are limited to a 50° azimuth and 15° polar range, with no zoom on touch.
- **Accessibility:** the canvas is `aria-hidden`. The memory table is the accessible equivalent and carries the same information.

### Both scenes

- Lazy-loaded with `next/dynamic` (`ssr: false`) after idle.
- A static SVG/CSS fallback renders first and stays put if WebGL is missing or the import fails.
- DPR is capped at `[1, 1.75]` and antialiasing is on.
- Materials are basic or standard; there are no post-processing passes and no shadows.

## 6. Performance budget

| Item | Budget |
|---|---|
| First-load JS for `/` before the 3D chunk | ≤ 200 KB gz. Measured 190 KB, of which about 170 KB is React and Next; our code is under 20 KB |
| 3D chunk (three, R3F, the drei subset), loaded after idle | ≤ 260 KB gz, never on the critical path. Measured 251 KB |
| Fonts | 3 variable families, Latin subset, `display: swap`, ≤ 140 KB total |
| LCP element | Hero headline (text), never the canvas |
| CLS | 0. Canvas and fallback share a fixed aspect box, and skeletons match final heights |
| Scene cost | ≤ 120 draw calls and ≤ 60k triangles. Memory tiles are instanced where counts exceed 64 |
| Frame | ≥ 50 fps on a 2020 integrated GPU at DPR 1.75. The loop pauses off-screen |
| Network | One `/api/stats` request on `/`, one `/api/me` request on `/me`, and recall debounced at 300 ms |

## 7. Data honesty rules

- `NEXT_PUBLIC_USE_MOCK=1` serves fixtures and shows a "Demo data" badge.
- In development only, an unreachable API (network error, non-JSON 404, or 5xx) falls back to fixtures with a "Sample data · API offline" badge. A JSON 4xx is a real answer: a bad token or unknown user shows the "get a fresh link" page.
- Production shows live data, skeletons while loading, and error states with retry. It never shows fixtures.
- The landing page's sample pick card and Day 1 / Day 7 tiles are an illustrative sample, and the page labels them that way.
- The public Tonight board (`/api/tonight`) is the one exception to "never fixtures in production": if the request fails, times out (15 s) or returns an unexpected shape, it shows `fixtureTonight()` with a "Sample · live feed unavailable" badge, so the landing page is never blank. A real but empty answer is shown as an empty state, never replaced by the sample.
- Spoiler-free means the score is not in the DOM until the viewer asks for it (`BurnReveal` renders it only after the click).

## 8. Optional contract additions (backward compatible)

- `MeResponse.currentWalrusEpoch?: number`: the current Walrus epoch, so the taste room can dim memories exactly. Without it, the UI estimates the epoch from the epoch-1 date and shows "≈".

## 9. Motion

Every effect has a reduced-motion path and none of them carries content on its own.

| Effect | Where | What it does | prefers-reduced-motion / no WebGL |
|---|---|---|---|
| Burn dissolve (`components/fx/burn.ts`, `BurnReveal`) | "Reveal score" on last night's replays | Redraws the hatched cover into a 2D canvas and burns it away from the click point: a raw WebGL 1 fragment shader with value-noise fbm for the ragged front, a scorch band ahead of it, a white-hot line on a flare glow at the edge and a few sparks behind. About 1.5 s, one context per reveal, released afterwards. No three.js. | Instant reveal. Any shader or context failure also reveals instantly. Focus moves to the score either way. |
| Gooey morph (`GooeyWords`) | Hero headline: "your evening." → "staying up for." → "the highlights." | Outgoing and incoming phrases cross-blur under an SVG alpha-threshold filter, so the letters melt into each other. Filter only applied during the 0.9 s morph (3.2 s hold); phrases share one grid cell, so no layout shift. The h1 keeps the real sentence in an sr-only span; the animated layer is aria-hidden. | Static first phrase. Also pauses while off-screen or the tab is hidden. |
| Smooth scroll (Lenis, MIT) | Landing and /proof | Wheel and trackpad smoothing, anchor links honour `scroll-padding-top`. Nested scrollers opt out with `data-lenis-prevent`. Not mounted on /me. | Off. Also off on touch-first devices (`pointer: coarse`). |
| Section reveal (`ScrollReveal`) | Blocks marked `data-reveal` | Blocks still below the fold after hydration fade up 22px once; the rail line next to each section index draws itself. Server HTML is always visible. | Nothing hidden, nothing moves. |
