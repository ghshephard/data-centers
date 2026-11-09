"use client";

import { useState } from "react";
import type { DataCenter } from "@/lib/schema";
import { formatMw, formatUsd, place, statusLabel } from "@/lib/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export default function Details({
  dc,
  onClose,
  onReject,
}: {
  dc: DataCenter;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function reject() {
    setBusy(true);
    try {
      await onReject(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="details">
      <div className="head">
        <h2>{dc.name}</h2>
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="sub">
        <span className={`badge ${dc.status}`}>{statusLabel(dc.status)}</span>{" "}
        {place(dc)}
        {dc.confidence === "low" && <span className="conf-low"> · low confidence</span>}
      </div>
      <dl>
        <Row label="Capacity now" value={formatMw(dc.capacity_mw)} />
        <Row label="Planned total" value={formatMw(dc.planned_mw)} />
        <Row label="Operator" value={dc.operator} />
        <Row label="Owner" value={dc.owner} />
        <Row label="Tenant" value={dc.tenant} />
        <Row label="County" value={dc.county} />
        <Row label="Announced" value={dc.announced_date} />
        <Row label="Completion" value={dc.expected_completion} />
        <Row label="Investment" value={formatUsd(dc.investment_usd)} />
        <Row label="Power" value={dc.power_source} />
        <Row label="Utility" value={dc.utility} />
        <Row label="Acreage" value={dc.acreage ? `${dc.acreage.toLocaleString()} acres` : null} />
        <Row label="Coordinates" value={`${dc.lat.toFixed(4)}, ${dc.lon.toFixed(4)}`} />
      </dl>
      {dc.aliases.length > 0 && <p className="reason">Also known as: {dc.aliases.join(", ")}</p>}
      {dc.notes && <p className="notes">{dc.notes}</p>}
      <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)" }}>Sources</h3>
      <ul>
        {dc.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
            {s.retrieved && <span className="reason"> ({s.retrieved})</span>}
          </li>
        ))}
      </ul>
      {confirming ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input className="search" placeholder="Reason (optional), e.g. rumor, cancelled" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="danger" disabled={busy} onClick={reject}>{busy ? "Removing…" : "Confirm: not real"}</button>
            <button className="restore" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="danger" onClick={() => setConfirming(true)}>Mark as not real</button>
      )}
    </aside>
  );
}
