# Submission summary: Total Recall (Tatum × Walrus)

- **Project:** Pocket Pundit, the football pundit in your pocket
- **Track:** Track 1: Markets & Sports Prediction (the track brief lists "Sports companion that learns your leagues and trusted analysts"). Also entering Best Walrus Memory.
- **Live app:** https://t.me/finder_matching_bot and https://pocket-pundit.vercel.app
- **Repo:** https://github.com/yukitran03/pocket-pundit
- **Judges start here:** [README](../README.md), then [docs/TOTAL_RECALL.md](TOTAL_RECALL.md)

## On-chain identity

| | |
|---|---|
| Sui address (account owner) | `0x9bacad5b532906701208c0d8a81ee9a78d6c096a68902cf5213bcfaac82e68e3` |
| Walrus Memory account ID | `0xc460a14354e4b8fd67a710af8d403adbbdb6a1b79df191e7e315557e28217057` |
| MEMWAL_AGENT_ID (delegate public key) | `7d6252cea5c9e96dc91f8dee504b22bbed6f994048cea114af4ccf9684e9b913` |
| Mainnet memories | 73 on 11 Nov 2026, all matched to their Sui objects (live count on [/proof](https://pocket-pundit.vercel.app/proof); the requirement is at least 10) |
| Tatum AI Builder | Not used. The app calls the Tatum Sui gateway directly (native gRPC and GraphQL). |

## Short description

> Every evening Pocket Pundit reads the day's football fixtures (often 200 to 500) and sends you the three worth your time on Telegram, inside the hours you can actually watch and without spoilers. After full time, one tap tells it how the match was. It checks what really happened and writes what it learned to your Walrus Memory on Sui mainnet. Tomorrow's picks recall those memories and cite them. Every evening is ranked twice, with memory on and off, so you can see exactly what memory changed. Every night is also a blind A/B test: two picks use memory, one doesn't, and the brief is locked on Walrus before kick-off, with its certification time read from Sui through Tatum. You can export your taste, or move it to an account your own wallet controls.

## What judges can check in two minutes

1. Open https://pocket-pundit.vercel.app/proof. It reads the memory account, its delegate keys and every Walrus Blob object live through Tatum gRPC, and matches them to the memories the agent says it stored.
2. Start https://t.me/finder_matching_bot and run the four setup taps. Tonight's three picks arrive, and the bot replies with the Sui checkpoint that certified the brief's lock.
3. Send `/ask which leagues do I enjoy?`, which runs a semantic recall over your own namespace. `/card`, `/calendar`, `/duo`, `/export` and `/own` show the rest.
4. Tap "Why these picks?" to open your dashboard. After the night's picks finish, the Memory switch shows the same evening with memory on and off.
5. Read [docs/TOTAL_RECALL.md](TOTAL_RECALL.md) for criteria and evidence and [docs/MEMORY-FORMAT.md](MEMORY-FORMAT.md) for the memory format.

## Feedback for the partners

- **Walrus Memory:** easy to adopt. `remember` and `recall` are clear, and `MemWalMock` made full end-to-end tests possible. Friction: no delete or renew in the TS SDK, a recall can come back empty with `dropped_count > 0` and needs a retry, and finding an account by owner needs an event query.
- **Tatum:** native gRPC (`sui.rpc.v2`) through the gateway worked well for objects, owned objects and transactions. Public Sui JSON-RPC is gone, so everything, including the wallet flow, runs on gRPC and GraphQL.
