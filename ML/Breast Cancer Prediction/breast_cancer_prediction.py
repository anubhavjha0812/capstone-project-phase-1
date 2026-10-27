"""Grade a breast histopathology tile (H&E microscope image) with a fine-tuned Phikon ViT.

Usage:
  python breast_cancer_prediction.py <image_path>   one image, prints one JSON line
  python breast_cancer_prediction.py --serve        reads image paths from stdin (one per line)
                                                    and prints one JSON line per image; the model
                                                    is loaded once, so each request takes ~0.3 s

Output: {"grade": "high" | "low" | "stroma", "probabilities": {"high": .., "low": .., "stroma": ..}}
  high   = high-grade tumour tissue
  low    = low-grade tumour tissue
  stroma = non-tumour supporting tissue
or {"error": "invalid_image" | "model_unavailable"}.

Weights: <MODEL_DIR>/predictix_phikon_grade.pt and <MODEL_DIR>/phikon_config/ (trained by the
Kaggle kernel bcg-predictix-phikon-weights). MODEL_DIR is $BREAST_MODEL_DIR or ./weights.
If the weights are missing and $BREAST_MODEL_URL is set, a .tar.gz with both is downloaded once.
"""

import json
import os
import sys
import tarfile
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError

HERE = Path(__file__).resolve().parent
MODEL_DIR = Path(os.environ.get("BREAST_MODEL_DIR", HERE / "weights"))
WEIGHTS = MODEL_DIR / "predictix_phikon_grade.pt"
CONFIG_DIR = MODEL_DIR / "phikon_config"
CLASSES = ("high", "low", "stroma")  # same order as training
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)
SIZE = 224

_model = None


def download_weights():
    url = os.environ.get("BREAST_MODEL_URL")
    if not url:
        return
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    archive = MODEL_DIR / "download.tar.gz"
    print(f"downloading breast model from {url}", file=sys.stderr, flush=True)
    urllib.request.urlretrieve(url, archive)
    with tarfile.open(archive) as tar:
        tar.extractall(MODEL_DIR, filter="data")
    archive.unlink()


def load_model():
    """Returns the model, or None when the weights are not installed."""
    global _model
    if _model is not None:
        return _model
    if not WEIGHTS.exists() or not CONFIG_DIR.exists():
        try:
            download_weights()
        except Exception as err:  # offline, bad URL, ...
            print(f"could not download breast model: {err}", file=sys.stderr, flush=True)
    if not WEIGHTS.exists() or not CONFIG_DIR.exists():
        return None

    import torch
    import torch.nn as nn
    from transformers import AutoConfig, AutoModel

    class GradeNet(nn.Module):
        # Same layout as FTViT in the training kernel: CLS + mean patch token -> linear head
        def __init__(self, config):
            super().__init__()
            self.m = AutoModel.from_config(config)
            self.head = nn.Linear(2 * config.hidden_size, len(CLASSES))

        def forward(self, x):
            h = self.m(pixel_values=x).last_hidden_state
            return self.head(torch.cat([h[:, 0], h[:, 1:].mean(1)], 1))

    model = GradeNet(AutoConfig.from_pretrained(CONFIG_DIR))
    model.load_state_dict(torch.load(WEIGHTS, map_location="cpu"))
    _model = model.eval()
    return _model


def preprocess(path):
    img = Image.open(path).convert("RGB").resize((SIZE, SIZE), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32).transpose(2, 0, 1) / 255.0
    return (arr - MEAN) / STD


def predict(path):
    try:
        x = preprocess(path)
    except (UnidentifiedImageError, OSError):
        return {"error": "invalid_image"}
    model = load_model()
    if model is None:
        return {"error": "model_unavailable"}

    import torch

    with torch.inference_mode():
        probs = torch.softmax(model(torch.from_numpy(x)[None]), 1)[0].tolist()
    best = int(np.argmax(probs))
    return {
        "grade": CLASSES[best],
        "probabilities": {c: round(p, 4) for c, p in zip(CLASSES, probs)},
    }


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--serve":
        load_model()  # warm up before the first request
        print(json.dumps({"ready": load_model() is not None}), flush=True)
        for line in sys.stdin:
            path = line.strip()
            if path:
                print(json.dumps(predict(path)), flush=True)
    elif len(sys.argv) == 2:
        print(json.dumps(predict(sys.argv[1])))
    else:
        print(__doc__)
        sys.exit(1)
