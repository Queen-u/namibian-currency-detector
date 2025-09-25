import React, { useState, useRef, useEffect } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null); // either local object URL or backend processed image url
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // Upload image and get detections (and optional processed image url)
  const handleUpload = async () => {
    if (!file) return alert("Please select an image first!");
    setLoading(true);
    setResults([]);
    setImageSrc(URL.createObjectURL(file)); // show preview immediately

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

      // If backend returns an annotated image URL, show it instead of drawing client-side.
      if (data.image_url) {
        // Make sure CORS allows fetching this image from the browser (backend must serve with correct headers)
        setImageSrc(data.image_url);
      } else {
        // Use local file preview (we already set it)
        // Will draw boxes client-side once image loads
      }

      setResults(data.detections || []);
    } catch (err) {
      console.error(err);
      alert("Detection failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resize canvas to match displayed image size and draw boxes when image or results change
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const draw = () => {
      // set canvas pixel dimensions to match displayed image pixel size
      const displayedW = img.clientWidth;
      const displayedH = img.clientHeight;

      // set canvas width/height taking devicePixelRatio into account so lines are sharp
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(displayedW * dpr);
      canvas.height = Math.round(displayedH * dpr);
      canvas.style.width = `${displayedW}px`;
      canvas.style.height = `${displayedH}px`;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing operations by devicePixelRatio
      ctx.clearRect(0, 0, displayedW, displayedH);

      if (!results || results.length === 0) return;

      // natural size of the image (original pixels) used by model
      const naturalW = img.naturalWidth || displayedW;
      const naturalH = img.naturalHeight || displayedH;

      const scaleX = displayedW / naturalW;
      const scaleY = displayedH / naturalH;

      results.forEach((item, i) => {
        // handle bbox formats like [[x1,y1,x2,y2]] or [x1,y1,x2,y2]
        let box = item.bbox;
        if (Array.isArray(box) && box.length > 0 && Array.isArray(box[0])) {
          box = box[0];
        }
        // Defensive: ensure numbers
        let [x1, y1, x2, y2] = box.map((v) => Number(v));

        // Scale coordinates
        const rx = x1 * scaleX;
        const ry = y1 * scaleY;
        const rw = (x2 - x1) * scaleX;
        const rh = (y2 - y1) * scaleY;

        // Draw rectangle
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(220, 38, 38, 1)"; // red
        ctx.strokeRect(rx, ry, rw, rh);

        // Draw label background
        const label = `${item.class} ${(item.confidence * 100).toFixed(1)}%`;
        ctx.font = "16px sans-serif";
        const padding = 6;
        const textMetrics = ctx.measureText(label);
        const textW = textMetrics.width;
        const textH = 16; // approx height

        // place label above box if possible, else inside top of box
        const labelX = rx;
        let labelY = ry - textH - padding;
        if (labelY < 0) labelY = ry + padding;

        // background
        ctx.fillStyle = "rgba(220,38,38,0.85)";
        ctx.fillRect(labelX - 1, labelY, textW + padding, textH + 4);

        // text
        ctx.fillStyle = "white";
        ctx.fillText(label, labelX + padding / 2, labelY + textH - 3);
      });
    };

    // draw whenever image finished loading or results changed
    if (img.complete) draw();
    else img.onload = draw;

    // also redraw on window resize (maintain overlay)
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [results, imageSrc]);

  // When the user selects a file, set local preview and clear previous results
  const handleFileChange = (e) => {
    setResults([]);
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setImageSrc(URL.createObjectURL(f));
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">YOLOv8 Object Detection</h1>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mb-4 block"
      />

      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded mb-4"
      >
        {loading ? "Detecting..." : "Upload & Detect"}
      </button>

      <div style={{ position: "relative", display: imageSrc ? "inline-block" : "none" }}>
        {/* Display either backend processed image (imageSrc can be remote URL) or local preview */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="uploaded"
          style={{ maxWidth: "800px", width: "100%", height: "auto", display: "block", borderRadius: 8 }}
          crossOrigin="anonymous" /* needed if drawing remote image; backend must allow CORS for images */
        />
        {/* Canvas overlay */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
            borderRadius: 8,
          }}
        />
      </div>

      {/* Textual results below */}
      <div className="mt-4">
        <h2 className="font-semibold">Detections:</h2>
        {results.length === 0 ? (
          <p className="text-gray-500">No detections yet.</p>
        ) : (
          <ul>
            {results.map((r, i) => (
              <li key={i}>
                <strong>{r.class}</strong> — {(r.confidence * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
