import os
import joblib
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ModelRegistry:
    # Class-level cache dictionary mapping filename to loaded model in memory
    _models: Dict[str, Any] = {}
    
    @classmethod
    def load_models(cls) -> None:
        """
        Iterates over the models directory and loads all .pkl files once
        to prevent memory leaks and slow per-request inference paths.
        """
        logger.info("Initializing ML models from registry...")
        base_dir = os.path.dirname(__file__)
        models_dir = os.path.join(base_dir, "models")
        
        if not os.path.exists(models_dir):
            logger.warning(f"Model directory not found at {models_dir}. Ensure models are placed here.")
            return

        expected_models = [
            "scaler.pkl",
            "risk_classifier.pkl",
            "gait_score_regressor.pkl",
            "pressure_risk_regressor.pkl",
            "skin_risk_regressor.pkl"
        ]
        
        for model_name in expected_models:
            model_path = os.path.join(models_dir, model_name)
            if not os.path.exists(model_path):
                logger.error(f"Missing required model file: {model_name}")
                continue
                
            try:
                cls._models[model_name] = joblib.load(model_path)
                logger.debug(f"Loaded: {model_name}")
            except Exception as e:
                logger.error(f"Failed to load {model_name}: {str(e)}")
                
        logger.info(f"ML Model Registry loaded {len(cls._models)}/{len(expected_models)} models.")

    @classmethod
    def get_model(cls, model_name: str) -> Any:
        """Fetch a cached model by filename. Returns None if not loaded."""
        if not cls._models:
            logger.warning("Models accessed before initialization. Loading now...")
            cls.load_models()
        return cls._models.get(model_name)
