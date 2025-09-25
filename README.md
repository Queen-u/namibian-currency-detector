# 🇳🇦 Namibian Currency Detector

A web application that detects Namibian banknotes using YOLOv8 model, FastAPI backend, and React frontend.

## ✨ Features

- 📸 Image upload with annotated preview
- 🎥 Webcam snapshot / live detection
- 🎯 Adjustable confidence threshold
- 🔄 Optional deduplication to avoid double-counting
- 💰 Automatic total calculation

## 🏗️ Project Structure

```
yolo-react-app/
├─ backend/
│  ├─ app.py              # FastAPI server
│  ├─ requirements.txt    # Python dependencies
│  └─ best.pt            # Trained YOLO model
└─ frontend/
   ├─ package.json       # Node dependencies
   └─ src/
      ├─ App.jsx         # Main application
      └─ WebcamDetector.jsx
```

## 🚀 Quick Setup

### Backend Setup

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Unix/MacOS
source .venv/bin/activate
pip install -r requirements.txt
# Copy your trained model to backend/best.pt
uvicorn app:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Then open [http://localhost:5173](http://localhost:5173)

## 🔌 API Reference

### POST /predict/

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file` (image)

**Response:**
```json
{
  "detections": [
    {
      "class": string,
      "confidence": float,
      "bbox": number[]
    }
  ],
  "image_url": string (optional)
}
```

## 💡 Implementation Details

### Currency Detection

- `DENOMINATION_MAP`: Maps model classes to NAD values
- Confidence threshold filters low-confidence detections
- IoU-based deduplication removes overlapping boxes

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS error | Enable `CORSMiddleware` in backend for `http://localhost:5173` |
| Camera access | Allow browser camera permission; use HTTPS for remote hosts |
| Model loading | Verify `best.pt` exists in backend/ and `ultralytics` is installed |

## 🔜 Future Improvements

- [ ] Move deduplication/total calculation to backend
- [ ] Dockerize services for production
- [ ] Add automated testing
- [ ] Implement error logging

## 📝 License

© Created for Princessa, by Princessa

---
<div align="center">
Made with ❤️ for Namibian Currency Detection
</div>

