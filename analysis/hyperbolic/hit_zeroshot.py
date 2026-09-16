#!/usr/bin/env python
"""E3 — zero-shot hyperbolic vectors from a Hierarchy Transformer (HiT) checkpoint.

    .venv/bin/python hit_zeroshot.py --smoke                 # 10 hand-written Software pairs
    .venv/bin/python hit_zeroshot.py --scheme software [--w 0.5] [--topk 5] [--text pref|text]

HiT (He et al., 2024, "Language models as hierarchy encoders") fine-tunes a sentence-transformer
so that its OUTPUT space, read as a Poincaré ball of curvature c = 1/d (d = embedding dim, i.e. the
ball circumscribing the LM's bounded output hypercube), encodes subsumption: a parent sits closer
to the origin than its children (centripetal loss) and near them (clustering loss). Loading the
checkpoint through plain sentence-transformers therefore already gives ball points — no
`hierarchy_transformers` dependency is needed; the five ball formulas live in `poincare_ops.py`.

Score for a (child, parent) pair, higher = more plausible subsumption:

    score = -( dist_c(child, parent) + w * (norm0(parent) - norm0(child)) )

so a parent that is both near the child and nearer the origin wins. `w` is the R3 operator's λ.

Outputs:
  out/env.json                                     python / torch / model sha / device
  in/vectors-<scheme>-hit-<model>.jsonl            {k, t, v} ball points (non-smoke)
  out/candidates-<scheme>-hit-zeroshot-0.json      top-k norm-ordered parents per concept (non-smoke)

With `--text text` (the export's `prefLabel: definition`, the same text E1 embeds) the files are
`in/vectors-<scheme>-hit-gloss-<model>.jsonl` and `out/candidates-<scheme>-hit-zeroshot-gloss-0.json`,
so the prefLabel-only run (`hit-zeroshot`) and the gloss run (`hit-zeroshot-gloss`) coexist.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import sys
import time
from pathlib import Path

import numpy as np

from poincare_ops import dist, dist0, project

HERE = Path(__file__).resolve().parent
MODEL = os.environ.get("HIT_MODEL", "Hierarchy-Transformers/HiT-MiniLM-L12-WordNetNoun")

SMOKE_PAIRS = [
    ("Microsoft Exchange Server 2013", "Microsoft Exchange Server", True),
    ("Microsoft Exchange Server 2016", "Microsoft Exchange Server", True),
    ("Windows Server 2016", "Windows", True),
    ("Windows 10", "Windows", True),
    ("Windows 10", "MS Office", False),
    ("Firefox ESR", "Firefox", True),
    ("Python 2.7.18", "Python", True),
    ("Adobe Reader DC", "Adobe Acrobat Reader", True),
    ("Microsoft Office 2010", "Microsoft Office", True),
    ("Firefox", "web browser", True),
    ("Microsoft Exchange Server", "Windows", False),
    ("WordPress", "WP Database Reset", False),
]


def embedding_dim(model) -> int:
    getter = getattr(model, "get_embedding_dimension", None) or model.get_sentence_embedding_dimension
    return int(getter())


def load_model():
    from sentence_transformers import SentenceTransformer

    started = time.time()
    model = SentenceTransformer(MODEL)
    return model, time.time() - started


def model_sha() -> str | None:
    try:
        from huggingface_hub import HfApi

        return HfApi().model_info(MODEL).sha
    except Exception:  # offline: fall back to the local snapshot directory name
        cache = Path.home() / ".cache/huggingface/hub" / ("models--" + MODEL.replace("/", "--")) / "snapshots"
        if cache.exists():
            snaps = sorted(cache.iterdir())
            return snaps[-1].name if snaps else None
        return None


def write_env(model, load_s: float) -> None:
    import torch

    env = {
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "torch": torch.__version__,
        "cuda": torch.cuda.is_available(),
        "device": str(model.device),
        "model": MODEL,
        "modelSha": model_sha(),
        "embeddingDim": embedding_dim(model),
        "curvature": 1.0 / embedding_dim(model),
        "loadSeconds": round(load_s, 2),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    (HERE / "out").mkdir(exist_ok=True)
    (HERE / "out/env.json").write_text(json.dumps(env, indent=2) + "\n")
    print("env:", json.dumps(env))


def encode(model, texts: list[str], c: float) -> np.ndarray:
    vecs = model.encode(texts, convert_to_numpy=True, batch_size=64, show_progress_bar=False)
    return project(vecs.astype(np.float64), c)


def smoke(w: float) -> None:
    model, load_s = load_model()
    write_env(model, load_s)
    d = embedding_dim(model)
    c = 1.0 / d
    texts = sorted({t for pair in SMOKE_PAIRS for t in pair[:2]})
    vecs = dict(zip(texts, encode(model, texts, c)))
    print(f"\nmodel {MODEL}  dim={d}  c=1/{d}  w={w}")
    print(f"{'child':32} {'parent':26} {'gold':5} {'score':>8} {'dist':>7} {'n(c)':>7} {'n(p)':>7}  n(p)<n(c)")
    agree = 0
    for child, parent, positive in SMOKE_PAIRS:
        vc, vp = vecs[child], vecs[parent]
        dcp = float(dist(vc, vp, c))
        nc, np_ = float(dist0(vc, c)), float(dist0(vp, c))
        score = -(dcp + w * (np_ - nc))
        ordered = np_ < nc
        agree += int(ordered == positive)
        print(f"{child:32} {parent:26} {'yes' if positive else 'no':5} {score:8.3f} {dcp:7.3f} {nc:7.3f} {np_:7.3f}  {'yes' if ordered else 'no'}")
    print(f"\nnorm-order agrees with the hand label on {agree}/{len(SMOKE_PAIRS)} pairs")


def run_scheme(scheme: str, w: float, topk: int, text_field: str) -> None:
    scheme_path = HERE / "in" / f"scheme-{scheme}.json"
    data = json.loads(scheme_path.read_text())
    concepts = data["concepts"]
    texts = [(cpt["prefLabel"] if text_field == "pref" else cpt["text"]) for cpt in concepts]
    model, load_s = load_model()
    write_env(model, load_s)
    d = embedding_dim(model)
    c = 1.0 / d
    started = time.time()
    vecs = encode(model, texts, c)
    print(f"encoded {len(texts)} concepts in {time.time() - started:.1f}s")

    slug = MODEL.split("/")[-1]
    variant = "" if text_field == "pref" else "-gloss"
    out_vec = HERE / "in" / f"vectors-{scheme}-hit{variant}-{slug}.jsonl"
    with out_vec.open("w") as fh:
        for t, v in zip(texts, vecs):
            k = hashlib.sha256(json.dumps([MODEL, t], ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
            fh.write(json.dumps({"k": k, "t": t, "v": [float(x) for x in v]}) + "\n")

    norms = dist0(vecs, c)
    # Pairwise distances in blocks (n ≤ 2k, so an n×n matrix is fine).
    D = np.stack([dist(vecs[i][None, :], vecs, c) for i in range(len(vecs))])
    score = -(D + w * (norms[None, :] - norms[:, None]))  # score[i, j]: j as parent of i
    np.fill_diagonal(score, -np.inf)
    score[norms[None, :] >= norms[:, None]] = -np.inf  # parent must be nearer the origin
    rows = []
    for i, cpt in enumerate(concepts):
        order = np.argsort(-score[i])[:topk]
        cands = [
            {"parent": concepts[j]["prefLabel"], "score": float(score[i, j]), "dist": float(D[i, j]),
             "normChild": float(norms[i]), "normParent": float(norms[j])}
            for j in order if np.isfinite(score[i, j])
        ]
        rows.append({"child": cpt["prefLabel"], "candidates": cands})
    out = HERE / "out" / f"candidates-{scheme}-hit-zeroshot{variant}-0.json"
    out.write_text(json.dumps({"model": MODEL, "scheme": scheme, "method": f"hit-zeroshot{variant}", "w": w, "topk": topk, "text": text_field,
                               "curvature": c, "rows": rows}, indent=1) + "\n")
    print(f"wrote {out_vec} and {out}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--scheme")
    ap.add_argument("--w", type=float, default=0.5)
    ap.add_argument("--topk", type=int, default=5)
    ap.add_argument("--text", choices=["pref", "text"], default="pref")
    args = ap.parse_args()
    if args.smoke:
        smoke(args.w)
    elif args.scheme:
        run_scheme(args.scheme, args.w, args.topk, args.text)
    else:
        ap.error("--smoke or --scheme required")


if __name__ == "__main__":
    main()
