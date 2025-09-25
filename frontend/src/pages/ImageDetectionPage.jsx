// pages/ImageDetectionPage.jsx
import React, { useRef, useEffect } from "react";
import { useCurrencyDetection, DENOMINATION_MAP } from "../hooks/useCurrencyDetection";

export default function ImageDetectionPage() {
  const {
    imageSrc,
    loading,
    threshold,
    dedupe,
    filteredResults,
    total,
    breakdown,
    setThreshold,
    setDedupe,
    handleUpload,
    handleFileChange,
  } = useCurrencyDetection();

  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // Draw boxes on the canvas overlay
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !imageSrc) return;

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

      if (!filteredResults || filteredResults.length === 0) return;

      const naturalW = img.naturalWidth || displayedW;
      const naturalH = img.naturalHeight || displayedH;
      const scaleX = displayedW / naturalW;
      const scaleY = displayedH / naturalH;

      filteredResults.forEach((item) => {
        let box = item.bbox;
        if (Array.isArray(box) && Array.isArray(box[0])) box = box[0];
        const [x1, y1, x2, y2] = box.map((v) => Number(v));

        const rx = x1 * scaleX;
        const ry = y1 * scaleY;
        const rw = (x2 - x1) * scaleX;
        const rh = (y2 - y1) * scaleY;

        // Draw rect and label logic (unchanged)
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(55, 4, 100, 1)";
        ctx.strokeRect(rx, ry, rw, rh);
        const label = `${item.class} ${(item.confidence * 100).toFixed(1)}%`;
        ctx.font = "16px sans-serif";
        const padding = 6;
        const textW = ctx.measureText(label).width;
        const textH = 16;
        let labelY = ry - textH - padding;
        if (labelY < 0) labelY = ry + padding;
        ctx.fillStyle = "rgba(202, 15, 149, 0.85)";
        ctx.fillRect(rx - 1, labelY, textW + padding, textH + 4);
        ctx.fillStyle = "white";
        ctx.fillText(label, rx + padding / 2, labelY + textH - 3);
      });
    };

    if (img.complete) draw();
    else img.onload = draw;
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [filteredResults, imageSrc]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Image File Detection</h2>

      {/* Upload controls */}
      <div className="mb-4">
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={loading} style={{ marginLeft: 12 }}>
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
                  {cls}: {count} &times; N${DENOMINATION_MAP[cls] ?? "?"} = N${(DENOMINATION_MAP[cls] || 0) * count}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}