#!/usr/bin/env bash
# Create the sidecar venv at analysis/hyperbolic/.venv.
#
#   ./bootstrap.sh            # uv + Python 3.12 when uv is installed; otherwise system python3
#   ./bootstrap.sh --cpu      # pull CPU-only torch wheels (much smaller; enough for the smoke)
#
# Preferred path (reproducible interpreter):
#   uv python install 3.12 && uv venv --python 3.12 .venv && uv pip install -r requirements.txt
# Fallback when uv is absent: `python3 -m venv .venv` on whatever python3 is on PATH (3.12+),
# then pip. The fallback is what the 2026-09-16 smoke ran on (python 3.14, no uv on the box);
# out/env.json records the interpreter actually used.
set -euo pipefail
cd "$(dirname "$0")"

CPU_INDEX=""
if [[ "${1:-}" == "--cpu" ]]; then
  CPU_INDEX="--extra-index-url https://download.pytorch.org/whl/cpu"
fi

if command -v uv >/dev/null 2>&1; then
  echo "bootstrap: uv found — Python 3.12 venv"
  uv python install 3.12
  uv venv --python 3.12 .venv
  # shellcheck disable=SC2086
  uv pip install --python .venv/bin/python $CPU_INDEX -r requirements.txt
else
  PY="${PYTHON:-python3}"
  echo "bootstrap: uv not found — falling back to $($PY --version) via venv"
  "$PY" -m venv .venv
  .venv/bin/python -m pip install --upgrade pip >/dev/null
  # shellcheck disable=SC2086
  .venv/bin/python -m pip install $CPU_INDEX -r requirements.txt
fi

.venv/bin/python - <<'PY'
import sys, torch, sentence_transformers, numpy
print("python", sys.version.split()[0], "torch", torch.__version__, "cuda", torch.cuda.is_available(),
      "sentence-transformers", sentence_transformers.__version__, "numpy", numpy.__version__)
PY
echo "bootstrap: done — run  .venv/bin/python hit_zeroshot.py --smoke"
