// pages/WebcamDetectionPage.jsx
import React from "react";
import WebcamDetector from "../WebcamDetector"; // Adjust path as needed
import { DENOMINATION_MAP } from "../hooks/useCurrencyDetection"; // Use the shared map

export default function WebcamDetectionPage() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Live Webcam Detection</h2>
      
      <WebcamDetector
        predictUrl="http://127.0.0.1:8000/predict/"
        denominationMap={DENOMINATION_MAP}
      />
    </div>
  );
}