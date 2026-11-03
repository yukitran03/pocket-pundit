# Match Finder

**Track 02 / 03 entry for Total Recall (Tatum × Walrus) · also for Best Walrus Memory**

Every evening Match Finder looks at the day's football fixtures (often 400+) and sends you the few worth your time, on Telegram. After full time you tap how it was. It reads what actually happened in the match, writes what it learned to **your Walrus Memory on Sui mainnet**, and uses those memories in tomorrow's picks. Every pick cites the memories (blob ids) that shaped it.

- Bot: https://t.me/finder_matching_bot
- App: https://matchfinder-memory.vercel.app
- Proof (live, read from Sui through Tatum): https://matchfinder-memory.vercel.app/proof · [docs/PROOF.md](docs/PROOF.md)

## How it learns

1. **Brief (at the time you choose).** Fixtures in your watch window are scored. Two picks come from the memory-driven agent; one comes from the same agent with memory **off**. The three are shuffled and unlabelled, so your ratings are a blind A/B test of whether memory helps.
2. **Recall before every brief.** The agent recalls your memories from Walrus (two semantic queries over your namespace) and rebuilds your taste from them: competitions, teams, match styles (late goals, comebacks, tight games…) and kick-off times you actually stay up for. Nothing about your taste is kept anywhere else. If recall fails, the brief says it ran without memory.
3. **Full time.** The scheduler reads the public event timeline and computes a 0–100 drama score (goals, goals after 75', lead changes, comebacks, attempts, red cards). The bot asks: Loved / Fine / Bailed / Didn't watch.
4. **Remember.** Your rating plus what happened becomes one memory, written through a durable, idempotent queue. The bot edits its message to "stored on Walrus" with the blob id once the write is confirmed.
5. **Lesson.** Once a day the agent writes a short lesson memory: what pulls you in, what pushes you away, and how memory picks are doing against memory-off picks.

## Where Walrus and Tatum do the work

| Concern | How |
|---|---|
| Memory store | `@mysten-incubation/memwal` 0.1.12 against the mainnet relayer: `remember` (queued, paced under the ~12/min/key limit, idempotency keys), `getRememberBulkStatus`, `recall` (sort recent + relevance), `listNamespaces` |
| Privacy | Seal-encrypted on Walrus; namespaces are HMAC-derived so no user id appears on-chain; credential-shaped strings are redacted before any write ([lib/memory.ts](lib/memory.ts)) |
| Chain reads | **Tatum Sui gateway, native gRPC** (`sui.rpc.v2` protos vendored from MystenLabs/sui-apis): `LedgerService/GetServiceInfo`, `LedgerService/GetObject` (the MemWalAccount: owner, delegate keys, active), `StateService/ListOwnedObjects` (every Walrus `Blob` object owned by the account, with `storage.end_epoch`). GraphQL for delegate-key events. ([lib/tatum.ts](lib/tatum.ts)) |
| Proof | Each stored memory's base64url blob id is converted to the on-chain u256 and matched to its Sui `Blob` object. The dashboard shows the Sui object and expiry epoch next to each memory; `npm run verify` writes [docs/PROOF.md](docs/PROOF.md) |

## Architecture

```
Telegram ──webhook──▶ /api/telegram ─┐
GitHub Actions (30 min) ─▶ /api/cron/tick ─┼─▶ lib/tick.ts ─┬─ lib/picker.ts ── lib/feed.ts (public fixtures, form, timelines)
Vercel cron (daily)  ───────┘                 │             ├─ lib/memory.ts ── Walrus Memory relayer (mainnet)
Web (/, /me, /proof) ─▶ /api/{stats,me,proof} ┘             ├─ lib/drama.ts / lib/taste.ts
                                                             └─ lib/tatum.ts ── Tatum Sui gRPC + GraphQL (mainnet)
Neon Postgres: users, picks, memory write queue, recall events, caches
```

Next.js 16 on Vercel (Node runtime), Neon Postgres, React Three Fiber for the 3D views.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in Tatum, Walrus Memory, Telegram, app secrets
node --env-file=.env.local scripts/local-runner.ts   # long-polls Telegram + ticks every minute (dev)
npm run dev                                         # web UI
npm test                                            # unit tests
npm run verify                                      # cross-check stored memories against Sui via Tatum
```

## Honest limits

- The hosted relayer runs Seal decryption and embeddings, so it sees plaintext during writes and recalls (Walrus Memory's default path). Don't write anything you wouldn't tell a server you trust.
- The app operates one Walrus Memory account (custodial) with a namespace per user. Per-user self-custody is the next step.
- Memories last as long as their Walrus storage (currently `end_epoch` 57, about 15 epochs from write). There is no renew in the TS SDK yet; expiry is shown, not hidden.
- Football data comes from a public, anonymous API; no odds, no betting, no club or federation branding.
