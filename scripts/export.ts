import fs from "node:fs";
import path from "node:path";
import { listDataCenters, listRejected } from "../lib/db";

const outDir = path.join(process.cwd(), "data");

const datacenters = listDataCenters().map(({ id: _id, max_mw: _max, created_at: _c, updated_at: _u, ...rest }) => rest);
fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(datacenters, null, 2) + "\n");

const rejected = listRejected().map(({ id: _id, record: _r, ...rest }) => rest);
fs.writeFileSync(path.join(outDir, "rejected.json"), JSON.stringify(rejected, null, 2) + "\n");

console.log(`Wrote ${datacenters.length} data centers to data/seed.json and ${rejected.length} rejections to data/rejected.json`);
