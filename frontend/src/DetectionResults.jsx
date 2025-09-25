import React from "react";

const DetectionResults = ({ results }) => {
  if (!results || results.length === 0) {
    return <p className="text-gray-500">No detections yet.</p>;
  }

  return (
    <div className="mt-6 space-y-4">
      {results.map((item, index) => (
        <div
          key={index}
          className="p-4 bg-white shadow rounded-2xl border border-gray-200"
        >
          <h3 className="text-lg font-semibold text-indigo-700">
            {item.class}
          </h3>
          <p className="text-sm text-gray-600">
            Confidence:{" "}
            <span className="font-medium text-green-600">
              {(item.confidence * 100).toFixed(2)}%
            </span>
          </p>
          <p className="text-sm text-gray-600">
            Bounding Box:{" "}
            <span className="font-mono">
              {item.bbox[0].map((coord) => coord.toFixed(1)).join(", ")}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
};

export default DetectionResults;
