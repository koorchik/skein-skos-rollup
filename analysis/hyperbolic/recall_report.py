#!/usr/bin/env python
"""Recall@k of the ranked-parent files against the gold hierarchy, per arm × scheme × method.

    .venv/bin/python recall_report.py [--methods euclid,euclid-normfilter,euclid-normfilter-gloss,hit-zeroshot,hit-zeroshot-gloss] [--split test]
        [--k 1,5,10] [--boot 1000] [--seed 42] [--md ../out/recall-at-k.md]

Unit: a gold-mapped concept (child) whose gold cluster has at least one gold ancestor over the
edges of the chosen split (default `test` = test-test edges, docs/ROLLUP-PROTOCOL.md) — the same
denominator as `rollup-eval`'s sound%. For each unit, the candidates of
`out/candidates-<arm>-<scheme>-<method>-0.json` are scanned in rank order:

  transitive hit  — the candidate's gold cluster is any gold ancestor of the child's cluster
                    (credit for `Office 2010 → Microsoft Products` when Office sits in between);
  direct hit      — the candidate's gold cluster is a direct gold parent.

recall@k = share of units with a hit at rank ≤ k; MRR = mean 1/rank of the first hit (0 if none).
coverage = share of units whose ancestor (resp. direct parent) cluster has at least one gold-mapped
concept in this arm's scheme at all — the ceiling any ranker over this scheme can reach.
Uncertainty: percentile bootstrap over units, `--boot` resamples, seed `--seed`, 95%.

Writes `out/recall-<arm>-<scheme>.json` per pair and one consolidated Markdown table (`--md`).
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
HIERARCHY_KINDS = {"isa", "part-of", "broadergeneric", "broaderinstantial", "broaderpartitive"}
SCHEME_ORDER = ["software", "sector", "government-body", "organization", "device", "domain"]


def ancestry(gold_edges: list[dict], split: str) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    parents: dict[str, set[str]] = {}
    for e in gold_edges:
        if e["split"] != split or e["kind"].strip().lower() not in HIERARCHY_KINDS:
            continue
        if e["fromClusterId"] == e["toClusterId"]:
            continue
        parents.setdefault(e["fromClusterId"], set()).add(e["toClusterId"])
    ancestors: dict[str, set[str]] = {}
    for start in parents:
        seen: set[str] = set()
        stack = list(parents[start])
        while stack:
            node = stack.pop()
            if node == start or node in seen:
                continue
            seen.add(node)
            stack.extend(parents.get(node, ()))
        ancestors[start] = seen
    return parents, ancestors


def first_rank(cands: list[dict], gold_map: dict[str, str], targets: set[str]) -> int | None:
    for rank, c in enumerate(cands, start=1):
        if gold_map.get(c["parent"]) in targets:
            return rank
    return None


def stats(ranks: list[int | None], ks: list[int]) -> dict[str, float]:
    r = np.array([np.inf if x is None else x for x in ranks], dtype=np.float64)
    out = {f"recall@{k}": float(np.mean(r <= k)) for k in ks}
    out["mrr"] = float(np.mean(np.where(np.isfinite(r), 1.0 / np.where(np.isfinite(r), r, 1.0), 0.0)))
    return out


def bootstrap(ranks: list[int | None], ks: list[int], boot: int, seed: int) -> dict[str, list[float]]:
    rng = np.random.default_rng(seed)
    n = len(ranks)
    if n == 0 or boot == 0:
        return {}
    samples: dict[str, list[float]] = {}
    arr = np.array([np.inf if x is None else x for x in ranks], dtype=np.float64)
    for _ in range(boot):
        idx = rng.integers(0, n, size=n)
        s = arr[idx]
        for k in ks:
            samples.setdefault(f"recall@{k}", []).append(float(np.mean(s <= k)))
        samples.setdefault("mrr", []).append(float(np.mean(np.where(np.isfinite(s), 1.0 / np.where(np.isfinite(s), s, 1.0), 0.0))))
    return {key: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))] for key, v in samples.items()}


def evaluate(arm: str, scheme: str, methods: list[str], split: str, ks: list[int], boot: int, seed: int) -> dict | None:
    data = json.loads((HERE / "in" / f"scheme-{arm}-{scheme}.json").read_text())
    gold_map: dict[str, str] = data["goldMap"]
    parents, ancestors = ancestry(data["goldEdges"], split)
    units = [c["prefLabel"] for c in data["concepts"] if gold_map.get(c["prefLabel"]) in ancestors]
    if not units:
        return None
    mapped_clusters = set(gold_map.values())
    cov_any = float(np.mean([bool(ancestors[gold_map[u]] & mapped_clusters) for u in units]))
    cov_direct = float(np.mean([bool(parents[gold_map[u]] & mapped_clusters) for u in units]))
    report = {
        "arm": arm, "scheme": scheme, "split": split, "units": len(units),
        "coverage": {"transitive": cov_any, "direct": cov_direct},
        "bootstrap": {"resamples": boot, "seed": seed, "ci": 0.95},
        "methods": {},
    }
    for method in methods:
        path = HERE / "out" / f"candidates-{arm}-{scheme}-{method}-0.json"
        if not path.exists():
            report["methods"][method] = {"missing": str(path)}
            continue
        rows = {r["child"]: r["candidates"] for r in json.loads(path.read_text())["rows"]}
        trans = [first_rank(rows.get(u, []), gold_map, ancestors[gold_map[u]]) for u in units]
        direct = [first_rank(rows.get(u, []), gold_map, parents[gold_map[u]]) for u in units]
        report["methods"][method] = {
            "transitive": {**stats(trans, ks), "ci": bootstrap(trans, ks, boot, seed)},
            "direct": {**stats(direct, ks), "ci": bootstrap(direct, ks, boot, seed)},
            "emptyRows": int(sum(1 for u in units if not rows.get(u))),
        }
    return report


def markdown(reports: list[dict], methods: list[str], ks: list[int]) -> str:
    lines = [
        f"# Recall@k of the ranked-parent files (gold hierarchy, {reports[0]['split']} split)",
        "",
        "Unit = gold-mapped concept whose gold cluster has an ancestor over the split's edges (the sound% denominator). "
        "`trans.` = credit for any gold ancestor, `direct` = the direct gold parent only; `cov.` = share of units whose "
        "ancestor cluster has any concept in this arm's scheme (the ceiling). 95% percentile bootstrap over units "
        f"({reports[0]['bootstrap']['resamples']} resamples, seed {reports[0]['bootstrap']['seed']}) on R@10 (trans.).",
        "",
    ]
    kcols = " | ".join(f"R@{k}" for k in ks)
    by_scheme: dict[str, list[dict]] = {}
    for r in reports:
        by_scheme.setdefault(r["scheme"], []).append(r)
    for scheme in sorted(by_scheme, key=lambda s: (SCHEME_ORDER.index(s) if s in SCHEME_ORDER else 99, s)):
        lines.append(f"## {scheme}")
        lines.append("")
        lines.append(f"| arm | method | n | cov. | {kcols} | MRR | R@10 CI | direct {kcols} | direct MRR |")
        lines.append("|---|---|---:|---:|" + "---:|" * (len(ks) + 2) + "---:|" * (len(ks) + 1))
        for r in by_scheme[scheme]:
            for method in methods:
                m = r["methods"].get(method)
                if not m or "missing" in m:
                    lines.append(f"| {r['arm']} | {method} | {r['units']} | – | " + " | ".join("–" for _ in range(2 * len(ks) + 3)) + " |")
                    continue
                t, d = m["transitive"], m["direct"]
                ci = t["ci"].get("recall@10") or t["ci"].get(f"recall@{ks[-1]}") or [float("nan"), float("nan")]
                lines.append(
                    f"| {r['arm']} | {method} | {r['units']} | {100 * r['coverage']['transitive']:.0f}% | "
                    + " | ".join(f"{100 * t[f'recall@{k}']:.1f}" for k in ks)
                    + f" | {t['mrr']:.3f} | [{100 * ci[0]:.0f}, {100 * ci[1]:.0f}] | "
                    + " | ".join(f"{100 * d[f'recall@{k}']:.1f}" for k in ks)
                    + f" | {d['mrr']:.3f} |"
                )
        lines.append("")
    return "\n".join(lines) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--methods", default="euclid,euclid-normfilter,euclid-normfilter-gloss,hit-zeroshot,hit-zeroshot-gloss")
    ap.add_argument("--split", default="test")
    ap.add_argument("--k", default="1,5,10")
    ap.add_argument("--boot", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--md", default=str(HERE.parent / "out" / "recall-at-k.md"))
    ap.add_argument("--only", help="regex on <arm>-<scheme>")
    args = ap.parse_args()
    methods = [m for m in args.methods.split(",") if m]
    ks = [int(k) for k in args.k.split(",")]
    reports = []
    for scheme_path in sorted((HERE / "in").glob("scheme-*.json")):
        slug = scheme_path.stem[len("scheme-"):]
        if args.only and not re.search(args.only, slug):
            continue
        arm, scheme = None, None
        for s in SCHEME_ORDER:
            if slug.endswith("-" + s):
                arm, scheme = slug[: -len(s) - 1], s
                break
        if arm is None:
            continue
        report = evaluate(arm, scheme, methods, args.split, ks, args.boot, args.seed)
        if report is None:
            print(f"{slug}: no units with a {args.split} gold ancestor; skipped")
            continue
        (HERE / "out" / f"recall-{arm}-{scheme}.json").write_text(json.dumps(report, indent=1) + "\n")
        reports.append(report)
        heads = ", ".join(
            f"{m}: R@1 {100 * r['transitive']['recall@1']:.0f} R@10 {100 * r['transitive'][f'recall@{ks[-1]}']:.0f}"
            for m, r in report["methods"].items() if "missing" not in r
        )
        print(f"{slug}: n={report['units']} cov={100 * report['coverage']['transitive']:.0f}% | {heads}")
    if reports:
        Path(args.md).parent.mkdir(parents=True, exist_ok=True)
        Path(args.md).write_text(markdown(reports, methods, ks))
        print(f"wrote {args.md}")


if __name__ == "__main__":
    main()
