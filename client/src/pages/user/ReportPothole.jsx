import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "../../components/Sidebar";
import api from "../../lib/api";

export default function ReportPothole() {
  const [images, setImages]       = useState([]);
  const [previews, setPreviews]   = useState([]);
  const [location, setLocation]   = useState(null);
  const [gettingLoc, setGettingLoc] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity]   = useState("medium");
  const [scanning, setScanning]   = useState(false);
  const [aiResult, setAiResult]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef();
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setImages(files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);

    // Mock AI scan
    setScanning(true);
    setTimeout(() => {
      setAiResult({
        confidence: Math.floor(80 + Math.random() * 20),
        detectedSeverity: ["low", "medium", "high", "critical"][Math.floor(Math.random() * 4)],
      });
      setScanning(false);
    }, 2000);
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      return toast.error("Geolocation not supported.");
    }
    setGettingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGettingLoc(false);
        toast.success("Location captured!");
      },
      () => {
        toast.error("Failed to get location.");
        setGettingLoc(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) return toast.error("Please upload at least one image.");
    if (!location) return toast.error("Please capture your location.");

    setSubmitting(true);
    try {
      const formData = new FormData();
      images.forEach((img) => formData.append("images", img));
      formData.append("longitude", location.lng);
      formData.append("latitude", location.lat);
      formData.append("description", description);
      formData.append("severity", aiResult?.detectedSeverity || severity);

      await api.post("/complaints", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Complaint submitted successfully!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message || "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-2xl text-white mb-1">Report a Pothole</h1>
            <p className="text-muted text-sm">AI-powered road damage detection</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div className="glass rounded-2xl p-6">
              <label className="block text-sm font-semibold text-white mb-3">Upload Images</label>

              {previews.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/40 transition-all"
                >
                  <div className="text-5xl mb-3">📸</div>
                  <p className="text-white font-medium mb-1">Click to upload or drag images</p>
                  <p className="text-muted text-sm">Max 5 images, JPEG/PNG</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {previews.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                        <img src={url} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                        {scanning && i === 0 && (
                          <div className="absolute inset-0 bg-dark/80 flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              <p className="text-xs text-primary">AI Scanning...</p>
                            </div>
                          </div>
                        )}
                        {aiResult && i === 0 && (
                          <div className="absolute bottom-2 left-2 right-2 bg-dark/90 rounded-lg p-2 border border-primary/30">
                            <p className="text-xs text-primary font-semibold">
                              AI Confidence: {aiResult.confidence}%
                            </p>
                            <p className="text-xs text-muted">Severity: {aiResult.detectedSeverity}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-ghost text-sm w-full"
                  >
                    + Add More Images
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Location */}
            <div className="glass rounded-2xl p-6">
              <label className="block text-sm font-semibold text-white mb-3">Location</label>
              {location ? (
                <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="text-success text-sm font-semibold">Location Captured</p>
                    <p className="text-muted text-xs">
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={getLocation}
                  disabled={gettingLoc}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {gettingLoc ? (
                    <>
                      <div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                      Getting Location...
                    </>
                  ) : (
                    <>📍 Capture My Location</>
                  )}
                </button>
              )}
            </div>

            {/* Severity */}
            <div className="glass rounded-2xl p-6">
              <label className="block text-sm font-semibold text-white mb-3">Severity Level</label>
              <div className="grid grid-cols-4 gap-2">
                {["low", "medium", "high", "critical"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`py-3 rounded-xl border text-xs font-semibold transition-all ${
                      (aiResult?.detectedSeverity || severity) === s
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-muted hover:border-primary/30"
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
              {aiResult && (
                <p className="text-xs text-muted mt-2 text-center">
                  AI suggests: <span className="text-primary">{aiResult.detectedSeverity}</span>
                </p>
              )}
            </div>

            {/* Description */}
            <div className="glass rounded-2xl p-6">
              <label className="block text-sm font-semibold text-white mb-3">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any additional details..."
                rows={4}
                maxLength={500}
                className="input-field resize-none"
              />
              <p className="text-xs text-muted mt-1 text-right">{description.length}/500</p>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={submitting || !location || images.length === 0}
              whileTap={{ scale: 0.97 }}
              className="btn-primary w-full text-base py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                  Submitting Complaint...
                </>
              ) : (
                <>🚀 Submit Complaint</>
              )}
            </motion.button>
          </form>
        </div>
      </main>
    </div>
  );
}
