# ProthexAI Frontend PRD — Clinical Intelligence Upgrade

## 1. Product Objective
Upgrade the user-facing dashboard from a prototype rule-based interface to a **strict, ML-backed clinical analysis platform**. The frontend must act as the primary guardrail, ensuring only high-fidelity biometric data is processed by the ML engine.

## 2. Core Operational Changes

### 2.1. Strict Biometric Validation
The frontend now implements a validation layer in `js/dashboard.js` before any API network request is initiated.

| Metric | Constraint | Frontend Action |
| :--- | :--- | :--- |
| `symmetry` | 0.0 — 1.0 | Hard rejection if out of bounds. |
| `pressure` | ≥ 0.0 | Hard rejection if negative. |
| `wear_hours` | 0.0 — 24.0 | Hard rejection if unrealistic. |
| `step_length / speed` | > 0.0 | Rejects stationary/zero values. |

### 2.2. Clinical Feature Mapping
The frontend has migrated to the standardized API feature set:
- **Old Mapping**: `step_length_cm`, `cadence_spm`, etc.
- **Production Mapping**: `step_length`, `cadence`, `speed`, `symmetry`, `temperature`, `moisture`, `pressure`, `wear_hours`.

### 2.3. ML Response Consumption
The Dashboard UI now binds directly to the expanded ML output schema:
- `gait_score`: Displayed on the primary biometric gauge.
- `risk_level`: Used for color-coding (Green: Low, Yellow: Moderate, Red: High).
- `pressure_risk`: Displayed in the specialized monitoring panel.
- `skin_risk`: Triggers AI preventative alerts.

---

## 3. UI/UX Enhancements

### 3.1. Loading States (UX Transparency)
-   **Submission Feedback**: Submit buttons now transition to an "Analyzing Biometrics..." state and are disabled during the inference cycle to prevent duplicate requests.
-   **Status Toasts**: Backend `ValueError` exceptions are caught and displayed as clear, human-readable status messages.

### 3.2. Real-Time System Monitoring
A new **ML Health Panel** in `settings.html` tracks the live status of the analytical engine:
-   **Service Status**: Reports `Healthy` vs `Degraded`.
-   **Model Registry**: Confirms all `.pkl` weights are hot-loaded in memory.
-   **Schema Verification**: Displays the current active feature count (Standard: 14).

---

## 4. Technical Constraints
-   **API Base URL**: All fetches must use the `API_BASE_URL` constant from `js/api.js`.
-   **No Silent Failures**: Mandatory fields now reject null/zero inputs with an explicit "Field required" UI alert.
-   **Design Preservation**: All functional upgrades have been implemented without altering the existing glassmorphism design system or color palette.

---

## 5. Acceptance Criteria
- [x] Input mapping matches `AnalysisRequest` schema exactly.
- [x] Symmetry values > 1.0 are rejected by the browser.
- [x] Dashboard gauge reflects ML `gait_score` correctly.
- [x] Status bar shows "Analyzing..." during the 50ms inference window.
- [x] Settings page correctly fetches and displays `/analysis/health`.
