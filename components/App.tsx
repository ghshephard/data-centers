"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { DataCenter, RejectedEntry, Status } from "@/lib/schema";
import { STATUSES } from "@/lib/schema";
import { formatMw, place, statusLabel } from "@/lib/format";
import { readRejected, toDataCenter, writeRejected } from "@/lib/browser-store";
import Details from "./Details";

const staticSite = process.env.NEXT_PUBLIC_DATA_SOURCE === "static";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const TIERS = [
  { min: 50, label: "≥ 50 MW" },
  { min: 500, label: "≥ 500 MW" },
  { min: 1000, label: "≥ 1 GW" },
];

const STATUS_COLOR: Record<Status, string> = {
  operational: "var(--operational)",
  under_construction: "var(--under_construction)",
  announced: "var(--announced)",
  planned: "var(--planned)",
};

export default function App() {
  const [all, setAll] = useState<DataCenter[]>([]);
  const [minMw, setMinMw] = useState(500);
  const [statuses, setStatuses] = useState<Set<Status>>(new Set(STATUSES));
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"mw" | "name">("mw");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [rejected, setRejected] = useState<RejectedEntry[] | null>(null);

  async function load() {
    if (staticSite) {
      const raw = await fetch("/datacenters.json").then((r) => r.json());
      const blocked = readRejected();
      const blockedNames = new Set(blocked.map((r) => `${r.name}|${r.state ?? ""}`));
      setRejected(blocked);
      setAll(
        (raw as Parameters<typeof toDataCenter>[0][])
          .filter((d) => !blockedNames.has(`${d.name}|${d.state}`))
          .map((d, i) => toDataCenter(d, i + 1)),
      );
      return;
    }
    const res = await fetch("/api/datacenters");
    setAll(await res.json());
  }
  useEffect(() => { load(); }, []);

  async function loadRejected() {
    if (staticSite) {
      setRejected(readRejected());
      setShowRejected(true);
      return;
    }
    const res = await fetch("/api/rejected");
    setRejected(await res.json());
    setShowRejected(true);
  }

  async function rejectSelected(reason: string) {
    if (!selected) return;
    if (staticSite) {
      const entry = {
        id: Date.now(),
        name: selected.name,
        aliases: selected.aliases,
        state: selected.state,
        lat: selected.lat,
        lon: selected.lon,
        reason: reason.trim() || null,
        rejected_at: new Date().toISOString(),
        record: selected,
      };
      const next = [entry, ...readRejected()];
      writeRejected(next);
      setRejected(next);
      setAll((prev) => prev.filter((d) => d.id !== selected.id));
      setSelectedId(null);
      return;
    }
    const res = await fetch(`/api/datacenters/${selected.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("reject failed");
    setAll((prev) => prev.filter((d) => d.id !== selected.id));
    setSelectedId(null);
    setRejected(null);
  }

  const counts = useMemo(
    () => Object.fromEntries(TIERS.map((t) => [t.min, all.filter((d) => d.max_mw >= t.min).length])),
    [all],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter(
      (d) =>
        d.max_mw >= minMw &&
        statuses.has(d.status) &&
        (!q || `${d.name} ${d.aliases.join(" ")} ${d.operator ?? ""} ${d.tenant ?? ""} ${d.city ?? ""} ${d.county ?? ""} ${d.state}`.toLowerCase().includes(q)),
    );
    return list.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.max_mw - a.max_mw));
  }, [all, minMw, statuses, query, sort]);

  const selected = all.find((d) => d.id === selectedId) ?? null;

  function toggleStatus(s: Status) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function restore(id: number) {
    if (staticSite) {
      const current = readRejected();
      const entry = current.find((r) => r.id === id);
      writeRejected(current.filter((r) => r.id !== id));
      if (entry?.record) {
        setAll((prev) => [...prev, toDataCenter(entry.record!, prev.length + 1)]);
      }
      setRejected(readRejected());
      return;
    }
    await fetch(`/api/rejected/${id}`, { method: "DELETE" });
    await Promise.all([load(), loadRejected()]);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>US Large Data Centers</h1>
          <p>Campuses built, under construction, or announced. Click a marker for sources.</p>
        </header>
        <div className="controls">
          <div className="tiers">
            {TIERS.map((t) => (
              <button key={t.min} className={minMw === t.min ? "active" : ""} onClick={() => setMinMw(t.min)}>
                <span className="count">{counts[t.min] ?? "…"}</span>
                <span className="label">{t.label}</span>
              </button>
            ))}
          </div>
          <input className="search" placeholder="Search name, operator, tenant, place…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="statuses">
            {STATUSES.map((s) => (
              <label key={s}>
                <input type="checkbox" checked={statuses.has(s)} onChange={() => toggleStatus(s)} />
                <span className="dot" style={{ background: STATUS_COLOR[s] }} />
                {statusLabel(s)}
              </label>
            ))}
          </div>
        </div>
        {showRejected ? (
          <div className="list">
            <div className="list-head"><span>Marked not real</span></div>
            {(rejected ?? []).map((r) => (
              <div key={r.id} className="row" style={{ cursor: "default" }}>
                <span className="name">{r.name}</span>
                <button className="restore" onClick={() => restore(r.id)}>Restore</button>
                <span className="where">{[r.state, r.reason].filter(Boolean).join(" · ") || "no reason given"}</span>
              </div>
            ))}
            {rejected?.length === 0 && <p style={{ padding: "12px 16px", color: "var(--muted)" }}>Nothing rejected yet.</p>}
          </div>
        ) : (
          <div className="list">
            <div className="list-head">
              <span>{visible.length} shown</span>
              <button onClick={() => setSort(sort === "mw" ? "name" : "mw")}>Sort: {sort === "mw" ? "capacity" : "name"}</button>
            </div>
            {visible.map((d) => (
              <button key={d.id} className={`row ${selectedId === d.id ? "selected" : ""}`} onClick={() => setSelectedId(d.id)}>
                <span className="name">{d.name}</span>
                <span className="mw">{formatMw(d.max_mw)}</span>
                <span className="where">{place(d)}{d.operator ? ` · ${d.operator}` : ""}</span>
                <span className="status-tag" style={{ color: STATUS_COLOR[d.status] }}>{statusLabel(d.status)}</span>
              </button>
            ))}
          </div>
        )}
        <footer>
          <button onClick={() => (showRejected ? setShowRejected(false) : loadRejected())}>
            {showRejected ? "Back to map list" : `Rejected${rejected ? ` (${rejected.length})` : ""}`}
          </button>
        </footer>
      </aside>
      <div className="map-wrap">
        <MapView datacenters={visible} selected={selected} onSelect={(d) => setSelectedId(d.id)} />
        <div className="legend">
          <h3>Status</h3>
          {STATUSES.map((s) => (
            <div key={s}><span className="dot" style={{ background: STATUS_COLOR[s] }} />{statusLabel(s)}</div>
          ))}
          <div className="sizes">
            <span><span className="dot" style={{ width: 8, height: 8, background: "#93a1b3" }} /> 50 MW</span>
            <span><span className="dot" style={{ width: 13, height: 13, background: "#93a1b3" }} /> 500 MW</span>
            <span><span className="dot" style={{ width: 18, height: 18, background: "#93a1b3" }} /> 1 GW+</span>
          </div>
        </div>
        {selected && (
          <Details dc={selected} onClose={() => setSelectedId(null)} onReject={rejectSelected} />
        )}
      </div>
    </div>
  );
}
