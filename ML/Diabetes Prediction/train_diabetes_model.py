"""Train the diabetes model on the Pima Indians Diabetes Database (data/diabetes.csv).

Fixes over the old model (linear SVM, C=1, scaler fitted on all rows incl. test rows):
  * zeros in Glucose, BloodPressure, SkinThickness, Insulin and BMI mean "not measured" and are
    imputed with the training median instead of being used as real zeros
  * scaling and imputation are fitted inside each training fold only (no test-data leakage)
  * class_weight="balanced": the old model missed about half of the diabetic patients
  * C is tuned inside each training fold (nested CV)

Saves diabetes_model.pkl ({"model", "features"}) and diabetes_model_metrics.json.
"""

import csv
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, RepeatedStratifiedKFold, StratifiedKFold, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler
from sklearn.svm import SVC

from diabetes_features import FEATURES, zeros_to_nan

HERE = Path(__file__).resolve().parent


def load_data():
    with open(HERE / "data" / "diabetes.csv", newline="") as f:
        rows = list(csv.DictReader(f))
    X = np.array([[float(r[c]) for c in FEATURES] for r in rows])
    y = np.array([int(r["Outcome"]) for r in rows])
    return X, y


def prep(impute=True):
    steps = [FunctionTransformer(zeros_to_nan), SimpleImputer(strategy="median")] if impute else []
    return steps + [StandardScaler()]


def tuned(estimator, grid, impute=True):
    pipe = make_pipeline(*prep(impute), estimator)
    name = pipe.steps[-1][0]
    return GridSearchCV(pipe, {f"{name}__{k}": v for k, v in grid.items()},
                        cv=StratifiedKFold(5, shuffle=True, random_state=1), scoring="roc_auc")


def main():
    X, y = load_data()
    print(f"{len(y)} patients, {y.sum()} diabetic")
    C = [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3]
    candidates = {
        "old_setup_linear_svm_C1_unweighted": make_pipeline(StandardScaler(), SVC(kernel="linear")),
        "linear_svm_balanced": tuned(SVC(kernel="linear", class_weight="balanced"), {"C": C}),
        "logistic_regression_balanced": tuned(
            LogisticRegression(class_weight="balanced", max_iter=5000), {"C": C}),
        "logistic_regression_balanced_no_imputation": tuned(
            LogisticRegression(class_weight="balanced", max_iter=5000), {"C": C}, impute=False),
        "random_forest_balanced": tuned(
            RandomForestClassifier(300, class_weight="balanced", random_state=0),
            {"min_samples_leaf": [10, 20, 40], "max_depth": [None, 6]}),
    }
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=0)
    results = {}
    for name, est in candidates.items():
        r = cross_validate(est, X, y, cv=cv, return_train_score=True, n_jobs=-1,
                           scoring=["roc_auc", "accuracy", "balanced_accuracy", "recall"])
        results[name] = {k: round(float(v), 4) for k, v in {
            "roc_auc": r["test_roc_auc"].mean(),
            "accuracy": r["test_accuracy"].mean(),
            "balanced_accuracy": r["test_balanced_accuracy"].mean(),
            "sensitivity": r["test_recall"].mean(),
            "train_balanced_accuracy": r["train_balanced_accuracy"].mean(),
            "train_validation_gap": r["train_balanced_accuracy"].mean() - r["test_balanced_accuracy"].mean(),
        }.items()}
        print(name, results[name], flush=True)

    # Among models within 0.005 ROC-AUC of the best, take the best balanced accuracy
    # (a screening tool must not miss most diabetics); never pick the old setup
    pool = {n: v for n, v in results.items() if not n.startswith("old_setup")}
    top_auc = max(v["roc_auc"] for v in pool.values())
    best = max((n for n in pool if pool[n]["roc_auc"] >= top_auc - 0.005),
               key=lambda n: (pool[n]["balanced_accuracy"], -pool[n]["train_validation_gap"]))

    final = candidates[best].fit(X, y)
    if hasattr(final, "best_params_"):
        print("chosen params:", final.best_params_)
        results[best]["chosen_params"] = final.best_params_
        final = final.best_estimator_
    joblib.dump({"model": final, "features": FEATURES, "model_name": best}, HERE / "diabetes_model.pkl")
    (HERE / "diabetes_model_metrics.json").write_text(json.dumps({
        "dataset": "Pima Indians Diabetes Database (768 patients)",
        "validation": "5-fold stratified CV x10, hyperparameters tuned inside each training fold",
        "candidates": results,
        "selected": best,
    }, indent=2))
    print("selected:", best)


if __name__ == "__main__":
    main()
