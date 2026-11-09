import fs from "node:fs";
import { importRecords, type ImportReport } from "../lib/db";

export function printReport(label: string, report: ImportReport): void {
  console.log(`\n${label}`);
  console.log(`  added:            ${report.added.length}`);
  for (const n of report.added) console.log(`    + ${n}`);
  console.log(`  updated (merged): ${report.updated.length}`);
  for (const n of report.updated) console.log(`    ~ ${n}`);
  console.log(`  skipped, rejected: ${report.skippedRejected.length}`);
  for (const s of report.skippedRejected) {
    console.log(`    x ${s.name} (matches rejected "${s.matched}"${s.reason ? `: ${s.reason}` : ""})`);
  }
  if (report.rejectedAdded.length) {
    console.log(`  new rejections:   ${report.rejectedAdded.length}`);
    for (const n of report.rejectedAdded) console.log(`    - ${n}`);
  }
  console.log(`  invalid:          ${report.invalid.length}`);
  for (const i of report.invalid) console.log(`    ! [${i.index}] ${i.name ?? "?"}: ${i.error}`);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: npm run import -- <file.json> [more.json ...]");
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const report = importRecords(JSON.parse(fs.readFileSync(file, "utf8")));
  printReport(file, report);
  if (report.invalid.length) failed = true;
}
process.exit(failed ? 2 : 0);
