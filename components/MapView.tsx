"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { DataCenter, Status } from "@/lib/schema";
import { formatMw, place, statusLabel } from "@/lib/format";

const STATUS_COLOR: Record<Status, string> = {
  operational: "#3dd68c",
  under_construction: "#f5a524",
  announced: "#5b9dff",
  planned: "#a78bfa",
};

function radius(mw: number): number {
  if (mw >= 1000) return 16;
  if (mw >= 500) return 11;
  if (mw >= 200) return 8;
  return 6;
}

function FlyTo({ dc }: { dc: DataCenter | null }) {
  const map = useMap();
  useEffect(() => {
    if (dc) map.flyTo([dc.lat, dc.lon], Math.max(map.getZoom(), 8), { duration: 0.8 });
  }, [dc, map]);
  return null;
}

export default function MapView({
  datacenters,
  selected,
  onSelect,
}: {
  datacenters: DataCenter[];
  selected: DataCenter | null;
  onSelect: (dc: DataCenter) => void;
}) {
  return (
    <MapContainer center={[39.5, -96]} zoom={4} minZoom={3} maxBounds={[[15, -170], [72, -50]]} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo dc={selected} />
      {datacenters.map((dc) => (
        <CircleMarker
          key={dc.id}
          center={[dc.lat, dc.lon]}
          radius={radius(dc.max_mw)}
          pathOptions={{
            color: STATUS_COLOR[dc.status],
            fillColor: STATUS_COLOR[dc.status],
            fillOpacity: selected?.id === dc.id ? 0.95 : 0.6,
            weight: selected?.id === dc.id ? 3 : 1.5,
          }}
          eventHandlers={{ click: () => onSelect(dc) }}
        >
          <Popup>
            <strong>{dc.name}</strong>
            <br />
            {place(dc)}
            <br />
            {formatMw(dc.max_mw)} · {statusLabel(dc.status)}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
