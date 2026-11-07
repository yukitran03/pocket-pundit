# Pocket Pundit × Total Recall (Tatum × Walrus)

**Track 1: Markets & Sports Prediction.** The track brief lists *"Sports companion that learns your leagues and trusted analysts"* as an example. That is Pocket Pundit: it learns your leagues, teams, match styles and the hours you really watch, and it proves every night that the learning helps. **Also entering Best Walrus Memory.**

Every commit in this repository was made inside the build window (first commit 3 Nov 2026; the window runs 20 Oct to 10 Nov). The bot has run on mainnet every evening since 3 Nov.

- **Bot:** https://t.me/finder_matching_bot
- **Web:** https://pocket-pundit.vercel.app
- **Live proof (read from Sui through Tatum):** https://pocket-pundit.vercel.app/proof
- **Live numbers:** https://pocket-pundit.vercel.app/api/stats

## In one minute

Every evening the pundit reads the day's fixtures (often 400 or more), and sends three picks on Telegram inside the hours you can watch, with no spoilers. After full time, one tap says how it was. It checks what actually happened, from the public match timeline, and writes the lesson to your Walrus Memory on Sui mainnet. The next evening's picks recall those memories, and each one cites the blobs it relied on.

## Memory that visibly changes the product

| What judges can see | How it works | Where |
|---|---|---|
| **Memory switch** | At brief time, every match in your window is ranked twice: once with your Walrus memories and once with memory off. Both top threes are kept, with each match's rank in each list, why memory moved it, and the blobs behind that. `/me` shows them side by side, and the next morning it adds what actually happened (drama and rank on the night). The bot sends the same in one line after the night's last rating. | [lib/picker.ts](../lib/picker.ts) `memorySwitch`, [components/me/MemorySwitch.tsx](../components/me/MemorySwitch.tsx) |
| **Blind A/B every night** | Two picks use memory, and one is the same agent with memory off. They are shuffled and shown with neutral reasons only. Ratings are collected before the arm is revealed. | [lib/picker.ts](../lib/picker.ts) `buildBrief` |
| **Sealed before kick-off** | The brief is written to Walrus before the first kick-off. Which pick is the control is sealed as `sha256("<date>\|control=<match>\|<salt>")`, and the salt is revealed after the last full time. The bot replies to each brief with the time **Sui certified it, read through Tatum**. | [lib/lock.ts](../lib/lock.ts) |
| **Night reports, misses included** | Once your window closes, every finished match in it is ranked by drama from the timeline. A `[night]` memory records where the picks landed, and a `[form]` memory scores each competition against the night's average. Only memory-on picks read league form back. | [lib/night.ts](../lib/night.ts) |
| **Every pick cites its memories** | The reasons on each pick link to the Walrus blobs that produced them, and `/ask` runs a semantic recall over your own namespace. | `/me`, `/ask` |
| **Portable and yours** | `/export` hands over a taste passport in a documented format, and `/own` moves your memory into a Walrus Memory account your own wallet controls. | [docs/MEMORY-FORMAT.md](MEMORY-FORMAT.md), [lib/own.ts](../lib/own.ts) |

### Numbers so far (8 Nov 2026, live at /api/stats)

| | Memory picks | Memory-off picks |
|---|---|---|
| Rated | 10 | 5 |
| Loved / Fine / Bailed / Didn't watch | 7 / 1 / 1 / 1 | 1 / 2 / 1 / 1 |
| Average rating (Loved 2, Fine 1, Bailed 0) | **1.67** | **1.00** |

All 15 picks sent so far were rated. Night reports: the night's best match was among the picks on 2 of 3 ranked nights, both times through the memory-off pick. Memory picks tend to be the matches *this viewer* enjoys rather than the loudest ones: a 0–0 they loved scored drama 0, and a 2–2 they bailed on scored 50. Learning that difference is what memory is for.

**Honest limit:** these numbers come from very few viewers so far, so they show the loop working, not a statistically settled result. The A/B panel says "too early to call" until each side has ten ratings.

## Judging criteria → where to look

| Criterion | Weight | Evidence |
|---|---|---|
| Walrus and Tatum integration | 30% | Walrus Memory is the product: one HMAC-derived namespace per viewer; typed memories (`rating`, `preference`, `lesson`, `brief`, `night`, `form`); recall on every brief; and corrections that supersede rather than delete. Tatum is how the app reads Sui: native gRPC for the account, delegate keys, every Blob object and the certification time of each lock, and GraphQL for delegate-key and account events. |
| Technical quality (incl. Tatum Sui RPC) | 30% | 82 tests: unit tests, plus end-to-end runs against a fake football world, a fake Telegram and the SDK's `MemWalMock`. Memory writes go through a queue with idempotency keys, pacing under the relayer limit and backoff up to 12 attempts. Reads are paced for Tatum's rate limits. Picks are scored deterministically, with no LLM in the picking path, so every reason is traceable to a weight and a blob. |
| Creativity | 20% | A pundit that shows its own counterfactual: the same evening with memory on and off, sealed before kick-off, checked against what happened, and blind-rated by the viewer. |
| Presentation | 20% | A working bot and web app, a live `/proof` page, a per-viewer dashboard, this document, [docs/MEMORY-FORMAT.md](MEMORY-FORMAT.md), [docs/PROOF.md](PROOF.md), the blog and the demo video. |

## Live evidence on Sui mainnet

| What | Where |
|---|---|
| Walrus Memory account (owner, delegate key, active) | [0xc460…7057](https://suiscan.xyz/mainnet/object/0xc460a14354e4b8fd67a710af8d403adbbdb6a1b79df191e7e315557e28217057) |
| Account owner | [0x9bac…68e3](https://suiscan.xyz/mainnet/account/0x9bacad5b532906701208c0d8a81ee9a78d6c096a68902cf5213bcfaac82e68e3) |
| Stored memories matched to their Sui Blob objects | 43 of 43 on 7 Nov (live count on /proof) |
| Brief lock, 7 Nov: certified on Sui 240 min before the first kick-off | [object 0xce02…e968](https://suiscan.xyz/mainnet/object/0xce02c0ab151afab0091b8072ca75398b5aa5c5f8874ad1d5b2824f857a59e968) |
| Brief lock, 6 Nov: certified 60 min before the first kick-off | [object 0x512b…d390](https://suiscan.xyz/mainnet/object/0x512bb72ca398f64eccccee7edd4a4365eb928abe944ca3d792835279b0bbd390) |
| Brief lock, 5 Nov: certified 59 min before the first kick-off | [object 0xd76b…eb5b](https://suiscan.xyz/mainnet/object/0xd76b454e1b0142da532cbaed435d6c43fe8549d9f71adbf35ffcfb45c0feeb5b) |

The certification times come from Tatum gRPC: `LedgerService/GetObject` gives the Blob's `previous_transaction`, and `LedgerService/GetTransaction` gives its checkpoint and timestamp.

## Tatum calls in the product

| Call | Used for | Code |
|---|---|---|
| gRPC `LedgerService/GetServiceInfo` | Chain status on /proof | [lib/tatum.ts](../lib/tatum.ts) |
| gRPC `LedgerService/GetObject` | The MemWalAccount (owner, delegate keys, active), and each Blob's last transaction | [lib/tatum.ts](../lib/tatum.ts) |
| gRPC `StateService/ListOwnedObjects` | Every Walrus Blob object the account owns, matched to stored memories | [lib/tatum.ts](../lib/tatum.ts) |
| gRPC `LedgerService/GetTransaction` | When Sui certified each brief lock, for /proof and the bot's lock reply | [lib/lock.ts](../lib/lock.ts) |
| GraphQL `events` | Delegate-key history and finding a viewer's own account (`AccountCreated`) for `/own` | [lib/own.ts](../lib/own.ts) |

## Honest limits

- There are only a few real viewers so far, so the A/B shows that the loop works, not a settled effect size.
- The public football feed settles some competitions only. Picks prefer competitions it settles, on both arms alike.
- The hosted Walrus Memory relayer sees plaintext while it embeds and encrypts, which is the default path. Nothing credential-shaped is written.
- A Walrus memory can't be edited. The 6 Nov night report named the wrong match when four matches tied for the best, so a correction memory now supersedes it, and the original stays on Walrus where anyone can check it.
