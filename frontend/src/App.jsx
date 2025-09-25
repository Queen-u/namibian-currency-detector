import React, { useState, useRef, useEffect } from "react";
import WebcamDetector from "./WebcamDetector";

/**
 * Map model class names -> numeric NAD values.
 * Make sure these keys exactly match the class strings your model returns.
 */
const DENOMINATION_MAP = {
  "Ten_Namibian_dollars": 10,
  "Twenty_Namibian_dollars": 20,
  "Thirty_Namibian_dollars": 30,
  "Fifty_Namibian_dollars": 50,
  "One_Hundred_Namibian_dollars": 100,
  "Two_Hundred_Namibian_dollars": 200,
  // Add more if needed
};

export default function App() {
  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // totals UI controls
  const [threshold, setThreshold] = useState(0.30); // confidence threshold
  const [dedupe, setDedupe] = useState(false); // enable IoU dedupe

  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // --- Utility: IoU between two boxes [x1,y1,x2,y2]
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

  // --- Optional dedupe: keep highest-confidence detection among overlapping same-class boxes
  function dedupeDetections(dets, iouThreshold = 0.45) {
    const out = [];
    const sorted = [...dets].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    for (const d of sorted) {
      // normalize box to [x1,y1,x2,y2]
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

  // compute totals and breakdown
  function computeTotals(detections) {
    if (!detections) return { total: 0, breakdown: {} };
    // apply threshold
    let filtered = detections.filter((r) => (r.confidence ?? 0) >= threshold);

    if (dedupe) filtered = dedupeDetections(filtered, 0.45);

    const breakdown = {};
    let total = 0;
    for (const r of filtered) {
      const cls = r.class;
      const value = DENOMINATION_MAP[cls] ?? 0;
      breakdown[cls] = (breakdown[cls] || 0) + 1;
      total += value;
    }
    return { total, breakdown };
  }

  // upload and call backend predict
  const handleUpload = async () => {
    if (!file) return alert("Please select an image first!");
    setLoading(true);
    setResults([]);
    setImageSrc(URL.createObjectURL(file)); // show immediate preview

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://127.0.0.1:8000/predict/", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server error: ${res.status} ${txt}`);
      }

      const data = await res.json();

      // If backend returns an annotated image URL, show that instead (optional)
      if (data.image_url) {
        setImageSrc(data.image_url);
      }

      setResults(data.detections || []);
    } catch (err) {
      console.error(err);
      alert("Detection failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Draw boxes on the canvas overlay when image or results change
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const draw = () => {
      const displayedW = img.clientWidth;
      const displayedH = img.clientHeight;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(displayedW * dpr);
      canvas.height = Math.round(displayedH * dpr);
      canvas.style.width = `${displayedW}px`;
      canvas.style.height = `${displayedH}px`;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, displayedW, displayedH);

      if (!results || results.length === 0) return;

      const naturalW = img.naturalWidth || displayedW;
      const naturalH = img.naturalHeight || displayedH;
      const scaleX = displayedW / naturalW;
      const scaleY = displayedH / naturalH;

      // apply same threshold + dedupe rules visually
      let visible = results.filter((r) => (r.confidence ?? 0) >= threshold);
      if (dedupe) visible = dedupeDetections(visible, 0.45);

      visible.forEach((item) => {
        let box = item.bbox;
        if (Array.isArray(box) && Array.isArray(box[0])) box = box[0];
        const [x1, y1, x2, y2] = box.map((v) => Number(v));

        const rx = x1 * scaleX;
        const ry = y1 * scaleY;
        const rw = (x2 - x1) * scaleX;
        const rh = (y2 - y1) * scaleY;

        // draw rect
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(183, 16, 171, 1)";
        ctx.strokeRect(rx, ry, rw, rh);

        // label
        const label = `${item.class} ${(item.confidence * 100).toFixed(1)}%`;
        ctx.font = "16px sans-serif";
        const padding = 6;
        const textW = ctx.measureText(label).width;
        const textH = 16;
        let labelY = ry - textH - padding;
        if (labelY < 0) labelY = ry + padding;

        ctx.fillStyle = "rgba(125, 16, 150, 0.85)";
        ctx.fillRect(rx - 1, labelY, textW + padding, textH + 4);
        ctx.fillStyle = "white";
        ctx.fillText(label, rx + padding / 2, labelY + textH - 3);
      });
    };

    if (img.complete) draw();
    else img.onload = draw;

    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [results, imageSrc, threshold, dedupe]);

  // file selection
  const handleFileChange = (e) => {
    setResults([]);
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setImageSrc(URL.createObjectURL(f));
  };

  const { total, breakdown } = computeTotals(results);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Namibian Currency Detector</h1>

   <div className="mb-4 flex items-center gap-3">
    {/* 1. The custom styled label acts as the visible button */}
    <label htmlFor="file-upload"  
           className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg cursor-pointer hover:bg-blue-600 transition duration-150">
        Choose File 🖼️
    </label>
    
    {/* 2. The actual input is hidden, but its functionality is triggered by the label */}
    <input 
        id="file-upload" // <- Link this ID to the label's htmlFor
        type="file" 
        accept="image/*"
        onChange={handleFileChange}
        // Tailwind class to visually hide the input
        className="hidden" 
    />

    <button onClick={handleUpload}
        disabled={loading} 
        style={{ marginLeft: 12 }}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? "Detecting..." : "Upload & Detect"}
    </button>
</div>
      

      {/* Threshold & dedupe */}
      <div style={{ marginBottom: 12 }}>
        <label>
          Confidence threshold: {(threshold * 100).toFixed(0)}%
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle" }}
          />
        </label>

        <label style={{ marginLeft: 16 }}>
          <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
          {" "}Enable dedupe (IoU)
        </label>
      </div>

      {/* Image + overlay */}
      <div style={{ position: "relative", display: imageSrc ? "inline-block" : "none" }}>
        <img
          ref={imgRef}
          src={imageSrc}
          alt="uploaded"
          style={{ maxWidth: "800px", width: "100%", height: "auto", display: "block", borderRadius: 8 }}
          crossOrigin="anonymous"
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", borderRadius: 8 }}
        />
      </div>

      {/* Totals */}
      <div style={{ marginTop: 12 }}>
        <h3>Total: <strong>N${total}</strong></h3>

        <div>
          <h4>Breakdown:</h4>
          {Object.keys(breakdown).length === 0 ? (
            <p>No notes counted. Try lowering the threshold.</p>
          ) : (
            <ul>
              {Object.entries(breakdown).map(([cls, count]) => (
                <li key={cls}>
                  {cls}: {count} × N${DENOMINATION_MAP[cls] ?? "?"} = N${(DENOMINATION_MAP[cls] || 0) * count}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <hr style={{ margin: "24px 0" }} />

      {/* Webcam detector (shares same predict endpoint) */}
      <WebcamDetector
        predictUrl="http://127.0.0.1:8000/predict/"
        denominationMap={DENOMINATION_MAP}
      />
    </div>
  );
}
