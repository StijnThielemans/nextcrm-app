#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt
# PaddleOCR PP-OCR weights ship inside rapidocr and load on first use.
mkdir -p models
if [ ! -f models/M2_DA_FT_v2_best.pt ]; then
  curl -fL --retry 3 -o models/M2_DA_FT_v2_best.pt \
    "https://github.com/Chunling1/OpenBIM-FloorPlan-AI/releases/download/v1.0.0/M2_DA_FT_v2_best.pt"
fi
