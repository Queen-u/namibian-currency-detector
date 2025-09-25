// App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import ImageDetectionPage from "./pages/ImageDetectionPage";
import WebcamDetectionPage from "./pages/WebcamDetectionPage";

function Navigation() {
  // Simple navigation bar
  return (
    <nav className="p-4 bg-gray-800 text-white shadow-md">
      <ul className="flex space-x-4">
        <li>
          <Link to="/" className="hover:text-purple-300">Image Upload</Link>
        </li>
        <li>
          <Link to="/webcam" className="hover:text-purple-300">Live Webcam</Link>
        </li>
      </ul>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold p-6 text-center">Namibian Currency Detection</h1>
        
        <Navigation />

        <div className="p-6">
          <Routes>
            {/* The root path is the Image Detection Page */}
            <Route path="/" element={<ImageDetectionPage />} />
            
            {/* Separate path for Webcam Detection */}
            <Route path="/webcam" element={<WebcamDetectionPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}