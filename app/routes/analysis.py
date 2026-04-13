from fastapi import APIRouter, Depends, HTTPException, Body
from app.core.dependencies import get_current_user
from app.database import get_db
from app.services.analysis_service import analysis_service
from app.models.analysis_schemas import AnalysisRequest, AnalysisResponse
from bson import ObjectId
from datetime import datetime, timezone
import time
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_record(
    request: AnalysisRequest, 
    current_user: dict = Depends(get_current_user)
):
    """
    Optimized endpoint for biomechanical analysis.
    Performs purely mathematical calculations without blocking I/O or external AI calls.
    Returns minimal JSON response under 500ms.
    """
    start_time = time.perf_counter()
    db = get_db()
    user_id = current_user["_id"]

    try:
        # Instead of fetching daily_metrics, we now use the incoming raw features directly
        # as dictated by the ML Integration PRD.
        features = request.model_dump(exclude={"record_id"})
        
        # 1. Perform ML Analysis
        predictions = analysis_service.run_ml_analysis(features)
        
        # 2. Store Summarized Result
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        # Support fallback to record_id if the client still sends it for linkage
        record_obj_id = ObjectId(request.record_id) if request.record_id and ObjectId.is_valid(request.record_id) else None
        
        # Determine patient_id (linked to user_id)
        profile = await db["patient_profiles"].find_one({"user_id": user_id})
        patient_id = profile["_id"] if profile else user_id

        # A. Create Daily Metric Record (for Dashboard & Calendar UI)
        daily_record = {
            "patient_id": patient_id,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "step_length_cm": request.step_length,
            "cadence_spm": request.cadence,
            "walking_speed_mps": request.speed,
            "gait_symmetry_index": request.symmetry,
            "skin_temperature_c": request.temperature,
            "skin_moisture": request.moisture,
            "pressure_distribution_index": request.pressure,
            "daily_wear_hours": request.wear_hours,
            "gait_abnormality": "Abnormal" if predictions["risk_level"] == "High" else "Normal",
            "skin_risk": "High" if predictions["skin_risk"] > 50 else "Low", 
            "prosthetic_health_score": predictions["gait_score"],
            "created_at": datetime.now(timezone.utc)
        }
        await db["daily_metrics"].insert_one(daily_record)

        # B. Store Detailed Analysis Result
        analysis_doc = {
            "user_id": user_id,
            "patient_id": patient_id,
            "record_id": record_obj_id,
            "gait_score": predictions["gait_score"],
            "pressure_risk": predictions["pressure_risk"],
            "skin_risk": predictions["skin_risk"],
            "risk_level": predictions["risk_level"],
            "execution_time_ms": execution_time_ms,
            "created_at": datetime.now(timezone.utc)
        }
        await db["analysis_results"].insert_one(analysis_doc)

        # 3. Log Analysis Metadata
        logger.info(
            f"ML Analysis Saved: user={user_id}, "
            f"time={execution_time_ms:.2f}ms"
        )

        # 4. Return PRD compliant response
        return AnalysisResponse(
            risk_level=predictions["risk_level"],
            gait_score=predictions["gait_score"],
            pressure_risk=predictions["pressure_risk"],
            skin_risk=predictions["skin_risk"],
            execution_time_ms=execution_time_ms
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Analysis engine failed to process the request")

@router.get("/health")
async def ml_health():
    """
    Health check for ML registry and feature schema.
    """
    from app.ml.model_registry import ModelRegistry
    scaler = ModelRegistry.get_model("scaler.pkl")
    classifier = ModelRegistry.get_model("risk_classifier.pkl")
    
    models_loaded = all([scaler, classifier])
    feature_count = len(scaler.feature_names_in_) if scaler and hasattr(scaler, "feature_names_in_") else 0
    
    return {
        "status": "healthy" if models_loaded else "degraded",
        "models_loaded": models_loaded,
        "feature_count": feature_count,
        "version": "2.0-production-ready"
    }

@router.post("/stress-test")
async def stress_test(metrics: dict = Body(...)):
    """
    In-memory stress test for the ML pipeline with extreme inputs.
    Does not persist to database.
    """
    try:
        predictions = analysis_service.run_ml_analysis(metrics)
        return {
            "status": "success",
            "predictions": predictions
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e)
        }

@router.post("/run/{record_id}", deprecated=True)
async def run_analysis_legacy(record_id: str, current_user: dict = Depends(get_current_user)):
    """
    Legacy endpoint. Use /analyze instead.
    """
    return await analyze_record(AnalysisRequest(record_id=record_id), current_user)
