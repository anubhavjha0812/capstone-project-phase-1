"""Predict heart disease for one patient.

Usage: python heartpredict.py age sex cp trestbps chol fbs restecg thalach exang oldpeak slope ca thal
Coding (same as the website form and the sample lab reports):
  sex 1 male / 0 female, fbs and exang 1 yes / 0 no,
  cp 0 asymptomatic / 1 atypical angina / 2 non-anginal pain / 3 typical angina,
  restecg 0 left ventricular hypertrophy / 1 normal / 2 ST-T wave abnormality,
  slope 0 downsloping / 1 flat / 2 upsloping, ca 0-3, thal 1 fixed defect / 2 normal / 3 reversible defect
Prints 1 (heart disease) or 0 (no heart disease) as the last line. Model: train_heart_model.py.
"""

import os
import sys

import joblib

# (min, max, allowed values or None)
LIMITS = [
    (1, 120, None),          # age
    (0, 1, {0, 1}),          # sex
    (0, 3, {0, 1, 2, 3}),    # cp
    (50, 250, None),         # trestbps (mm Hg)
    (80, 700, None),         # chol (mg/dl)
    (0, 1, {0, 1}),          # fbs
    (0, 2, {0, 1, 2}),       # restecg
    (50, 250, None),         # thalach (bpm)
    (0, 1, {0, 1}),          # exang
    (0, 10, None),           # oldpeak
    (0, 2, {0, 1, 2}),       # slope
    (0, 3, {0, 1, 2, 3}),    # ca
    (1, 3, {1, 2, 3}),       # thal
]


def main():
    if len(sys.argv) != 14:
        print("Error: expected 13 values", file=sys.stderr)
        sys.exit(1)
    try:
        values = [float(v) for v in sys.argv[1:]]
    except ValueError:
        print("Error: all values must be numbers", file=sys.stderr)
        sys.exit(2)
    for v, (lo, hi, allowed) in zip(values, LIMITS):
        if not lo <= v <= hi or (allowed is not None and v not in allowed):
            print(f"Error: value {v} out of range", file=sys.stderr)
            sys.exit(2)

    bundle = joblib.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "heart_model.pkl"))
    print(int(bundle["model"].predict([values])[0]))


if __name__ == "__main__":
    main()
