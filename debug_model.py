import joblib

scaler = joblib.load("app/ml/models/scaler.pkl")

print("Number of features scaler expects:")
print(scaler.n_features_in_)

print("\nFeature names used during training:")
print(scaler.feature_names_in_)