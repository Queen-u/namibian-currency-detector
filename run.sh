# Create project root
mkdir yolo-react-app && cd yolo-react-app

# ---------------- Backend ----------------
mkdir backend && cd backend

# Create app.py
cat > app.py << 'EOF'
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from io import BytesIO
from PIL import Image

app = FastAPI()

# Allow frontend (React) to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained model
model = YOLO("best.pt")

@app.post("/predict/")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    img = Image.open(BytesIO(contents)).convert("RGB")

    results = model.predict(img)
    detections = []
    for r in results:
        for box in r.boxes:
            detections.append({
                "class": model.names[int(box.cls)],
                "confidence": float(box.conf),
                "bbox": box.xyxy.tolist()
            })
    return JSONResponse(content={"detections": detections})
EOF

# Requirements file
cat > requirements.txt << 'EOF'
fastapi
uvicorn
ultralytics
pillow
EOF

cd ..

# ---------------- Frontend ----------------
mkdir frontend && cd frontend

# Initialize vite + react
npm create vite@latest . -- --template react

# Overwrite App.jsx
cat > src/App.jsx << 'EOF'
import React, { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState([]);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://127.0.0.1:8000/predict/", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setResults(data.detections);
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">YOLOv8 Object Detection</h1>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
        className="mb-4"
      />
      <button
        onClick={handleUpload}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Upload & Detect
      </button>

      <div className="mt-4">
        <h2 className="font-semibold">Results:</h2>
        <pre>{JSON.stringify(results, null, 2)}</pre>
      </div>
    </div>
  );
}

export default App;
EOF

cd ..

# ---------------- Done ----------------
echo "✅ Project scaffold created!"
echo "Next steps:"
echo "1. Copy your trained best.pt into backend/"
echo "2. Backend: cd backend && pip install -r requirements.txt && uvicorn app:app --reload --port 8000"
echo "3. Frontend: cd frontend && npm install && npm run dev"
