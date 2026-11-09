import { z } from "zod";

export const STATUSES = ["operational", "under_construction", "announced", "planned"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  operational: "Operational",
  under_construction: "Under construction",
  announced: "Announced",
  planned: "Planned",
};

export const TIERS = [50, 500, 1000] as const;

const optStr = z.string().trim().min(1).nullish();
const optNum = z.number().nonnegative().nullish();

export const SourceSchema = z.object({
  url: z.string().url(),
  title: z.string().nullish(),
  retrieved: z.string().nullish(),
});

export const DataCenterInputSchema = z.object({
  name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).nullish(),
  operator: optStr,
  owner: optStr,
  tenant: optStr,
  city: optStr,
  county: optStr,
  state: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  lat: z.number().min(17).max(72),
  lon: z.number().min(-180).max(-64),
  capacity_mw: optNum,
  planned_mw: optNum,
  status: z.enum(STATUSES),
  announced_date: optStr,
  expected_completion: optStr,
  investment_usd: optNum,
  power_source: optStr,
  utility: optStr,
  acreage: optNum,
  notes: optStr,
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  sources: z.array(SourceSchema).min(1),
});

export type DataCenterInput = z.infer<typeof DataCenterInputSchema>;
export type Source = z.infer<typeof SourceSchema>;

export interface DataCenter {
  id: number;
  name: string;
  aliases: string[];
  operator: string | null;
  owner: string | null;
  tenant: string | null;
  city: string | null;
  county: string | null;
  state: string;
  lat: number;
  lon: number;
  capacity_mw: number | null;
  planned_mw: number | null;
  max_mw: number;
  status: Status;
  announced_date: string | null;
  expected_completion: string | null;
  investment_usd: number | null;
  power_source: string | null;
  utility: string | null;
  acreage: number | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
  sources: Source[];
  created_at: string;
  updated_at: string;
}

export interface RejectedEntry {
  id: number;
  name: string;
  aliases: string[];
  state: string | null;
  lat: number | null;
  lon: number | null;
  reason: string | null;
  rejected_at: string;
  record: DataCenterInput | null;
}
