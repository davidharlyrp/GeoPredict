# Geotechnical Parameter Predictor — Walkthrough

## What Was Built

A full-stack **Geotechnical Parameter Predictor** using FastAPI, React, and PocketBase.

### Backend (`backend/`)

| File | Purpose |
|------|---------|
| [main.py](file:///e:/Program/Machine%20Learing%20Geoteknik/backend/main.py) | FastAPI app with 4 endpoints: `/api/train`, `/api/predict`, `/api/data`, `/api/model-status` |
| [ml_pipeline.py](file:///e:/Program/Machine%20Learing%20Geoteknik/backend/ml_pipeline.py) | ML pipeline: `SimpleImputer` → `StandardScaler` / `OneHotEncoder` → `MultiOutputRegressor(XGBRegressor)` |
| [pocketbase_client.py](file:///e:/Program/Machine%20Learing%20Geoteknik/backend/pocketbase_client.py) | PocketBase SDK wrapper for fetching/creating [soil_data](file:///e:/Program/Machine%20Learing%20Geoteknik/backend/pocketbase_client.py#22-53) records |
| [requirements.txt](file:///e:/Program/Machine%20Learing%20Geoteknik/backend/requirements.txt) | Python dependencies |

**ML Pipeline Details:**
- **Input features**: `depth`, `n_spt`, `soil_type`
- **Targets**: `phi`, `cohesion`, `water_content`, `unit_weight`
- **Preprocessing**: Numeric → median imputer + standard scaler; Categorical → most-frequent imputer + one-hot encoder
- **Model**: `MultiOutputRegressor(XGBRegressor)` — saved/loaded as `.joblib`

### Frontend (`frontend/src/`)

| File | Purpose |
|------|---------|
| [App.tsx](file:///e:/Program/Machine%20Learing%20Geoteknik/frontend/src/App.tsx) | Main layout with tab navigation |
| [DataEntry.tsx](file:///e:/Program/Machine%20Learing%20Geoteknik/frontend/src/components/DataEntry.tsx) | Tab 1: Form for entering new soil data to PocketBase |
| [Predictor.tsx](file:///e:/Program/Machine%20Learing%20Geoteknik/frontend/src/components/Predictor.tsx) | Tab 2: Input form + prediction results + retrain button |
| [api.ts](file:///e:/Program/Machine%20Learing%20Geoteknik/frontend/src/services/api.ts) | Typed API client for all backend endpoints |
| [types.ts](file:///e:/Program/Machine%20Learing%20Geoteknik/frontend/src/types.ts) | TypeScript interfaces and soil type constants |

---

## Verification

- ✅ **Frontend build**: `npm run build` completed with no errors (708ms)
- ✅ **Dev server**: Vite started without issues on `http://localhost:5173`

---

## How to Run

### 1. Start PocketBase
Ensure PocketBase is running at `http://127.0.0.1:8090` with a `soil_data` collection containing fields: `depth`, `n_spt`, `soil_type`, `phi`, `cohesion`, `water_content`, `unit_weight`.

### 2. Start Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start Frontend
```bash
cd frontend
npm run dev
```

### 4. Usage Flow
1. **Add data** via Tab 1 (Data Entry)
2. **Train model** via the "Retrain Model" button in Tab 2
3. **Predict** by entering Depth + N-SPT + Soil Type in Tab 2


### 5. Update Parameters
Copy-Item "e:\Program\Machine Learing Geoteknik\parameters.json" "e:\Program\Machine Learing Geoteknik\frontend\public\parameters.json" -Force