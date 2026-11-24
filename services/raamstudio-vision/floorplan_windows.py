"""Window and door boxes from a floor-plan segmenter trained on CubiCasa5K.

Classes are background, wall, window and door. Official CubiCasa5K weights are
CC BY-NC and are not loaded. COCO detectors (RF-DETR, Detectron2, MMDetection,
YOLO) have no window class, so they are not used as window marks.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

WEIGHTS = Path(__file__).with_name("models") / "M2_DA_FT_v2_best.pt"
_MODEL: Any = None
_FAILED = False


def read_floorplan(data: bytes, page_no: int) -> dict[str, Any]:
    rendered = render(data, page_no)
    if not rendered.get("ok"):
        return rendered
    try:
        boxes = openings_from_image(rendered["image"])
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    if boxes is None:
        return {"ok": False, "error": "CubiCasa5K-model ontbreekt."}
    return {"ok": True, "boxes": boxes}


def openings_from_image(image: Any) -> list[dict[str, Any]] | None:
    model = load_model()
    if model is None:
        return None
    rgb = as_rgb(image)
    dark = choose_dark(model, rgb)
    window, door = segment(model, rgb, dark)
    height, width = window.shape[:2]
    minimum = max(48, int(0.00006 * height * width))
    boxes: list[dict[str, Any]] = []
    boxes.extend(components(window, width, height, minimum, "cubicasa5k"))
    boxes.extend(components(door, width, height, minimum, "cubicasa5k-deur"))
    boxes = [box for box in boxes if not edge_junk(box) and not tall_wall_slice(box)]
    for frame in window_frames(rgb):
        if all(box_overlap(frame, box) < 0.45 for box in boxes):
            boxes.append(frame)
    return boxes


def load_model() -> Any:
    global _MODEL, _FAILED
    if _MODEL is not None:
        return _MODEL
    if _FAILED or not WEIGHTS.is_file():
        _FAILED = True
        return None
    try:
        import torch
        import segmentation_models_pytorch as smp

        torch.set_num_threads(2)
        model = smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=4)
        checkpoint = torch.load(WEIGHTS, map_location="cpu", weights_only=False)
        state = checkpoint["model_state_dict"] if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint else checkpoint
        model.load_state_dict(state)
        model.eval()
        _MODEL = model
        return model
    except Exception:
        _FAILED = True
        return None


def choose_dark(model: Any, rgb: Any) -> bool:
    import cv2

    small = cv2.resize(rgb, (512, 512), interpolation=cv2.INTER_AREA)
    best_dark = False
    best_score = -1.0
    for dark in (False, True):
        pred = forward(model, as_model_input(small, dark))
        fraction = float(((pred == 2) | (pred == 3)).mean())
        score = fraction if fraction < 0.12 else -1.0
        if score > best_score:
            best_score = score
            best_dark = dark
    return best_dark


def segment(model: Any, rgb: Any, dark: bool) -> tuple[Any, Any]:
    import cv2
    import numpy as np

    height, width = rgb.shape[:2]
    scale = min(1.0, 3200 / max(height, width))
    work = rgb
    if scale < 1:
        work = cv2.resize(rgb, (max(1, int(width * scale)), max(1, int(height * scale))), interpolation=cv2.INTER_AREA)
    prepared = as_model_input(work, dark)
    tile_h, tile_w = prepared.shape[:2]
    window = np.zeros((tile_h, tile_w), np.uint8)
    door = np.zeros((tile_h, tile_w), np.uint8)
    for top, left, crop in tiles(prepared):
        pred = forward(model, crop)
        crop_h, crop_w = crop.shape[:2]
        window[top : top + crop_h, left : left + crop_w] |= (pred == 2).astype(np.uint8)
        door[top : top + crop_h, left : left + crop_w] |= (pred == 3).astype(np.uint8)
    if scale < 1:
        window = cv2.resize(window, (width, height), interpolation=cv2.INTER_NEAREST)
        door = cv2.resize(door, (width, height), interpolation=cv2.INTER_NEAREST)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    window = cv2.morphologyEx(window, cv2.MORPH_CLOSE, kernel)
    door = cv2.morphologyEx(door, cv2.MORPH_CLOSE, kernel)
    return window, door


def tiles(image: Any) -> list[tuple[int, int, Any]]:
    height, width = image.shape[:2]
    tile = 512
    stride = 400
    ys = positions(height, tile, stride)
    xs = positions(width, tile, stride)
    found = []
    for top in ys:
        for left in xs:
            found.append((top, left, image[top : top + tile, left : left + tile]))
    return found


def positions(length: int, tile: int, stride: int) -> list[int]:
    if length <= tile:
        return [0]
    stops = list(range(0, length - tile + 1, stride))
    last = length - tile
    if stops[-1] != last:
        stops.append(last)
    return stops


def forward(model: Any, rgb: Any) -> Any:
    import cv2
    import numpy as np
    import torch

    resized = cv2.resize(rgb, (512, 512), interpolation=cv2.INTER_AREA)
    array = resized.astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], np.float32)
    std = np.array([0.229, 0.224, 0.225], np.float32)
    array = (array - mean) / std
    tensor = torch.from_numpy(array.transpose(2, 0, 1)).unsqueeze(0)
    with torch.no_grad():
        probs = torch.softmax(model(tensor), dim=1)[0]
        pred = probs.argmax(0).cpu().numpy().astype(np.uint8)
    return cv2.resize(pred, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_NEAREST)


def as_model_input(rgb: Any, dark: bool) -> Any:
    if not dark:
        return rgb
    import cv2

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    inverted = 255 - gray
    enhanced = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(inverted)
    _, binary = cv2.threshold(enhanced, 200, 255, cv2.THRESH_BINARY)
    mixed = cv2.addWeighted(enhanced, 0.4, binary, 0.6, 0)
    return cv2.cvtColor(mixed, cv2.COLOR_GRAY2RGB)


def components(mask: Any, width: int, height: int, minimum: int, source: str) -> list[dict[str, Any]]:
    import cv2

    count, _, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype("uint8"))
    boxes = []
    for index in range(1, count):
        x, y, w, h, area = (int(stats[index, i]) for i in range(5))
        if area < minimum:
            continue
        box = clamp(x / width, y / height, w / width, h / height, source)
        if box and keep_opening(box):
            boxes.append(box)
    return boxes


def window_frames(rgb: Any) -> list[dict[str, Any]]:
    """Rectangular window frames on an architectural sheet. A light interior keeps rooms and furniture out."""
    import cv2

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 8)
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (12, 1)))
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 12)))
    lines = cv2.dilate(cv2.bitwise_or(horizontal, vertical), cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    contours, _ = cv2.findContours(lines, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    height, width = gray.shape[:2]
    boxes: list[dict[str, Any]] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w * h < 120 or w < 12 or h < 10:
            continue
        peri = cv2.arcLength(contour, True)
        if peri <= 0 or len(cv2.approxPolyDP(contour, 0.05 * peri, True)) != 4:
            continue
        fw, fh = w / width, h / height
        if min(fw, fh) < 0.0035 or fw > 0.045 or fh > 0.1:
            continue
        if max(fw, fh) / min(fw, fh) > 6:
            continue
        inner = binary[y + 2 : max(y + 3, y + h - 2), x + 2 : max(x + 3, x + w - 2)]
        if inner.size == 0 or not (0.015 <= float((inner > 0).mean()) <= 0.35):
            continue
        box = clamp(x / width, y / height, w / width, h / height, "raamkader")
        if box and not edge_junk(box):
            boxes.append(box)
    return boxes


def box_overlap(left: dict[str, Any], right: dict[str, Any]) -> float:
    ix0 = max(float(left["x"]), float(right["x"]))
    iy0 = max(float(left["y"]), float(right["y"]))
    ix1 = min(float(left["x"]) + float(left["w"]), float(right["x"]) + float(right["w"]))
    iy1 = min(float(left["y"]) + float(left["h"]), float(right["y"]) + float(right["h"]))
    inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
    union = float(left["w"]) * float(left["h"]) + float(right["w"]) * float(right["h"]) - inter
    return inter / union if union else 0.0


def edge_junk(box: dict[str, Any]) -> bool:
    cx = float(box["x"]) + float(box["w"]) / 2
    cy = float(box["y"]) + float(box["h"]) / 2
    if cx < 0.03 or cy < 0.03 or cx > 0.97 or cy > 0.97:
        return True
    if box.get("source") == "raamkader":
        return False
    # Title block and scale bar sit on the sheet margin. Openings in the drawing do not.
    return cy > 0.86 and float(box["h"]) < 0.03


def tall_wall_slice(box: dict[str, Any]) -> bool:
    if box.get("source") != "cubicasa5k":
        return False
    return float(box["h"]) > 0.08 and float(box["w"]) < 0.05


def keep_opening(box: dict[str, Any]) -> bool:
    w = float(box["w"])
    h = float(box["h"])
    if w < 0.003 or h < 0.003 or w > 0.4 or h > 0.4:
        return False
    if w * h > 0.05:
        return False
    return max(w, h) / min(w, h) <= 18


def clamp(x: float, y: float, w: float, h: float, source: str) -> dict[str, Any] | None:
    if w <= 0 or h <= 0:
        return None
    x = min(max(x, 0.0), 1.0)
    y = min(max(y, 0.0), 1.0)
    w = min(w, 1 - x)
    h = min(h, 1 - y)
    if w <= 0 or h <= 0:
        return None
    return {"x": round(x, 5), "y": round(y, 5), "w": round(w, 5), "h": round(h, 5), "source": source}


def as_rgb(image: Any) -> Any:
    import cv2
    import numpy as np

    if image.ndim == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
    return np.ascontiguousarray(image[:, :, :3])


def render(data: bytes, page_no: int) -> dict[str, Any]:
    try:
        import pypdfium2 as pdfium
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    doc = pdfium.PdfDocument(data)
    try:
        if page_no < 1 or page_no > len(doc):
            return {"ok": False, "error": "Pagina bestaat niet."}
        page = doc[page_no - 1]
        width, height = page.get_size()
        long_side = max(float(width), float(height), 1.0)
        scale = min(2.0, 3200.0 / long_side)
        image = page.render(scale=scale).to_numpy()
        return {"ok": True, "image": image}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        doc.close()
