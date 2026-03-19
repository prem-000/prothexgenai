"""
Lightweight placeholder model classes for local testing.
These live in a proper importable module so pickle can resolve them at load time.
"""
import numpy as np


class _DummyScaler:
    """Mimics sklearn StandardScaler.transform()"""
    def __init__(self):
        self.feature_names_in_ = [
            "step_length", "cadence", "speed", "symmetry", 
            "temperature", "moisture", "pressure", "wear_hours",
            "gait_efficiency", "skin_stress_index", "mech_load", 
            "asymmetry", "gait_quality", "overall_load"
        ]

    def transform(self, X):
        return np.array(X, dtype=float)


class _DummyClassifier:
    """Always predicts class index 1 → 'Moderate'"""
    def predict(self, X):
        return [1]


class _DummyRegressor:
    """Returns a fixed plausible float for every inference call"""
    def __init__(self, value: float):
        self._value = value

    def predict(self, X):
        return [self._value]
