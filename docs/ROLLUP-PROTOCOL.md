# Roll-up evaluation protocol (SKEIN-SKOS-rollup)

Fixed before any reported number is produced. Inherits the SKEIN-R statistical protocol
(`docs/statistical-protocol.md`) where it applies; the roll-up-specific rules are below.

## 1. Units and slices

- **Unit of scoring**: a canonical concept of one scheme, mapped to its gold cluster by surface
  majority (`mapCanonicalsToGold`). Edges are scored between gold clusters, never between labels.
- **Per scheme, always.** Schemes differ in what a "parent" means (version → product for
  Software, sub-sector → sector for Sector, unit → ministry for Government Body); pooling them
  would average incommensurable folds. The **primary slice is Software** (209 of 398 gold edge
  rows; the only scheme where all three of R0's contracts, R1's stripping and the enrichments
  apply). Sector, Government Body, Organization and Device are secondary; Domain carries no gold
  edges and is reported only as a B-cubed sanity check for R1.
- **Split discipline.** Gold clusters carry `split ∈ {dev, test}`. A gold edge is *test-test*
  when both endpoint clusters are test, *dev-dev* when both are dev, *cross* otherwise.
  - **Reportable**: test-test edges (`rollup-eval --split test`, the default).
  - **Dev only for tuning**: λ, linkage cutoffs, `w`, prompt text, stripping rules are chosen on
    dev-dev edges (`--split dev`); tuning never touches test. Cross edges are used by neither.
  - `--hierarchy-all-splits` exists for iteration (it is what SKEIN-R's `evaluate` did for
    hierarchy) and never backs a reported number.

## 2. Metrics (`src/Evaluation/rollupMetrics.ts`)

- **sound%** — the fold target's gold cluster is the canonical's own cluster or one of its gold
  ancestors (transitive over `isa`/`part-of`). A canonical left in place is sound.
- **complete%** — the target's gold cluster is a topmost gold ancestor.
- **denominator** — canonicals whose gold cluster has at least one gold ancestor; roots cannot
  be folded rightly or wrongly. Reported next to every percentage.
- **B-cubed F1 and ARI** of the fold partition vs the gold-projected partition (every gold
  cluster rolled to its topmost ancestor; lexicographically smallest root on multi-parent
  clusters), over all gold-mapped canonicals of the scheme.
- **AUPC** — area under sound% vs number of fold targets across the λ sweep, x rescaled to
  [0, 1]; one number per (arm, operator, scheme) for the sweep figure.
- **Probes** (named, binary): `exchangeFamily` — every `Microsoft Exchange Server…` canonical
  folds to one target; `windowsNotOffice` — no `Windows…` canonical folds under an `Office`
  target. Both are reported per arm; a failing probe is a finding, not a filtered-out case.
- `targetUnmapped` (target has no gold cluster) is reported, never silently dropped.

## 3. Uncertainty

- **BCa bootstrap over gold edges, seed 42, 10 000 resamples**, 95 % — `src/Evaluation/bootstrap.ts`
  (`bootstrapCI`, `mulberry32(42)`). The resampling unit is the gold edge (equivalently the
  canonical in the denominator), never the scheme.
- Paired comparisons between operators on the same arm × scheme: paired permutation test,
  10 000 permutations, Holm correction within the family of contrasts named in `CLAIMS.md`.
- Replicates: the four factorial cells contribute one arm each for the baseline table
  (r1, r1, r1, r3 — the r3 of B2 is used because the paper's headline r1 has a documented
  transplant prefix in r2); a claim about a *cell* uses all three replicates and reports the
  seed range, as in SKEIN-R.

## 4. Cost accounting

- **Build stage** (SKEIN-R + enrichments): tokens and calls, read from run cards (`cost` block)
  and from the enrichment CLIs' recorded usage — never from logs. E1 cost is encoder calls and
  wall-clock ms; E2 is LLM tokens; E3 is encode seconds and the model sha (`out/env.json`).
- **Roll-up stage**: wall-clock milliseconds per fold (`foldMs` in every `rollup-eval` row) with
  **zero LLM calls** — the operators cannot call one (no client is in scope of `fold`).

## 5. Non-additive weight rule

Mention counts under a fold are **distinct-incident counts recomputed from artifacts**
(the per-document artifacts and decision logs of the source run), never sums of per-concept
counts: two labels of one concept in the same report are one incident, and a folded family's
count is the number of distinct (document, family) incidents. Summing children's counts
double-counts every report that mentions two siblings. Any aggregate figure in the paper is
produced by the recomputation path, and the code that does it is cited in `CLAIMS.md`.

## 6. What is forbidden

- Any LLM call inside a roll-up operator or inside `rollup-eval`.
- Editing a frozen registry in place (`runs/experiments/<arm>/registry.json`); enrichments write
  to `<arm>-e2/` copies only.
- Reporting `--hierarchy-all-splits` or `--split dev` numbers as results.
- Choosing λ on the test slice. The reported λ for each operator is the dev-selected one plus
  the full sweep curve (AUPC), so the reader sees both the chosen point and its neighbourhood.
