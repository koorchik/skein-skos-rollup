# skein-skos-rollup

Experiment repository for the **SKEIN-SKOS-rollup** paper (article 4 of the series): *LLM-free
roll-up aggregation of concepts inside one SKOS concept scheme*, over the frozen registries the
SKEIN-R paper produced.

Status (2026-09-17): **first measurements done, no reportable claim frozen.** Operators R0–R4 are
implemented and scored on four SKEIN-R arms × five schemes without a single LLM call
([`docs/MEASUREMENTS-2026-09-16.md`](docs/MEASUREMENTS-2026-09-16.md)). The reading: stored judge
edges fold soundly but incompletely (Software, test split: 81–90% sound, 63–80% complete at λ = 0), label
stripping is sound and almost never complete, and every vector operator (Euclidean HAC, cosine
ranking, zero-shot hyperbolic ranking) does best when it does nothing beyond stripping. The
decided direction is therefore to **complete the hierarchy at vocabulary-construction time** and
keep the fold deterministic; the construction-time pass is not built yet
([`docs/EXPERIMENT-PLAN.md`](docs/EXPERIMENT-PLAN.md)). `docs/CLAIMS.md` is still an empty template.

## The question

A flat registry answers "how many mentions of *Microsoft Office 2010*". An analyst wants "how
many mentions of Office at product granularity", or of Windows, or of the whole Microsoft
family: a different answer for every choice of fold. SKEIN-R stores typed `skos:broader` edges
(ISO 25964 BTG / BTP / BTI) and folds along them at query time; this paper asks how well that
fold, and cheaper LLM-free alternatives, recover the gold hierarchy, per scheme, at what cost, and
how much of that quality is decided by what the LLM wrote into the vocabulary at construction.

Two stages, with a hard line between them:

1. **Vocabulary construction** (LLM allowed; done once, offline). SKEIN-R built the registries.
   Optional enrichments write into a *copy* of a registry, never into the frozen one:
   E1 `prefLabel: definition` Euclidean vectors (`npm run embed-scheme`), E2 an LLM family-hint
   note per concept (`npm run enrich-family-hint`, not run yet), E3 Poincaré-ball vectors from a
   Hierarchy Transformer, zero-shot (`analysis/hyperbolic/hit_zeroshot.py`). Planned: H1, a
   forced-choice "existing parent or abstract family" pass over unparented concepts.
2. **Roll-up** (NO LLM calls, ever): a deterministic fold with one continuous parameter λ, scored
   per scheme against the gold hierarchy (`npm run rollup-eval`). Roll-up cost is reported in
   milliseconds with zero LLM calls; construction cost in tokens.

### Operators

| id | operator | source | λ |
|---|---|---|---|
| R0 | graph walk over stored `skos:broader` edges (highest-similarity parent per hop, optional ISO 25964 contract `broaderInstantial`) | `src/Rollup/GraphWalkRollup.ts` | similarity brake |
| R1 | facet stripping: deterministic family from the label (versions and editions for Software and Device, eTLD+1 for Domain, identity elsewhere) | `src/Rollup/FacetRollup.ts` | none |
| R2 | Euclidean average-linkage clustering over E1 vectors, on R1 families; medoid target; `hac-constrained` adds judge edges as must-links, `hac-constrained-root` targets the judge-edge root of each cluster | `src/Rollup/HacRollup.ts` | linkage cutoff |
| R3 | ranked parent from a candidates file, on R1 families: `hyperbolic-hit[-gloss]` (HiT ball, norm-ordered), `hyperbolic-euclid` (cosine control), `hyperbolic-euclid-normfilter[-gloss]` (cosine plus HiT norm filter) | `src/Rollup/HyperbolicRollup.ts` | distance bound / cosine floor |
| R4 | hybrid: R0 (λ = 0) where a judge edge exists, an R1 / R2 / R3 fallback elsewhere | `src/Rollup/HybridRollup.ts` | the fallback's |

R1 is a dependency of R2 and R3: version labels enter clustering as families, not one by one.

## Finding your way around

- **What is decided and why, predictions, risks, gold options:** the governing plan lives in the
  dissertation wiki, `~/work/kpi/dissert/wiki/notes/skein-skos-rollup-paper-plan.md`; related work
  to engage with: `~/work/kpi/dissert/wiki/notes/skein-rollup-reading-map.md`.
- **What has been measured:** [`docs/MEASUREMENTS-2026-09-16.md`](docs/MEASUREMENTS-2026-09-16.md);
  raw outputs and their index in [`analysis/out/README.md`](analysis/out/README.md).
- **What is planned, in what order, and what is still open:** [`docs/EXPERIMENT-PLAN.md`](docs/EXPERIMENT-PLAN.md).
- **Scoring rules fixed before any reported number:** [`docs/ROLLUP-PROTOCOL.md`](docs/ROLLUP-PROTOCOL.md)
  (with the inherited [`docs/statistical-protocol.md`](docs/statistical-protocol.md)).
- **How to run anything:** [`docs/RUNBOOK.md`](docs/RUNBOOK.md).
- **Operator semantics, file and JSON contracts:** [`docs/CONTRACTS.md`](docs/CONTRACTS.md);
  Python sidecar: [`analysis/hyperbolic/README.md`](analysis/hyperbolic/README.md).
- **Claims–evidence matrix (empty until numbers are frozen):** [`docs/CLAIMS.md`](docs/CLAIMS.md).
- **Paper vocabulary versus code vocabulary:** [`docs/TERMINOLOGY-ALIGNMENT.md`](docs/TERMINOLOGY-ALIGNMENT.md).
- **Why judge-written hierarchy edges are incomplete** (the premise of the planned H1 pass):
  [`docs/BALLOT-COMPOSITION-2026-08-22.md`](docs/BALLOT-COMPOSITION-2026-08-22.md), an inherited
  SKEIN-R research note; the run directories it cites live in the development repository.

## Layout

- `src/Rollup/` — operator contract (`types.ts`), R0–R4, `averageLinkage.ts`, file contracts shared
  with the sidecar (`schemeIo.ts`). `src/Evaluation/rollupMetrics.ts` — sound% / complete% /
  denominator, B-cubed and ARI against the gold-projected partition, AUPC, the named probes.
- `bin/rollup-eval.ts`, `bin/export-scheme.ts`, `bin/embed-scheme.ts`, `bin/enrich-family-hint.ts` —
  the four roll-up CLIs. Every SKEIN-R CLI (`evaluate`, `fold`, `stats`, `export-skos`, `view`, …)
  still works.
- `analysis/hyperbolic/` — Python sidecar (HiT zero-shot, cosine candidates, recall report,
  δ-hyperbolicity); `analysis/out/` — committed outputs; `analysis/figures.py` — the inherited
  figure script, kept for its sizing and font contract (3.0 in wide, STIX, no tight bbox, one
  panel per figure); its plots are SKEIN-R's.
- `prompts/` — every LLM instruction, hashed in `manifest.json`; the only article-4 prompt so far
  is `family-hint-v1` (see `prompts/README.md`).
- `runs/experiments/` — the 50 frozen SKEIN-R arms, the INPUT of this paper (which four are read
  today: `runs/experiments/README.md`). The only registries this repository ever writes are
  copies: `<arm>-e2/` (family hints), `<arm>-h1/` (completed hierarchy).
- `gold/` — the frozen SKEIN-R gold table; its typed hierarchy edges are the roll-up reference
  (see `gold/README.md`). `data/` — the frozen corpus and extractions, unchanged.

Quick start: `npm install` (Node ≥ 22; ts-node, no build step), then
`npm run typecheck && npm test` (812 tests) and the first command of `docs/RUNBOOK.md`.

## Provenance

Fork of [`skein-resolver`](https://github.com/koorchik/skein-resolver), the SKEIN-R publication
artifact. The inherited history is the single commit `23cdfc2`; `skein-resolver` is also
configured as the local `upstream` remote and is never modified from here. The SKEIN-R claims
ledger and README remain readable with `git show 23cdfc2:docs/CLAIMS.md` and
`git show 23cdfc2:README.md`; the SKEIN-R experiment browser, figure outputs and reproduction
runbook were not kept (they belong to `skein-resolver`).

Series: (1) V. Turskyi, *A Formal Model for Constructing Sensitive Data Graphs from Cyber Reports
using Large Language Models*, TACS 7(2), 2025, batch pipeline with a hand-written schema;
(2) SKEIN-R, streaming identity and typed hierarchy within fixed concept schemes; (3) SKEIN-E
(`~/work/kpi/skein-extractor`), discovery of the schemes and relation types; (4) this repository,
aggregation along `skos:broader` without an LLM.
