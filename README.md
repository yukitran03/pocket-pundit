# Pocket Pundit

**The football pundit in your pocket.**

**Total Recall (Tatum × Walrus) · Track 3: Consumer Apps People Use (recommendation) · also for Best Walrus Memory**

Pocket Pundit is a personal football pundit on Telegram. Every evening it reads the day's fixtures, often 400 or more, and sends you the three worth your time. It only picks matches inside the hours you can actually watch, and it never spoils a score. After full time, one tap tells it how the match was. It checks what really happened in the match and keeps what it learned in **your own memory: encrypted on Walrus, verifiable on Sui mainnet**. Tomorrow's picks use that memory, and every pick cites the memories that shaped it.

- **Bot:** https://t.me/finder_matching_bot
- **Web:** https://pocket-pundit.vercel.app (includes a live "Tonight" board anyone can use)
- **Proof (live, read from Sui through Tatum):** https://pocket-pundit.vercel.app/proof · [docs/PROOF.md](docs/PROOF.md)

## Who it's for

Football fans who love the game but can't watch everything. Many live in Asia, where European football kicks off late at night, so a bad pick costs sleep. Pocket Pundit replaces scrolling, spoilers and missed thrillers with three good choices and one tap.

## What it saves you

| Without it | With Pocket Pundit |
|---|---|
| Scrolling 400+ fixtures to find one worth staying up for | Three picks at the time you choose, inside the hours you can actually watch |
| Watching 90 minutes of a dead game | A "worth switching on" ping when a match in your window turns tight and late (at most twice a day) |
| Missing kick-off | A reminder about 20 minutes before each pick, plus a calendar feed that fills itself |
| Spoilers in every app | Full-time messages hide the score until you've answered |
| Not knowing which highlights matter | One spoiler-free line: last night's match most worth the highlights |
| Explaining your taste to every app | It learns from your taps. `/ask` shows what it knows, and `/card` turns it into an image you can share |

Memory tunes every one of those: the leagues you enjoy, the styles you love or bail on (late goals, comebacks, cagey 0–0s), and the kick-off times you really stay up for.

## Why you can trust a pick

- **Blind A/B, every night.** Two picks use your memory. One is the same agent with memory switched off. The brief shows only neutral reasons. After you rate a match, the bot tells you which kind of pick it was and which memories it cited.
- **Locked before kick-off.** Each brief is written to Walrus before the first match starts. Which pick was the memory-off control is sealed as a sha256 commit. After the last full time, the bot reveals the salt, so you can recompute `sha256("<date>|control=<match>|<salt>")` yourself. The `/proof` page reads each lock's **certification time on Sui through Tatum** (`GetObject` → `previous_transaction` → `GetTransaction`) and shows how many minutes before kick-off it landed.
- **Your memory is yours.** There is no other copy of your taste. If recall returns nothing, the agent genuinely knows nothing.

## Architecture

Read left to right: who triggers work, the Vercel routes, the agent core, and the mainnet services it writes to and reads from.

```mermaid
flowchart LR
  classDef user fill:#1d3b2a,stroke:#7fd1a0,color:#e8f1ea
  classDef app fill:#14202b,stroke:#6aa6d8,color:#e6eef5
  classDef core fill:#24180f,stroke:#f0531c,color:#fbe9df
  classDef data fill:#1f1f2e,stroke:#a29bfe,color:#ecebff
  classDef ext fill:#2b2410,stroke:#e8b84a,color:#fff4d6

  subgraph IN["① Inputs"]
    direction TB
    TG["💬 Telegram bot<br/>picks · ratings · /ask · /card"]:::user
    WEB["🖥 Web<br/>/ · /me · /proof"]:::user
    CAL["📅 Calendar apps<br/>subscribed feed"]:::user
    CRON["⏱ Scheduler<br/>every 5–10 min"]:::app
  end

  subgraph VER["② Vercel · Next.js 16"]
    direction TB
    HOOK["/api/telegram<br/>webhook secret"]:::app
    TICK["/api/cron/tick<br/>bearer secret"]:::app
    API["/api/tonight · me · stats · proof"]:::app
    OUT["/api/card · /api/cal<br/>signed single-purpose keys"]:::app
  end

  subgraph CORE["③ Agent core · lib/"]
    direction TB
    PICK["picker + taste<br/>memory arm vs memory-off control"]:::core
    LOCK["brief lock<br/>sha256-sealed control"]:::core
    LOOP["drama + extras<br/>settle · live alerts · reminders"]:::core
    QUEUE["memory queue<br/>paced · idempotent · redacted"]:::core
    CHAIN["tatum client<br/>native gRPC + GraphQL"]:::core
  end

  subgraph NET["④ Mainnet"]
    direction TB
    MW["Walrus Memory relayer<br/>remember · recall"]:::ext
    WAL[("Walrus<br/>Seal-encrypted blobs")]:::ext
    TAT["Tatum Sui gateway<br/>sui.rpc.v2"]:::ext
    SUI[("Sui<br/>MemWalAccount · Blob objects")]:::ext
  end

  FD["⚽ Public football data<br/>fixtures · form · timelines · live"]:::ext
  DB[("Neon Postgres<br/>users · picks · queue · caches")]:::data

  TG <--> HOOK
  WEB --> API
  CAL --> OUT
  CRON --> TICK
  HOOK --> PICK
  TICK --> PICK & LOOP & QUEUE
  PICK --> LOCK --> QUEUE
  API --> CHAIN
  PICK -- recall --> MW
  QUEUE -- remember --> MW
  MW --> WAL
  WAL -. "one Blob object per memory" .-> SUI
  CHAIN -- "GetObject · GetTransaction · ListOwnedObjects" --> TAT
  TAT --> SUI
  PICK & LOOP --> FD
  CORE --- DB
```

## One day with your pundit

```mermaid
sequenceDiagram
  autonumber
  participant S as Scheduler
  participant A as Pundit (agent)
  participant W as Walrus Memory
  participant F as Football data
  participant U as You (Telegram)
  participant T as Tatum → Sui

  S->>A: your brief time (e.g. 18:00)
  A->>W: recall "what I rated, loved, bailed on"
  W-->>A: memories (text + tags)
  A->>F: fixtures in your window, recent form
  A->>A: score: memory arm vs memory-off arm
  A->>U: 3 picks, shuffled, blind A/B
  A->>W: lock the brief (control sealed as sha256)
  S->>U: ⏰ kick-off reminder
  S->>F: live scores every few minutes
  S-->>U: 🔥 worth switching on (thresholds from memory)
  S->>F: timeline after full time → drama score
  S->>U: Full time (no score yet) · did you watch it?
  U->>A: 😍 Loved
  A->>W: remember(rating + what happened)
  W-->>A: blob id (≈25 s)
  A->>U: ✅ stored · 🔓 memory pick, cited 2 memories · 🔒 locked 74 min before kick-off
  A->>T: Blob object, end_epoch, certification time
  Note over A,W: tomorrow's recall includes tonight's lesson
```

## What a memory looks like

Each memory is one readable sentence with a machine-readable tail. Recall returns the sentence, and the agent turns the tags back into weights.

```text
[rating] 2026-11-04 · Loved Como 4–1 Manchester United (UEFA Champions League · League Stage);
kicked off 23:45 my time. Drama 74/100: 5 goals, 2 after 75'.
tags: verdict=1.00 comp=2000001032 team=como team=manchester-united signal=high-scoring signal=late-goals kick=evening

[brief] 2026-11-04 · Tonight's picks, locked before kick-off: Barcelona v Aston Villa (03:00); …
Memory-off pick sealed: commit 3f9a1c2b7d4e5f60. tags: kind=brief
```

```mermaid
flowchart LR
  classDef a fill:#24180f,stroke:#f0531c,color:#fbe9df
  classDef b fill:#2b2410,stroke:#e8b84a,color:#fff4d6
  R["Your tap<br/>😍 / 🙂 / 😴 / 🙈"]:::a --> M["Memory sentence<br/>+ tags"]:::a --> E["Seal-encrypted<br/>blob on Walrus"]:::b --> O["Sui Blob object<br/>owner · size · end_epoch"]:::b
  O -->|"read via Tatum gRPC"| P["/proof + your dashboard"]:::a
  M -->|"recall tomorrow"| K["Taste weights<br/>(decay: 21-day half-life)"]:::a --> N["Tomorrow's picks<br/>+ alert thresholds"]:::a
```

## Where Walrus and Tatum do the work

| Concern | How |
|---|---|
| Memory store | `@mysten-incubation/memwal` 0.1.12 against the mainnet relayer: `remember` (queued, paced under the ~12/min/key limit, idempotency keys), `getRememberBulkStatus`, `recall` (recent and relevance sorts), `listNamespaces` |
| Ask your memory | `/ask <question>` runs a semantic `recall` over your own namespace and answers with the matching memories, each linked to its blob, plus the taste weights they add up to |
| Privacy | Seal-encrypted on Walrus. Namespaces are HMAC-derived, so no user id appears on-chain. Credential-shaped strings are redacted before any write ([lib/memory.ts](lib/memory.ts)) |
| Chain reads | **Tatum Sui gateway, native gRPC** (`sui.rpc.v2` protos vendored from MystenLabs/sui-apis): `LedgerService/GetServiceInfo`; `LedgerService/GetObject` (the MemWalAccount: owner, delegate keys, active); `StateService/ListOwnedObjects` (every Walrus `Blob` object the account owns, with `storage.end_epoch`); `LedgerService/GetTransaction` (checkpoint time of a lock's certification). GraphQL for delegate-key events ([lib/tatum.ts](lib/tatum.ts)) |
| Proof | Each stored memory's base64url blob id is converted to the on-chain u256 and matched to its Sui `Blob` object. The dashboard shows the Sui object and expiry epoch next to each memory; `npm run verify` writes [docs/PROOF.md](docs/PROOF.md) |
| Blind A/B + locks | Two memory picks and one memory-off control, shuffled, with neutral reasons only. The brief is locked on Walrus before kick-off, with the control sealed by a commit that is revealed after the last full time ([lib/lock.ts](lib/lock.ts)) |

## Bot commands

| Command | What it does |
|---|---|
| `/start` | Four taps: time zone, brief time, watch window, competitions you follow |
| `/picks` | Tonight's three |
| `/ask <question>` | Ask your memory, e.g. *which leagues do I enjoy?* |
| `/card` | Your football taste as a shareable image |
| `/calendar` | A private feed for Google or Apple Calendar, with a 20-minute reminder on each pick |
| `/teach <text>` | Save a preference, e.g. *I love late comebacks* or *no matches after 2am on weekdays* (plain messages work too) |
| `/me` | Your private dashboard: picks with cited memories, learned weights, memory wall, A/B |
| `/alerts on\|off` | "Worth switching on" pings during matches |
| `/spoilers on\|off` | Show scores in full-time messages |
| `/settings` | Change time zone, brief time, watch window |

## Run it

```bash
npm install
cp .env.example .env.local                          # Tatum, Walrus Memory, Telegram, app secrets
node --env-file=.env.local scripts/local-runner.ts  # dev: long-polls Telegram + ticks every minute
npm run dev                                         # web UI
npm test                                            # unit tests
npm run verify                                      # cross-check stored memories against Sui via Tatum
```

## Honest limits

- The hosted relayer runs Seal decryption and embeddings, so it sees plaintext during writes and recalls (Walrus Memory's default path). Don't write anything you wouldn't tell a server you trust.
- The app operates one Walrus Memory account (custodial) with a namespace per user. Per-user self-custody is the next step.
- Memories last as long as their Walrus storage (currently about 15 epochs from write). The TS SDK has no renew yet, so expiry is shown rather than hidden.
- Live alerts depend on the scheduler's cadence, so they can arrive a few minutes after a match turns.
- Football data comes from a public, anonymous API. There are no odds, no betting, and no club or federation branding.
