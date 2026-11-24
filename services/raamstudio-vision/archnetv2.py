"""ArchNetv2 window and door search.

ArchNetv2 (Xu, Jha, Mehadi, Mandal, 2024) detects windows, doors and stairs on
floor plans. The paper is CC BY-NC, the network is a modified YOLOv8, and no
commercial weights are published. Ultralytics YOLO is AGPL-3.0 and is not
imported. A local checkpoint is used only when it names a window or door class.
Nothing here invents a box.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

WEIGHTS = Path(__file__).with_name("models") / "archnetv2.pt"
WINDOW = {"window", "windows", "raam", "ramen", "door", "doors", "deur", "deuren"}


def read_archnet(data: bytes, page_no: int) -> dict[str, Any]:
    del data, page_no
    if not WEIGHTS.is_file():
        return {"ok": False, "reason": "geen-gewichten", "boxes": []}
    try:
        import torch
    except Exception as exc:
        return {"ok": False, "reason": str(exc), "boxes": []}
    try:
        checkpoint = torch.load(WEIGHTS, map_location="cpu", weights_only=False)
    except Exception as exc:
        return {"ok": False, "reason": str(exc), "boxes": []}
    names = class_names(checkpoint)
    if not names or not WINDOW.intersection({name.lower() for name in names}):
        return {"ok": False, "reason": "geen-raamklasse", "boxes": []}
    return {"ok": False, "reason": "formaat-niet-geladen", "boxes": []}


def class_names(checkpoint: Any) -> list[str]:
    if not isinstance(checkpoint, dict):
        return []
    raw = checkpoint.get("names") or checkpoint.get("class_names") or []
    if isinstance(raw, dict):
        return [str(raw[key]) for key in sorted(raw)]
    if isinstance(raw, (list, tuple)):
        return [str(name) for name in raw]
    return []
