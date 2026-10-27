"""Train the heart disease model on the original UCI Cleveland data.

Data: data/processed.cleveland.data (UCI Heart Disease, CC BY 4.0). Label: num > 0 = heart disease.

The website and the sample lab reports use the coding of the popular Kaggle copy of this data,
so the UCI values are converted to that coding here (the label is NOT taken from Kaggle,
because the Kaggle copy has it reversed):
  cp       0 asymptomatic, 1 atypical angina, 2 non-anginal pain, 3 typical angina
  restecg  0 left ventricular hypertrophy, 1 normal, 2 ST-T wave abnormality
  slope    0 downsloping, 1 flat, 2 upsloping
  thal     1 fixed defect, 2 normal, 3 reversible defect
  ca       0-3 major vessels

Candidates are compared with repeated stratified 5-fold CV; the regularisation strength C is
chosen inside each training fold (nested), so the reported scores are not tuned on the test folds.
Saves heart_model.pkl ({"model", "features"}) and heart_model_metrics.json.
"""

import csv
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, RepeatedStratifiedKFold, StratifiedKFold, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

HERE = Path(__file__).resolve().parent
FEATURES = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang",
            "oldpeak", "slope", "ca", "thal"]
CATEGORICAL = [FEATURES.index(c) for c in ("cp", "restecg", "slope", "thal")]
NUMERIC = [i for i in range(len(FEATURES)) if i not in CATEGORICAL]
CATEGORIES = [[0, 1, 2, 3], [0, 1, 2], [0, 1, 2], [1, 2, 3]]

CP = {1: 3, 2: 1, 3: 2, 4: 0}
RESTECG = {0: 1, 1: 2, 2: 0}
SLOPE = {1: 2, 2: 1, 3: 0}
THAL = {3: 2, 6: 1, 7: 3}


def load_data():
    X, y = [], []
    with open(HERE / "data" / "processed.cleveland.data", newline="") as f:
        for row in csv.reader(f):
            if not row or "?" in row:  # 6 patients have missing ca/thal
                continue
            v = [float(x) for x in row]
            X.append([v[0], v[1], CP[int(v[2])], v[3], v[4], v[5], RESTECG[int(v[6])], v[7], v[8],
                      v[9], SLOPE[int(v[10])], v[11], THAL[int(v[12])]])
            y.append(int(v[13] > 0))
    return np.array(X), np.array(y)


def logistic(one_hot):
    if one_hot:
        prep = ColumnTransformer([
            ("cat", OneHotEncoder(categories=CATEGORIES, drop="first"), CATEGORICAL),
            ("num", StandardScaler(), NUMERIC),
        ])
    else:
        prep = StandardScaler()
    pipe = make_pipeline(prep, LogisticRegression(max_iter=5000))
    return GridSearchCV(pipe, {"logisticregression__C": [0.01, 0.03, 0.1, 0.3, 1, 3]},
                        cv=StratifiedKFold(5, shuffle=True, random_state=1), scoring="roc_auc")


def main():
    X, y = load_data()
    print(f"{len(y)} patients, {y.sum()} with heart disease")
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=0)
    candidates = {
        "logistic_regression_one_hot": logistic(True),
        "logistic_regression_codes": logistic(False),
        "random_forest_min_leaf_5": RandomForestClassifier(300, min_samples_leaf=5, random_state=0),
    }
    results = {}
    for name, est in candidates.items():
        r = cross_validate(est, X, y, cv=cv, return_train_score=True,
                           scoring=["roc_auc", "accuracy", "balanced_accuracy", "recall"])
        results[name] = {k: round(float(v), 4) for k, v in {
            "roc_auc": r["test_roc_auc"].mean(),
            "accuracy": r["test_accuracy"].mean(),
            "accuracy_std": r["test_accuracy"].std(),
            "balanced_accuracy": r["test_balanced_accuracy"].mean(),
            "sensitivity": r["test_recall"].mean(),
            "train_accuracy": r["train_accuracy"].mean(),
            "train_validation_gap": r["train_accuracy"].mean() - r["test_accuracy"].mean(),
        }.items()}
        print(name, results[name], flush=True)

    # ROC-AUC differences under 0.005 are noise on 297 patients; among those near the top,
    # prefer the best balanced accuracy (catches sick patients without over-calling healthy ones)
    top_auc = max(r["roc_auc"] for r in results.values())
    near_top = [n for n in results if results[n]["roc_auc"] >= top_auc - 0.005]
    best = max(near_top, key=lambda n: (results[n]["balanced_accuracy"], -results[n]["train_validation_gap"]))
    final = candidates[best].fit(X, y)
    if hasattr(final, "best_params_"):
        print("chosen C:", final.best_params_)
        results[best]["chosen_params"] = final.best_params_
        final = final.best_estimator_
    joblib.dump({"model": final, "features": FEATURES, "model_name": best}, HERE / "heart_model.pkl")
    (HERE / "heart_model_metrics.json").write_text(json.dumps({
        "dataset": "UCI Heart Disease, Cleveland (CC BY 4.0), complete rows",
        "patients": int(len(y)),
        "positives": int(y.sum()),
        "validation": "5-fold stratified CV x10, C tuned inside each training fold",
        "candidates": results,
        "selected": best,
    }, indent=2))
    print("selected:", best)


if __name__ == "__main__":
    main()
