import React, { useRef, useState, useEffect } from "react";

/**
 * WebcamDetector
 * - snapshot mode + live mode
 * - computes totals & breakdown like App.jsx
 * - props:
 *    - predictUrl: backend endpoint
 *    - denominationMap: mapping class -> value
 */
export default function WebcamDetector({
  predictUrl = "http://127.0.0.1:8000/predict/",
  captureQuality = 0.7,
  defaultInterval = 700,
  denominationMap = {
    "Ten_Namibian_dollars": 10,
    "Twenty_Namibian_dollars": 20,
    "Fifty_Namibian_dollars": 50,
    "One_Hundred_Namibian_dollars": 100,
    "Two_Hundred_Namibian_dollars": 200,
  },
}) {
  const videoRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const overlayRef = useRef(null);

  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState(false);
  const [intervalMs, setIntervalMs] = useState(defaultInterval);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [fps, setFps] = useState(0);

  // totals controls
  const [threshold, setThreshold] = useState(0.30);
  const [dedupe, setDedupe] = useState(false);
  const [totals, setTotals] = useState({ total: 0, breakdown: {} });

  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const liveRef = useRef(false); // Use ref to track live state for callbacks

  // --- IoU + dedupe (same logic as App.jsx)
  function iou(boxA, boxB) {
    const [ax1, ay1, ax2, ay2] = boxA;
    const [bx1, by1, bx2, by2] = boxB;
    const ix1 = Math.max(ax1, bx1);
    const iy1 = Math.max(ay1, by1);
    const ix2 = Math.min(ax2, bx2);
    const iy2 = Math.min(ay2, by2);
    const iw = Math.max(0, ix2 - ix1);
    const ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    const areaA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
    const areaB = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
    const union = areaA + areaB - inter;
    return union === 0 ? 0 : inter / union;
  }

  function dedupeDetections(dets, iouThreshold = 0.45) {
    const out = [];
    const sorted = [...dets].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    for (const d of sorted) {
      const box = Array.isArray(d.bbox) && Array.isArray(d.bbox[0]) ? d.bbox[0] : d.bbox;
      let keep = true;
      for (const o of out) {
        const obox = Array.isArray(o.bbox) && Array.isArray(o.bbox[0]) ? o.bbox[0] : o.bbox;
        if (d.class === o.class && iou(box, obox) > iouThreshold) {
          keep = false;
          break;
        }
      }
      if (keep) out.push(d);
    }
    return out;
  }

  function computeTotals(detections) {
    let filtered = (detections || []).filter((r) => (r.confidence ?? 0) >= threshold);
    if (dedupe) filtered = dedupeDetections(filtered, 0.45);
    const breakdown = {};
    let total = 0;
    for (const r of filtered) {
      const cls = r.class;
      const value = denominationMap[cls] ?? 0;
      breakdown[cls] = (breakdown[cls] || 0) + 1;
      total += value;
    }
    return { total, breakdown };
  }

  // --- camera control ---
  const startCamera = async () => {
    if (streaming) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStreaming(true);
      videoRef.current.onloadedmetadata = () => {
        const v = videoRef.current;
        const hc = hiddenCanvasRef.current;
        hc.width = v.videoWidth;
        hc.height = v.videoHeight;
        drawOverlay(); // clear
      };
    } catch (err) {
      console.error("Camera error", err);
      alert("Failed to access camera: " + err.message);
    }
  };

  const stopCamera = () => {
    if (!streaming) return;
    const stream = videoRef.current.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    videoRef.current.srcObject = null;
    setStreaming(false);
    setLive(false);
    liveRef.current = false;
    clearTimer();
    drawOverlay(); // clear overlay
  };

  // capture frame as blob
  const captureFrameBlob = (quality = 0.7) => {
    const v = videoRef.current;
    const hc = hiddenCanvasRef.current;
    if (!v || !hc) throw new Error("Video not ready");
    hc.width = v.videoWidth;
    hc.height = v.videoHeight;
    const ctx = hc.getContext("2d");
    ctx.drawImage(v, 0, 0, hc.width, hc.height);
    const data = hc.toDataURL("image/jpeg", quality);
    // convert to blob
    const arr = data.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  };

  // predict single frame (snapshot)
  const captureAndPredict = async () => {
    if (!streaming) {
      alert("Start camera first");
      return;
    }
    setLoading(true);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    abortRef.current = new AbortController();

    try {
      const blob = captureFrameBlob(captureQuality);
      const form = new FormData();
      form.append("file", blob, "frame.jpg");

      const t0 = performance.now();
      const res = await fetch(predictUrl, { method: "POST", body: form, signal: abortRef.current.signal });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server ${res.status}: ${txt}`);
      }
      const data = await res.json();
      const dets = data.detections || [];
      setResults(dets);

      // compute totals for UI
      const totalsLocal = computeTotals(dets);
      setTotals(totalsLocal);

      // draw overlay
      drawOverlay(dets);

      const t1 = performance.now();
      const elapsed = t1 - t0;
      setFps(Math.round(1000 / (elapsed || 1)));
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Predict error", err);
        if (!liveRef.current) alert("Prediction failed: " + err.message);
      } else {
        console.log("Aborted previous request");
      }
    } finally {
      setLoading(false);
    }
  };

  // live mode schedule
  const startLive = () => {
    if (!streaming) {
      alert("Start camera first");
      return;
    }
    if (live) return;
    setLive(true);
    liveRef.current = true;
    scheduleNext();
  };

  const scheduleNext = () => {
    clearTimer();
    timerRef.current = setTimeout(async () => {
      if (!liveRef.current) return; // Check ref instead of state
      
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      
      await captureAndPredict();
      
      // Schedule next only if still in live mode
      if (liveRef.current) {
        scheduleNext();
      }
    }, intervalMs);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const stopLive = () => {
    setLive(false);
    liveRef.current = false;
    clearTimer();
    setFps(0);
  };

  // Update live ref when state changes
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  // Restart live mode when interval changes
  useEffect(() => {
    if (live && streaming) {
      clearTimer();
      scheduleNext();
    }
  }, [intervalMs]);

  useEffect(() => {
    return () => {
      stopCamera();
      clearTimer();
    };
    // eslint-disable-next-line
  }, []);

  // draw overlay boxes on top of video
  const drawOverlay = (detections = results) => {
    const v = videoRef.current;
    const overlay = overlayRef.current;
    if (!v || !overlay) return;

    const imgW = v.clientWidth;
    const imgH = v.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.round(imgW * dpr);
    overlay.height = Math.round(imgH * dpr);
    overlay.style.width = `${imgW}px`;
    overlay.style.height = `${imgH}px`;

    const ctx = overlay.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, imgW, imgH);

    if (!detections || detections.length === 0) return;

    // filter + dedupe for drawing consistent with totals
    let visible = detections.filter((r) => (r.confidence ?? 0) >= threshold);
    if (dedupe) visible = dedupeDetections(visible, 0.45);

    const naturalW = v.videoWidth || imgW;
    const naturalH = v.videoHeight || imgH;
    const scaleX = imgW / naturalW;
    const scaleY = imgH / naturalH;

    visible.forEach((item) => {
      let box = item.bbox;
      if (Array.isArray(box) && Array.isArray(box[0])) box = box[0];
      const [x1, y1, x2, y2] = box.map((n) => Number(n));
      const rx = x1 * scaleX;
      const ry = y1 * scaleY;
      const rw = (x2 - x1) * scaleX;
      const rh = (y2 - y1) * scaleY;

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(220,38,38,1)";
      ctx.strokeRect(rx, ry, rw, rh);

      const label = `${item.class} ${(item.confidence * 100).toFixed(1)}%`;
      ctx.font = "16px sans-serif";
      const padding = 6;
      const textW = ctx.measureText(label).width;
      let labelY = ry - 18;
      if (labelY < 0) labelY = ry + 6;
      ctx.fillStyle = "rgba(220,38,38,0.9)";
      ctx.fillRect(rx - 1, labelY - 4, textW + padding, 20);
      ctx.fillStyle = "white";
      ctx.fillText(label, rx + 4, labelY + 12);
    });
  };

  // redraw overlay on resize
  useEffect(() => {
    const handleResize = () => drawOverlay();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [results, threshold, dedupe]);

  return (
    <div style={{ maxWidth: 960, margin: "1rem auto", padding: 12 }}>
      <h2>Webcam Note Detector</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        {!streaming ? (
          <button onClick={startCamera}>Start Camera</button>
        ) : (
          <button onClick={stopCamera}>Stop Camera</button>
        )}

        <button onClick={captureAndPredict} disabled={!streaming || loading}>
          {loading ? "Detecting..." : "Snapshot Detect"}
        </button>

        {!live ? (
          <button onClick={startLive} disabled={!streaming}>
            Start Live
          </button>
        ) : (
          <button onClick={stopLive}>Stop Live</button>
        )}

        <label style={{ marginLeft: 12 }}>
          Interval:
          <input
            type="range"
            min="200"
            max="2000"
            step="100"
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            style={{ marginLeft: 8 }}
          />
          <span style={{ marginLeft: 8 }}>{intervalMs} ms</span>
        </label>

        <div style={{ marginLeft: "auto" }}>
          FPS: <strong>{fps}</strong>
        </div>
      </div>

      {/* threshold + dedupe controls */}
      <div style={{ marginBottom: 8 }}>
        <label>
          Confidence threshold: {(threshold * 100).toFixed(0)}%
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ marginLeft: 8 }}
          />
        </label>
        <label style={{ marginLeft: 12 }}>
          <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
          {" "}Enable dedupe
        </label>
      </div>

      <div style={{ position: "relative", display: streaming ? "inline-block" : "none", borderRadius: 8 }}>
        <video ref={videoRef} style={{ maxWidth: "100%", width: 800, height: "auto", borderRadius: 8 }} playsInline muted />
        <canvas ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />
      </div>

      <canvas ref={hiddenCanvasRef} style={{ display: "none" }} />

      <div style={{ marginTop: 12 }}>
        <h4>Detections</h4>
        {results.length === 0 ? <p>No detections.</p> : (
          <ul>
            {results.map((r, i) => (
              <li key={i}>
                <strong>{r.class}</strong> — {(r.confidence * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Total: N${totals.total}</h4>
        <div>
          {Object.keys(totals.breakdown).length === 0 ? (
            <p>No notes counted.</p>
          ) : (
            <ul>
              {Object.entries(totals.breakdown).map(([cls, count]) => (
                <li key={cls}>
                  {cls}: {count} × N${denominationMap[cls] ?? "?"} = N${(denominationMap[cls] || 0) * count}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}