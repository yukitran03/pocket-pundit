// Probe Tatum native gRPC (Sui rpc v2). Run: node --env-file=.env.local scripts/probe-grpc.mjs
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
const root = path.resolve("proto");
const def = protoLoader.loadSync(["sui/rpc/v2/ledger_service.proto", "sui/rpc/v2/state_service.proto"], { includeDirs: [root], keepCase: true, longs: String, enums: String, defaults: false, oneofs: true });
const pkg = grpc.loadPackageDefinition(def).sui.rpc.v2;
const creds = grpc.credentials.createSsl();
const host = "sui-mainnet-grpc.gateway.tatum.io:443";
const md = new grpc.Metadata(); md.set("x-api-key", process.env.TATUM_API_KEY);
const ledger = new pkg.LedgerService(host, creds);
const state = new pkg.StateService(host, creds);
const call = (c, m, req) => new Promise((res, rej) => { const t = Date.now(); c[m](req, md, { deadline: Date.now() + 15000 }, (e, r) => e ? rej(Object.assign(e, { ms: Date.now() - t })) : res({ r, ms: Date.now() - t })); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
try {
  const a = await call(ledger, "GetServiceInfo", {}); console.log("GetServiceInfo", a.ms + "ms", JSON.stringify(a.r).slice(0, 300));
  await sleep(400);
  const b = await call(ledger, "GetObject", { object_id: process.env.MEMWAL_ACCOUNT_ID, read_mask: { paths: ["object_id", "version", "object_type", "owner", "json", "previous_transaction"] } });
  console.log("GetObject(account)", b.ms + "ms", JSON.stringify(b.r).slice(0, 700));
  await sleep(400);
  const c = await call(state, "ListOwnedObjects", { owner: "0x9bacad5b532906701208c0d8a81ee9a78d6c096a68902cf5213bcfaac82e68e3", page_size: 5, object_type: "0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob", read_mask: { paths: ["object_id", "version", "object_type", "json", "previous_transaction"] } });
  console.log("ListOwnedObjects(Blob)", c.ms + "ms", JSON.stringify(c.r).slice(0, 900));
} catch (e) { console.log("ERR", e.code, e.details || e.message, e.ms); }
process.exit(0);
