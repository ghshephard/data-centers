import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  DataCenterInputSchema,
  type DataCenter,
  type DataCenterInput,
  type RejectedEntry,
  type Source,
} from "./schema";

const DB_PATH = process.env.DATACENTER_DB ?? path.join(process.cwd(), "data", "datacenters.db");
const SEED_PATH = path.join(process.cwd(), "data", "seed.json");
const REJECTED_PATH = path.join(process.cwd(), "data", "rejected.json");

const REJECT_RADIUS_KM = 2;
const DUPLICATE_RADIUS_KM = 1;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS datacenters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      operator TEXT,
      owner TEXT,
      tenant TEXT,
      city TEXT,
      county TEXT,
      state TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      capacity_mw REAL,
      planned_mw REAL,
      status TEXT NOT NULL,
      announced_date TEXT,
      expected_completion TEXT,
      investment_usd REAL,
      power_source TEXT,
      utility TEXT,
      acreage REAL,
      notes TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      sources TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS rejected (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      operator TEXT,
      state TEXT,
      lat REAL,
      lon REAL,
      reason TEXT,
      record TEXT,
      rejected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM datacenters").get() as { n: number };
  const { r } = db.prepare("SELECT COUNT(*) AS r FROM rejected").get() as { r: number };
  if (n === 0 && r === 0 && !process.env.DATACENTER_NO_AUTOSEED) seedFromFiles();
  return db;
}

/** Load data/rejected.json (the exported blocklist) first, then data/seed.json. */
export function seedFromFiles(): ImportReport {
  const reject = fs.existsSync(REJECTED_PATH) ? JSON.parse(fs.readFileSync(REJECTED_PATH, "utf8")) : [];
  const existing = new Set(listRejected().map((r) => `${normalizeName(r.name)}|${r.state ?? ""}`));
  const newRejects = (reject as { name: string; state?: string }[]).filter(
    (r) => !existing.has(`${normalizeName(r.name)}|${r.state?.toUpperCase() ?? ""}`),
  );
  const datacenters = fs.existsSync(SEED_PATH) ? JSON.parse(fs.readFileSync(SEED_PATH, "utf8")) : [];
  return importRecords({ reject: newRejects, datacenters });
}

const STOP_WORDS = /\b(data ?cent(er|re)s?|campus|ai|the|project|facility|site|phase \w+|llc|inc)\b/g;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(STOP_WORDS, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function nameKeys(name: string, aliases: string[] | null | undefined): Set<string> {
  // Short, code-like aliases (e.g. "ORD01") are shared by unrelated sites, so only
  // word-like keys of a reasonable length count toward identity.
  return new Set(
    [name, ...(aliases ?? [])].map(normalizeName).filter((k) => k.length >= 6 && !/^\d+$/.test(k)),
  );
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function sameOperator(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na.length > 1 && (na.includes(nb) || nb.includes(na));
}

interface Row {
  id: number;
  name: string;
  aliases: string;
  operator: string | null;
  state: string;
  lat: number;
  lon: number;
  sources: string;
  [key: string]: unknown;
}

interface RejectedRow {
  id: number;
  name: string;
  aliases: string;
  operator: string | null;
  state: string | null;
  lat: number | null;
  lon: number | null;
  reason: string | null;
  record: string | null;
  rejected_at: string;
}

function rowToDataCenter(row: Row): DataCenter {
  const dc = {
    ...row,
    aliases: JSON.parse(row.aliases) as string[],
    sources: JSON.parse(row.sources) as Source[],
  } as unknown as DataCenter;
  dc.max_mw = Math.max(dc.capacity_mw ?? 0, dc.planned_mw ?? 0);
  return dc;
}

function rowToRejected(row: RejectedRow): RejectedEntry {
  return {
    id: row.id,
    name: row.name,
    aliases: JSON.parse(row.aliases),
    state: row.state,
    lat: row.lat,
    lon: row.lon,
    reason: row.reason,
    rejected_at: row.rejected_at,
    record: row.record ? JSON.parse(row.record) : null,
  };
}

/** A rejection matches on any shared name/alias, or on proximity to the same operator. */
export function findRejection(input: Pick<DataCenterInput, "name" | "aliases" | "state" | "lat" | "lon" | "operator">): RejectedEntry | null {
  const keys = nameKeys(input.name, input.aliases);
  const rows = getDb().prepare("SELECT * FROM rejected").all() as RejectedRow[];
  for (const row of rows) {
    if (row.state && row.state !== input.state) continue;
    const rKeys = nameKeys(row.name, JSON.parse(row.aliases));
    if ([...keys].some((k) => rKeys.has(k))) return rowToRejected(row);
    if (
      row.lat != null &&
      row.lon != null &&
      distanceKm(row.lat, row.lon, input.lat, input.lon) <= REJECT_RADIUS_KM &&
      (sameOperator(row.operator, input.operator) || !row.operator || !input.operator)
    ) {
      return rowToRejected(row);
    }
  }
  return null;
}

function findExisting(input: DataCenterInput): Row | null {
  const keys = nameKeys(input.name, input.aliases);
  const rows = getDb().prepare("SELECT * FROM datacenters WHERE state = ?").all(input.state) as Row[];
  for (const row of rows) {
    const rKeys = nameKeys(row.name, JSON.parse(row.aliases));
    if ([...keys].some((k) => rKeys.has(k))) return row;
  }
  for (const row of rows) {
    if (
      distanceKm(row.lat, row.lon, input.lat, input.lon) <= DUPLICATE_RADIUS_KM &&
      sameOperator(row.operator, input.operator)
    ) {
      return row;
    }
  }
  return null;
}

const FIELDS = [
  "operator", "owner", "tenant", "city", "county", "state", "lat", "lon",
  "capacity_mw", "planned_mw", "status", "announced_date", "expected_completion",
  "investment_usd", "power_source", "utility", "acreage", "notes", "confidence",
] as const;

function insert(input: DataCenterInput): number {
  const cols = ["name", "aliases", "sources", ...FIELDS];
  const stmt = getDb().prepare(
    `INSERT INTO datacenters (${cols.join(",")}) VALUES (${cols.map((c) => "@" + c).join(",")})`,
  );
  const params: Record<string, unknown> = {
    name: input.name,
    aliases: JSON.stringify(input.aliases ?? []),
    sources: JSON.stringify(input.sources),
  };
  for (const f of FIELDS) params[f] = input[f] ?? null;
  return Number(stmt.run(params).lastInsertRowid);
}

/** Merge incoming data into an existing row: non-null values win, aliases and sources are unioned. */
function merge(row: Row, input: DataCenterInput): void {
  const aliases = new Set<string>(JSON.parse(row.aliases));
  if (normalizeName(input.name) !== normalizeName(row.name)) aliases.add(input.name);
  for (const a of input.aliases ?? []) if (normalizeName(a) !== normalizeName(row.name)) aliases.add(a);

  const sources: Source[] = JSON.parse(row.sources);
  for (const s of input.sources) if (!sources.some((x) => x.url === s.url)) sources.push(s);

  const params: Record<string, unknown> = {
    id: row.id,
    aliases: JSON.stringify([...aliases]),
    sources: JSON.stringify(sources),
  };
  const sets = ["aliases = @aliases", "sources = @sources", "updated_at = datetime('now')"];
  for (const f of FIELDS) {
    const v = input[f];
    if (v !== null && v !== undefined) {
      params[f] = v;
      sets.push(`${f} = @${f}`);
    }
  }
  getDb().prepare(`UPDATE datacenters SET ${sets.join(", ")} WHERE id = @id`).run(params);
}

export interface ImportReport {
  added: string[];
  updated: string[];
  skippedRejected: { name: string; matched: string; reason: string | null }[];
  invalid: { index: number; name?: string; error: string }[];
  rejectedAdded: string[];
}

export interface ImportFile {
  datacenters?: unknown[];
  reject?: { name: string; aliases?: string[]; operator?: string; state?: string; lat?: number; lon?: number; reason?: string }[];
}

/** Import a plain array of data centers, or `{ datacenters: [...], reject: [...] }`. */
export function importRecords(payload: unknown[] | ImportFile, opts: { ignoreRejections?: boolean } = {}): ImportReport {
  const file: ImportFile = Array.isArray(payload) ? { datacenters: payload } : payload;
  const report: ImportReport = { added: [], updated: [], skippedRejected: [], invalid: [], rejectedAdded: [] };
  const database = getDb();

  database.transaction(() => {
    for (const r of file.reject ?? []) {
      addRejection({ ...r, record: null });
      report.rejectedAdded.push(r.name);
    }
    (file.datacenters ?? []).forEach((raw, index) => {
      const parsed = DataCenterInputSchema.safeParse(raw);
      if (!parsed.success) {
        report.invalid.push({
          index,
          name: (raw as { name?: string })?.name,
          error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
        return;
      }
      const input = parsed.data;
      if (!opts.ignoreRejections) {
        const rejection = findRejection(input);
        if (rejection) {
          report.skippedRejected.push({ name: input.name, matched: rejection.name, reason: rejection.reason });
          return;
        }
      }
      const existing = findExisting(input);
      if (existing) {
        merge(existing, input);
        report.updated.push(input.name);
      } else {
        insert(input);
        report.added.push(input.name);
      }
    });
  })();

  return report;
}

function addRejection(r: {
  name: string;
  aliases?: string[] | null;
  operator?: string | null;
  state?: string | null;
  lat?: number | null;
  lon?: number | null;
  reason?: string | null;
  record: DataCenterInput | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO rejected (name, aliases, operator, state, lat, lon, reason, record)
       VALUES (@name, @aliases, @operator, @state, @lat, @lon, @reason, @record)`,
    )
    .run({
      name: r.name,
      aliases: JSON.stringify(r.aliases ?? []),
      operator: r.operator ?? null,
      state: r.state ? r.state.toUpperCase() : null,
      lat: r.lat ?? null,
      lon: r.lon ?? null,
      reason: r.reason ?? null,
      record: r.record ? JSON.stringify(r.record) : null,
    });
}

export function listDataCenters(filter: { minMw?: number; statuses?: string[] } = {}): DataCenter[] {
  const rows = getDb().prepare("SELECT * FROM datacenters").all() as Row[];
  return rows
    .map(rowToDataCenter)
    .filter((dc) => (filter.minMw ? dc.max_mw >= filter.minMw : true))
    .filter((dc) => (filter.statuses?.length ? filter.statuses.includes(dc.status) : true))
    .sort((a, b) => b.max_mw - a.max_mw);
}

export function getDataCenter(id: number): DataCenter | null {
  const row = getDb().prepare("SELECT * FROM datacenters WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToDataCenter(row) : null;
}

/** Move a data center into the rejected table so it is never re-imported. */
export function rejectDataCenter(id: number, reason: string | null): boolean {
  const dc = getDataCenter(id);
  if (!dc) return false;
  const { id: _id, max_mw: _max, created_at: _c, updated_at: _u, ...record } = dc;
  getDb().transaction(() => {
    addRejection({ ...record, reason, record: record as DataCenterInput });
    getDb().prepare("DELETE FROM datacenters WHERE id = ?").run(id);
  })();
  return true;
}

export function listRejected(): RejectedEntry[] {
  const rows = getDb().prepare("SELECT * FROM rejected ORDER BY rejected_at DESC, id DESC").all() as RejectedRow[];
  return rows.map(rowToRejected);
}

/** Remove a rejection; if the original record was kept, put it back on the map. */
export function restoreRejected(id: number): boolean {
  const row = getDb().prepare("SELECT * FROM rejected WHERE id = ?").get(id) as RejectedRow | undefined;
  if (!row) return false;
  getDb().transaction(() => {
    getDb().prepare("DELETE FROM rejected WHERE id = ?").run(id);
    if (row.record) importRecords([JSON.parse(row.record)], { ignoreRejections: true });
  })();
  return true;
}
