import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../../components/Sidebar";
import api from "../../lib/api";
import useSocket from "../../hooks/useSocket";
import useAuthStore from "../../store/authStore";

const SEVERITY_COLORS = {
  critical: "#ff2d55",
  high:     "#ff6b00",
  medium:   "#ffd60a",
  low:      "#30d158",
};

const DEFAULT_CENTER = [78.9629, 20.5937]; // India center — fallback
const DEFAULT_ZOOM   = 5;
const ZOOMED_ZOOM    = 12;

export default function LiveMap() {
  const { user } = useAuthStore();

  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]);        // mapbox Marker instances
  const mapboxglRef  = useRef(null);      // mapboxgl module

  const [complaints, setComplaints] = useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [filter,     setFilter]     = useState("all");
  const [selected,   setSelected]   = useState(null);
  const [mapReady,   setMapReady]   = useState(false);
  const [mapError,   setMapError]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [userCoords, setUserCoords] = useState(null); // { lng, lat }
  const [stats,      setStats]      = useState({ total: 0, shown: 0 });

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  // ── 1. Get user's real GPS location ──────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude });
      },
      () => {
        // GPS denied — we'll still show all complaints without geo-filter
        setUserCoords(null);
      },
      { timeout: 6000 }
    );
  }, []);

  // ── 2. Fetch ALL complaints (no geo-filter by default) ───────
  useEffect(() => {
    const fetchComplaints = async () => {
      setLoading(true);
      try {
        let url = "/complaints?limit=200&status=pending,approved,in_progress";

        // If user gave GPS permission, also try nearby (wider radius)
        if (userCoords) {
          url = `/complaints/nearby?longitude=${userCoords.lng}&latitude=${userCoords.lat}&radius=50000`;
        }

        const { data } = await api.get(url);

        // Handle both response shapes: { data: [...] } or { complaints: [...] }
        const list =
          data.data       ||   // nearby endpoint
          data.complaints ||   // list endpoint
          data             ||  // raw array
          [];

        setComplaints(Array.isArray(list) ? list : []);
        setStats(prev => ({ ...prev, total: Array.isArray(list) ? list.length : 0 }));
      } catch (err) {
        console.error("Failed to fetch complaints:", err);
        // Fallback: fetch without geo-filter
        try {
          const { data } = await api.get("/complaints?limit=200");
          const list = data.complaints || data.data || data || [];
          setComplaints(Array.isArray(list) ? list : []);
        } catch {}
      } finally {
        setLoading(false);
      }
    };

    fetchComplaints();
  }, [userCoords]);

  // ── 3. Real-time socket ───────────────────────────────────────
  useSocket(user?.region, {
    new_complaint: (c) => setComplaints((prev) => [c, ...prev]),
    new_alert:     (a) => setAlerts((prev) => [a, ...prev]),
  });

  // ── 4. Init Mapbox ────────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setMapError("VITE_MAPBOX_TOKEN not set in client/.env");
      return;
    }
    if (!mapContainer.current || mapRef.current) return;

    import("mapbox-gl").then((module) => {
      const mapboxgl = module.default;
      mapboxglRef.current = mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      // Center on user location if available, else India
      const center = userCoords
        ? [userCoords.lng, userCoords.lat]
        : DEFAULT_CENTER;
      const zoom = userCoords ? ZOOMED_ZOOM : DEFAULT_ZOOM;

      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center,
        zoom,
        attributionControl: false,
      });

      mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      mapRef.current.on("load", () => setMapReady(true));
    }).catch((err) => {
      setMapError("Failed to load Mapbox: " + err.message);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [MAPBOX_TOKEN]);

  // ── 5. Add / refresh markers when complaints or filter change ─
  const placeMarkers = useCallback(() => {
    if (!mapRef.current || !mapReady || !mapboxglRef.current) return;

    const mapboxgl = mapboxglRef.current;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const filtered =
      filter === "all"
        ? complaints
        : complaints.filter((c) => c.severity === filter);

    let placed = 0;

    filtered.forEach((c) => {
      // ── Coordinate extraction (handle multiple shapes) ────────
      let lng, lat;

      // Shape A: { location: { coordinates: [lng, lat] } }
      if (c.location?.coordinates?.length === 2) {
        [lng, lat] = c.location.coordinates;
      }
      // Shape B: { location: { longitude, latitude } }
      else if (c.location?.longitude != null) {
        lng = c.location.longitude;
        lat = c.location.latitude;
      }
      // Shape C: top-level longitude/latitude
      else if (c.longitude != null) {
        lng = c.longitude;
        lat = c.latitude;
      }
      // Shape D: { lat, lng } or { lat, lon }
      else if (c.lat != null) {
        lat = c.lat;
        lng = c.lng ?? c.lon;
      }

      // Skip if still no valid coords
      if (
        lat == null || lng == null ||
        isNaN(lat) || isNaN(lng) ||
        lat === 0  || lng === 0   // (0,0) is in the ocean — almost always a bug
      ) {
        console.warn("Skipping complaint (no valid coords):", c._id, c.location);
        return;
      }

      // Clamp to valid ranges
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn("Skipping complaint (coords out of range):", lat, lng);
        return;
      }

      const color = SEVERITY_COLORS[c.severity] || "#00d4ff";

      // ── Pulsing marker element ────────────────────────────────
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:relative;width:22px;height:22px;cursor:pointer;";

      // Pulse ring
      const ring = document.createElement("div");
      ring.style.cssText = `
        position:absolute;inset:-4px;border-radius:50%;
        border:2px solid ${color};opacity:0.5;
        animation:mapPulse 2s ease-out infinite;
      `;

      // Dot
      const dot = document.createElement("div");
      dot.style.cssText = `
        position:absolute;inset:0;border-radius:50%;
        background:${color};border:2px solid #fff;
        box-shadow:0 0 10px ${color},0 0 20px ${color}66;
        transition:transform 0.15s;
      `;

      dot.addEventListener("mouseenter", () => (dot.style.transform = "scale(1.3)"));
      dot.addEventListener("mouseleave", () => (dot.style.transform = "scale(1)"));

      wrapper.appendChild(ring);
      wrapper.appendChild(dot);

      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

      wrapper.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(c);
        mapRef.current.flyTo({ center: [lng, lat], zoom: Math.max(mapRef.current.getZoom(), 14), duration: 600 });
      });

      markersRef.current.push(marker);
      placed++;
    });

    setStats({ total: complaints.length, shown: placed });

    // If we have complaints but no user location, fit map to show all markers
    if (placed > 0 && !userCoords) {
      const bounds = new mapboxgl.LngLatBounds();
      markersRef.current.forEach((m) => bounds.extend(m.getLngLat()));
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
    }
  }, [complaints, filter, mapReady, userCoords]);

  useEffect(() => {
    placeMarkers();
  }, [placeMarkers]);

  // ── 6. Add pulse CSS once ─────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("map-pulse-style")) return;
    const style = document.createElement("style");
    style.id = "map-pulse-style";
    style.textContent = `
      @keyframes mapPulse {
        0%   { transform:scale(1);   opacity:0.6; }
        70%  { transform:scale(2.2); opacity:0;   }
        100% { transform:scale(1);   opacity:0;   }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // ── Filter options ─────────────────────────────────────────────
  const FILTERS = [
    { key: "all",      label: "All" },
    { key: "critical", label: "Critical" },
    { key: "high",     label: "High" },
    { key: "medium",   label: "Medium" },
    { key: "low",      label: "Low" },
  ];

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap z-10 bg-surface">
          <h1 className="font-display text-lg text-white mr-2">Live Map</h1>

          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                filter === f.key
                  ? "bg-primary/20 border-primary text-primary"
                  : "border-border text-muted hover:border-primary/30 hover:text-white"
              }`}
            >
              {f.label}
              {f.key !== "all" && (
                <span className="ml-1 opacity-60">
                  ({complaints.filter(c => c.severity === f.key).length})
                </span>
              )}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            {loading && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 border border-primary border-t-transparent rounded-full animate-spin inline-block" />
                Loading...
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse inline-block" />
              Live · {stats.shown}/{stats.total} markers
            </span>
          </div>
        </div>

        {/* ── Map + detail panel ── */}
        <div className="flex-1 flex overflow-hidden relative">

          {/* Mapbox or fallback */}
          {mapError ? (
            <MapFallback
              error={mapError}
              complaints={complaints}
              filter={filter}
              onSelect={setSelected}
            />
          ) : (
            <div ref={mapContainer} className="flex-1 h-full" />
          )}

          {/* No complaints notice */}
          {!loading && mapReady && stats.total === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="glass rounded-2xl p-6 text-center border border-border max-w-xs pointer-events-auto">
                <div className="text-4xl mb-3">📍</div>
                <p className="text-white font-semibold text-sm mb-1">No reports found</p>
                <p className="text-muted text-xs">
                  There are no open complaints in the database yet.
                  Report a pothole to see it appear here.
                </p>
              </div>
            </div>
          )}

          {/* Floating alerts */}
          <AnimatePresence>
            {alerts.length > 0 && (
              <div className="absolute top-4 left-4 space-y-2 max-w-xs z-20 pointer-events-none">
                {alerts.slice(0, 3).map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="glass rounded-xl p-3 border border-warning/30 pointer-events-auto"
                  >
                    <p className="text-warning text-xs font-semibold">{a.title}</p>
                    <p className="text-muted text-xs">{a.message}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Selected complaint side panel */}
          <AnimatePresence>
            {selected && (
              <motion.div
                key="detail"
                initial={{ x: 320 }}
                animate={{ x: 0 }}
                exit={{ x: 320 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute right-0 top-0 bottom-0 w-72 glass border-l border-border overflow-y-auto p-4 space-y-4 z-20"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white text-sm">Complaint Detail</h3>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted hover:text-white text-lg leading-none transition-colors"
                  >✕</button>
                </div>

                {selected.images?.[0]?.url && (
                  <img
                    src={selected.images[0].url}
                    alt="pothole"
                    className="w-full h-40 object-cover rounded-xl"
                  />
                )}

                <div className="space-y-3">
                  <p className="text-xs text-muted font-mono">{selected.complaintId}</p>

                  <div className="flex gap-2 flex-wrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold border"
                      style={{
                        color: SEVERITY_COLORS[selected.severity],
                        borderColor: SEVERITY_COLORS[selected.severity] + "60",
                        background: SEVERITY_COLORS[selected.severity] + "15",
                      }}
                    >
                      {selected.severity?.toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold border border-border text-muted capitalize">
                      {selected.status?.replace(/_/g, " ")}
                    </span>
                  </div>

                  <p className="text-sm text-white">
                    📍 {
                      selected.location?.address ||
                      selected.address ||
                      (() => {
                        const [lng, lat] = selected.location?.coordinates || [];
                        return lat ? `${(+lat).toFixed(5)}, ${(+lng).toFixed(5)}` : "Unknown location";
                      })()
                    }
                  </p>

                  {selected.description && (
                    <p className="text-xs text-muted italic">"{selected.description}"</p>
                  )}

                  {selected.aiAnalysis?.confidence && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                      <p className="text-xs text-primary font-semibold">
                        🤖 AI Confidence: {selected.aiAnalysis.confidence}%
                      </p>
                      {selected.aiAnalysis.detectedSeverity && (
                        <p className="text-xs text-muted mt-0.5">
                          Detected: {selected.aiAnalysis.detectedSeverity}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted">
                    Reported by: <span className="text-white">{selected.reportedBy?.name || "Anonymous"}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(selected.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Legend bar ── */}
        <div className="p-3 border-t border-border flex items-center gap-6 text-xs text-muted bg-surface flex-wrap">
          <span className="font-semibold text-white">Severity:</span>
          {Object.entries(SEVERITY_COLORS).map(([sev, color]) => (
            <div key={sev} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
              <span className="capitalize">{sev}</span>
              <span className="opacity-50">({complaints.filter(c => c.severity === sev).length})</span>
            </div>
          ))}
          {userCoords && (
            <span className="ml-auto text-success flex items-center gap-1">
              <span className="w-2 h-2 bg-success rounded-full" />
              GPS active
            </span>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Fallback grid map when Mapbox token is missing ─────────────
function MapFallback({ error, complaints, filter, onSelect }) {
  const filtered = filter === "all" ? complaints : complaints.filter(c => c.severity === filter);

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Error banner */}
      <div className="px-4 py-2 bg-warning/10 border-b border-warning/20 flex items-center gap-2">
        <span className="text-warning text-xs">⚠️</span>
        <span className="text-warning text-xs font-medium">{error}</span>
        <span className="text-muted text-xs ml-1">— Showing list view instead</span>
      </div>

      {/* Grid list of complaints */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">📍</div>
            <p className="text-white font-semibold mb-1">No complaints to show</p>
            <p className="text-muted text-sm">Try changing the filter or add Mapbox token for the real map.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const color = SEVERITY_COLORS[c.severity] || "#00d4ff";
              const [lng, lat] = c.location?.coordinates || [];
              return (
                <div
                  key={c._id}
                  onClick={() => onSelect(c)}
                  className="glass rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-all border border-border space-y-2"
                >
                  {c.images?.[0]?.url && (
                    <img src={c.images[0].url} alt="" className="w-full h-32 object-cover rounded-lg" />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted">{c.complaintId}</span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ color, background: color + "20", border: `1px solid ${color}50` }}
                    >
                      {c.severity?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-white">
                    📍 {c.location?.address || (lat ? `${(+lat).toFixed(4)}, ${(+lng).toFixed(4)}` : "No location")}
                  </p>
                  <p className="text-xs text-muted capitalize">{c.status?.replace(/_/g, " ")}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}