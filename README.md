# ProthexaI - Clinical Mobility Platform

ProthexaI is an advanced clinical monitoring and biomechanical analysis platform designed for prosthetic users. It combines real-time sensor data analysis, machine learning risk prediction, and an AI-driven clinical assistant to improve rehabilitation outcomes.

## 🚀 Key Features

- **Biomechanical Analysis**: Real-time processing of 14 clinical features (Gait Efficiency, Skin Stress, Mechanical Load, etc.) with sub-50ms inference.
- **ML Risk Prediction**: RandomForest-based risk classification (Low, Moderate, High) and specialized regressors for Gait, Pressure, and Skin risk.
- **AI Clinical Assistant**: Integrated Chatbot powered by **Google Gemini (1.5 Flash)** using the latest `google-genai` SDK for clinical insights and device support.
- **Automated Health Reports**: Dynamic generation of medical-grade PDF reports summarizing weekly biometrics and clinical trends.
- **Patient Dashboard**: Interactive visualization of gait symmetry, walking speed, and prosthetic health scores using D3.js and Chart.js.

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **AI/ML**: Scikit-Learn, Google GenAI SDK
- **Scheduling**: APScheduler (Weekly Clinical Jobs)
- **Reporting**: ReportLab (Medical PDF Generation)

### Frontend
- **Logic**: Vanilla JavaScript (ES6+ Modules)
- **Styling**: TailwindCSS & Custom CSS
- **Visualization**: D3.js, Chart.js, Three.js (Hero)

## 📦 Installation & Setup

### Prerequisites
- Python 3.10+
- MongoDB instance
- Google Gemini API Key

### Backend Setup
1. Standard installation:
   ```bash
   pip install -r requirements.txt
   ```
2. Environment Configuration (`.env`):
   ```env
   PROJECT_NAME="ProthexaI"
   MONGODB_URL="your_mongodb_url"
   DATABASE_NAME="prothexai_db"
   SECRET_KEY="your_secret_key"
   GEMINI_API_KEY="your_gemini_api_key"
   ```
3. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup
Serve the `prothexai-frontend` directory using a simple web server (e.g., Live Server in VS Code). Ensure the `API_BASE_URL` in `js/api.js` matches your backend URL (default: `http://localhost:8000`).

## 📊 ML Engineering Details

ProthexaI utilizes a 14-dimensional feature schema expanded from 8 raw sensor inputs:
- **Raw Inputs**: Step length, Cadence, Speed, Symmetry, Temperature, Moisture, Pressure, Wear Hours.
- **Engineered Metrics**: Gait Efficiency, Skin Stress Index, Mechanical Load, Asymmetry, Gait Quality, Overall Load.

## 📝 Recent Updates (April 2026)
- **SDK Migration**: Upgraded to the new `google-genai` package for faster AI responses and improved model management.
- **Model Optimization**: Switched to `gemini-1.5-flash` to resolve throughput and quota limitations while maintaining clinical accuracy.
- **Report Engine Fixes**: Resolved issue with in-memory PDF streaming to ensure consistent report downloads across all browsers.
- **Manual Data Logging**: Fixed synchronization between ML analysis and daily metric collections to ensure manual logs appear immediately in the dashboard calendar.

---
© 2026 ProthexaI Clinical Intelligence Platform
