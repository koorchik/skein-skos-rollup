#!/usr/bin/env python
"""Geometry diagnostics for a set of concept vectors: δ-hyperbolicity and tree distortion.

    python geometry.py --vectors in/vectors-software-ollama-embeddinggemma.jsonl --metric cosine \
        [--tree in/scheme-software.json] [--samples 20000] [--seed 42]
    python geometry.py --self-test
    python geometry.py --bundle <arm>-software      # E1 (cosine, euclid), HiT (poincare, cosine) and random
                                                    # baselines → out/geometry-<arm>-<scheme>.json

δ-hyperbolicity (Gromov four-point condition, sampled): for a quadruple (a, b, c, d) with the three
pair sums S1 = d(a,b)+d(c,d), S2 = d(a,c)+d(b,d), S3 = d(a,d)+d(b,c), δ = (largest − second)/2.
A tree metric has δ = 0; a Euclidean grid does not. Reported as max and mean over samples, and
relative to the diameter (2δ/diam) so different metrics compare.

Tree distortion: given a tree (the registry's broader edges, read from a scheme export), the
embedding distance d_e is compared with the hop distance d_t on pairs inside one connected
component. With the best least-squares scale α, relative distortion = mean |d_e − α d_t| / (α d_t);
worst-case distortion = max(d_e/d_t) / min(d_e/d_t). An isometric embedding gives 0 and 1.

numpy only. Distances: euclid, cosine (1 − cos), or poincare (curvature c = 1/dim, see poincare_ops).

`--bundle` runs the diagnostics for one arm × scheme over the E1 vectors
(`in/vectors-<arm>-<scheme>-ollama-embeddinggemma.jsonl`, cosine and euclid), the HiT ball points
(`in/vectors-<arm>-<scheme>-hit-<model>.jsonl`, poincare and cosine), and two random baselines of the
same n: Gaussian directions of the E1 dimension (cosine), and Gaussian directions carrying the HiT
norm distribution (poincare) — so "more tree-like than random" has a number to be compared with.
"""
from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np


def load_vectors(path: Path) -> tuple[list[str], np.ndarray]:
    names, rows = [], []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        names.append(obj["t"])
        rows.append(obj["v"])
    return names, np.asarray(rows, dtype=np.float64)


def distance_matrix(X: np.ndarray, metric: str) -> np.ndarray:
    if metric == "euclid":
        sq = np.sum(X * X, axis=1)
        D = sq[:, None] + sq[None, :] - 2 * X @ X.T
        return np.sqrt(np.maximum(D, 0.0))
    if metric == "cosine":
        Xn = X / np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-12)
        return np.clip(1.0 - Xn @ Xn.T, 0.0, 2.0)
    if metric == "poincare":
        from poincare_ops import dist, project

        c = 1.0 / X.shape[1]
        P = project(X, c)
        return np.stack([dist(P[i][None, :], P, c) for i in range(len(P))])
    raise ValueError(metric)


def delta_hyperbolicity(D: np.ndarray, samples: int, seed: int) -> dict:
    n = D.shape[0]
    rng = np.random.default_rng(seed)
    if n < 4:
        return {"deltaMax": 0.0, "deltaMean": 0.0, "diameter": float(D.max()), "relative": 0.0, "samples": 0}
    q = np.stack([rng.choice(n, size=4, replace=False) for _ in range(samples)])
    a, b, c, d = q.T
    s = np.stack([D[a, b] + D[c, d], D[a, c] + D[b, d], D[a, d] + D[b, c]], axis=1)
    s.sort(axis=1)
    delta = (s[:, 2] - s[:, 1]) / 2.0
    diam = float(D.max())
    return {
        "deltaMax": float(delta.max()),
        "deltaMean": float(delta.mean()),
        "diameter": diam,
        "relative": float(2 * delta.max() / diam) if diam > 0 else 0.0,
        "samples": int(samples),
    }


def tree_distances(names: list[str], edges: list[tuple[str, str]]) -> dict[tuple[int, int], int]:
    index = {name: i for i, name in enumerate(names)}
    adj: dict[int, set[int]] = {}
    for u, v in edges:
        if u in index and v in index:
            adj.setdefault(index[u], set()).add(index[v])
            adj.setdefault(index[v], set()).add(index[u])
    hops: dict[tuple[int, int], int] = {}
    for start in adj:
        seen = {start: 0}
        queue = deque([start])
        while queue:
            node = queue.popleft()
            for nxt in adj.get(node, ()):
                if nxt not in seen:
                    seen[nxt] = seen[node] + 1
                    queue.append(nxt)
        for node, h in seen.items():
            if node > start:
                hops[(start, node)] = h
    return hops


def distortion(D: np.ndarray, hops: dict[tuple[int, int], int]) -> dict:
    if not hops:
        return {"pairs": 0}
    pairs = np.array(list(hops.keys()))
    de = D[pairs[:, 0], pairs[:, 1]]
    dt = np.array(list(hops.values()), dtype=np.float64)
    alpha = float((de @ dt) / (dt @ dt))
    ratio = de / dt
    return {
        "pairs": int(len(dt)),
        "scale": alpha,
        "relativeDistortion": float(np.mean(np.abs(de - alpha * dt) / (alpha * dt))) if alpha > 0 else None,
        "worstCase": float(ratio.max() / ratio.min()) if ratio.min() > 0 else None,
    }


def self_test() -> None:
    # A random tree metric: δ must be 0 and an isometric embedding has no distortion.
    rng = np.random.default_rng(0)
    n = 60
    parent = [None] + [int(rng.integers(0, i)) for i in range(1, n)]
    names = [f"n{i}" for i in range(n)]
    edges = [(names[i], names[parent[i]]) for i in range(1, n)]
    hops = tree_distances(names, edges)
    D = np.zeros((n, n))
    for (i, j), h in hops.items():
        D[i, j] = D[j, i] = h
    d = delta_hyperbolicity(D, samples=5000, seed=1)
    assert d["deltaMax"] < 1e-9, d
    t = distortion(D, hops)
    assert abs(t["relativeDistortion"]) < 1e-9 and abs(t["worstCase"] - 1) < 1e-9, t
    # A Euclidean grid is not a tree: δ clearly positive.
    G = np.array([(x, y) for x in range(8) for y in range(8)], dtype=np.float64)
    g = delta_hyperbolicity(distance_matrix(G, "euclid"), samples=5000, seed=1)
    assert g["deltaMax"] > 0.5, g
    # A path embedded on a line is isometric under euclid.
    P = np.arange(10, dtype=np.float64)[:, None]
    ph = tree_distances([f"p{i}" for i in range(10)], [(f"p{i}", f"p{i+1}") for i in range(9)])
    p = distortion(distance_matrix(P, "euclid"), ph)
    assert abs(p["relativeDistortion"]) < 1e-9, p
    print("geometry: self-tests passed", {"treeDelta": d["deltaMax"], "gridDelta": round(g["deltaMax"], 3)})


def report_for(names: list[str], X: np.ndarray, metric: str, samples: int, seed: int, scheme: dict | None, label: str) -> dict:
    D = distance_matrix(X, metric)
    report = {"vectors": label, "n": len(names), "dim": int(X.shape[1]), "metric": metric,
              "delta": delta_hyperbolicity(D, samples, seed)}
    if scheme is not None:
        by_text = {c["text"]: c["prefLabel"] for c in scheme["concepts"]}
        labels = [by_text.get(t, t) for t in names]
        hops = tree_distances(labels, [(e["narrower"], e["broader"]) for e in scheme["edges"]])
        report["distortion"] = distortion(D, hops)
    return report


def bundle(slug: str, samples: int, seed: int, provider: str, model: str, hit_model: str) -> dict:
    from poincare_ops import dist0, expmap0

    here = Path(__file__).resolve().parent
    scheme = json.loads((here / "in" / f"scheme-{slug}.json").read_text())
    rng = np.random.default_rng(seed)
    out: dict = {"scheme": slug, "samples": samples, "seed": seed, "reports": []}
    e1_path = here / "in" / f"vectors-{slug}-{provider}-{model}.jsonl"
    if e1_path.exists():
        names, X = load_vectors(e1_path)
        for metric in ("cosine", "euclid"):
            out["reports"].append(report_for(names, X, metric, samples, seed, scheme, f"E1 {provider}/{model}"))
        R = rng.standard_normal(X.shape)
        out["reports"].append(report_for(names, R, "cosine", samples, seed, scheme, f"random gaussian dim={X.shape[1]}"))
    for variant, tag in (("", "pref"), ("-gloss", "gloss")):
        hit_path = here / "in" / f"vectors-{slug}-hit{variant}-{hit_model}.jsonl"
        if not hit_path.exists():
            continue
        names, H = load_vectors(hit_path)
        c = 1.0 / H.shape[1]
        for metric in ("poincare", "cosine"):
            out["reports"].append(report_for(names, H, metric, samples, seed, scheme, f"HiT {hit_model} ({tag})"))
        if variant:
            continue
        # Random ball points with the HiT norm distribution: random directions, HiT origin-distances.
        norms = dist0(H, c)
        dirs = rng.standard_normal(H.shape)
        dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        # expmap0 of a tangent vector of length r/1 gives a point at geodesic distance r from the origin.
        # dist0(expmap0(v)) = 2/√c · artanh(tanh(√c‖v‖)) = 2‖v‖ ⇒ ‖v‖ = norm/2.
        B = expmap0(dirs * (norms[:, None] / 2.0), c)
        out["reports"].append(report_for(names, B, "poincare", samples, seed, scheme, "random ball (HiT norms)"))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vectors")
    ap.add_argument("--metric", choices=["euclid", "cosine", "poincare"], default="cosine")
    ap.add_argument("--tree", help="scheme-<x>.json whose `edges` give the tree (narrower→broader)")
    ap.add_argument("--samples", type=int, default=20000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--bundle", help="<arm>-<scheme>: run every diagnostic and write out/geometry-<arm>-<scheme>.json")
    ap.add_argument("--provider", default="ollama")
    ap.add_argument("--model", default="embeddinggemma")
    ap.add_argument("--hit-model", default="HiT-MiniLM-L12-WordNetNoun")
    args = ap.parse_args()
    if args.self_test:
        self_test()
        return
    if args.bundle:
        out = bundle(args.bundle, args.samples, args.seed, args.provider, args.model, args.hit_model)
        target = Path(__file__).resolve().parent / "out" / f"geometry-{args.bundle}.json"
        target.write_text(json.dumps(out, indent=2) + "\n")
        for r in out["reports"]:
            d = r["delta"]
            dist_ = r.get("distortion", {})
            print(f"{r['vectors']:38} {r['metric']:9} n={r['n']:4} δmax={d['deltaMax']:.3f} δmean={d['deltaMean']:.4f} "
                  f"diam={d['diameter']:.3f} 2δ/diam={d['relative']:.3f} distortion={dist_.get('relativeDistortion')} worst={dist_.get('worstCase')}")
        print(f"wrote {target}")
        return
    if not args.vectors:
        ap.error("--vectors or --self-test required")
    names, X = load_vectors(Path(args.vectors))
    D = distance_matrix(X, args.metric)
    report = {"vectors": args.vectors, "n": len(names), "dim": int(X.shape[1]), "metric": args.metric,
              "delta": delta_hyperbolicity(D, args.samples, args.seed)}
    if args.tree:
        scheme = json.loads(Path(args.tree).read_text())
        by_text = {c["text"]: c["prefLabel"] for c in scheme["concepts"]}
        labels = [by_text.get(t, t) for t in names]
        hops = tree_distances(labels, [(e["narrower"], e["broader"]) for e in scheme["edges"]])
        report["distortion"] = distortion(D, hops)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
