import { STATUS_LABELS, type Status } from "./schema";

export function formatMw(mw: number | null | undefined): string {
  if (mw == null) return "—";
  if (mw >= 1000) {
    const gw = mw / 1000;
    return `${Number.isInteger(gw) ? gw : gw.toFixed(1)} GW`;
  }
  return `${mw} MW`;
}

export function formatUsd(usd: number | null | undefined): string {
  if (usd == null) return "—";
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(usd >= 1e10 ? 0 : 1)}B`;
  if (usd >= 1e6) return `$${Math.round(usd / 1e6)}M`;
  return `$${usd.toLocaleString()}`;
}

export function statusLabel(status: Status): string {
  return STATUS_LABELS[status];
}

export function place(dc: { city: string | null; county: string | null; state: string }): string {
  return [dc.city ?? dc.county, dc.state].filter(Boolean).join(", ");
}
