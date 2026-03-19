import sys
import os
from unittest.mock import MagicMock

# Add project root to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.ml.predictor import MLPredictor
from app.ml.model_registry import ModelRegistry

def test_pipeline():
    # 1. Initialize models
    print("--- Initializing Production Pipeline ---")
    ModelRegistry.load_models()
    
    # 2. VALID Input (8 raw features)
    metrics = {
        "step_length": 64.0,
        "cadence": 105.0,
        "speed": 1.2,
        "symmetry": 0.92,
        "temperature": 34.0,
        "moisture": 45.0,
        "pressure": 0.85,
        "wear_hours": 12.0
    }
    
    print(f"\nVALID INPUT TEST: {metrics}")
    try:
        predictions = MLPredictor.run_prediction(metrics)
        print(f"PREDICTIONS: {predictions}")
        print("Status: PASS")
    except Exception as e:
        print(f"Status: FAIL | Error: {str(e)}")

    # 3. INVALID Input (Symmetry out of bounds)
    print("\n--- Testing Input Validation (Invalid Symmetry) ---")
    invalid_metrics = metrics.copy()
    invalid_metrics["symmetry"] = 1.5
    try:
        MLPredictor.run_prediction(invalid_metrics)
        print("Status: FAIL (Should have raised ValueError)")
    except ValueError as e:
        print(f"Status: PASS | Expected Error: {str(e)}")

    # 4. INVALID Input (Missing Field)
    print("\n--- Testing Input Validation (Missing Field) ---")
    missing_metrics = metrics.copy()
    del missing_metrics["cadence"]
    try:
        MLPredictor.run_prediction(missing_metrics)
        print("Status: FAIL (Should have raised ValueError)")
    except ValueError as e:
        print(f"Status: PASS | Expected Error: {str(e)}")

    # 5. STRESS TEST (Extreme but valid inputs)
    print("\n--- Testing Stress Test (Extreme Inputs) ---")
    stress_metrics = {
        "step_length": 20.0,
        "cadence": 40.0,
        "speed": 0.4,
        "symmetry": 0.1,
        "temperature": 40.0,
        "moisture": 90.0,
        "pressure": 2.0,
        "wear_hours": 20.0
    }
    try:
        predictions = MLPredictor.run_prediction(stress_metrics)
        print(f"STRESS PREDICTIONS: {predictions}")
        print("Status: PASS")
    except Exception as e:
        print(f"Status: FAIL | Error: {str(e)}")

if __name__ == "__main__":
    test_pipeline()
