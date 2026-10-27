"""Check one lung CT slice image for signs of malignancy.

Usage: python lungctpredict.py <image_path> [--thumbnail <output.jpg>]
  --thumbnail: after a successful analysis, also save a small grayscale JPEG copy there
               (used for the user's prediction history)
Prints one JSON line:
  {"prediction": "malignant" | "not_malignant", "probability": 0.97}   (probability of malignant)
or, for an upload that cannot be analysed:
  {"error": "invalid_image"}  - the file is not a readable image
  {"error": "not_ct"}         - a colour photo, not a grayscale CT scan
  {"error": "unusual"}        - grayscale, but unlike every CT slice the model was trained on
                                (e.g. an X-ray, an MRI, a side view of a CT)
Model: lung_ct_model.pt, trained by train_lung_ct_model.py.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError

HERE = Path(__file__).resolve().parent
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


def done(payload, code=0):
    print(json.dumps(payload))
    sys.exit(code)


def looks_like_ct(img):
    """CT slices are grayscale; reject images where many pixels are clearly coloured."""
    hsv = np.asarray(img.convert("RGB").resize((128, 128)).convert("HSV"))
    coloured = (hsv[..., 1] > 60) & (hsv[..., 2] > 40)
    return coloured.mean() < 0.05


def preprocess(img, size):
    """Same steps as load_image() in train_lung_ct_model.py."""
    img = img.convert("L")
    w, h = img.size
    s = min(w, h)
    img = img.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    x = np.asarray(img.resize((size, size), Image.BILINEAR), dtype=np.float32) / 255
    x = np.repeat(x[None], 3, axis=0)
    return ((x - MEAN) / STD)[None]


def save_thumbnail(img, path):
    thumb = img.convert("L")
    thumb.thumbnail((384, 384))
    thumb.save(path, "JPEG", quality=85)


def main():
    args = sys.argv[1:]
    thumbnail_path = None
    if len(args) == 3 and args[1] == "--thumbnail":
        thumbnail_path = args[2]
        args = args[:1]
    if len(args) != 1:
        done({"error": "usage: lungctpredict.py <image_path> [--thumbnail <output.jpg>]"}, 1)
    sys.argv = [sys.argv[0], args[0]]

    try:
        img = Image.open(sys.argv[1])
        img.load()
    except (UnidentifiedImageError, OSError):
        done({"error": "invalid_image"})
    if min(img.size) < 64:
        done({"error": "invalid_image"})
    if not looks_like_ct(img):
        done({"error": "not_ct"})

    import torch  # imported late: slow, and not needed for rejected uploads
    import torch.nn as nn
    from torchvision import models

    ckpt = torch.load(HERE / "lung_ct_model.pt", map_location="cpu", weights_only=True)
    net = models.resnet18(weights=None)
    net.fc = nn.Identity()
    net.load_state_dict(ckpt["backbone"])
    net.eval()

    with torch.no_grad():
        feat = net(torch.from_numpy(preprocess(img, ckpt["size"])))[0]
        bank = ckpt["bank"].float()
        similarity = torch.nn.functional.cosine_similarity(bank, feat[None], dim=1).max().item()
        if similarity < ckpt["ood_threshold"]:
            done({"error": "unusual"})
        logit = float(feat @ ckpt["head_weight"] + ckpt["head_bias"])
    probability = 1 / (1 + np.exp(-logit))

    if thumbnail_path:
        try:
            save_thumbnail(img, thumbnail_path)
        except OSError as err:  # the prediction still counts without the copy
            print(f"thumbnail not saved: {err}", file=sys.stderr)

    done({
        "prediction": "malignant" if probability >= 0.5 else "not_malignant",
        "probability": round(float(probability), 4),
    })


if __name__ == "__main__":
    main()
