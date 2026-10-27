"""Predict diabetes for one patient.

Usage: python diabetespredict.py pregnancies glucose blood_pressure skin_thickness insulin bmi pedigree age
A 0 for glucose, blood pressure, skin thickness, insulin or BMI means "not measured" (the model fills it in).
Prints 1 (diabetic) or 0 (not diabetic) as the last line. Model: train_diabetes_model.py.
Exit code 2 = invalid input.
"""

import os
import sys

import joblib

# Imported so the saved model's preprocessing step (zeros_to_nan) can be found when loading
import diabetes_features  # noqa: F401

# (min, max) for each value; 0 is always allowed for the "not measured" columns
LIMITS = [
    (0, 20),     # pregnancies
    (40, 400),   # glucose (mg/dl)
    (30, 150),   # diastolic blood pressure (mm Hg)
    (5, 100),    # skin thickness (mm)
    (5, 900),    # insulin (mu U/ml)
    (10, 80),    # BMI
    (0, 3),      # diabetes pedigree function
    (1, 120),    # age
]


def main():
    if len(sys.argv) != 9:
        print("Error: expected 8 values", file=sys.stderr)
        sys.exit(2)
    try:
        values = [float(v) for v in sys.argv[1:]]
    except ValueError:
        print("Error: all values must be numbers", file=sys.stderr)
        sys.exit(2)
    for i, (v, (lo, hi)) in enumerate(zip(values, LIMITS)):
        missing_ok = i in diabetes_features.ZERO_MEANS_MISSING and v == 0
        if not missing_ok and not lo <= v <= hi:
            print(f"Error: value {v} out of range", file=sys.stderr)
            sys.exit(2)

    bundle = joblib.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "diabetes_model.pkl"))
    print(int(bundle["model"].predict([values])[0]))


if __name__ == "__main__":
    main()
