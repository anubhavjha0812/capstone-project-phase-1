"""
Trains the Predictix lung cancer risk model.

Data: "Survey Lung Cancer" dataset (data/survey_lung_cancer.csv, 309 survey
responses, MIT licence copy from github.com/Uni-Creator/Lung_Cancer_Prediction).
Each row is one person: gender, age and 13 yes/no questions about smoking and
symptoms, plus whether they had lung cancer.

The data is imbalanced (most rows are "YES"), so models are compared on ROC-AUC
and balanced accuracy with repeated stratified cross-validation, not on plain
accuracy. Regularisation is tuned inside each training fold (nested CV) because
with only 38 "NO" rows the default settings overfit (train/validation gap ~10 points).
The best model is retrained on all data and saved to lung_model.pkl.

Run:  python train_lung_model.py
"""

import csv
import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import (
    GridSearchCV,
    RepeatedStratifiedKFold,
    StratifiedKFold,
    cross_validate,
)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(HERE, "data", "survey_lung_cancer.csv")
MODEL_FILE = os.path.join(HERE, "lung_model.pkl")
METRICS_FILE = os.path.join(HERE, "lung_model_metrics.json")

# Feature order used by the model, the backend and lungpredict.py
FEATURES = [
    "gender",  # 1 = male, 0 = female
    "age",
    "smoking",
    "yellowFingers",
    "anxiety",
    "peerPressure",
    "chronicDisease",
    "fatigue",
    "allergy",
    "wheezing",
    "alcohol",
    "coughing",
    "shortnessOfBreath",
    "swallowingDifficulty",
    "chestPain",
]


def load_data():
    """Reads the CSV and encodes it: yes/no answers (2/1 in the file) become 1/0."""
    rows = []
    with open(DATA_FILE, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # header
        for r in reader:
            if not r:
                continue
            gender = 1 if r[0].strip().upper() == "M" else 0
            age = float(r[1])
            answers = [1 if int(v) == 2 else 0 for v in r[2:15]]
            label = 1 if r[15].strip().upper() == "YES" else 0
            rows.append(tuple([gender, age, *answers, label]))

    total = len(rows)
    rows = sorted(set(rows))  # identical duplicate rows would leak between CV folds
    data = np.array(rows, dtype=float)
    return data[:, :-1], data[:, -1].astype(int), total


def main():
    X, y, total_rows = load_data()
    print(f"Rows: {total_rows} in file, {len(y)} after removing duplicates")
    print(f"Lung cancer YES: {int(y.sum())}  NO: {int((y == 0).sum())}")

    inner = StratifiedKFold(5, shuffle=True, random_state=1)

    def tuned(model, grid):
        # ROC-AUC barely changes with regularisation here; balanced accuracy does
        return GridSearchCV(model, grid, cv=inner, scoring="balanced_accuracy")

    candidates = {
        "Logistic Regression": tuned(
            make_pipeline(StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=5000)),
            {"logisticregression__C": [0.003, 0.01, 0.03, 0.1, 0.3, 1]},
        ),
        "Random Forest": tuned(
            RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42),
            {"min_samples_leaf": [3, 10, 20], "max_depth": [None, 4]},
        ),
        "Gradient Boosting": tuned(
            GradientBoostingClassifier(random_state=42),
            {"max_depth": [1, 2, 3], "n_estimators": [50, 150]},
        ),
        "SVM (RBF)": tuned(
            make_pipeline(StandardScaler(), SVC(class_weight="balanced", random_state=42)),
            {"svc__C": [0.1, 0.3, 1, 3]},
        ),
    }

    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=42)
    scoring = {
        "roc_auc": "roc_auc",
        "balanced_accuracy": "balanced_accuracy",
        "accuracy": "accuracy",
        "recall_yes": "recall",
        "f1_yes": "f1",
    }

    results = {}
    for name, model in candidates.items():
        scores = cross_validate(model, X, y, cv=cv, scoring=scoring, return_train_score=True, n_jobs=-1)
        results[name] = {
            metric: {
                "mean": round(float(np.mean(scores[f"test_{metric}"])), 4),
                "std": round(float(np.std(scores[f"test_{metric}"])), 4),
            }
            for metric in scoring
        }
        train_bal = float(np.mean(scores["train_balanced_accuracy"]))
        results[name]["train_balanced_accuracy"] = round(train_bal, 4)
        results[name]["train_validation_gap"] = round(
            train_bal - results[name]["balanced_accuracy"]["mean"], 4
        )
        r = results[name]
        print(
            f"{name:20s} ROC-AUC {r['roc_auc']['mean']:.3f} ± {r['roc_auc']['std']:.3f} | "
            f"balanced acc {r['balanced_accuracy']['mean']:.3f} (train {train_bal:.3f}, "
            f"gap {r['train_validation_gap']:+.3f}) | recall(YES) {r['recall_yes']['mean']:.3f}",
            flush=True,
        )

    # ROC-AUC differences under 0.005 are noise here; among the models near the top,
    # take the best balanced accuracy, then the smallest train/validation gap
    top_auc = max(r["roc_auc"]["mean"] for r in results.values())
    best_name = max(
        (n for n in results if results[n]["roc_auc"]["mean"] >= top_auc - 0.005),
        key=lambda n: (results[n]["balanced_accuracy"]["mean"], -results[n]["train_validation_gap"]),
    )
    print(f"\nSelected model: {best_name}")

    best = candidates[best_name].fit(X, y)
    results[best_name]["chosen_params"] = best.best_params_
    print("Chosen settings:", best.best_params_)
    best = best.best_estimator_

    joblib.dump({"model": best, "features": FEATURES, "model_name": best_name}, MODEL_FILE)

    with open(METRICS_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {
                "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "dataset": "Survey Lung Cancer (data/survey_lung_cancer.csv)",
                "rows_in_file": total_rows,
                "rows_used": int(len(y)),
                "positives": int(y.sum()),
                "negatives": int((y == 0).sum()),
                "validation": "Repeated stratified 5-fold cross-validation, 10 repeats",
                "selected_model": best_name,
                "features": FEATURES,
                "results": results,
            },
            f,
            indent=2,
        )
    print(f"Saved {os.path.basename(MODEL_FILE)} and {os.path.basename(METRICS_FILE)}")


if __name__ == "__main__":
    main()
