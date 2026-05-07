"""
RoadSense AI — Python traffic analysis service
Runs on port 8000. Called by the Node.js server.

Install:
  pip install fastapi uvicorn ultralytics opencv-python-headless \
              deep-sort-realtime numpy python-multipart

Run:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import base64
import io
import time
import tempfile
import os
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

# ─────────────────────────────────────────
# App setup
# ─────────────────────────────────────────
app = FastAPI(title="RoadSense AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# Load models once at startup
# ─────────────────────────────────────────
print("[RoadSense AI] Loading YOLOv8 model...")
model = YOLO("yolov8n.pt")  # Downloads automatically on first run
tracker = DeepSort(max_age=30, n_init=3, max_iou_distance=0.7)
print("[RoadSense AI] Models ready.")

# YOLO class IDs for vehicles
VEHICLE_CLASSES = [2, 3, 5, 7]  # car, motorcycle, bus, truck

# Congestion thresholds (vehicle count)
CONGESTION_LEVELS = [
    ("free",     0,  10),
    ("light",    10, 25),
    ("moderate", 25, 50),
    ("heavy",    50, 80),
    ("gridlock", 80, 9999),
]

HEATMAP_COLORS = {
    "free":     "#30d158",
    "light":    "#a8e063",
    "moderate": "#ffd60a",
    "heavy":    "#ff6b00",
    "gridlock": "#ff2d55",
}

# Track previous positions for speed estimation
prev_positions: dict = {}


# ─────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────
class FrameRequest(BaseModel):
    camera_id: str
    road: str
    frame: str          # base64-encoded JPEG
    timestamp: str
    fps: Optional[float] = 10.0


class TrafficInsight(BaseModel):
    camera_id: str
    road: str
    timestamp: str
    vehicle_count: int
    avg_speed_kmh: float
    congestion_level: str
    delay_seconds: int
    queue_length_m: float
    heatmap_color: str
    incidents: list
    processing_ms: int


# ─────────────────────────────────────────
# Core analysis logic
# ─────────────────────────────────────────
def classify_congestion(count: int) -> str:
    for level, lo, hi in CONGESTION_LEVELS:
        if lo <= count < hi:
            return level
    return "gridlock"


def detect_incidents(tracks, frame: np.ndarray) -> list:
    """Detect accidents, illegal parking, signal delays from track data."""
    incidents = []
    h, w = frame.shape[:2]
    stationary_count = 0

    for track in tracks:
        if not track.is_confirmed():
            continue
        tid = track.track_id
        ltrb = track.to_ltrb()
        cx = (ltrb[0] + ltrb[2]) / 2

        if tid in prev_positions:
            dx = abs(cx - prev_positions[tid])
            if dx < 2:  # nearly stationary in pixels
                stationary_count += 1

        prev_positions[tid] = cx

    # Accident: multiple stationary vehicles clustered
    if stationary_count >= 3:
        incidents.append({
            "type": "accident",
            "confidence": round(min(0.6 + stationary_count * 0.05, 0.95), 2),
            "description": f"{stationary_count} stationary vehicles detected",
        })

    # Illegal parking: vehicle detected at road edge (bottom 10% of frame)
    for track in tracks:
        if not track.is_confirmed():
            continue
        ltrb = track.to_ltrb()
        if ltrb[3] > h * 0.90 and (ltrb[2] - ltrb[0]) > w * 0.05:
            incidents.append({
                "type": "illegal_parking",
                "confidence": 0.72,
                "description": "Vehicle detected near road edge/footpath",
            })
            break  # one report per frame

    return incidents


def analyze_frame_data(camera_id: str, road: str, frame: np.ndarray, fps: float) -> dict:
    """Run YOLOv8 + DeepSORT on a single frame and return insights."""
    t_start = time.time()

    # YOLOv8 inference
    results = model(frame, classes=VEHICLE_CLASSES, conf=0.4, verbose=False)[0]

    detections = []
    for box in results.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf = float(box.conf[0])
        cls = int(box.cls[0])
        detections.append(([x1, y1, x2 - x1, y2 - y1], conf, cls))

    # DeepSORT tracking
    tracks = tracker.update_tracks(detections, frame=frame)
    confirmed = [t for t in tracks if t.is_confirmed()]

    # Speed estimation from positional delta
    speeds = []
    for track in confirmed:
        tid = track.track_id
        ltrb = track.to_ltrb()
        cx = (ltrb[0] + ltrb[2]) / 2
        if tid in prev_positions:
            dx_px = abs(cx - prev_positions[tid])
            # Approx: 1px ≈ 0.06m at typical 6m mounting height
            speed_kmh = dx_px * 0.06 * fps * 3.6
            if 0 < speed_kmh < 120:  # sanity check
                speeds.append(speed_kmh)
        prev_positions[tid] = cx

    vehicle_count = len(confirmed)
    avg_speed = round(sum(speeds) / len(speeds), 1) if speeds else 0.0
    congestion = classify_congestion(vehicle_count)
    delay = max(0, (vehicle_count - 10) * 5)
    queue_m = vehicle_count * 5.5
    incidents = detect_incidents(confirmed, frame)

    return {
        "camera_id": camera_id,
        "road": road,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "vehicle_count": vehicle_count,
        "avg_speed_kmh": avg_speed,
        "congestion_level": congestion,
        "delay_seconds": delay,
        "queue_length_m": round(queue_m, 1),
        "heatmap_color": HEATMAP_COLORS[congestion],
        "incidents": incidents,
        "processing_ms": int((time.time() - t_start) * 1000),
    }


# ─────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "RoadSense AI", "models": ["yolov8n", "deepsort"]}


@app.post("/analyze", response_model=TrafficInsight)
def analyze(req: FrameRequest):
    """Analyze a single base64-encoded frame."""
    try:
        img_bytes = base64.b64decode(req.frame)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid frame data: {e}")

    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    insight = analyze_frame_data(req.camera_id, req.road, frame, req.fps or 10.0)
    return insight


@app.post("/analyze-video")
async def analyze_video(
    video: UploadFile = File(...),
    road: str = Form("unknown"),
    region: str = Form("belagavi"),
):
    """
    Accept a video upload. Extract a keyframe every 2 seconds.
    Return a list of insights for each keyframe.
    """
    if not video.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files accepted")

    # Write to temp file (OpenCV needs a file path)
    content = await video.read()
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(status_code=422, detail="Could not open video")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_interval = int(fps * 2)  # 1 keyframe every 2 seconds
        insights = []
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % frame_interval == 0:
                insight = analyze_frame_data(
                    camera_id=f"user_upload_{region}",
                    road=road,
                    frame=frame,
                    fps=fps,
                )
                insights.append(insight)
            frame_idx += 1

        cap.release()
    finally:
        os.unlink(tmp_path)

    return {
        "road": road,
        "region": region,
        "frames_analyzed": len(insights),
        "insights": insights,
    }