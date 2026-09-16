#!/usr/bin/env python
"""Euclidean parent candidates on the E1 vectors — the control for the HiT ranker.

    .venv/bin/python euclid_candidates.py --scheme <arm>-<scheme> [--provider ollama] [--model embeddinggemma] \
        [--hit-model HiT-MiniLM-L12-WordNetNoun] [--topk 10]

Reads `in/scheme-<arm>-<scheme>.json` and the E1 vectors `in/vectors-<arm>-<scheme>-<provider>-<model>.jsonl`
(keyed by the export's `text`), and writes two ranked-parent files in the same shape as
`hit_zeroshot.py` (`{model, scheme, method, topk, rows: [{child, candidates: [{parent, score, dist,
normChild, normParent}]}]}`):

  out/candidates-<arm>-<scheme>-euclid-0.json              top-k parents by cosine, no restriction
  out/candidates-<arm>-<scheme>-euclid-normfilter-0.json   top-k by cosine among candidates whose
                                                            HiT origin-norm is SMALLER than the child's
  out/candidates-<arm>-<scheme>-euclid-normfilter-gloss-0.json  the same with the norms of the
                                                            gloss-text HiT run (`hit_zeroshot.py --text text`)

`score` is the cosine, `dist` is 1 − cosine. `normChild` / `normParent` are the HiT norms read from
`in/vectors-<arm>-<scheme>-hit-<hit-model>.jsonl` (present in both files so the two rankers can be
compared row by row); the normfilter file is skipped (with a message) when the HiT vectors are
missing. The normfilter control isolates the norm-order signal: same cosine ranking, HiT norms only
as a filter, so a gap between the two files is what the norm carries beyond cosine.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from poincare_ops import dist0

HERE = Path(__file__).resolve().parent


def load_jsonl(path: Path) -> dict[str, np.ndarray]:
    out: dict[str, np.ndarray] = {}
    for line in path.read_text().splitlines():
        if line.strip():
            obj = json.loads(line)
            out[obj["t"]] = np.asarray(obj["v"], dtype=np.float64)
    return out


def rank(concepts: list[dict], X: np.ndarray, norms: np.ndarray | None, topk: int, normfilter: bool) -> list[dict]:
    Xn = X / np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-12)
    S = Xn @ Xn.T
    np.fill_diagonal(S, -np.inf)
    if normfilter:
        assert norms is not None
        S = np.where(norms[None, :] < norms[:, None], S, -np.inf)
    rows = []
    for i, cpt in enumerate(concepts):
        order = np.argsort(-S[i], kind="stable")[:topk]
        cands = [
            {
                "parent": concepts[j]["prefLabel"],
                "score": float(S[i, j]),
                "dist": float(1.0 - S[i, j]),
                "normChild": None if norms is None else float(norms[i]),
                "normParent": None if norms is None else float(norms[j]),
            }
            for j in order
            if np.isfinite(S[i, j])
        ]
        rows.append({"child": cpt["prefLabel"], "candidates": cands})
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scheme", required=True, help="<arm>-<scheme>, as in in/scheme-<arm>-<scheme>.json")
    ap.add_argument("--provider", default="ollama")
    ap.add_argument("--model", default="embeddinggemma")
    ap.add_argument("--hit-model", default="HiT-MiniLM-L12-WordNetNoun")
    ap.add_argument("--topk", type=int, default=10)
    args = ap.parse_args()

    scheme = json.loads((HERE / "in" / f"scheme-{args.scheme}.json").read_text())
    concepts = scheme["concepts"]
    e1_path = HERE / "in" / f"vectors-{args.scheme}-{args.provider}-{args.model}.jsonl"
    e1 = load_jsonl(e1_path)
    missing = [c["prefLabel"] for c in concepts if c["text"] not in e1]
    if missing:
        raise SystemExit(f"{len(missing)} concepts have no E1 vector in {e1_path} (e.g. {missing[:3]})")
    X = np.stack([e1[c["text"]] for c in concepts])

    def hit_norms(variant: str) -> np.ndarray | None:
        hit_path = HERE / "in" / f"vectors-{args.scheme}-hit{variant}-{args.hit_model}.jsonl"
        if not hit_path.exists():
            print(f"no HiT vectors at {hit_path}; normfilter{variant} skipped")
            return None
        hit = load_jsonl(hit_path)
        # hit_zeroshot.py keys its JSONL by the text it encoded (prefLabel by default, `text` for gloss).
        keyed = [hit.get(c["prefLabel"], hit.get(c["text"])) for c in concepts]
        if not all(v is not None for v in keyed):
            print(f"HiT vectors in {hit_path} do not cover the scheme; normfilter{variant} skipped")
            return None
        H = np.stack(keyed)
        return dist0(H, 1.0 / H.shape[1])

    norms = hit_norms("")
    (HERE / "out").mkdir(exist_ok=True)
    base = {"model": f"{args.provider}/{args.model}", "scheme": args.scheme, "topk": args.topk,
            "text": "text", "curvature": None, "hitModel": args.hit_model if norms is not None else None}
    out = HERE / "out" / f"candidates-{args.scheme}-euclid-0.json"
    out.write_text(json.dumps({**base, "method": "euclid", "rows": rank(concepts, X, norms, args.topk, False)}, indent=1) + "\n")
    print(f"wrote {out}")
    for variant in ("", "-gloss"):
        n = norms if variant == "" else hit_norms(variant)
        if n is None:
            continue
        out = HERE / "out" / f"candidates-{args.scheme}-euclid-normfilter{variant}-0.json"
        out.write_text(json.dumps({**base, "hitModel": args.hit_model, "hitText": "pref" if variant == "" else "text",
                                   "method": f"euclid-normfilter{variant}", "rows": rank(concepts, X, n, args.topk, True)}, indent=1) + "\n")
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
