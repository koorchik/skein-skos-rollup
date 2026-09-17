# Gold table (FROZEN)

**`gold-aliases-v2` — 3,201 clusters / 398 hierarchy edge rows (392 distinct cluster pairs) /
4,069 NIL labels.** This is a byte-identical, read-only copy of the SKEIN-R evaluation reference
(`skein-resolver/gold/`). It is never edited here: any change would silently fork the gold version
that the SKEIN-R claims are scored against. New annotation gets a new file name.

## Role in article 4 (SKEIN-SKOS-rollup)

- **The typed hierarchy edges are the roll-up reference.** 398 edge rows between gold clusters:
  232 `part-of`, 164 `isa`, 2 `renamed-to`. By scheme (the edge's `category`): Software 210,
  Sector 117, Government Body 33, Organization 16, Device 11, Infrastructure 6, HackerGroup 4,
  Country 1. Sound% and complete% are computed over the transitive ancestry of these edges
  (`src/Evaluation/rollupMetrics.ts`, `goldAncestry`).
- **Split discipline.** An edge is test-test when both endpoint clusters are test clusters:
  278 test-test (Software 154, Sector 75, Government Body 29, Organization 9, Infrastructure 6,
  Device 2, HackerGroup 2, Country 1), 110 cross, 10 dev-dev. Only test-test edges back a
  reported number; dev-dev edges select λ; cross edges are used by neither
  (`docs/ROLLUP-PROTOCOL.md`). With 10 dev-dev edges, dev selection is weak: say so in the paper.
- **Known biases for this use.** Rows tagged `rule: "pooled-adjudication"` were adjudicated from
  candidates pooled across SKEIN-R system outputs, the same family of registries that is folded
  here, so completeness against them is biased upward for
  stored judge edges (R0); `scripts/gold-slice.py --exclude-rule pooled-adjudication` gives the
  independent-provenance panel. The hierarchy is shallow and partial: most concepts have no gold
  ancestor and fall outside every denominator.
- **What it lacks.** No gold for minted abstract family nodes, no depth or rung labels, Device
  and Organization too small to interpret, no second annotator. The extension to
  `hierarchy-v3` (Software plus one attribution scheme) is an open decision
  (`docs/EXPERIMENT-PLAN.md`); it would be a new file built with the protocol of
  `docs/GOLD-TABLE.md`.

Everything below is the unchanged SKEIN-R description of the table.

Built in the source repo (`llm-analysis-of-text-data/llm-basic-framework`) by the gold pipeline
documented in `docs/GOLD-TABLE.md`; the builder itself is deliberately NOT carried into this
paper repo — gold ships frozen. Provenance artifacts (LLM-ensemble annotation caches, worksheet)
remain in the source repo.

## Provenance

- Clusters and NIL labels: single-expert adjudication over LLM-proposed candidate pairs, with
  LLM-ensemble cross-annotation for agreement measurement (per-model Cohen's κ vs the expert
  .848/.848/.906, ensemble-majority .943, Fleiss κ .603 — recorded in the `models`/`sources`
  fields of the clusters that carry votes).
- Hierarchy edges: expert-adjudicated typed relations (`isa` / `part-of` / `renamed-to`) with
  per-edge `rule` provenance. Rows tagged `rule: "pooled-adjudication"` were adjudicated from
  candidate relations pooled across system outputs, blind to system attribution; because that
  candidate pool is drawn from the evaluated systems, edge *recall* against this panel can favor
  them — the paper discusses this in threats to validity and bounds it with a
  provenance-based sensitivity analysis (`scripts/gold-slice.py --exclude-rule
  pooled-adjudication` reproduces the independent-provenance panel).
- `Domain` category (internet domain names): excluded from pair proposal (57% of surfaces) and carries no hierarchy
  edges; identity metrics are primarily scored on the Domain-excluded universe
  (`docs/statistical-protocol.md`).

## Files

| file | what it is |
|---|---|
| `gold.json` | The frozen table: `version`, `inputContentHash`, clusters (with `stratum` a/b/c and `split` dev/test), typed hierarchy edges (`isa` / `part-of` / `renamed-to`, with evidence and provenance `rule`), NIL labels |
| `gold-obf.json` | Pseudonymized twin (per-alphabet letter-substitution derangement over HackerGroup/Software surfaces, seed pinned in `scripts/make-obfuscated.py`) for the memorization ablation |
| `inventory.json` | All 3,360 unique `(category, surface)` pairs from the frozen corpus — the annotation universe |
| `pairs-meta.json` | How candidate pairs were proposed (proposer settings, thresholds) |
| `policy-inferred.md` | The annotation policy inferred and pinned before labelling |
| `subsets/dev-software-22.txt` | The 22-document dev subset every fast-iteration number is measured on |
| `subsets/country-14.txt` | Country-category subset (all multi-member Country clusters are test-split) |

## Integrity anchors

- `gold.json.inputContentHash` = `37d57e47…` pins the **frozen gpt-5 extractions**
  (`data/extractions/gpt-5/`, 204 files). Verify: `npm run hash-input -- data/extractions/gpt-5`.
- Scoring discipline: `npm run evaluate` defaults to `--split test`; dev numbers require
  `--allow-dev` and are never reportable as absolutes. Strata are never averaged.

## Known limitations (stated in the paper's threats to validity)

- Stratum (d) — post-knowledge-cutoff designators — is empty: positive results on strata a–c do
  not separate model knowledge from method quality.
- Stratum (c) is not sourced from external authorities (MITRE ATT&CK / Wikidata).
- Single-expert adjudication with LLM-ensemble cross-annotation; no second human annotator.
- Edge rows from pooled system candidates make edge recall a lower-bound-biased-upward measure
  for the pooled systems (precision is unaffected).
