from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import time

logger = logging.getLogger(__name__)

from app.ml.predictor import MLPredictor

class AnalysisService:
    @staticmethod
    def run_ml_analysis(features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs the ML prediction pipeline over the provided input features.
        """
        # Features should be a dict matching the 8 input metrics.
        logger.info("Running ML analysis pipeline...")
        
        start_time = time.perf_counter()
        predictions = MLPredictor.run_prediction(features)
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        logger.info(f"ML analysis completed in {latency_ms:.2f}ms")
        return predictions

analysis_service = AnalysisService()
