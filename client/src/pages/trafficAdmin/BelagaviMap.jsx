import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

const CONGESTION_COLORS = {
  free:     "#30d158",
  light:    "#a8e063",
  moderate: "#ffd60a",
  heavy:    "#ff6b00",
  gridlock: "#ff2d55",
  unknown:  "#888780",
};

// Checkpoint coordinates in order
const CHECKPOINTS = [
  { id: "channamma_circle",  name: "Channamma Circle",   coords: [74.4977, 15.8584] },
  { id: "rpd_cross",         name: "RPD Cross",           coords: [74.5010, 15.8560] },
  { id: "central_bus_stand", name: "Central Bus Stand",   coords: [74.5041, 15.8497] },
  { id: "bogarves",          name: "Bogarves",            coords: [74.5102, 15.8450] },
];

export default function BelagaviMap({ segments = [], eta = null }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);

  // Build segment-keyed lookup: camera_id → insight
  const segMap = {};
  segments.forEach((s) => { segMap[s.camera_id] = s; });

  // ── Init map ──
  useEffect(() => {
    if (map.current || !mapboxgl.accessToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [74.504, 15.854],
      zoom: 14,
    });

    map.current.on("load", () => {
      addRouteLayers();
      addCheckpointMarkers();
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update route colors whenever segments change ──
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    updateRouteColors();
    updateMarkers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  function buildRouteGeoJSON() {
    const features = [];
    for (let i = 0; i < CHECKPOINTS.length - 1; i++) {
      const from = CHECKPOINTS[i];
      const to   = CHECKPOINTS[i + 1];
      const seg  = segMap[from.id];
      features.push({
        type: "Feature",
        properties: {
          color: CONGESTION_COLORS[seg?.congestion_level || "unknown"],
          level: seg?.congestion_level || "unknown",
          road: from.name,
        },
        geometry: {
          type: "LineString",
          coordinates: [from.coords, to.coords],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }

  function addRouteLayers() {
    const geojson = buildRouteGeoJSON();

    map.current.addSource("route", { type: "geojson", data: geojson });

    // Glow / halo layer
    map.current.addLayer({
      id: "route-halo",
      type: "line",
      source: "route",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 14,
        "line-opacity": 0.25,
        "line-blur": 4,
      },
    });

    // Main color layer
    map.current.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 6,
        "line-opacity": 0.9,
      },
    });
  }

  function updateRouteColors() {
    const src = map.current.getSource("route");
    if (src) src.setData(buildRouteGeoJSON());
  }

  function addCheckpointMarkers() {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    CHECKPOINTS.forEach((cp, idx) => {
      const seg = segMap[cp.id];
      const color = CONGESTION_COLORS[seg?.congestion_level || "unknown"];

      const el = document.createElement("div");
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; border: 3px solid white;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; color: #111;
        box-shadow: 0 2px 8px rgba(0,0,0,0.6); cursor: pointer;
      `;
      el.textContent = idx + 1;

      // Popup
      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(`
        <div style="font-family:sans-serif;font-size:12px;min-width:160px">
          <p style="font-weight:700;margin:0 0 4px">${cp.name}</p>
          <p style="margin:0;color:${color}">● ${(seg?.congestion_level || "unknown").toUpperCase()}</p>
          ${seg ? `
            <p style="margin:4px 0 0;color:#888">
              ${seg.vehicle_count} vehicles · ${seg.avg_speed_kmh} km/h<br/>
              Delay: ${seg.delay_seconds}s · Queue: ${seg.queue_length_m}m
            </p>
            ${seg.incidents?.length ? `<p style="color:#ff6b00;margin:4px 0 0">⚠ ${seg.incidents[0].type}</p>` : ""}
          ` : ""}
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(cp.coords)
        .setPopup(popup)
        .addTo(map.current);

      markersRef.current.push(marker);
    });
  }

  function updateMarkers() {
    // Remove and re-add markers with updated colors
    addCheckpointMarkers();
  }

  if (!mapboxgl.accessToken) {
    return (
      <div className="flex items-center justify-center h-full bg-surface rounded-2xl text-muted text-sm">
        <div className="text-center">
          <p className="text-2xl mb-2">🗺️</p>
          <p>Add <code className="text-primary">VITE_MAPBOX_TOKEN</code> to enable live map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      {/* ETA overlay */}
      {eta && (
        <div className="absolute top-3 left-3 glass rounded-xl p-3 text-xs max-w-[200px]">
          <p className="text-white font-semibold mb-1">
            🧭 {eta.eta_minutes} min · {eta.distance_km} km
          </p>
          {eta.total_delay_seconds > 0 && (
            <p className="text-warning">+{Math.round(eta.total_delay_seconds / 60)} min delay</p>
          )}
          {eta.alternate_suggested && (
            <p className="text-primary mt-1">↩ Alternate available</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass rounded-xl p-2 text-xs space-y-1">
        {Object.entries(CONGESTION_COLORS).filter(([k]) => k !== "unknown").map(([level, color]) => (
          <div key={level} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-muted capitalize">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
