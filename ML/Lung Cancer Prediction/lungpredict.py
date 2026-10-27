"""
Predicts lung cancer risk with the model trained by train_lung_model.py.

Usage: python lungpredict.py <15 values in this order>
  gender (1 = male, 0 = female), age, then 13 answers (1 = yes, 0 = no):
  smoking, yellowFingers, anxiety, peerPressure, chronicDisease, fatigue,
  allergy, wheezing, alcohol, coughing, shortnessOfBreath,
  swallowingDifficulty, chestPain

Prints one JSON line: {"prediction": 0 or 1, "probability": <chance of 1>}
"""

import json
import os
import sys

import joblib
import numpy as np

MODEL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lung_model.pkl")


def main():
    bundle = joblib.load(MODEL_FILE)
    features = bundle["features"]

    args = sys.argv[1:]
    if len(args) != len(features):
        print(f"Expected {len(features)} values ({', '.join(features)}), got {len(args)}", file=sys.stderr)
        sys.exit(1)

    try:
        values = [float(a) for a in args]
    except ValueError:
        print("All values must be numbers", file=sys.stderr)
        sys.exit(1)

    age = values[1]
    binary = [values[0]] + values[2:]
    if not (1 <= age <= 120) or any(v not in (0.0, 1.0) for v in binary):
        print("Age must be 1-120 and all other values must be 0 or 1", file=sys.stderr)
        sys.exit(1)

    model = bundle["model"]
    X = np.array([values])
    prediction = int(model.predict(X)[0])
    probability = float(model.predict_proba(X)[0][1])
    print(json.dumps({"prediction": prediction, "probability": round(probability, 4)}))


if __name__ == "__main__":
    main()
