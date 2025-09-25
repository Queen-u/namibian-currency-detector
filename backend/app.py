from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
import cv2
import numpy as np
from ultralytics import YOLO
import uuid, os


app = FastAPI()
model = YOLO("best.pt")  # your trained model
OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

from fastapi.middleware.cors import CORSMiddleware


# Allow React dev server
origins = [
    "http://localhost:5173",   # Vite/React dev server
    "http://127.0.0.1:5173",   # sometimes Vite binds here
    "http://localhost:3000",   # CRA dev server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # list of allowed origins
    allow_credentials=True,
    allow_methods=["*"],          # allow all HTTP methods
    allow_headers=["*"],          # allow all headers
)


@app.post("/predict/")
async def predict(file: UploadFile = File(...)):
    # Save uploaded image temporarily
    img_bytes = await file.read()
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Run YOLO prediction
    results = model.predict(img)[0]

    detections = []
    for box in results.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf = float(box.conf[0])
        cls = model.names[int(box.cls[0])]
        detections.append({
            "class": cls,
            "confidence": conf,
            "bbox": [[x1, y1, x2, y2]]
        })

    # Draw bounding boxes on image
    for det in detections:
        (x1, y1, x2, y2) = map(int, det["bbox"][0])
        label = f'{det["class"]} {det["confidence"]*100:.1f}%'
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 2)
        cv2.putText(img, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

    # Save processed image
    file_id = str(uuid.uuid4())
    out_path = os.path.join(OUTPUT_DIR, f"{file_id}.jpg")
    cv2.imwrite(out_path, img)

    return {
        "detections": detections,
        "image_url": f"http://127.0.0.1:8000/image/{file_id}.jpg"
    }

@app.get("/image/{filename}")
async def get_image(filename: str):
    path = os.path.join(OUTPUT_DIR, filename)
    return FileResponse(path)
