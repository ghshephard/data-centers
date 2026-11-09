import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcmap-"));
process.env.DATACENTER_DB = path.join(dir, "t.db");
process.env.DATACENTER_NO_AUTOSEED = "1";

const { getDb, importRecords, listDataCenters, listRejected, rejectDataCenter, restoreRejected } = require("../lib/db") as typeof import("../lib/db");

const base = {
  state: "TX", lat: 32.5, lon: -99.7, status: "announced" as const,
  sources: [{ url: "https://example.com/a", title: "A", retrieved: "2026-11-08" }],
};

let report = importRecords([
  { ...base, name: "Alpha Campus", aliases: ["Alpha One"], operator: "Acme", planned_mw: 800 },
  { ...base, name: "Alpha One", operator: "Acme", planned_mw: 1200, notes: "expanded" },
  { ...base, name: "Beta Site", operator: "Other", lat: 32.501, lon: -99.701, planned_mw: 600 },
  { name: "Bad", state: "T", lat: 0, lon: 0, status: "nope", sources: [] },
]);
assert(report.added.length === 2, `expected 2 added, got ${report.added}`);
assert(report.updated.length === 1, `expected 1 updated, got ${report.updated}`);
assert(report.invalid.length === 1, `expected 1 invalid, got ${JSON.stringify(report.invalid)}`);

const all = listDataCenters();
const alpha = all.find((d) => d.name === "Alpha Campus")!;
assert(alpha.planned_mw === 1200, "merge should take the newer planned_mw");
assert(alpha.notes === "expanded", "merge should fill null fields");
assert(alpha.aliases.includes("Alpha One"), "alias recorded");
assert(all.length === 2, `dedupe failed, have ${all.length}`);

assert(rejectDataCenter(alpha.id, "rumor"), "reject returns true");
assert(listDataCenters().length === 1, "rejected row removed");
assert(listRejected().length === 1 && listRejected()[0].reason === "rumor", "rejection stored");

report = importRecords([{ ...base, name: "Alpha Campus Phase 2", operator: "Acme", planned_mw: 2000 }]);
assert(report.skippedRejected.length === 1, `re-import should be blocked, got ${JSON.stringify(report)}`);
assert(listDataCenters().length === 1, "blocked entry not inserted");

report = importRecords([{ ...base, name: "Totally Different", operator: "Acme", lat: 32.505, lon: -99.705, planned_mw: 900 }]);
assert(report.skippedRejected.length === 1, "proximity + same operator should block");

const rejId = listRejected()[0].id;
assert(restoreRejected(rejId), "restore returns true");
assert(listRejected().length === 0, "rejection lifted");
assert(listDataCenters().some((d) => d.name === "Alpha Campus"), "original record restored");

report = importRecords([{ ...base, name: "Alpha Campus", operator: "Acme", planned_mw: 3000 }]);
assert(report.updated.length === 1, "imports work again after restore");

getDb().close();
fs.rmSync(dir, { recursive: true });
console.log("selftest passed");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL: " + msg);
    process.exit(1);
  }
}
