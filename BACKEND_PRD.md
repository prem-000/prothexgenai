# ProthexAI Backend PRD — Production ML & Clinical Intelligence

## 1. Product Version & Metadata
- **Version**: 4.0 — Production ML Release
- **Last Updated**: March 19, 2026
- **System Type**: FastAPI Clinical Middleware
- **Environment**: Cloud/Local Hybrid (In-Memory Inference)

---

## 2. Updated System Architecture
ProthexAI utilizes a high-performance Service Layer architecture designed for sub-50ms clinical inference.

```text
Request (8 Features)
     ↓
FastAPI Router
     ↓
Input Validation Layer (Health/Safety checks)
     ↓
ML Engine (Feature Engineering 8 -> 14)
     ↓
In-Memory Model Inference (Multi-Model Registry)
     ↓
Database Persistence (MongoDB)
     ↓
Production Logging & Response
```

### 2.1. Tech Stack
-   **Framework**: FastAPI
-   **ML Engine**: Scikit-Learn (Joblib Persistence)
-   **Data Processing**: Pandas / NumPy
-   **Database**: MongoDB (Motor async driver)
-   **Scheduling**: APScheduler (Weekly Clinical Jobs)

---

## 3. Production Machine Learning Layer

### 3.1. Feature Engineering (14-Dimensional Schema)
To ensure high-precision clinical scoring, the backend expands 8 raw sensor inputs into a 14-feature engineered set.

| Raw Input (8) | Engineered Features (6) | Formula |
| :--- | :--- | :--- |
| `step_length` | `gait_efficiency` | `step_length × symmetry` |
| `cadence` | `skin_stress_index` | `temperature × moisture` |
| `speed` | `mech_load` | `pressure × wear_hours` |
| `symmetry` | `asymmetry` | `1 - symmetry` |
| `temperature` | `gait_quality` | `cadence × speed` |
| `moisture` | `overall_load` | `mech_load × asymmetry` |
| `pressure` | | |
| `wear_hours` | | |

### 3.2. Model Registry Management
Models are loaded **once** into memory at server startup using a `ModelRegistry` pattern to eliminate I/O overhead during therapy sessions.

| Model File | Type | Clinical Output |
| :--- | :--- | :--- |
| `scaler.pkl` | StandardScaler | Normalizes 14 input features. |
| `risk_classifier.pkl` | RandomForest | Categorical Risk: Low, Moderate, High. |
| `gait_score_regressor.pkl`| Regressor | Biomechanical score (0 — 100). |
| `pressure_risk_regressor.pkl`| Regressor | Mechanical skin-load risk index. |
| `skin_risk_regressor.pkl` | Regressor | Ulceration/Dermatitis risk index. |

---

## 4. Operational Requirements

### 4.1. Strict Input Validation (Change 25.1)
The engine no longer accepts "garbage" data. Every inference request is validated:
-   **Missing Fields**: Rejects request with `400 Bad Request`.
-   **Range Logic**:
    -   `symmetry`: Must be `0.0 — 1.0`.
    -   `pressure`: Must be `≥ 0.0`.
    -   `wear_hours`: Must be `0.0 — 24.0`.

### 4.2. Monitoring & Transparency
-   **Logging**: Every successful inference logs the full 14-dimensional feature set and the final prediction output.
-   **Healthchecks**:
    -   `GET /analysis/health`: Verifies all ML models are hot-loaded in memory.
    -   `POST /analysis/stress-test`: Allows safe pipeline verification with extreme inputs.

### 4.3. Exception Handling
-   **No Silent Defaults**: Rule-based fallbacks (e.g., "Default to Moderate") are removed in favor of strict `ValueError` raising to ensure data integrity.

---

## 5. Deployment & Performance Benchmarks
-   **Target Inference Latency**: < 20ms (Actual: ~12ms).
-   **Memory Footprint**: < 250MB (inclusive of all ML models).
-   **Throughput**: 500+ TPS per container instance.

---

## 6. Acceptance Criteria
- [x] No `_Dummy` stub classes used in production engine.
- [x] Feature count = 14 before scaling.
- [x] Input validation rejects out-of-range metrics.
- [x] Logs provide full audit trail for clinical reviews.
- [x] Health check returning `200 OK` for all loaded `.pkl` models.
