# CLAIMS — the claims–evidence matrix (SKEIN-SKOS-rollup paper)

Every claim, table row and figure in the paper maps to its evidence here; this file doubles as
the paper's reproducibility statement. **Empty template**: rows are filled only when a number is
frozen for the manuscript, and a row is never edited afterwards without bumping the paper version.

The SKEIN-R ledger this repository inherited is preserved in git history
(`git show 23cdfc2:docs/CLAIMS.md`); the SKEIN-R runs under `runs/experiments/` are INPUT here.

## Canonical scoring command

`rollup-eval` = `npm run rollup-eval -- --gold gold/gold.json --split test --lambda-sweep
0,0.5,0.7,0.8,0.85,0.9,0.95 --run <dir> [--run …] --operator <ops> [--contract <c>] [--category <X>]`

- `--split test` (default) is the reportable slice: gold edges whose BOTH endpoint clusters are
  test clusters (`docs/ROLLUP-PROTOCOL.md`). `--hierarchy-all-splits` is for iteration only and
  never backs a reported number.
- Per-scheme reporting: `--category` one scheme at a time; the primary slice is **Software**.
- Confidence intervals: BCa bootstrap over gold edges, seed 42, via `bin/stats.ts` machinery
  (`src/Evaluation/bootstrap.ts`) — wiring for roll-up rows TBD (`docs/PLAN.md`).
- Run dirs live in `runs/experiments/`; the commit is the repo commit containing the output file
  under `analysis/out/`.

## Baselines R0 / R1 (paper Table TBD)

| claim | runs | command | status |
|---|---|---|---|
| R0 graph walk, all contracts, λ sweep, Software | t-{a1,a2,b1}-*-r1, t-b2-*-r3 | rollup-eval --operator graph --contract all --category Software → analysis/out/rollup-r0-r1.json | TBD |
| R0 broaderInstantial contract (versions only) | same | rollup-eval --operator graph --contract broaderInstantial | TBD |
| R1 facet stripping, per scheme | same | rollup-eval --operator facet | TBD |
| AUPC per arm × scheme | same | `aupc` block of the same JSON | TBD |
| Probes exchangeFamily / windowsNotOffice | same | `probes` field per row | TBD |

## Enriched operators R2 / R3 / R4 (paper Table TBD)

| claim | runs | command | status |
|---|---|---|---|
| E1 vectors (encoder, dims, cost) | analysis/hyperbolic/in/vectors-*.jsonl | export-scheme + embed-scheme | TBD |
| E2 family hints (tokens, calls, coverage) | runs/experiments/<arm>-e2/ | enrich-family-hint | TBD |
| E3 HiT zero-shot vectors (model sha, env) | analysis/hyperbolic/out/env.json | hit_zeroshot.py --scheme | TBD |
| R2 HAC on R1 families | TBD | rollup-eval --operator hac | TBD |
| R3 hyperbolic norm-ordered parent | TBD | rollup-eval --operator hyperbolic | TBD |
| R4 hybrid | TBD | TBD | TBD |

## Geometry (paper §TBD)

| claim | source | status |
|---|---|---|
| δ-hyperbolicity of E1 vs E3 vectors per scheme | geometry.py --vectors … --metric cosine|poincare | TBD |
| tree distortion vs the registry's broader graph | geometry.py --tree in/scheme-<x>.json | TBD |

## Cost accounting (paper Table TBD)

| claim | source | status |
|---|---|---|
| Build stage: tokens/calls per arm (SKEIN-R run cards, `cost` block) | runs/experiments/*/run-card.json | TBD |
| Enrichment stage: E1 embed ms, E2 tokens, E3 encode s | CLI stdout captured under analysis/out/ | TBD |
| Roll-up stage: ms per fold, zero LLM calls | `foldMs` per row in rollup-eval JSON | TBD |

## Statistics

| claim | source | status |
|---|---|---|
| BCa CIs over gold edges (seed 42), paired permutation, Holm | src/Evaluation/bootstrap.ts (protocol: docs/ROLLUP-PROTOCOL.md) | TBD |

## Figures

TBD — regenerate offline from `analysis/out/rollup-*.json` (script TBD, `analysis/figures_rollup.py`).
