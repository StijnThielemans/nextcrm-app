"""Mark windows, doors and sliding windows the way a Belgian plan draws them.

On a facade the joinery is a closed frame with a light glass fill, standing on
a floor or sill line. A wide frame on the ground line is a sliding window. A
tall narrow frame on that line is a door. The other frames are windows.

On a floor plan a window is a short stack of parallel lines inside the wall.
A long stack is a sliding window. A quarter-circle swing is a door.

Sizes are not invented. Every mark stays for review.
"""

from __future__ import annotations

import math
import re
from typing import Any

PLAN_WORD = re.compile(
    r"grondplan|gelijkvloers|verdiep|plattegrond|fundering|\bplan\b",
    re.IGNORECASE,
)
GEVEL_WORD = re.compile(r"gevel|aanzicht|façade|facade|elevation", re.IGNORECASE)


def read_symbols(data: bytes, page_no: int, words: list[dict[str, Any]]) -> dict[str, Any]:
    regions = regions_from_words(words)
    if not regions:
        return {"ok": True, "boxes": []}
    boxes: list[dict[str, Any]] = []
    if "gevel" in regions:
        drawn = gevel_boxes(data, page_no, regions["gevel"], words)
        boxes.extend(drawn)
    if "plan" in regions:
        boxes.extend(plan_boxes(data, page_no, regions["plan"], words))
    return {"ok": True, "boxes": boxes}


def regions_from_words(words: list[dict[str, Any]]) -> dict[str, tuple[float, float]]:
    gevel = [float(word["y"]) for word in words if GEVEL_WORD.search(str(word.get("text") or ""))]
    plan = [float(word["y"]) for word in words if PLAN_WORD.search(str(word.get("text") or "")) and not GEVEL_WORD.search(str(word.get("text") or ""))]
    if not gevel and not plan:
        return {}
    found: dict[str, tuple[float, float]] = {}
    if gevel and plan:
        top = max(0.0, min(gevel) - 0.22)
        bottom = min(0.95, max(gevel) + 0.04)
        below = [y for y in plan if y > max(gevel)]
        plan_top = max(bottom, min(below) - 0.08) if below else bottom
        found["gevel"] = (top, bottom)
        found["plan"] = (plan_top, 0.94)
        return found
    if gevel:
        return {"gevel": (0.0, 1.0)}
    return {"plan": (0.0, 1.0)}


def gevel_boxes(
    data: bytes,
    page_no: int,
    band: tuple[float, float],
    words: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rendered = render_page(data, page_no, 0.9)
    if rendered is None:
        return []
    image, _scale = rendered
    import cv2
    import numpy as np

    height, width = image.shape[:2]
    y0 = int(band[0] * height)
    y1 = int(band[1] * height)
    if y1 - y0 < 40:
        return []
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    view = gray[y0:y1]
    ink = (view < 90).astype(np.uint8)
    closed = cv2.morphologyEx(ink * 255, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    contours, _hierarchy = cv2.findContours(closed, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    frames: list[list[float]] = []
    view_h, view_w = view.shape[:2]
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w < 26 or h < 32 or w > view_w * 0.22 or h > view_h * 0.72:
            continue
        if w / h > 6 or h / w > 5:
            continue
        roi = view[y : y + h, x : x + w]
        if min(border_ink(roi[:3, :]), border_ink(roi[-3:, :]), border_ink(roi[:, :3]), border_ink(roi[:, -3:])) < 0.25:
            continue
        inset = roi[5:-5, 5:-5] if h > 14 and w > 14 else roi
        if inset.size == 0:
            continue
        light = float((inset > 195).mean())
        grayish = float(((inset > 80) & (inset < 170)).mean())
        if light < 0.40 or grayish > 0.50:
            continue
        if not on_extending_line(ink, x, y + h, w):
            continue
        frames.append([float(x), float(y), float(w), float(h)])
    frames = drop_grouped_frames(frames)
    ground = ground_line(frames)
    boxes: list[dict[str, Any]] = []
    for x, y, w, h in frames:
        cx = (x + w / 2) / width
        cy = (y0 + y + h / 2) / height
        if near_plan_title(cx, cy, words):
            continue
        kind = gevel_kind(w, h, ground is not None and abs((y + h) - ground) <= 16)
        box = fraction_box(x / width, (y0 + y) / height, w / width, h / height, kind)
        if box:
            boxes.append(box)
    return boxes


def gevel_kind(width: float, height: float, on_ground: bool) -> str:
    if on_ground and width > height * 1.7:
        return "gevel-schuifraam"
    if on_ground and height > width * 1.6:
        return "gevel-deur"
    return "gevel-raam"


def border_ink(strip: Any) -> float:
    if strip.size == 0:
        return 0.0
    return float((strip < 100).mean())


def on_extending_line(ink: Any, x: int, bottom: int, width: int) -> bool:
    height, page_w = ink.shape[:2]
    extra = max(12, int(width * 0.28))
    for dy in range(-8, 9):
        yy = bottom + dy
        if yy < 0 or yy >= height:
            continue
        left = max(0, x - extra)
        right = min(page_w, x + width + extra)
        span = ink[yy, left:right]
        if span.size == 0:
            continue
        if int(span.sum()) >= max(width * 0.45, 18) and int(span[:extra].sum() + span[-extra:].sum()) >= 8:
            return True
    return False


def drop_grouped_frames(frames: list[list[float]]) -> list[list[float]]:
    def contains(outer: list[float], inner: list[float]) -> bool:
        return (
            inner[0] >= outer[0] - 2
            and inner[1] >= outer[1] - 2
            and inner[0] + inner[2] <= outer[0] + outer[2] + 2
            and inner[1] + inner[3] <= outer[1] + outer[3] + 2
            and inner[2] * inner[3] < outer[2] * outer[3] * 0.92
        )

    kept: list[list[float]] = []
    for frame in frames:
        children = sum(1 for other in frames if other is not frame and contains(frame, other))
        if children >= 2:
            continue
        kept.append(frame)
    singles: list[list[float]] = []
    for frame in kept:
        if any(other is not frame and contains(other, frame) for other in kept):
            continue
        singles.append(frame)
    return singles


def ground_line(frames: list[list[float]]) -> float | None:
    bottoms = sorted(frame[1] + frame[3] for frame in frames)
    if len(bottoms) < 2:
        return None
    best_y = None
    best_count = 0
    for bottom in bottoms:
        count = sum(1 for other in bottoms if abs(other - bottom) <= 14)
        if count > best_count or (count == best_count and best_y is not None and bottom > best_y):
            best_count = count
            best_y = bottom
    if best_count < 2:
        return None
    return best_y


def near_plan_title(cx: float, cy: float, words: list[dict[str, Any]]) -> bool:
    for word in words:
        text = str(word.get("text") or "")
        if GEVEL_WORD.search(text) or not PLAN_WORD.search(text):
            continue
        wx = float(word.get("x") or 0)
        wy = float(word.get("y") or 0)
        if abs(cx - wx) < 0.16 and -0.03 < (cy - wy) < 0.22:
            return True
    return False


def plan_boxes(
    data: bytes,
    page_no: int,
    band: tuple[float, float],
    words: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    try:
        import io
        import pdfplumber
    except Exception:
        return []
    boxes: list[dict[str, Any]] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        if page_no < 1 or page_no > len(pdf.pages):
            return []
        page = pdf.pages[page_no - 1]
        width, height = float(page.width), float(page.height)
        horizontal, vertical = axis_lines(page)
        boxes.extend(line_stacks(horizontal, vertical, width, height, True, band, words))
        boxes.extend(line_stacks(vertical, horizontal, width, height, False, band, words))
        boxes.extend(door_swings(page, width, height, band, words))
    return boxes


def axis_lines(page: Any) -> tuple[list[list[float]], list[list[float]]]:
    raw_h: list[tuple[float, float, float]] = []
    raw_v: list[tuple[float, float, float]] = []
    for curve in (page.curves or []) + (page.lines or []):
        points = curve.get("pts") or []
        pairs = [points] if len(points) == 2 else list(zip(points, points[1:])) if 2 < len(points) <= 5 else []
        for start, end in pairs:
            x0, y0 = float(start[0]), float(start[1])
            x1, y1 = float(end[0]), float(end[1])
            dx, dy = abs(x1 - x0), abs(y1 - y0)
            if dy <= 1.4 and dx >= 12:
                raw_h.append(((y0 + y1) / 2, min(x0, x1), max(x0, x1)))
            elif dx <= 1.4 and dy >= 12:
                raw_v.append(((x0 + x1) / 2, min(y0, y1), max(y0, y1)))
    return merge_lines(raw_h), merge_lines(raw_v)


def merge_lines(items: list[tuple[float, float, float]]) -> list[list[float]]:
    lines: list[list[float]] = []
    for cross, start, end in sorted(items, key=lambda item: (round(item[0], 0), item[1])):
        placed = False
        for line in lines[-14:]:
            if abs(line[0] - cross) > 1.6:
                continue
            if start <= line[2] + 14 and end >= line[1] - 14:
                line[0] = (line[0] + cross) / 2
                line[1] = min(line[1], start)
                line[2] = max(line[2], end)
                placed = True
                break
        if not placed:
            lines.append([cross, start, end])
    return [line for line in lines if line[2] - line[1] >= 36]


def line_stacks(
    lines: list[list[float]],
    jambs: list[list[float]],
    page_w: float,
    page_h: float,
    horizontal: bool,
    band: tuple[float, float],
    words: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """A window on a plan is an isolated stack of parallel lines in the wall."""
    lines = sorted(lines, key=lambda line: line[0])
    found: list[tuple[float, float, float, float, int]] = []
    for index, line in enumerate(lines):
        window = []
        for other in lines[index:]:
            if other[0] - line[0] > 14:
                break
            window.append(other)
        if len(window) < 3:
            continue
        longest = max(window, key=lambda item: item[2] - item[1])
        members = [longest]
        for item in window:
            if item is longest:
                continue
            overlap = min(item[2], longest[2]) - max(item[1], longest[1])
            if overlap >= 48 and overlap >= 0.45 * (longest[2] - longest[1]):
                members.append(item)
        if len({round(item[0]) for item in members}) < 3:
            continue
        left, right = longest[1], longest[2]
        if right - left < 48 or right - left > 410:
            continue
        cross0 = min(item[0] for item in members)
        cross1 = max(item[0] for item in members)
        if cross1 - cross0 < 3.5 or cross1 - cross0 > 16:
            continue
        if not isolated(lines, cross0, cross1, left, right):
            continue
        if not has_jambs(jambs, left, right, cross0, cross1):
            continue
        found.append((left, right, cross0, cross1, len(members)))
    found.sort(key=lambda item: -(item[1] - item[0]))
    kept: list[tuple[float, float, float, float, int]] = []
    for item in found:
        centre = (item[0] + item[1]) / 2
        if any(abs(item[2] - other[2]) < 10 and abs(centre - (other[0] + other[1]) / 2) < 36 for other in kept):
            continue
        kept.append(item)
    boxes: list[dict[str, Any]] = []
    for left, right, cross0, cross1, _count in kept:
        length = right - left
        kind = "grondplan-schuifraam" if length > 170 else "grondplan-raam"
        if horizontal:
            x, y = left / page_w, (page_h - cross1) / page_h
            w, h = length / page_w, max((cross1 - cross0) / page_h, 0.008)
            y = max(0.0, y - (h - (cross1 - cross0) / page_h) / 2)
        else:
            x, y = cross0 / page_w, (page_h - right) / page_h
            w, h = max((cross1 - cross0) / page_w, 0.008), length / page_h
            x = max(0.0, x - (w - (cross1 - cross0) / page_w) / 2)
        if not band_contains(y, h, band) or not on_plan(x + w / 2, y + h / 2, words):
            continue
        box = fraction_box(x, y, w, h, kind)
        if box:
            boxes.append(box)
    return boxes


def isolated(lines: list[list[float]], cross0: float, cross1: float, left: float, right: float) -> bool:
    near: set[int] = set()
    for line in lines:
        if cross0 <= line[0] <= cross1:
            continue
        if not cross0 - 26 <= line[0] <= cross1 + 26 or line[2] - line[1] < 48:
            continue
        overlap = min(line[2], right) - max(line[1], left)
        if overlap < 40:
            continue
        near.add(round(line[0]))
    return len(near) <= 2


def has_jambs(jambs: list[list[float]], left: float, right: float, cross0: float, cross1: float) -> bool:
    """A window stack ends on a jamb. A hatch line does not."""

    def near(end_pos: float) -> bool:
        for pos, start, end in jambs:
            if abs(pos - end_pos) > 16:
                continue
            if end >= cross0 - 6 and start <= cross1 + 6:
                return True
        return False

    return near(left) and near(right)


def door_swings(
    page: Any,
    page_w: float,
    page_h: float,
    band: tuple[float, float],
    words: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    boxes: list[dict[str, Any]] = []
    for curve in page.curves or []:
        points = [(float(point[0]), float(point[1])) for point in (curve.get("pts") or [])]
        if not 8 <= len(points) <= 80:
            continue
        fit = circle(points[0], points[len(points) // 2], points[-1])
        if fit is None:
            continue
        cx, cy, radius = fit
        if not 18 <= radius <= 90:
            continue
        if max(abs(math.hypot(x - cx, y - cy) - radius) for x, y in points) > 2.5:
            continue
        angles = [math.atan2(y - cy, x - cx) for x, y in points]
        span = max(angles) - min(angles)
        if span > math.pi:
            span = 2 * math.pi - span
        if not math.radians(55) <= span <= math.radians(130):
            continue
        x = (cx - radius) / page_w
        y = (page_h - (cy + radius)) / page_h
        size = (radius * 2) / page_w
        size_y = (radius * 2) / page_h
        if not band_contains(y, size_y, band) or not on_plan(x + size / 2, y + size_y / 2, words):
            continue
        box = fraction_box(x, y, size, size_y, "grondplan-deur")
        if box:
            boxes.append(box)
    return boxes


def circle(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> tuple[float, float, float] | None:
    ax, ay = a
    bx, by = b
    cx, cy = c
    determinant = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(determinant) < 1e-6:
        return None
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / determinant
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / determinant
    return ux, uy, math.hypot(ax - ux, ay - uy)


def on_plan(x: float, y: float, words: list[dict[str, Any]]) -> bool:
    """Keep a mark on the floor plan. A section or a facade sits next to its own title."""
    nearest: tuple[str, float] | None = None
    for word in words:
        text = str(word.get("text") or "")
        if GEVEL_WORD.search(text):
            kind = "gevel"
        elif re.search(r"snede|coupe|doorsnede", text, re.IGNORECASE):
            kind = "snede"
        elif PLAN_WORD.search(text):
            kind = "plan"
        else:
            continue
        distance = (float(word.get("x") or 0) - x) ** 2 + (float(word.get("y") or 0) - y) ** 2
        if nearest is None or distance < nearest[1]:
            nearest = (kind, distance)
    return nearest is not None and nearest[0] == "plan" and nearest[1] <= 0.28 ** 2


def band_contains(y: float, h: float, band: tuple[float, float]) -> bool:
    centre = y + h / 2
    return band[0] <= centre <= band[1]


def fraction_box(x: float, y: float, w: float, h: float, source: str) -> dict[str, Any] | None:
    if w <= 0 or h <= 0:
        return None
    x = min(max(x, 0.0), 1.0)
    y = min(max(y, 0.0), 1.0)
    w = min(w, 1 - x)
    h = min(h, 1 - y)
    if w < 0.004 or h < 0.004 or w > 0.45 or h > 0.45:
        return None
    return {"x": round(x, 5), "y": round(y, 5), "w": round(w, 5), "h": round(h, 5), "source": source}


def render_page(data: bytes, page_no: int, scale: float) -> tuple[Any, float] | None:
    try:
        import pypdfium2 as pdfium
    except Exception:
        return None
    doc = pdfium.PdfDocument(data)
    try:
        if page_no < 1 or page_no > len(doc):
            return None
        image = doc[page_no - 1].render(scale=scale).to_numpy()
        return image, scale
    except Exception:
        return None
    finally:
        doc.close()
