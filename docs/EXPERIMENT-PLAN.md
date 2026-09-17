# Experiment plan for article 4 (SKEIN-SKOS-rollup)

Status as of 2026-09-17. The governing plan with rationale, predictions, risks and gold options is
the wiki note `~/work/kpi/dissert/wiki/notes/skein-skos-rollup-paper-plan.md` (sections "Second
measurements" and "Direction after the first measurements"); this file tracks what is to be
measured, against what, and how far each item is. Scoring rules: `docs/ROLLUP-PROTOCOL.md`.
What the code does and exchanges: `docs/CONTRACTS.md`. Measured so far:
`docs/MEASUREMENTS-2026-09-16.md`.

## Claims the paper may make (and may not)

1. Measured soundness and completeness of an LLM-free fold along `skos:broader` against a gold
   hierarchy on an LLM-built vocabulary, per concept scheme, with the cost split between
   construction (tokens, once) and roll-up (milliseconds, zero LLM calls).
2. How much of the fold's quality is decided at construction time: the stored judge edges
   against the same registry with the hierarchy completed at construction (H1 below).
3. Measured negative results: zero-shot hyperbolic ranking, clustering as a parent finder and
   cosine ranking do not add parents; at their best setting they reduce to label stripping.
4. A non-additive counting rule for folded weights (distinct incidents, never sums of children).

Not claimed: a new hierarchy-embedding method, taxonomy induction as such, roll-up across
concept schemes (that is article 3's scheme discovery), identity resolution (article 2), any
statement about hyperbolicity of LLM embeddings beyond the δ values measured here.

## Method matrix and status

Enrichments (vocabulary construction, LLM allowed, one-off, into copies) × roll-up operators
(no LLM, parameter λ):

|            | R0 graph walk | R1 facet | R2 Euclid HAC | R3 ranked parent | R4 hybrid |
|------------|:---:|:---:|:---:|:---:|:---:|
| none       | measured | measured | – | – | `hybrid-facet` accepted by `rollup-eval`, not in the committed outputs |
| E1 `prefLabel: definition` vectors | – | – | measured (`hac`, `hac-constrained`, `hac-constrained-root`) | measured, controls (`hyperbolic-euclid`, `-normfilter[-gloss]`) | measured (`hybrid-hac`, `hybrid-euclid*`) |
| E2 family-hint note | – | planned (note as a stripping hint) | planned (note appended to text) | planned | – |
| E3 HiT ball vectors | – | – | – | measured (`hyperbolic-hit`, `-hit-gloss`) | measured (`hybrid-hit`) |
| H1 completed hierarchy (`<arm>-h1`) | **next** | **next** | – | – | **next** |

Cells marked – are not meaningful (R0 uses edges only; R1 uses labels only). E1 was embedded with
`ollama/embeddinggemma` for all four arms; the cloud encoder is pending budget approval.

## Direction decided 2026-09-16

Roll-up stays LLM-free at query time; the hierarchy is completed at CONSTRUCTION time. Kept as
measured negative results, not pursued as the main line: zero-shot HiT, clustering as a parent
finder, HiT / Poincaré fine-tuning on the ≈ 275 judge edges of one scheme.

## Next experiments, in order

| # | Experiment | Needs | Status |
|---|---|---|---|
| H1 | Forced-choice pass over unparented concepts (Software first, ≈ 500): existing parent, or a new abstract family node (label + definition), or none with a reason. Local `gemma4:26b` through Ollama, writes a copy `<arm>-h1`, prompt hash registered. Then `rollup-eval` on the `-h1` registries | `bin/complete-hierarchy.ts`, `prompts/parent-or-family-v1.md` | not built |
| H2 | Longest token-prefix parent: a concept's parent is the same-scheme concept whose label is its longest token prefix | `src/Rollup/PrefixParentRollup.ts` | not built |
| H3 | Neighbour parent: an orphan inherits the judge-assigned parent of its k nearest E1 neighbours when at least m agree (the only vector method still worth testing) | `src/Rollup/NeighbourParentRollup.ts` | not built |
| H4 | Deterministic edge cleaning before any fold: cycle removal, transitive reduction, label-consistency check | `bin/clean-edges.ts` | not built |
| H5 | E2 family hints as a factor (≈ 800 Software concepts / 40 per call = 20 calls per arm) | `npm run enrich-family-hint` exists | not run |
| H6 | Confidence intervals and paired tests for roll-up rows (BCa over gold edges, Holm) | `bin/stats.ts --rollup <json>` | not built |
| H7 | Non-additive incident counts under a fold (protocol §5) | `bin/rollup-count.ts` | not built |
| H8 | Figures and `docs/CLAIMS.md` rows | `analysis/figures_rollup.py` | not built |

**Success criterion for H1–H4:** completeness on the gold test slice rises from 63–80% toward
100% on Software with soundness not below R0's on the same arm; both Exchange probes pass; the
fold still makes zero LLM calls.

## Open decisions (the author's)

- **Hierarchy gold.** Option A (recommended in the wiki note): extend to `hierarchy-v3` for
  Software plus one attribution scheme, pooled candidates, three-model-family pre-annotation,
  author adjudication, pooled slice reported separately. Option B: an external taxonomy
  (Wikidata-derived, Software only, Ukrainian labels uncovered). Option C: intrinsic scores plus
  an LLM judge validated by κ on about 100 pairs. Until decided, the inherited 398 edge rows are
  the reference and Device / Organization slices are too small to interpret.
- **Reference tables.** The direction's model-free fallback "facet + reference tables" (CPE,
  Public Suffix List, ISO 3166) contradicts the earlier project position that no external code
  tables are maintained in code (wiki: `isa-vs-partof-flags` vs `merge-granularity`). `FacetRollup`
  already vendors an approximate eTLD+1 table. To be settled explicitly and stated in the paper.
- **B2 replicate.** The baseline table uses B2 r3 while the other cells use r1 (protocol §3).
  Whether a cell-level claim uses all three replicates with the seed range, as SKEIN-R did.
- **Headline contract.** All edges or `broaderInstantial` only.
- **Exchange probe wording.** The loose probe passes vacuously on chain-merged registries; the
  paper should define the strict probe and consider the guard arms (`t-a2guard2-*`) as inputs.

## Known weak spots

`stripQualifiers` was written against the Software labels of the four arms and awaits a dev-split
audit of false strips (for example `Cisco Firepower 1000 Series` in Device); Device has 2
test-test units; the eTLD+1 table is a vendored approximation; HiT is English-only while Sector,
Government Body and Organization carry Ukrainian labels; `GraphWalkRollup` (R0, the paper's
baseline) is the only operator without its own test file; the `LlmClient` retry is opt-in and
used by the enrichments only, SKEIN-R arms keep single-attempt semantics by design.

## Work packages done (2026-09-16)

WP2 fork, hygiene, contracts, R0 / R1, metrics, CLIs, sidecar, baseline JSON. WP3 E1 vectors for
the four arms, R2, dev-split outputs, geometry diagnostics. WP4 E3 vectors, R3 with Euclidean
controls, R4. WP5 (statistics wiring, figures, claims rows) is open as H6–H8 above.
