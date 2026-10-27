"""Preprocessing shared by train_diabetes_model.py and diabetespredict.py.

Kept in its own module so the saved model (which references zeros_to_nan) can be loaded
by the prediction script.
"""

import numpy as np

FEATURES = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI",
            "DiabetesPedigreeFunction", "Age"]

# In the Pima data a 0 in these columns means "not measured"
ZERO_MEANS_MISSING = [1, 2, 3, 4, 5]


def zeros_to_nan(X):
    X = np.array(X, dtype=float, copy=True)
    cols = X[:, ZERO_MEANS_MISSING]
    cols[cols == 0] = np.nan
    X[:, ZERO_MEANS_MISSING] = cols
    return X
