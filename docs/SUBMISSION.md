# Submission pack: Total Recall (Tatum × Walrus)

Deadline: **10 Nov 2026, 17:00 UTC**. Judging runs 11–16 Nov.

## Title and track line

- **Title:** Pocket Pundit: the football pundit in your pocket (Track 1, Markets & Sports Prediction)
- **First line of the description:** Track 1: Markets & Sports Prediction (the track brief lists "Sports companion that learns your leagues and trusted analysts"). Also entering Best Walrus Memory.
- The form has no track selector, so the track goes in the first line of the description. Judges start from [docs/TOTAL_RECALL.md](TOTAL_RECALL.md).

## Form fields

| Field | Value |
|---|---|
| Project name | Pocket Pundit |
| Track | Track 1: Markets & Sports Prediction |
| Bonus awards | Best Walrus Memory |
| Live app | https://t.me/finder_matching_bot and https://pocket-pundit.vercel.app |
| Public repo | https://github.com/yukitran03/pocket-pundit (make it public before submitting) |
| Video (2–3 min) | _upload, then paste the link_ |
| Additional documentation (blog) | _publish [docs/BLOG.md](BLOG.md) on Medium or dev.to, then paste the link_ |
| Social post | _post [docs/SOCIAL.md](SOCIAL.md), then paste the link_ |
| Tatum ID | _from the Tatum dashboard (owner to fill in)_ |
| Sui address (account owner) | `0x9bacad5b532906701208c0d8a81ee9a78d6c096a68902cf5213bcfaac82e68e3` |
| Walrus Memory Account ID | `0xc460a14354e4b8fd67a710af8d403adbbdb6a1b79df191e7e315557e28217057` |
| MEMWAL_AGENT_ID (delegate public key) | `7d6252cea5c9e96dc91f8dee504b22bbed6f994048cea114af4ccf9684e9b913` |
| Mainnet memories | Live count on https://pocket-pundit.vercel.app/proof (requirement: at least 10) |
| AI Builder (ai.tatum.io) | Not used |
| Feedback | Walrus Memory was easy to adopt (the remember and recall shapes are clear, and the mock made end-to-end tests possible). Friction: there is no delete or renew in the TS SDK, and finding an account by owner needs an event query. Tatum: native gRPC (`sui.rpc.v2`) through the gateway worked well. Public Sui JSON-RPC is gone, so we read everything over gRPC and GraphQL. |

## Short description (about 600 characters)

> Every evening Pocket Pundit reads the day's 400+ football fixtures and sends you the three worth your time on Telegram, inside the hours you can actually watch and without spoilers. After full time, one tap tells it how the match was. It checks what really happened and writes what it learned to your Walrus Memory on Sui mainnet. Tomorrow's picks cite those memories. Every evening is ranked twice, with memory on and off, so you can see exactly what memory changed. Every night is also a blind A/B test: two picks use memory, one doesn't, and the brief is locked on Walrus before kick-off, with its certification time read from Sui through Tatum. You can export your taste, or move it to an account your own wallet controls.

## What judges can check in two minutes

1. Open https://pocket-pundit.vercel.app/proof. It reads the MemWalAccount, its delegate keys and every Walrus Blob object live through Tatum gRPC, and matches them to the memories the agent says it stored.
2. Start https://t.me/finder_matching_bot and run the four setup taps. Tonight's three picks arrive, and the brief is locked on Walrus.
3. Send `/ask which leagues do I enjoy?`, which runs a semantic recall over your own namespace. Send `/card`, `/calendar`, `/duo`, `/export` or `/own` to try the rest.
4. Open `/me` from the bot's "Why these picks?" button: the Memory switch shows the same evening with memory on and off.
5. Read [docs/TOTAL_RECALL.md](TOTAL_RECALL.md) for criteria and evidence, [docs/MEMORY-FORMAT.md](MEMORY-FORMAT.md) for the memory format and taste rules, and [docs/PROOF.md](PROOF.md) for an on-chain snapshot.

## Before submitting

- [ ] Make the repo public, after the owner's compliance check on using the public football feed.
- [ ] Run `npm run verify` to regenerate `docs/PROOF.md`, then commit it.
- [ ] Confirm the memory count is at least 10 on /proof.
- [ ] Record the video ([docs/VIDEO.md](VIDEO.md)) and upload it, unlisted is fine.
- [ ] Publish the blog ([docs/BLOG.md](BLOG.md)) and the social post ([docs/SOCIAL.md](SOCIAL.md)).
- [ ] Fill in the Tatum ID.
- [ ] Ask on Discord whether Track 1 fits (the brief's example is a sports companion that learns your leagues).
- [ ] The rules allow one submission per person: confirm with the Aquahab team that this entry and theirs list different people.
- [ ] Submit before 10 Nov, 17:00 UTC.
- [ ] After the hackathon, rotate the Vercel token, Telegram token, delegate key and Neon password.
