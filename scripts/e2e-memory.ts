// End-to-end check of the write queue (enqueue -> submit -> settle) and the proof view, against mainnet.
import { enqueueMemory, processMemoryQueue } from "../lib/memory.ts";
import { proofView } from "../lib/views.ts";
import { q } from "../lib/db.ts";
import { sleep } from "../lib/util.ts";
process.env.PGLITE_DIR = process.env.PGLITE_DIR || "./data/pglite-dry";
const r = await enqueueMemory({ userId: null, namespace: "mf:system", kind: "system", text: `[system] ${new Date().toISOString().slice(0, 10)} · Write-queue self-test: enqueue, paced submit, bulk status settle.`, idem: "system:queue-selftest:v1" });
console.log("enqueued", r);
for (let i = 0; i < 8; i++) {
  const p = await processMemoryQueue();
  const [row] = await q(`select status, job_id, blob_id, error from memory_jobs where id = $1`, [r.id]);
  console.log(`pass ${i}:`, JSON.stringify({ submitted: p.submitted, stored: p.stored.length }), JSON.stringify(row));
  if (row?.status === "stored") break;
  await sleep(8000);
}
const t0 = Date.now();
const proof = await proofView();
console.log("proof", Date.now() - t0, "ms", JSON.stringify({ account: proof.account && { owner: proof.account.owner, active: proof.account.active, keys: proof.account.delegateKeys.map((k) => k.label) }, chain: proof.chain, onChain: proof.blobs.onChainCount, verified: proof.verified, relayer: proof.relayer, sample: proof.blobs.sample.slice(0, 2) }));
process.exit(0);
