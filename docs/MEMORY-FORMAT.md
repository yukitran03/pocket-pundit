# Taste memory format (v1)

Pocket Pundit keeps a viewer's football taste only as Walrus Memory entries: one namespace per viewer, one readable sentence per memory. There is no hidden copy. If recall returns nothing, the agent knows nothing.

This page documents the format, so the viewer (or another app they authorise) can read the same memories and get the same taste.

## One memory

```
[<kind>] <YYYY-MM-DD> · <human sentence> tags: <key>=<value> <key>=<value> …
```

- `kind` is one of `rating`, `preference`, `limit`, `lesson`, `brief` or `system`.
- The date is the viewer's local date when the memory was written.
- The sentence is meant for people. Recall returns it as is.
- Everything after ` tags: ` is meant for machines. Unknown keys must be ignored.

| Tag | Meaning |
|---|---|
| `verdict=<-1..1>` | How much the viewer liked it. Loved 1.00, fine 0.35, bailed -0.80, skipped 0, a stated preference ±0.80, switching on for a live alert 0.60, passing on one -0.25 |
| `comp=<id>` | Competition id from the public football data feed |
| `team=<slug>` | A team, slugified (`manchester-united`) |
| `signal=<name>` | What happened, or what the viewer asked for: `high-scoring`, `late-goals`, `lead-changes`, `comeback`, `tense`, `goalless`, `one-sided`, `red-card`, `shot-fest` |
| `kick=<bucket>` | Kick-off time in the viewer's zone: `day`, `evening` (17:00 and later) or `late` (before 06:00) |
| `kind=brief` | A locked brief. It carries no taste weight |
| `kind=night` | A night report. It carries no taste weight |

Examples:

```
[rating] 2026-11-04 · Loved Northbridge 3–2 Eastvale (Premier League); kicked off 21:00 my time. Drama 92/100: 5 goals, 2 after 75', 2 lead changes, comeback. tags: verdict=1.00 comp=2000000000 team=northbridge team=eastvale signal=high-scoring signal=late-goals signal=lead-changes signal=comeback kick=evening

[preference] 2026-11-04 · I love late comebacks tags: verdict=0.80 signal=comeback

[limit] 2026-11-04 · no matches after 2am on weekdays tags: verdict=-0.80 kick=late

[brief] 2026-11-04 · Tonight's picks, locked before kick-off: A v B (Wed 19:15); C v D (Wed 20:45); E v F (Wed 22:00). Memory-off pick sealed: commit 3f9a1c2b7d4e5f60. tags: kind=brief

[night] 2026-11-04 · Night report for my 19:00 to 02:00 window: 7 of 25 matches finished with full data. Best: A 3–2 B (Premier League), drama 87, one of my picks. My picks ranked #1, #2 and #5. tags: kind=night
```

## From memories to taste

For each tagged memory (not `lesson`, `system`, `brief` or `night`, and with a non-zero verdict), every key gets `verdict × decay`:

- `decay = 0.5 ^ (age_days / 21)`, a 21-day half-life;
- team keys are scaled by 0.6.

Each key's weight is `tanh(sum / 1.5)`, which falls in -1 to 1. The reference implementation is `parseMemory` and `buildTaste` in [lib/taste.ts](../lib/taste.ts).

## Brief locks

A `brief` memory lists tonight's picks before the first kick-off. Which pick was the memory-off control is sealed as:

```
commit = sha256("<date>|control=<matchId>|<salt>")[0..16]
```

After the last full time, the bot reveals `salt` and the control's match id. Anyone can then recompute the commit, and Tatum's Sui gateway shows when the blob was certified on Sui.

## Night reports

Once a watch window has closed and results have had 150 minutes to land, every match in it that finished with a score is ranked by drama from the public timeline. Futsal and beach soccer are left out because they score differently. Ties share a rank. The `night` memory records the best match and where the picks landed, without saying which pick ran with memory off. The picks were locked in a `brief` memory before kick-off, so the report can be checked against that lock. The reference implementation is `rankNight` in [lib/night.ts](../lib/night.ts).

## Taking it with you

- `/export` in the bot, or `GET /api/me/export?t=<dashboard token>`, downloads a taste passport (`pocket-pundit.taste-passport/v1`). It contains every stored memory with its blob id and Walruscan link, the learned weights, and the viewer's time zone and watch window.
- The memories themselves live in Walrus Memory. Any app holding a delegate key for the account can recall the same namespace and rebuild the same taste with the rules above.
