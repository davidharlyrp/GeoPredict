from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, create_model
from typing import Optional

from params_config import PARAMETER_LIST, FEATURE_COLUMNS, TARGET_COLUMNS, ALL_FIELDS
from pocketbase_client import fetch_all_soil_data, create_soil_record
from ml_pipeline import train_model, predict, model_exists, get_distribution_stats, perform_regression_analysis, discover_best_formula


# --- Dynamically build Pydantic models from parameters.json ---

def _build_soil_data_model():
    """Build SoilDataInput model: required fields are required, others Optional."""
    fields = {}
    for p in PARAMETER_LIST:
        if p["type"] == "number":
            if p.get("required"):
                fields[p["key"]] = (float, ...)
            else:
                fields[p["key"]] = (Optional[float], None)
        else:  # select / text
            if p.get("required"):
                fields[p["key"]] = (str, ...)
            else:
                fields[p["key"]] = (Optional[str], None)
    return create_model("SoilDataInput", **fields)


def _build_prediction_input_model():
    """Build PredictionInput model: only feature columns."""
    fields = {}
    for p in PARAMETER_LIST:
        if p["role"] != "feature":
            continue
        if p["type"] == "number":
            if p.get("required"):
                fields[p["key"]] = (float, ...)
            else:
                fields[p["key"]] = (Optional[float], None)
        else:
            if p.get("required"):
                fields[p["key"]] = (str, ...)
            else:
                fields[p["key"]] = (Optional[str], None)
    return create_model("PredictionInput", **fields)


class PredictionValue(BaseModel):
    value: Optional[float]
    confidence: float
    restricted: Optional[bool] = False

class PredictionResponse(BaseModel):
    multi_output: dict[str, PredictionValue]
    regressor_chain: dict[str, PredictionValue]

SoilDataInput = _build_soil_data_model()
PredictionInput = _build_prediction_input_model()


class TrainResponse(BaseModel):
    status: str
    num_samples: int
    features: list[str]
    targets: list[str]
    conf_multi: dict[str, float]
    conf_chain: dict[str, float]


class ModelStatusResponse(BaseModel):
    model_exists: bool


class StatsResponse(BaseModel):
    total_records: int


# --- FastAPI App ---

app = FastAPI(
    title="Geotechnical Parameter Predictor API",
    version="1.0.0",
)

# CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://geopredict.daharin.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Endpoints ---

@app.get("/api/config")
async def get_config_endpoint():
    return PARAMETER_LIST


@app.post("/api/train", response_model=TrainResponse)
async def train_endpoint():
    try:
        data = fetch_all_soil_data()
        if not data:
            raise HTTPException(
                status_code=400,
                detail="No data found in PocketBase. Add some soil data first."
            )
        result = train_model(data)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.post("/api/predict", response_model=PredictionResponse)
async def predict_endpoint(input_data: PredictionInput):
    try:
        input_dict = input_data.model_dump()
        result = predict(input_dict)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")



@app.post("/api/data")
async def create_data_endpoint(data: SoilDataInput):
    try:
        record = create_soil_record(data.model_dump())
        return {"status": "success", "record": record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save data: {str(e)}")


@app.get("/api/model-status", response_model=ModelStatusResponse)
async def model_status_endpoint():
    return {"model_exists": model_exists()}


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats_endpoint():
    try:
        data = fetch_all_soil_data()
        return {"total_records": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/distribution")
async def get_distribution_endpoint():
    try:
        data = fetch_all_soil_data()
        if not data:
            return {}
        return get_distribution_stats(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/regression")
async def get_regression_endpoint(x: str, y: str, force_origin: bool = False, model_type: str = "auto"):
    try:
        data = fetch_all_soil_data()
        if not data:
            return {"error": "No data available in database."}
        return perform_regression_analysis(data, x, y, force_origin, model_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/formula-discovery")
async def get_formula_discovery_endpoint(xs: str, y: str):
    try:
        data = fetch_all_soil_data()
        if not data:
            return {"error": "No data available in database."}
        
        x_list = [x.strip() for x in xs.split(",") if x.strip()]
        if not x_list:
            return {"error": "At least one input parameter (X) is required."}
            
        return discover_best_formula(data, x_list, y)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
