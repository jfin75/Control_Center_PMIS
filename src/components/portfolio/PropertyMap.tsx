"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type ErrorEvent, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { ASSET_HEX, type Property } from "@/mock/properties";

// Served from public/maplibre (see scripts/copy-maplibre-worker.mjs).
setWorkerUrl(new URL("/maplibre/maplibre-gl-worker.mjs", window.location.href).href);

/** OpenFreeMap's Positron: a pale, keyless basemap close to the reference's map tint. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** Approximate parcel outline: a rotated rectangle sized to the recorded acreage. */
export function parcelPolygon(p: Property): GeoJSON.Feature<GeoJSON.Polygon> {
  const m2 = Math.max(p.landAcres, 0.5) * 4046.86;
  const w = Math.sqrt(m2 * 1.35);
  const h = m2 / w;
  const rot = (p.parcelRotation * Math.PI) / 180;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => {
    const rx = x! * Math.cos(rot) - y! * Math.sin(rot);
    const ry = x! * Math.sin(rot) + y! * Math.cos(rot);
    return [p.lng + rx / mPerDegLng, p.lat + ry / mPerDegLat];
  });
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...corners, corners[0]!]] } };
}

export function PropertyMap({
  properties,
  riskIds,
  selectedId,
  onSelect,
  showBoundary,
  drawerOpen,
}: {
  properties: Property[];
  riskIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showBoundary: boolean;
  drawerOpen: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const [status, setStatus] = useState<"loading" | "ready" | "offline">("loading");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const bounds = new LngLatBounds();
    properties.forEach((p) => bounds.extend([p.lng, p.lat]));
    const m = new MapLibreMap({
      container: el.current,
      style: STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: { top: 60, bottom: 60, left: 60, right: 60 } },
      attributionControl: { compact: true },
      cooperativeGestures: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.current = m;

    const fail = window.setTimeout(() => setStatus((s) => (s === "loading" ? "offline" : s)), 9000);
    m.on("error", (e: ErrorEvent) => {
      if (!m.isStyleLoaded() && (e.error?.message ?? "").match(/fetch|network|Failed/i)) setStatus("offline");
    });
    m.on("load", () => {
      window.clearTimeout(fail);
      setStatus("ready");
      // Tint water and parks toward the reference's pale blue-green map.
      for (const layer of m.getStyle().layers ?? []) {
        if (layer.type === "fill" && /water/.test(layer.id)) m.setPaintProperty(layer.id, "fill-color", "#dcebf7");
        if (layer.type === "fill" && /park|wood|grass/.test(layer.id)) m.setPaintProperty(layer.id, "fill-color", "#eaf4ee");
        if (layer.type === "background") m.setPaintProperty(layer.id, "background-color", "#f7fafc");
      }
      m.addSource("parcel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "parcel-fill", type: "fill", source: "parcel", paint: { "fill-color": "#3681E6", "fill-opacity": 0.14 } });
      m.addLayer({ id: "parcel-line", type: "line", source: "parcel", paint: { "line-color": "#2468CC", "line-width": 2, "line-dasharray": [2, 1.5] } });
    });

    return () => {
      window.clearTimeout(fail);
      m.remove();
      map.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep markers in sync with the filtered property list.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const keep = new Set(properties.map((p) => p.id));
    for (const [id, { marker }] of markers.current) {
      if (!keep.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
    for (const p of properties) {
      if (markers.current.has(p.id)) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cc-pin";
      b.style.setProperty("--pin", ASSET_HEX[p.type]);
      b.setAttribute("aria-label", `${p.name}, ${p.type}, ${p.city}${riskIds.has(p.id) ? ", has a project at risk" : ""}`);
      if (riskIds.has(p.id)) b.dataset.risk = "true";
      b.innerHTML = `<span class="cc-pin-dot"></span><span class="cc-pin-label">${p.name}</span>`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(p.id);
      });
      const marker = new Marker({ element: b, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(m);
      markers.current.set(p.id, { marker, el: b });
    }
  }, [properties]);

  // Selection: highlight marker, fly to it, draw the parcel.
  useEffect(() => {
    const m = map.current;
    for (const [id, { el: b }] of markers.current) {
      b.dataset.selected = String(id === selectedId);
      b.setAttribute("aria-pressed", String(id === selectedId));
    }
    if (!m) return;
    const p = properties.find((x) => x.id === selectedId);
    const apply = () => {
      const src = m.getSource("parcel") as GeoJSONSource | undefined;
      src?.setData({ type: "FeatureCollection", features: p && showBoundary ? [parcelPolygon(p)] : [] });
    };
    if (m.isStyleLoaded()) apply();
    else m.once("load", apply);
    if (p) {
      const rightPad = drawerOpen && el.current ? Math.min(el.current.clientWidth * 0.55, 500) : 0;
      m.flyTo({ center: [p.lng, p.lat], zoom: p.landAcres > 12 ? 15.2 : 16, speed: 1.6, padding: { right: rightPad, left: 0, top: 0, bottom: 0 }, essential: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, showBoundary]);

  function fitAll() {
    const m = map.current;
    if (!m || !properties.length) return;
    const b = new LngLatBounds();
    properties.forEach((p) => b.extend([p.lng, p.lat]));
    m.fitBounds(b, { padding: 60, duration: 600 });
  }

  return (
    <div className="relative h-full min-h-[26rem] w-full overflow-hidden rounded-md bg-[#eef4f9]">
      {/* maplibre's own CSS forces position:relative on this node, so size it explicitly. */}
      <div ref={el} className="!absolute inset-0 h-full w-full" role="region" aria-label="Property map. Use the property list for keyboard selection." />
      <button
        type="button"
        onClick={fitAll}
        className="absolute top-3 left-3 z-10 inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink-2 shadow-thumb hover:text-ink"
      >
        Fit all properties
      </button>
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-full w-full animate-pulse bg-[linear-gradient(90deg,#eef4f9,#f5f9fc,#eef4f9)]" />
        </div>
      )}
      {status === "offline" && (
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-2 shadow-thumb">
          <strong className="text-ink">Map tiles unavailable.</strong> You may be offline. Pins still show relative positions, and the property list works.
        </div>
      )}
      <style>{`
        .cc-pin{display:grid;place-items:center;width:28px;height:28px;border:0;background:transparent;padding:0}
        .cc-pin-dot{width:14px;height:14px;border-radius:999px;background:var(--pin);box-shadow:0 0 0 2.5px #fff,0 2px 6px rgb(18 32 64 / .35);transition:transform var(--dur) var(--ease-out),box-shadow var(--dur)}
        .cc-pin:hover .cc-pin-dot,.cc-pin:focus-visible .cc-pin-dot{transform:scale(1.25)}
        .cc-pin[data-risk="true"] .cc-pin-dot{box-shadow:0 0 0 2.5px #fff,0 0 0 5px #FF6666,0 2px 6px rgb(18 32 64 / .35)}
        .cc-pin[data-selected="true"] .cc-pin-dot{transform:scale(1.45);box-shadow:0 0 0 3px #fff,0 0 0 5px var(--pin),0 4px 10px rgb(18 32 64 / .35)}
        .cc-pin-label{position:absolute;left:24px;top:50%;translate:0 -50%;white-space:nowrap;background:#fff;color:var(--ink);font:600 11px/1 var(--font-sans);padding:5px 7px;border-radius:5px;box-shadow:var(--shadow-raised);opacity:0;pointer-events:none;transition:opacity var(--dur-fast)}
        .cc-pin:hover .cc-pin-label,.cc-pin:focus-visible .cc-pin-label,.cc-pin[data-selected="true"] .cc-pin-label{opacity:1}
        .cc-pin:focus-visible{outline:none}
        .cc-pin:focus-visible .cc-pin-dot{box-shadow:0 0 0 2.5px #fff,0 0 0 5px var(--accent)}
      `}</style>
    </div>
  );
}
