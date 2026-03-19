from app.ml.model_registry import ModelRegistry

ModelRegistry.load_models()

scaler = ModelRegistry.get_model("scaler.pkl")

print("EXPECTED FEATURES:")
print(scaler.feature_names_in_)
print("COUNT:", len(scaler.feature_names_in_))