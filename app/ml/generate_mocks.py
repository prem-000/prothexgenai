import os
import pickle
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.datasets import make_classification, make_regression

def generate_mocks():
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(models_dir, exist_ok=True)
    
    # Generate Scaler
    print("Generating mock scaler...")
    scaler = StandardScaler()
    # Fit with dummy data matching 8 features
    scaler.fit([[64, 95, 1.1, 0.88, 33, 55, 0.78, 10]])
    with open(os.path.join(models_dir, "scaler.pkl"), "wb") as f:
        pickle.dump(scaler, f)

    # Generate Classifier (risk_classifier.pkl)
    print("Generating mock risk_classifier...")
    X, y = make_classification(n_samples=100, n_features=8, n_classes=3, n_informative=5)
    classifier = RandomForestClassifier(max_depth=2, random_state=42)
    classifier.fit(X, y)
    with open(os.path.join(models_dir, "risk_classifier.pkl"), "wb") as f:
        pickle.dump(classifier, f)

    # Generate Regressors
    names = ["gait_score_regressor.pkl", "pressure_risk_regressor.pkl", "skin_risk_regressor.pkl"]
    for name in names:
        print(f"Generating mock {name}...")
        X, y = make_regression(n_samples=100, n_features=8, noise=0.1)
        regressor = RandomForestRegressor(max_depth=2, random_state=42)
        regressor.fit(X, y)
        with open(os.path.join(models_dir, name), "wb") as f:
            pickle.dump(regressor, f)
            
    # Model Metadata
    with open(os.path.join(os.path.dirname(__file__), "model_metadata.json"), "w") as f:
        import json
        json.dump({
            "version": "1.0",
            "description": "Mock models for local testing",
            "features": [
                "step_length", "cadence", "speed", "symmetry", 
                "temperature", "moisture", "pressure", "wear_hours"
            ]
        }, f, indent=4)
        
    print("Models generated successfully.")

if __name__ == "__main__":
    generate_mocks()
