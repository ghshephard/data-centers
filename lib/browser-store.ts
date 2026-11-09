import type { DataCenter, DataCenterInput, RejectedEntry } from "./schema";

const KEY = "dcmap.rejected";

export function readRejected(): RejectedEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RejectedEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeRejected(entries: RejectedEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function toDataCenter(raw: DataCenterInput, id: number): DataCenter {
  return {
    ...raw,
    id,
    aliases: raw.aliases ?? [],
    operator: raw.operator ?? null,
    owner: raw.owner ?? null,
    tenant: raw.tenant ?? null,
    city: raw.city ?? null,
    county: raw.county ?? null,
    capacity_mw: raw.capacity_mw ?? null,
    planned_mw: raw.planned_mw ?? null,
    max_mw: Math.max(raw.capacity_mw ?? 0, raw.planned_mw ?? 0),
    announced_date: raw.announced_date ?? null,
    expected_completion: raw.expected_completion ?? null,
    investment_usd: raw.investment_usd ?? null,
    power_source: raw.power_source ?? null,
    utility: raw.utility ?? null,
    acreage: raw.acreage ?? null,
    notes: raw.notes ?? null,
    created_at: "",
    updated_at: "",
  };
}
