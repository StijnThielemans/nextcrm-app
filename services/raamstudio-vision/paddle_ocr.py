"""Read plan text with the PaddleOCR PP-OCR models.

The models run through ONNX Runtime (Apache-2.0). They are used when the PDF
text layer has no readable words. A recognised facade or floor name is added
as a clean label. Sizes are only the digits the reader actually saw.
"""

from __future__ import annotations

import re
from typing import Any

_ENGINE: Any = None
_FAILED = False


def read_paddle(data: bytes, page_no: int) -> dict[str, Any]:
    rendered = render(data, page_no)
    if not rendered.get("ok"):
        return rendered
    image = rendered["image"]
    if not worth_ocr(image):
        return {"ok": True, "words": []}
    try:
        words = words_from_image(image)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    if words is None:
        return {"ok": False, "error": "PaddleOCR ontbreekt."}
    return {"ok": True, "words": words}


def words_from_image(image: Any) -> list[dict[str, Any]] | None:
    engine = load_engine()
    if engine is None:
        return None
    import cv2

    height, width = image.shape[:2]
    words: list[dict[str, Any]] = []
    bands = 3
    for index in range(bands):
        top = int(height * index / bands)
        bottom = int(height * (index + 1) / bands)
        crop = image[top:bottom]
        if crop.size == 0:
            continue
        view = cv2.resize(crop, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        found, _elapsed = engine(view)
        if not found:
            continue
        view_h, view_w = view.shape[:2]
        for item in found:
            if len(item) < 3:
                continue
            points, text, score = item[0], str(item[1] or "").strip(), item[2]
            try:
                sure = float(score)
            except (TypeError, ValueError):
                sure = 0
            if not text or sure < 0.45 or text == "?":
                continue
            xs = [float(point[0]) for point in points]
            ys = [float(point[1]) for point in points]
            box = {
                "x": min(xs) / view_w,
                "y": (top + min(ys) / 3) / height,
                "w": max(1.0, max(xs) - min(xs)) / view_w,
                "h": max(1.0, (max(ys) - min(ys)) / 3) / height,
            }
            words.append({**box, "text": text})
            for label in canonical_labels(text):
                words.append({**box, "text": label})
    return words


def canonical_labels(text: str) -> list[str]:
    folded = text.lower()
    labels: list[str] = []
    if "achter" in folded:
        labels.append("achtergevel")
    if "rechts" in folded or "rechter" in folded or "gchts" in folded:
        labels.append("rechtergevel")
    if "links" in folded or "linker" in folded or "unks" in folded:
        labels.append("linkergevel")
    if "voorgevel" in folded or "vorgev" in folded or ("voor" in folded and "aanz" in folded):
        labels.append("voorgevel")
    if "gelijkvloer" in folded or "gelukvloer" in folded or "gellkvloer" in folded or ("vloer" in folded and "plan" in folded):
        labels.append("gelijkvloers")
    if re.search(r"verdiep", folded) and re.search(r"0?1\b|eerste", folded):
        labels.append("verdieping 1")
    if re.search(r"verdiep", folded) and re.search(r"0?2\b|tweede", folded):
        labels.append("verdieping 2")
    if re.search(r"snede|coupe|doorsnede", folded):
        labels.append("snede")
    return labels


def load_engine() -> Any:
    global _ENGINE, _FAILED
    if _ENGINE is not None:
        return _ENGINE
    if _FAILED:
        return None
    try:
        from rapidocr_onnxruntime import RapidOCR

        _ENGINE = RapidOCR()
        return _ENGINE
    except Exception:
        _FAILED = True
        return None


def worth_ocr(image: Any) -> bool:
    import cv2

    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if image.ndim == 3 else image
    return float((gray < 200).mean()) > 0.008


def render(data: bytes, page_no: int) -> dict[str, Any]:
    from floorplan_windows import as_rgb, render as render_page

    rendered = render_page(data, page_no)
    if not rendered.get("ok"):
        return rendered
    return {"ok": True, "image": as_rgb(rendered["image"])}
