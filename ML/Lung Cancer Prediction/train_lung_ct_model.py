"""Train the lung CT scan model (PyTorch): malignant vs not malignant.

Data (combined, so the model sees more than one hospital's image style):
  1. IQ-OTH/NCCD lung cancer dataset (Mendeley Data, DOI 10.17632/bhmdr45bh2, CC BY 4.0):
     normal + benign -> 0, malignant -> 1
  2. Chest CT-Scan images dataset (Kaggle, Mohamed Hany, CC0) in "Medical Reports/Lung Cancer":
     normal -> 0, adenocarcinoma / large cell / squamous cell carcinoma -> 1

Why binary: the earlier 3-class model learned normal vs benign from only 15 benign patients and
overfitted (100% train vs 70% validation). Malignant vs not is what the page needs and is well supported.

Leakage control:
  * exact duplicate files are dropped; near-identical images (copies, resized copies) are grouped
    with a perceptual hash, and a group never spans training and validation
  * IQ-OTH/NCCD file names have no patient ID, but a scan's slices are numbered consecutively, so each
    class is cut into 5 contiguous blocks (one block = one fold)

Model: ImageNet ResNet-18 (frozen) -> 512 features -> logistic regression. Full fine-tuning was tried
before and generalised worse on this amount of data. C is tuned inside each training fold.

Also stores a reference bank of training features: an upload whose nearest training image is less
similar than almost all real CT slices is rejected as "not a lung CT slice like the training data"
(catches X-rays, MRIs, side views, etc.).

Usage: python train_lung_ct_model.py
"""

import hashlib
import json
import re
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, confusion_matrix, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from torchvision import models

HERE = Path(__file__).resolve().parent
LUNG_DIR = HERE.parent.parent / "Medical Reports" / "Lung Cancer"
IQ_DIR = LUNG_DIR / "IQ-OTHNCCD" / "The IQ-OTHNCCD lung cancer dataset"
IQ_FOLDERS = {"Normal cases": 0, "Bengin cases": 0, "Malignant cases": 1}
SIZE = 224
FOLDS = 5
SEED = 42
C_GRID = [0.001, 0.003, 0.01, 0.03, 0.1]
# Cosine similarity to the nearest training image below which an upload is rejected as unusual.
# Checked on images the model never saw: chest/knee/hand X-rays and brain MRIs scored <= 0.773,
# axial lung CT slices from other hospitals (ieee8023 COVID collection) scored >= 0.834, and
# coronal (front-view) CTs 0.66-0.73. 0.80 sits in that gap. The share of genuine out-of-fold
# training slices below it is reported in the metrics.
OOD_THRESHOLD = 0.80

MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)


def load_image(path):
    """Grayscale, centre-cropped to a square, resized: the same steps as lungctpredict.py."""
    img = Image.open(path).convert("L")
    w, h = img.size
    s = min(w, h)
    img = img.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return np.asarray(img.resize((SIZE, SIZE), Image.BILINEAR), dtype=np.uint8)


def ahash(img_u8):
    small = np.asarray(Image.fromarray(img_u8).resize((16, 16), Image.BILINEAR), dtype=np.float32).ravel()
    return int("".join("1" if v > small.mean() else "0" for v in small), 2)


def load_all():
    """Returns images, labels, source names, group ids and fixed folds (IQ only, -1 elsewhere)."""
    seen = set()
    images, labels, sources, groups, folds = [], [], [], [], []

    def add(path, label, source, group, fold):
        digest = hashlib.md5(path.read_bytes()).hexdigest()
        if digest in seen:  # exact duplicate file
            return
        seen.add(digest)
        images.append(load_image(path))
        labels.append(label)
        sources.append(source)
        groups.append(group)
        folds.append(fold)

    # 1. IQ-OTH/NCCD: contiguous blocks per class
    for folder, label in IQ_FOLDERS.items():
        files = sorted((IQ_DIR / folder).iterdir(),
                       key=lambda p: int(re.search(r"\((\d+)\)", p.name).group(1)))
        for i, p in enumerate(files):
            block = i * FOLDS // len(files)
            add(p, label, "iq_othnccd", f"iq/{folder}/{block}", block)

    # 2. Kaggle chest CT (all sub-folders except the IQ dataset); groups set below
    first_kaggle = len(images)
    for p in sorted(LUNG_DIR.rglob("*")):
        if not p.is_file() or "IQ-OTHNCCD" in p.parts or p.suffix.lower() not in (".png", ".jpg", ".jpeg"):
            continue
        folder = p.parent.name.lower()
        label = 0 if folder.startswith("normal") or folder == "not suffering" else 1
        add(p, label, "kaggle_chest_ct", None, -1)

    # Group Kaggle near-duplicates (Hamming distance <= 10 on a 256-bit average hash)
    idx = list(range(first_kaggle, len(images)))
    hashes = [ahash(images[i]) for i in idx]
    parent = list(range(len(idx)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a in range(len(idx)):
        for b in range(a + 1, len(idx)):
            if bin(hashes[a] ^ hashes[b]).count("1") <= 10:
                parent[find(a)] = find(b)
    members = defaultdict(list)
    for a, i in enumerate(idx):
        members[find(a)].append(i)
    dropped = 0
    keep = np.ones(len(images), dtype=bool)
    for root, ids in members.items():
        if len({labels[i] for i in ids}) > 1:  # the same picture labelled both ways: unusable
            keep[ids] = False
            dropped += len(ids)
        for i in ids:
            groups[i] = f"kaggle/{root}"

    X = np.stack(images)[keep]
    y = np.array(labels)[keep]
    src = np.array(sources)[keep]
    grp = np.array(groups)[keep]
    fold = np.array(folds)[keep]

    # Kaggle groups -> folds, stratified by label
    k = src == "kaggle_chest_ct"
    sgkf = StratifiedGroupKFold(n_splits=FOLDS, shuffle=True, random_state=SEED)
    kaggle_idx = np.where(k)[0]
    for f, (_, te) in enumerate(sgkf.split(kaggle_idx, y[k], grp[k])):
        fold[kaggle_idx[te]] = f
    return X, y, src, grp, fold, dropped


def to_input(batch_u8):
    x = torch.from_numpy(batch_u8).float().div(255).unsqueeze(1).repeat(1, 3, 1, 1)
    return (x - MEAN) / STD


def backbone():
    net = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    net.fc = nn.Identity()
    return net.eval()


def features(net, X):
    out = []
    with torch.no_grad():
        for i in range(0, len(X), 64):
            out.append(net(to_input(X[i:i + 64])))
    return torch.cat(out).numpy()


def head(C):
    return make_pipeline(StandardScaler(),
                         LogisticRegression(C=C, class_weight="balanced", max_iter=5000))


def tune_C(F, y, grp):
    """Pick C by grouped inner CV on balanced accuracy."""
    inner = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED)
    best = None
    for C in C_GRID:
        scores = []
        for tr, te in inner.split(F, y, grp):
            scores.append(balanced_accuracy_score(y[te], head(C).fit(F[tr], y[tr]).predict(F[te])))
        if best is None or np.mean(scores) > best[1]:
            best = (C, float(np.mean(scores)))
    return best[0]


def summary(y, p):
    pred = (p >= 0.5).astype(int)
    out = {
        "n": int(len(y)),
        "accuracy": float((pred == y).mean()),
        "balanced_accuracy": float(balanced_accuracy_score(y, pred)),
        "sensitivity": float(recall_score(y, pred, zero_division=0)),
        "specificity": float(recall_score(1 - y, 1 - pred, zero_division=0)),
        "confusion_matrix(rows=true not/malignant)": confusion_matrix(y, pred, labels=[0, 1]).tolist(),
    }
    if len(set(y)) == 2:
        out["roc_auc"] = float(roc_auc_score(y, p))
    return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in out.items()}


def cosine_nn(query, bank):
    q = query / np.linalg.norm(query, axis=1, keepdims=True)
    b = bank / np.linalg.norm(bank, axis=1, keepdims=True)
    return (q @ b.T).max(axis=1)


def main():
    t0 = time.time()
    torch.manual_seed(SEED)
    X, y, src, grp, fold, dropped = load_all()
    for s in np.unique(src):
        m = src == s
        print(f"{s}: {m.sum()} unique images ({int(y[m].sum())} malignant, {int((y[m] == 0).sum())} not), "
              f"{len(np.unique(grp[m]))} groups", flush=True)
    print(f"dropped {dropped} images whose near-identical copies had opposite labels", flush=True)

    net = backbone()
    F = features(net, X)
    print(f"features ready ({time.time() - t0:.0f}s)", flush=True)

    # Outer CV: out-of-fold predictions, train scores, OOD calibration
    oof = np.zeros(len(y))
    oof_sim = np.zeros(len(y))
    train_bal, chosen = [], []
    for k in range(FOLDS):
        tr, te = fold != k, fold == k
        C = tune_C(F[tr], y[tr], grp[tr])
        model = head(C).fit(F[tr], y[tr])
        oof[te] = model.predict_proba(F[te])[:, 1]
        train_bal.append(balanced_accuracy_score(y[tr], model.predict(F[tr])))
        oof_sim[te] = cosine_nn(F[te], F[tr])
        chosen.append(C)
        print(f"  fold {k + 1}: C={C}, train bal-acc {train_bal[-1]:.3f}, "
              f"val bal-acc {balanced_accuracy_score(y[te], (oof[te] >= 0.5).astype(int)):.3f}", flush=True)

    overall = summary(y, oof)
    overall["train_balanced_accuracy"] = round(float(np.mean(train_bal)), 4)
    overall["train_validation_gap"] = round(overall["train_balanced_accuracy"] - overall["balanced_accuracy"], 4)
    per_source = {s: summary(y[src == s], oof[src == s]) for s in np.unique(src)}
    print("cross-validated:", json.dumps(overall), flush=True)
    for s, v in per_source.items():
        print(f"  {s}:", json.dumps(v), flush=True)

    # Cross-hospital check: train on one dataset only, test on the other
    cross = {}
    for a, b in (("iq_othnccd", "kaggle_chest_ct"), ("kaggle_chest_ct", "iq_othnccd")):
        tr, te = src == a, src == b
        model = head(tune_C(F[tr], y[tr], grp[tr])).fit(F[tr], y[tr])
        cross[f"train_{a}_test_{b}"] = summary(y[te], model.predict_proba(F[te])[:, 1])
        print(f"  trained only on {a}, tested on {b}:", json.dumps(cross[f'train_{a}_test_{b}']), flush=True)

    # Final model on all data
    C = tune_C(F, y, grp)
    final = head(C).fit(F, y)
    scaler, lr = final[0], final[1]
    w = lr.coef_[0] / scaler.scale_
    b = lr.intercept_[0] - float((lr.coef_[0] * scaler.mean_ / scaler.scale_).sum())
    ood_threshold = OOD_THRESHOLD
    genuine_rejected = float((oof_sim < ood_threshold).mean())
    print(f"final C={C}; unusual-image threshold {ood_threshold} would reject "
          f"{genuine_rejected:.2%} of genuine (out-of-fold) CT slices; "
          f"their similarity percentiles 0.1/1/5: {np.percentile(oof_sim, [0.1, 1, 5]).round(3).tolist()}",
          flush=True)

    torch.save({
        "backbone": net.state_dict(),
        "head_weight": torch.tensor(w, dtype=torch.float32),
        "head_bias": torch.tensor(b, dtype=torch.float32),
        "bank": torch.tensor(F, dtype=torch.float16),
        "ood_threshold": ood_threshold,
        "size": SIZE,
        "arch": "resnet18",
        "labels": ["not_malignant", "malignant"],
    }, HERE / "lung_ct_model.pt")

    metrics = {
        "task": "malignant vs not malignant (normal or benign)",
        "datasets": {
            "iq_othnccd": "The IQ-OTH/NCCD lung cancer dataset (Mendeley Data, DOI 10.17632/bhmdr45bh2, CC BY 4.0)",
            "kaggle_chest_ct": "Chest CT-Scan images dataset (Kaggle, Mohamed Hany, CC0)",
        },
        "unique_images": int(len(y)),
        "per_source_counts": {s: {"images": int((src == s).sum()), "malignant": int(y[src == s].sum())}
                              for s in np.unique(src)},
        "validation": f"{FOLDS}-fold grouped CV (near-duplicates and IQ scan blocks never split), "
                      "C tuned inside each training fold",
        "model": "frozen ImageNet ResNet-18 features + logistic regression (class_weight=balanced)",
        "C_per_fold": chosen,
        "final_C": C,
        "cross_validated": overall,
        "cross_validated_per_source": per_source,
        "cross_hospital": cross,
        "unusual_image_threshold": ood_threshold,
        "genuine_slices_rejected_as_unusual": round(genuine_rejected, 4),
        "train_minutes": round((time.time() - t0) / 60, 1),
    }
    (HERE / "lung_ct_model_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(f"saved lung_ct_model.pt in {metrics['train_minutes']} min")


if __name__ == "__main__":
    main()
