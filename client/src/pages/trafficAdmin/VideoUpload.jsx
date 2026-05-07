import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../lib/api";
import toast from "react-hot-toast";

const ROADS = [
  "Channamma Circle",
  "RPD Cross",
  "Central Bus Stand",
  "Bogarves",
];

const CONGESTION_COLOR = {
  free:     "text-success",
  light:    "text-success",
  moderate: "text-warning",
  heavy:    "text-danger",
  gridlock: "text-danger",
};

export default function VideoUpload({ onInsightReceived }) {
  const [file, setFile]         = useState(null);
  const [road, setRoad]         = useState(ROADS[0]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult]     = useState(null);
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast.error("Video must be under 50MB");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Please select a video first");
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("road", road);
    formData.append("region", "belagavi");

    try {
      const res = await api.post("/ai-traffic/upload-video", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded / e.total) * 80));
        },
      });

      setProgress(100);
      setResult(res.data.data);
      toast.success("Video analyzed by AI!");
      onInsightReceived?.(res.data.data);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
        📹 Upload Traffic Video
      </h2>

      {/* Road selector */}
      <div className="mb-3">
        <label className="text-xs text-muted uppercase tracking-wider block mb-1">
          Road / Location
        </label>
        <select
          value={road}
          onChange={(e) => setRoad(e.target.value)}
          className="input-field text-sm"
          disabled={uploading}
        >
          {ROADS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-3 ${
          file ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={handleFile}
          className="hidden"
        />
        {file ? (
          <div>
            <p className="text-white text-sm font-medium truncate">{file.name}</p>
            <p className="text-muted text-xs mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div>
            <p className="text-3xl mb-2">🎥</p>
            <p className="text-muted text-sm">Tap to select video</p>
            <p className="text-muted text-xs mt-1">MP4 / MOV · max 50MB</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>{progress < 80 ? "Uploading..." : "AI analyzing..."}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="w-3 h-3 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
              Analyzing...
            </>
          ) : "🤖 Analyze with AI"}
        </button>
        {file && !uploading && (
          <button onClick={reset} className="btn-ghost text-sm px-3">✕</button>
        )}
      </div>

      {/* Result card */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-surface rounded-xl border border-border"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">{road}</p>
              <span
                className={`text-xs font-bold uppercase ${
                  CONGESTION_COLOR[result.congestion_level] || "text-muted"
                }`}
              >
                ● {result.congestion_level}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-dark/30 rounded-lg p-2">
                <p className="text-muted">Vehicles</p>
                <p className="text-white font-semibold">{result.vehicle_count}</p>
              </div>
              <div className="bg-dark/30 rounded-lg p-2">
                <p className="text-muted">Avg Speed</p>
                <p className="text-white font-semibold">{result.avg_speed_kmh} km/h</p>
              </div>
              <div className="bg-dark/30 rounded-lg p-2">
                <p className="text-muted">Delay</p>
                <p className="text-warning font-semibold">{result.delay_seconds}s</p>
              </div>
              <div className="bg-dark/30 rounded-lg p-2">
                <p className="text-muted">Queue</p>
                <p className="text-white font-semibold">{result.queue_length_m}m</p>
              </div>
            </div>
            {result.incidents?.length > 0 && (
              <div className="mt-2 p-2 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-danger text-xs font-semibold">
                  ⚠ {result.incidents[0].type.replace("_", " ")} detected
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
