#!/usr/bin/env python3
"""Read one PDF page with pdfplumber, pypdfium2, OpenCV and Tesseract.

Prints JSON on stdout. Does not invent window sizes. A rectangle is a
candidate to check, not a confirmed window and not a measurement.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any

FIGURE = re.compile(r"^\d{2,5}$")
LABEL = re.compile(
    r"voorgevel|achtergevel|rechtergevel|linkergevel|façade|facade|snede|coupe|doorsnede|gelijkvloers|rez-de-chaussée|verdieping|étage|kelder|sous-sol",
    re.IGNORECASE,
)


def main() -> None:
    page_no = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    data = sys.stdin.buffer.read()
    if not data.startswith(b"%PDF"):
        json.dump({"error": "Dit bestand is geen PDF.", "engines": [], "openings": [], "figures": [], "labels": []}, sys.stdout)
        return
    json.dump(analyze(data, page_no), sys.stdout)


def analyze(data: bytes, page_no: int) -> dict[str, Any]:
    engines: list[str] = []
    words: list[dict[str, Any]] = []
    boxes: list[dict[str, Any]] = []
    text_source = None

    plumber = read_pdfplumber(data, page_no)
    if plumber.get("ok"):
        engines.append("pdfplumber")
        words = plumber["words"]
        boxes = plumber["boxes"]
        if words:
            text_source = "pdfplumber"
    elif plumber.get("error"):
        engines.append("pdfplumber-fout")

    if not words:
        ocr = read_tesseract(data, page_no)
        if ocr.get("ok") and ocr["words"]:
            engines.extend(["pypdfium2", "tesseract"])
            words = ocr["words"]
            text_source = "tesseract"

    if not boxes:
        seen = read_opencv(data, page_no, words)
        if seen.get("ok"):
            if "pypdfium2" not in engines:
                engines.append("pypdfium2")
            engines.append("opencv")
            boxes = seen["boxes"]

    figures = unique_text(words, FIGURE)[:40]
    labels = unique_text(words, LABEL)[:20]
    openings = []
    for box in nms(boxes)[:40]:
        openings.append({**box, "nearby": nearby_figures(box, words)[:4], "status": "te controleren"})

    return {
        "engines": engines,
        "textSource": text_source,
        "figures": figures,
        "labels": labels,
        "openings": openings,
    }


def read_pdfplumber(data: bytes, page_no: int) -> dict[str, Any]:
    try:
        import io
        import pdfplumber
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            if page_no < 1 or page_no > len(pdf.pages):
                return {"ok": False, "error": "Pagina bestaat niet."}
            page = pdf.pages[page_no - 1]
            width = float(page.width or 0)
            height = float(page.height or 0)
            if width <= 0 or height <= 0:
                return {"ok": False, "error": "Pagina heeft geen afmeting."}
            raw_words = page.extract_words() or []
            words = []
            for word in raw_words:
                text = str(word.get("text") or "").strip()
                if not text:
                    continue
                words.append({
                    "text": text,
                    "x": float(word["x0"]) / width,
                    "y": float(word["top"]) / height,
                    "w": max(0.0, float(word["x1"]) - float(word["x0"])) / width,
                    "h": max(0.0, float(word["bottom"]) - float(word["top"])) / height,
                })
            boxes = []
            for rect in page.rects or []:
                box = box_from_pdf(rect, width, height, "pdfplumber")
                if box and keep_box(box):
                    boxes.append(box)
            for box in rects_from_lines(page.lines or [], width, height):
                if keep_box(box):
                    boxes.append(box)
            return {"ok": True, "words": words, "boxes": boxes}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def box_from_pdf(rect: dict[str, Any], width: float, height: float, source: str) -> dict[str, Any] | None:
    try:
        x = float(rect["x0"]) / width
        w = (float(rect["x1"]) - float(rect["x0"])) / width
        if "top" in rect:
            y = float(rect["top"]) / height
            h = (float(rect["bottom"]) - float(rect["top"])) / height
        else:
            y = 1 - float(rect["y1"]) / height
            h = (float(rect["y1"]) - float(rect["y0"])) / height
    except (KeyError, TypeError, ValueError):
        return None
    return clamp_box(x, y, w, h, source)


def rects_from_lines(lines: list[dict[str, Any]], width: float, height: float) -> list[dict[str, Any]]:
    horizontal: list[tuple[float, float, float]] = []
    vertical: list[tuple[float, float, float]] = []
    for line in lines:
        try:
            x0, y0, x1, y1 = float(line["x0"]), float(line["y0"]), float(line["x1"]), float(line["y1"])
        except (KeyError, TypeError, ValueError):
            continue
        if abs(y0 - y1) <= 1.5 and abs(x1 - x0) >= 8:
            horizontal.append((min(x0, x1), max(x0, x1), (y0 + y1) / 2))
        elif abs(x0 - x1) <= 1.5 and abs(y1 - y0) >= 8:
            vertical.append(((x0 + x1) / 2, min(y0, y1), max(y0, y1)))
    found: list[dict[str, Any]] = []
    for index, (left_a, right_a, y_a) in enumerate(horizontal):
        for left_b, right_b, y_b in horizontal[index + 1 :]:
            gap = abs(y_a - y_b)
            if gap < 6 or gap > 120:
                continue
            if abs(left_a - left_b) > 6 or abs(right_a - right_b) > 6:
                continue
            left = max(left_a, left_b)
            right = min(right_a, right_b)
            if right - left < 8:
                continue
            bottom = min(y_a, y_b)
            top = max(y_a, y_b)
            if not (touches(vertical, left, bottom, top) and touches(vertical, right, bottom, top)):
                continue
            box = clamp_box(left / width, 1 - top / height, (right - left) / width, (top - bottom) / height, "pdfplumber")
            if box:
                found.append(box)
    return found


def touches(vertical: list[tuple[float, float, float]], x: float, bottom: float, top: float) -> bool:
    for vx, vy0, vy1 in vertical:
        if abs(vx - x) > 6:
            continue
        if vy0 <= bottom + 6 and vy1 >= top - 6:
            return True
    return False


def read_opencv(data: bytes, page_no: int, words: list[dict[str, Any]]) -> dict[str, Any]:
    rendered = render_page(data, page_no)
    if not rendered.get("ok"):
        return rendered
    try:
        import cv2
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    image = rendered["image"]
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if image.ndim == 3 else image
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 8)
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (18, 1)))
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 18)))
    lines = cv2.dilate(cv2.bitwise_or(horizontal, vertical), cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    contours, _ = cv2.findContours(lines, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    height, width = gray.shape[:2]
    boxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w * h < 200:
            continue
        peri = cv2.arcLength(contour, True)
        if peri <= 0 or len(cv2.approxPolyDP(contour, 0.05 * peri, True)) != 4:
            continue
        box = clamp_box(x / width, y / height, w / width, h / height, "opencv")
        if not box or not keep_box(box):
            continue
        if any(overlap(box, word) > 0.2 for word in words):
            continue
        boxes.append(box)
    return {"ok": True, "boxes": nms(boxes)}


def read_tesseract(data: bytes, page_no: int) -> dict[str, Any]:
    rendered = render_page(data, page_no)
    if not rendered.get("ok"):
        return rendered
    try:
        import pytesseract
        from PIL import Image
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    image = Image.fromarray(rendered["image"])
    found = None
    last_error = "Tesseract gaf geen tekst."
    for lang in ("nld+fra+eng", "nld+eng"):
        try:
            found = pytesseract.image_to_data(image, lang=lang, output_type=pytesseract.Output.DICT)
            break
        except Exception as exc:
            last_error = str(exc)
    if found is None:
        return {"ok": False, "error": last_error}
    width, height = image.size
    words = []
    for text, left, top, w, h, conf in zip(found["text"], found["left"], found["top"], found["width"], found["height"], found["conf"]):
        token = str(text or "").strip()
        try:
            sure = float(conf)
        except (TypeError, ValueError):
            sure = -1
        if not token or sure < 40 or w <= 0 or h <= 0:
            continue
        words.append({"text": token, "x": left / width, "y": top / height, "w": w / width, "h": h / height})
    return {"ok": True, "words": words}


def render_page(data: bytes, page_no: int) -> dict[str, Any]:
    try:
        import pypdfium2 as pdfium
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    doc = pdfium.PdfDocument(data)
    try:
        if page_no < 1 or page_no > len(doc):
            return {"ok": False, "error": "Pagina bestaat niet."}
        bitmap = doc[page_no - 1].render(scale=2)
        image = bitmap.to_numpy()
        return {"ok": True, "image": image}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        doc.close()


def keep_box(box: dict[str, Any]) -> bool:
    w = float(box["w"])
    h = float(box["h"])
    minimum = 0.015 if box.get("source") == "opencv" else 0.004
    if w < minimum or h < minimum or w > 0.18 or h > 0.18:
        return False
    area = w * h
    if area < 0.00005 or area > 0.02:
        return False
    return max(w, h) / min(w, h) <= 8


def clamp_box(x: float, y: float, w: float, h: float, source: str) -> dict[str, Any] | None:
    if w <= 0 or h <= 0:
        return None
    x = min(max(x, 0), 1)
    y = min(max(y, 0), 1)
    w = min(w, 1 - x)
    h = min(h, 1 - y)
    if w <= 0 or h <= 0:
        return None
    return {"x": round(x, 5), "y": round(y, 5), "w": round(w, 5), "h": round(h, 5), "source": source}


def nms(boxes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = sorted(boxes, key=lambda box: float(box["w"]) * float(box["h"]))
    kept: list[dict[str, Any]] = []
    for box in ordered:
        if all(overlap(box, other) < 0.5 for other in kept):
            kept.append(box)
    return kept


def overlap(left: dict[str, Any], right: dict[str, Any]) -> float:
    ix0 = max(float(left["x"]), float(right["x"]))
    iy0 = max(float(left["y"]), float(right["y"]))
    ix1 = min(float(left["x"]) + float(left["w"]), float(right["x"]) + float(right["w"]))
    iy1 = min(float(left["y"]) + float(left["h"]), float(right["y"]) + float(right["h"]))
    inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
    union = float(left["w"]) * float(left["h"]) + float(right["w"]) * float(right["h"]) - inter
    return inter / union if union else 0


def nearby_figures(box: dict[str, Any], words: list[dict[str, Any]]) -> list[str]:
    found: list[str] = []
    for word in words:
        if not FIGURE.match(str(word.get("text") or "")):
            continue
        if abs(float(word["x"]) - float(box["x"])) > float(box["w"]) + 0.04:
            continue
        if abs(float(word["y"]) - float(box["y"])) > float(box["h"]) + 0.04:
            continue
        if word["text"] not in found:
            found.append(word["text"])
    return found


def unique_text(words: list[dict[str, Any]], pattern: re.Pattern[str]) -> list[str]:
    seen: list[str] = []
    for word in words:
        text = str(word.get("text") or "").strip()
        if pattern.search(text) and text not in seen:
            seen.append(text)
    return seen


if __name__ == "__main__":
    main()
