# analysis/hyperbolic — Python sidecar (E3 hyperbolic vectors, geometry diagnostics)

Everything the TypeScript side cannot do cheaply: loading a Hierarchy-Transformer checkpoint,
Poincaré-ball arithmetic, δ-hyperbolicity. It talks to the repo only through files:

| direction | file | written by |
|---|---|---|
| in  | `in/scheme-<arm>-<scheme>.json`                           | `npm run export-scheme -- --run <arm> --category <X>` |
| in  | `in/vectors-<arm>-<scheme>-<provider>-<model>.jsonl`     | `npm run embed-scheme -- --run <arm> --category <X>` (E1, Euclidean) |
| out | `in/vectors-<arm>-<scheme>-hit-<model>.jsonl`            | `hit_zeroshot.py --scheme <arm>-<scheme>` (E3, ball points) |
| out | `out/candidates-<arm>-<scheme>-hit-zeroshot-0.json`      | `hit_zeroshot.py --scheme <arm>-<scheme>` → R3 `hyperbolic-hit` |
| out | `in/vectors-<arm>-<scheme>-hit-gloss-<model>.jsonl`, `out/candidates-<arm>-<scheme>-hit-zeroshot-gloss-0.json` | `hit_zeroshot.py --scheme <arm>-<scheme> --text text` → R3 `hyperbolic-hit-gloss` |
| out | `out/candidates-<arm>-<scheme>-euclid-0.json`, `…-euclid-normfilter-0.json`, `…-euclid-normfilter-gloss-0.json` | `euclid_candidates.py --scheme <arm>-<scheme>` → R3 `hyperbolic-euclid[-normfilter[-gloss]]` |
| out | `out/recall-<arm>-<scheme>.json`, `../out/recall-at-k.md` | `recall_report.py` (recall@k / MRR of every candidates file vs gold) |
| out | `out/geometry-<arm>-<scheme>.json`                       | `geometry.py --bundle <arm>-<scheme>` |
| out | `out/env.json`                                           | every `hit_zeroshot.py` run (python/torch/model sha/device) |

`<arm>` is the run directory's basename (`t-a1-flash-gembed2-r1-35bc1387d473`) and `<scheme>` is
`schemeSlug(category)` from `src/Rollup/schemeIo.ts` (`Government Body` → `government-body`); the
`--scheme` argument of every script is the pair `<arm>-<scheme>`.
`in/` and `out/` contents are generated and NOT committed (see `.gitignore`), except `out/env.json`
and the smoke transcript, which document the environment a reported number came from.

## Setup

```
./bootstrap.sh            # uv + Python 3.12 if uv is installed, else python3 -m venv (3.12+)
./bootstrap.sh --cpu      # CPU-only torch wheels (enough for the smoke and for MiniLM-sized models)
```

No `uv` on the 2026-09-16 box and no Python 3.12: the fallback created `.venv` on Python 3.14
with torch 2.14 CPU wheels (≈ 6 min). `out/env.json` records what actually ran.

## Scripts

- `poincare_ops.py` — möbius addition, geodesic distance, distance to the origin, exp/log maps at
  the origin, boundary projection; curvature `c` explicit everywhere. `python poincare_ops.py`
  runs the self-tests (identities, symmetry, triangle inequality, exp/log inverse, curvature scaling).
- `hit_zeroshot.py --smoke` — loads `Hierarchy-Transformers/HiT-MiniLM-L12-WordNetNoun` through
  sentence-transformers, treats the outputs as points of the ball with `c = 1/dim` (= 1/384), and
  scores 12 hand-written Software pairs with `score = -(dist(c,p) + w·(norm0(p) − norm0(c)))`.
  Prints score, distance, both norms and whether the parent is nearer the origin.
  `--scheme <arm>-software [--topk 10] [--w 0.5] [--text pref|text]` embeds a whole exported
  scheme (prefLabel by default) and writes the vectors + top-k norm-ordered parent candidates for R3.
- `euclid_candidates.py --scheme <arm>-<scheme>` — top-k parents by cosine on the E1 vectors, plain
  and restricted to smaller-HiT-norm parents (the control that isolates the norm-order signal).
- `recall_report.py` — recall@{1,5,10}, MRR, coverage of every candidates file against the gold
  hierarchy (test-test edges, transitive and direct credit), percentile bootstrap (1000, seed 42).
- `geometry.py --self-test` / `--vectors … --metric cosine|euclid|poincare [--tree scheme.json]` /
  `--bundle <arm>-<scheme>` — sampled four-point δ-hyperbolicity and tree distortion (see the module
  docstring for the definitions); `--bundle` runs E1, HiT and random baselines in one go. The
  self-test checks δ = 0 on a random tree metric and δ > 0 on a grid.

Nothing here calls an LLM or a paid API; the HiT checkpoint is downloaded once from the Hugging
Face Hub (≈ 130 MB) into `~/.cache/huggingface`.
