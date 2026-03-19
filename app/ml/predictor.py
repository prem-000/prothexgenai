import logging
from typing import Dict, Any
import numpy as np
import pandas as pd
from app.ml.model_registry import ModelRegistry

logger = logging.getLogger(__name__)

class MLPredictor:
    """
    Production-ready orchestrator for scikit-learn models.
    Includes input validation, feature engineering, and inference monitoring.
    """
    
    # Mapping model integer classes to readable risk strings
    RISK_MAP = {
        0: "Low",
        1: "Moderate",
        2: "High"
    }

    REQUIRED_FEATURES = [
        "step_length", "cadence", "speed", "symmetry", 
        "temperature", "moisture", "pressure", "wear_hours"
    ]

    @classmethod
    def validate_input(cls, data: Dict[str, Any]) -> None:
        """
        Hard validation layer to prevent garbage-in-garbage-out.
        """
        # 1. Missing Field Check
        for field in cls.REQUIRED_FEATURES:
            if field not in data:
                raise ValueError(f"Missing required clinical feature: '{field}'")
        
        # 2. Logic Range Checks
        symmetry = float(data["symmetry"])
        if not (0.0 <= symmetry <= 1.0):
            raise ValueError(f"Clinical Validation Error: Symmetry {symmetry} must be between 0 and 1.")

        pressure = float(data["pressure"])
        if pressure < 0:
            raise ValueError(f"Clinical Validation Error: Pressure {pressure} cannot be negative.")

        wear_hours = float(data["wear_hours"])
        if not (0.0 <= wear_hours <= 24.0):
            raise ValueError(f"Clinical Validation Error: Wear hours {wear_hours} must be between 0 and 24.")

    @staticmethod
    def construct_feature_df(data: Dict[str, Any]) -> pd.DataFrame:
        """
        Engineers 14 high-fidelity features from 8 raw metrics.
        """
        # Extract validated features
        step_length = float(data["step_length"])
        cadence = float(data["cadence"])
        speed = float(data["speed"])
        symmetry = float(data["symmetry"])
        temperature = float(data["temperature"])
        moisture = float(data["moisture"])
        pressure = float(data["pressure"])
        wear_hours = float(data["wear_hours"])

        # Feature Engineering (Production Formulas)
        gait_efficiency = step_length * symmetry
        skin_stress_index = temperature * moisture
        mech_load = pressure * wear_hours
        asymmetry = 1.0 - symmetry
        gait_quality = cadence * speed
        overall_load = mech_load * asymmetry

        feature_dict = {
            "step_length": [step_length],
            "cadence": [cadence],
            "speed": [speed],
            "symmetry": [symmetry],
            "temperature": [temperature],
            "moisture": [moisture],
            "pressure": [pressure],
            "wear_hours": [wear_hours],
            "gait_efficiency": [gait_efficiency],
            "skin_stress_index": [skin_stress_index],
            "mech_load": [mech_load],
            "asymmetry": [asymmetry],
            "gait_quality": [gait_quality],
            "overall_load": [overall_load]
        }
        
        return pd.DataFrame(feature_dict)

    @classmethod
    def run_prediction(cls, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Production Inference Pipeline: 
        Validation -> Engineering -> Alignment -> Scaling -> Multi-Model Inference -> Sanity Check.
        """
        # 1. Input Validation
        cls.validate_input(metrics)

        # 2. Feature Engineering
        df = cls.construct_feature_df(metrics)
        
        # Logging Ingestion (Monitoring)
        logger.info(f"Ingested Features (14-dim): {df.to_dict(orient='records')[0]}")
        
        # 3. Model Alignment
        scaler = ModelRegistry.get_model("scaler.pkl")
        if not scaler:
            raise RuntimeError("Production Failure: Scaler model registry empty.")
            
        if not hasattr(scaler, "feature_names_in_"):
            raise RuntimeError("Model Version Mismatch: Scaler missing feature_names_in_.")
            
        df = df[scaler.feature_names_in_]

        # 4. In-Memory Scaling
        X_scaled = scaler.transform(df)

        # 5. ML Specific Inference
        classifier = ModelRegistry.get_model("risk_classifier.pkl")
        gait_reg = ModelRegistry.get_model("gait_score_regressor.pkl")
        pressure_reg = ModelRegistry.get_model("pressure_risk_regressor.pkl")
        skin_reg = ModelRegistry.get_model("skin_risk_regressor.pkl")
        
        if not all([classifier, gait_reg, pressure_reg, skin_reg]):
            raise RuntimeError("Inference Blocked: One or more ML models failed to load.")

        # Executing Multi-Model Path
        risk_class_idx = classifier.predict(X_scaled)[0]
        risk_level = cls.RISK_MAP.get(int(risk_class_idx), "Moderate")

        gait_score = round(float(np.clip(gait_reg.predict(X_scaled)[0], 0, 100)), 1)
        pressure_risk = round(float(abs(pressure_reg.predict(X_scaled)[0])), 1)
        skin_risk = round(float(abs(skin_reg.predict(X_scaled)[0])), 1)

        # 6. Prediction Sanity Checks
        if not (0.0 <= gait_score <= 100.0):
            logger.error(f"Prediction Out of Bounds: gait_score={gait_score}")
            raise ValueError(f"Model integrity failure: Invalid gait_score {gait_score}")

        result = {
            "risk_level": risk_level,
            "gait_score": gait_score,
            "pressure_risk": pressure_risk,
            "skin_risk": skin_risk
        }

        # Final Production Logging
        logger.info(f"Production Inference Successful: UI_Result={result}")
        return result


