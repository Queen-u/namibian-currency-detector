// useCurrencyDetection.js
import { useState, useMemo } from "react";
import { dedupeDetections } from "../utils/utils"

// Map model class names -> numeric NAD values
export const DENOMINATION_MAP = {
  "Ten_Namibian_dollars": 10,
  "Twenty_Namibian_dollars": 20,
  "Thirty_Namibian_dollars": 30, // Note: This denomination is not standard in Namibia
  "Fifty_Namibian_dollars": 50,
  "One_Hundred_Namibian_dollars": 100,
  "Two_Hundred_Namibian_dollars": 200,
  // Add more if needed
};

/**
 * Custom hook to handle image file selection, detection, and result processing.
 * @returns {Object} State variables, handlers, and computed totals.
 */
export function useCurrencyDetection() {
  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(0.30); // confidence threshold
  const [dedupe, setDedupe] = useState(false); // enable IoU dedupe

  // Compute totals and breakdown based on current results, threshold, and dedupe settings
  const { total, breakdown, filteredResults } = useMemo(() => {
    let filtered = results.filter((r) => (r.confidence ?? 0) >= threshold);
    if (dedupe) filtered = dedupeDetections(filtered, 0.45);

    const breakdown = {};
    let total = 0;
    for (const r of filtered) {
      const cls = r.class;
      const value = DENOMINATION_MAP[cls] ?? 0;
      breakdown[cls] = (breakdown[cls] || 0) + 1;
      total += value;
    }
    return { total, breakdown, filteredResults: filtered };
  }, [results, threshold, dedupe]);

  // Upload and call backend predict
  const handleUpload = async () => {
    if (!file) return alert("Please select an image first!");
    setLoading(true);
    setResults([]);

    try {
      // Show immediate preview (optional, can be moved to file change handler)
      if (file instanceof File) {
          setImageSrc(URL.createObjectURL(file)); 
      }

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

  // File selection handler
  const handleFileChange = (e) => {
    setResults([]);
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setImageSrc(URL.createObjectURL(f));
  };

  return {
    // State
    file,
    imageSrc,
    results,
    loading,
    threshold,
    dedupe,
    // Setters
    setThreshold,
    setDedupe,
    // Handlers
    handleUpload,
    handleFileChange,
    // Computed Values
    total,
    breakdown,
    // Results after filtering/dedupe (useful for drawing)
    filteredResults, 
  };
}