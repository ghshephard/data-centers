import { getDb, seedFromFiles } from "../lib/db";

process.env.DATACENTER_NO_AUTOSEED = "1";
const db = getDb();
if (process.argv.includes("--reset")) {
  // Rejections are kept so known-bad entries stay out after a rebuild.
  db.exec("DELETE FROM datacenters");
  console.log("Cleared datacenters table (rejections kept).");
}

const report = seedFromFiles();
const { n } = db.prepare("SELECT COUNT(*) AS n FROM datacenters").get() as { n: number };
console.log(
  `Seed: ${report.added.length} added, ${report.updated.length} merged, ` +
    `${report.skippedRejected.length} skipped as rejected, ${report.rejectedAdded.length} rejections loaded, ` +
    `${report.invalid.length} invalid. ${n} data centers in database.`,
);
for (const i of report.invalid) console.log(`  ! [${i.index}] ${i.name ?? "?"}: ${i.error}`);
