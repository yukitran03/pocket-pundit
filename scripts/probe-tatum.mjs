// Probe Tatum Sui GraphQL with key. Run: node --env-file=.env.local scripts/probe-tatum.mjs
const GQL = "https://sui-mainnet.gateway.tatum.io/graphql";
const OWNER = "0x9bacad5b532906701208c0d8a81ee9a78d6c096a68902cf5213bcfaac82e68e3";
const ACCOUNT = process.env.MEMWAL_ACCOUNT_ID;
let last = 0;
async function q(query, variables = {}) {
  const wait = Math.max(0, last + 450 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); last = Date.now();
  const t = Date.now();
  const r = await fetch(GQL, { method: "POST", headers: { "content-type": "application/json", "x-api-key": process.env.TATUM_API_KEY }, body: JSON.stringify({ query, variables }) });
  const txt = await r.text();
  return { status: r.status, ms: Date.now() - t, body: txt };
}
const show = (label, x, n = 900) => console.log(`\n# ${label} [${x.status}, ${x.ms}ms]\n${x.body.slice(0, n)}`);
show("chain+epoch", await q(`{ chainIdentifier epoch { epochId startTimestamp } serviceConfig { maxQueryDepth } }`));
show("EventFilter fields", await q(`{ __type(name: "EventFilter") { inputFields { name } } }`));
show("ObjectFilter fields", await q(`{ __type(name: "ObjectFilter") { inputFields { name } } }`));
show("account object", await q(`query($a: SuiAddress!){ object(address: $a) { address version asMoveObject { contents { type { repr } json } } } }`, { a: ACCOUNT }), 1500);
show("owner objects", await q(`query($o: SuiAddress!){ address(address: $o) { objects(first: 10) { nodes { address contents { type { repr } } } } } }`, { o: OWNER }), 1500);
const blobs = await q(`query($o: SuiAddress!){ address(address: $o) { objects(first: 5, filter: { type: "0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob" }) { nodes { address contents { json } } } } }`, { o: OWNER });
show("owner Blob objects (walrus pkg guess)", blobs, 2500);
show("DelegateKeyAdded events", await q(`{ events(last: 5, filter: { type: "0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5::account::DelegateKeyAdded" }) { nodes { timestamp contents { json } transaction { digest } } } }`), 1500);
