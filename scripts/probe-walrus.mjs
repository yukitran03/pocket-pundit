// Probe: Walrus Memory mainnet health + one real write + read-back. Run: node --env-file=.env.local scripts/probe-walrus.mjs
import { MemWal } from "@mysten-incubation/memwal";
const mw = MemWal.create({ key: process.env.MEMWAL_PRIVATE_KEY, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: process.env.MEMWAL_SERVER_URL });
const t0 = Date.now();
console.log("health", JSON.stringify(await mw.health()));
console.log("pubkey matches env:", (await mw.getPublicKeyHex()) === process.env.MEMWAL_PUBLIC_KEY);
const ns = await mw.listNamespaces({ limit: 50 });
console.log("namespaces", JSON.stringify(ns.namespaces).slice(0, 400));
const ns1 = "mf:system";
const text = `[system][${new Date().toISOString().slice(0,10)}] Match Finder agent online. It recommends one football match worth watching each night and learns the viewer's taste from ratings and match timelines.`;
const acc = await mw.remember(text, ns1, { idempotencyKey: "mf:system:boot:v1" });
console.log("remember accepted", JSON.stringify(acc), (Date.now()-t0)+"ms");
const res = await mw.waitForRememberJob(acc.job_id, { timeoutMs: 180000, pollIntervalMs: 3000 });
console.log("stored", JSON.stringify(res), (Date.now()-t0)+"ms");
const r = await mw.recall({ query: "what does the agent do", namespace: ns1, limit: 5, sort: "relevance" });
console.log("recall", JSON.stringify(r).slice(0, 500), (Date.now()-t0)+"ms");
const m = await mw.listMemories({ namespace: ns1, limit: 10 });
console.log("listMemories", JSON.stringify(m.memories.slice(0,2)));
mw.destroy();
