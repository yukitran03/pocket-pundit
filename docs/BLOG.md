# Pocket Pundit: a football pundit that remembers you, on Walrus and Sui

*Built for Total Recall (Tatum × Walrus). Track 1: Markets & Sports Prediction. Also entering Best Walrus Memory.*

On a normal weekday there are more than 400 professional football matches. If you live in Ho Chi Minh City and love European football, the ones you care about often kick off at 2 or 3 in the morning. So every evening you do the same thing: scroll fixtures, guess which game will be worth losing sleep over, dodge spoilers the next morning, and still miss the thriller that happened somewhere else.

Pocket Pundit does that job for you. It is a Telegram bot, so there is nothing to install and no wallet to set up, and it sends you the three matches worth your evening. After full time you tap how it was. It checks what actually happened in the match, remembers what it learned in your own memory on Walrus, and gets better at choosing for you.

Try it: [t.me/finder_matching_bot](https://t.me/finder_matching_bot) · [pocket-pundit.vercel.app](https://pocket-pundit.vercel.app) · [live proof](https://pocket-pundit.vercel.app/proof)

## What a day looks like

At the hour you choose, you get a short brief:

- three matches inside the hours you can actually watch;
- for each one, a plain reason (both sides have averaged 4.1 goals a game lately; it's a knockout tie);
- a line telling you the brief is locked on Walrus before kick-off.

About 20 minutes before each kick-off, a reminder arrives. If a match in your window turns tight and late, you get one "worth switching on" ping, and never more than two a day. After full time the bot asks "Did you watch it?" without showing the score, so nothing is spoiled. You answer with one tap: Loved it, Fine, Bailed, or Didn't watch.

Then it shows you the score, a drama rating worked out from the real event timeline (goals, late goals, lead changes, comebacks), and something most recommenders never tell you: whether that pick came from your memory or from the same agent with memory switched off.

## Memory is the product

Pocket Pundit has no hidden taste profile. Everything it knows about you is a set of Walrus Memory entries in your own namespace. Each one is a readable sentence with a small machine-readable tail:

```
[rating] 2026-11-09 · Loved Rennes 1–2 Lille (Ligue 1 (FRA) · Regular Season); kicked off 21:00 my time.
Drama 43/100: 3 goals. tags: verdict=1.00 comp=2000000018 team=rennes team=lille signal=tense kick=evening
```

That one is real: [it's on Walrus](https://walruscan.com/mainnet/blob/OEom5xRViyxCfBxlpRnpMoyNql0bKHjTDYBv7Nr094w).

Before each brief the agent runs a recall against your namespace and turns the tags back into weights for competitions, teams, kinds of match and kick-off times. Older memories count for less (a 21-day half-life). If recall returns nothing, the agent genuinely knows nothing, and it says so on day one.

Every pick cites the memories that shaped it, each linked to its Walrus blob. `/ask which leagues do I enjoy?` runs a semantic recall over your own memories and answers with them. `/card` draws your taste as an image you can share. `/export` downloads all of it as a taste passport, and the format is documented so another app can rebuild the same taste.

## Proving memory helps, honestly

Recommendation demos always look good. We wanted proof, so every brief is a blind A/B test:

- two picks come from the agent with your memory;
- one comes from the same agent with memory switched off;
- they are shuffled and described with the same neutral reasons.

You can't tell which is which until you've rated the match.

To stop anyone (us included) from rewriting history after the results are in, the brief is written to Walrus before the first kick-off. The memory-off pick is sealed as a commitment, `sha256("<date>|control=<match>|<salt>")`. After the last full time the bot reveals the salt, so you can recompute it yourself. The proof page then reads, through Tatum, the Sui checkpoint time at which that blob was certified, and shows how many minutes before kick-off the picks were locked.

The landing page shows the A/B result as it stands. If memory stops helping, that chart will say so. After 27 blind-rated picks (11 Nov), memory picks average 1.59 out of 2 and memory-off picks 1.38. That is one viewer, so it shows the loop working rather than a settled result.

Ratings only cover the three matches you were sent, so we also keep the counterfactual. When the brief is made, every match in your window is scored twice, once with your memories and once with memory off, and both top threes are stored. Once that night's picks have finished, your dashboard shows them side by side: which matches memory brought in, which it dropped and why, the Walrus blobs behind each reason, and the next morning, how every one of the six actually went. The night report ranks every finished match in your window, so a memory-off favourite that turned into a dull 0–0 shows up too.

It also shows memory being wrong. On 8 Nov memory brought in Sunderland v Chelsea and pushed Rennes v Lille from first to sixth. Rennes v Lille was still sent, as the hidden memory-off pick, and the viewer loved it, while Sunderland v Chelsea finished 96th of 125 on drama. That night is on Walrus, where it can't be edited.

## How Walrus and Tatum do the work

**Walrus Memory** (`@mysten-incubation/memwal`, mainnet relayer):

- Writes go through a durable queue, so a confirmed rating is never lost and never written twice. The queue paces itself under the relayer's rate limit and uses idempotency keys.
- Memories are Seal-encrypted. Namespaces are HMAC-derived, so no Telegram id ever appears on-chain.
- Anything credential-shaped is stripped before a write.

**Tatum** is how the app reads Sui. We used native gRPC (`sui.rpc.v2`) through Tatum's gateway, and GraphQL for events:

- `LedgerService/GetServiceInfo` for the current epoch and checkpoint;
- `LedgerService/GetObject` for the MemWalAccount: its owner, whether it's active, and its delegate keys;
- `StateService/ListOwnedObjects` for every Walrus `Blob` object the account owns, with its storage end epoch. Each stored memory's blob id is converted to the on-chain u256 and matched to its object;
- `LedgerService/GetTransaction` for when a brief lock was certified;
- GraphQL `AccountCreated` and `DelegateKeyAdded` events, to find a wallet's memory account and its key history.

One thing we learned along the way: public Sui JSON-RPC is gone. Everything here, including the wallet flow below, works without it.

## Your memory can be yours outright

By default nobody needs a wallet. Pocket Pundit runs one Walrus Memory account with a namespace per viewer. If you want custody, `/own` opens a page where your Sui wallet does two things itself through the Wallet Standard: it creates a Walrus Memory account, then adds Pocket Pundit's delegate key to it.

Our server then reads the account through Tatum, confirms the key is there, and copies your memories across once. From then on your writes and recalls go to your account. Remove the key whenever you like, and at the next brief the bot notices and stops writing there.

## Watching with a friend

`/duo` sends a friend an invite link. Once they've joined, each evening's brief includes one extra match chosen for both of your tastes and both of your watch windows, which matters when you live in different time zones. Neither of you sees the other's memories, only the shared pick.

## Things we had to get right

- **Ties at the top.** On 6 Nov four matches tied for the night's best, one of them a pick, and the report named a different one as "one of my picks". A Walrus memory can't be edited, so the fix writes a correction that supersedes the original, and the original stays on Walrus where anyone can check it. Reports now name the pick when it shares the top.
- **A pick the report left out.** Night reports skip futsal, so a 6–5 futsal game doesn't outrank league matches. On 9 Nov only three matches fell in the window, one of them a futsal game the viewer loved, and the report called it "no result". Picks now always get their place, and a second correction memory supersedes that report.
- **Keeping the blind test blind.** Until 8 Nov the brief showed each pick's score. Memory picks are scored with memory, so the memory-off pick usually had the lowest number. Scores and memory reasons now stay hidden until a pick is rated.

- **The data feed doesn't settle everything.** The public football API we use fills in results and timelines for some competitions (Premier League, Ligue 1, MLS, J1, V.League) and leaves others marked "scheduled" forever. We measure coverage per competition over the last week and prefer competitions that get settled, on both arms of the A/B so it stays fair. For a match without a result, the bot still asks how it was.
- **Scheduling on a hobby plan.** Vercel Hobby crons run once a day, and GitHub's scheduler skipped hours. The heartbeat now runs on Vercel Queues: every pass schedules the next one, five minutes out while matches, reminders or memory writes are in motion and on the half hour when nothing is due, so the free database can scale to zero between beats. The chain follows each new deployment.
- **Testing a bot that lives on mainnet.** An end-to-end suite drives the whole bot through a fake football world, a fake Telegram and Walrus Memory's in-memory mock: onboarding, briefs, locks, reminders, live alerts, ratings, lessons, day two, every command, `/duo`, `/export` and `/own`. It found four real bugs before users did.

## Honest limits

- The hosted relayer handles Seal encryption and embeddings, so it sees plaintext during writes and recalls. That is Walrus Memory's default path.
- Memories last as long as their Walrus storage (about 15 epochs), and the TS SDK can't renew them yet.
- Removing a delegate key is forward-only. Memories saved before removal stay readable by that key.
- There are no odds, no betting and no club branding. Football data comes from a public, anonymous API.

## What's next

- A weekly "season so far" summary written back as a memory.
- Richer `/ask` answers.
- Letting other apps read your taste passport, with your consent.

If you watch football at strange hours, try it tonight: [t.me/finder_matching_bot](https://t.me/finder_matching_bot).
