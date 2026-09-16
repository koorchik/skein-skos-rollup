# PLAN — method matrix, dependencies, contracts

## Method matrix

Enrichments (vocabulary construction, LLM allowed, one-off, into copies) × roll-up operators
(no LLM, parameter λ):

|            | R0 graph walk | R1 facet | R2 Euclid HAC | R3 ranked parent | R4 hybrid |
|------------|:---:|:---:|:---:|:---:|:---:|
| none       | ✔ done (`GraphWalkRollup`) | ✔ done (`FacetRollup`) | – | – | ✔ `hybrid-facet` |
| E1 `name: gloss` vectors | – | – | ✔ done (`HacRollup`: `hac`, `hac-constrained`, `hac-constrained-root`) | ✔ done, controls (`hyperbolic-euclid`, `hyperbolic-euclid-normfilter[-gloss]`) | ✔ `hybrid-hac`, `hybrid-euclid` |
| E2 family-hint note | – | note as a stripping hint (R1′) | note appended to text (E1+E2) | note appended to text | – |
| E3 HiT ball vectors | – | – | – | ✔ done (`hyperbolic-hit` on prefLabel, `hyperbolic-hit-gloss` on `prefLabel: definition`) | ✔ `hybrid-hit` |

Cells marked – are not meaningful (R0 uses edges only; R1 uses labels only). Measured on the four
baseline arms × five gold schemes: `analysis/out/rollup-r2-r4.{json,txt}` (test-test edges) and
`rollup-r2-r4-dev.{json,txt}` (dev-dev, for λ selection only); ranker recall `analysis/out/recall-at-k.md`.

### Operator semantics as implemented (WP3/WP4)

- **R2 `HacRollup`** — R1 first; each R1 target (family canonical, `facet:` node, or an unfamilied
  concept) is one representative whose vector is the L2-normalised centroid of its members' E1
  vectors; `averageLinkage` (Lance–Williams) at cutoff λ over the representatives; a cluster's target
  is its **medoid** (highest mean cosine to the rest; ties → shortest label → lexical); R1 members
  inherit their representative's target. `constrained: true` pre-merges every judge edge (any type)
  as a must-link. Sweep λ ∈ {0.99, 0.97, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7}. Consequence worth knowing:
  a must-link cluster contains the true parent, and the medoid rule then folds the PARENT onto a
  child-ish centre, which the sound% metric scores as unsound for the parent; `hac-constrained` is
  therefore far below `hac`. `hac-constrained-root` replaces the medoid by the cluster's judge-edge
  root (no outgoing judge edge inside the cluster; ties → highest in-degree → medoid rule), which
  makes the connected part behave like R0 at λ = 0 and leaves the medoid rule for edge-free clusters.
- **R3 `HyperbolicRollup`** — reads a ranked-parent file (`candidatesPath`, `method`), R1 first; for
  every concept whose R1 target is itself, the best candidate that clears λ (`hit`: geodesic
  distance ≤ λ, ∞ = no bound; `euclid*`: cosine ≥ λ), resolved through R1 to its family; then a walk
  along the reached node's own best candidate while the origin-norm strictly decreases, ≤ 4 hops,
  cycle-guarded (`hit`, `euclid-normfilter`; plain `euclid` is one hop). Sweeps: HiT
  {2, 4, 6, 8, 10, 12, ∞}; cosine {0.99, 0.97, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7}. `-gloss` variants
  (`hyperbolic-hit-gloss`, `hyperbolic-euclid-normfilter-gloss`) use the HiT run on the same
  `prefLabel: definition` text E1 embeds (`hit_zeroshot.py --text text`), removing the input confound.
- **R4 `HybridRollup`** — R0 at λ = 0 (every edge of the contract followed to the top) where the
  concept has a judge edge, the fallback operator (R1/R2/R3, with the swept λ) elsewhere; the
  fallback runs on the whole scheme, so its abstract nodes pass through even when R0 took some of
  their members. `--operator hybrid-<fallback>`, contract from `--contract`.
- **Probes** — `exchangeFamily` (loose: one target) and `exchangeFamilyStrict` (that target's
  label contains `Exchange`); both are reported (`exch` / `exch!` columns).

## Dependencies

- **R1 → R2, R3.** Version and edition labels are folded to families FIRST; clustering operates
  on family representatives (the family's canonical when it exists, else the abstract node's
  label / the member centroid). Otherwise `Office 2010` and `Office 2013` occupy the cluster
  budget that should separate `Office` from `Windows`.
- **E1 → R2.** `export-scheme` then `embed-scheme`; vectors keyed by the export's `text`.
- **E3 → R3.** `export-scheme` then `hit_zeroshot.py --scheme <slug>`; R3 reads
  `out/candidates-<scheme>-hit-zeroshot-0.json`.
- **E2 → R1′ / E1+E2.** `enrich-family-hint` writes `concept.note`; `export-scheme` on the
  `<arm>-e2` copy carries the note into `text` (planned: `text = "prefLabel (note): definition"`).
- **R4** composes: R0 where a contract edge exists, the enriched operator elsewhere; λ is R0's.

## JSON contracts

**File naming.** Every sidecar file is qualified by the arm so the four baseline arms never collide
on one scheme: `<arm>` is the run directory's basename (`t-a1-flash-gembed2-r1-35bc1387d473`),
`<scheme>` is `schemeSlug(category)` (`government-body`), and the Python `--scheme` argument is the
pair `<arm>-<scheme>` (`armSchemeSlug` in `src/Rollup/schemeIo.ts`). Paths: `schemeExportPath(run,
category)`, `vectorsPath(run, category, provider, model)`, `candidatesPath(run, category, method)`.

`analysis/hyperbolic/in/scheme-<arm>-<scheme>.json` (`bin/export-scheme.ts`, type `SchemeExport`):
```
{ run, category,
  concepts: [{ prefLabel, labels: [surfaces], definition, text }],   // text = "prefLabel: definition" | prefLabel
  edges:    [{ narrower, broader, type, similarityScore, decision }],
  goldMap:  { prefLabel: clusterId },
  goldEdges:[{ fromClusterId, toClusterId, kind, split }] }            // split = test | dev | cross
```

`analysis/hyperbolic/in/vectors-<arm>-<scheme>-<provider>-<model>.jsonl` (`bin/embed-scheme.ts`,
and `hit_zeroshot.py` with provider `hit`): one line per text, `{ k, t, v }` — the embeddings
cache line shape (`k = sha256(JSON.stringify([model, text]))`).

`analysis/hyperbolic/out/candidates-<arm>-<scheme>-<method>-<seed>.json` (`hit_zeroshot.py` for
`hit-zeroshot`; `euclid_candidates.py` for `euclid` and `euclid-normfilter`; seed 0; top-10):
```
{ model, scheme, method?, w?, topk, text, curvature,
  rows: [{ child, candidates: [{ parent, score, dist, normChild, normParent }] }] }
```
`hit-zeroshot`: `score = -(dist + w·(norm(p) − norm(c)))`, parents restricted to a smaller HiT norm
than the child; `hit-zeroshot-gloss` is the same on `prefLabel: definition` (vectors in
`in/vectors-<arm>-<scheme>-hit-gloss-<model>.jsonl`), `euclid-normfilter-gloss` the cosine control
filtered by the gloss-HiT norms. `euclid`: `score` = cosine on the E1 vectors, `dist = 1 − cos`, no restriction;
`euclid-normfilter`: the same ranking restricted to smaller-HiT-norm parents (the control that
isolates the norm order). `normChild`/`normParent` are HiT norms in all three files (null without HiT).

`analysis/hyperbolic/out/recall-<arm>-<scheme>.json` + `analysis/out/recall-at-k.md`
(`recall_report.py`): recall@{1,5,10}, MRR (transitive-ancestor and direct-parent credit), coverage,
95 % percentile bootstrap over units (1000 resamples, seed 42), test-test edges.

`analysis/hyperbolic/out/geometry-<arm>-<scheme>.json` (`geometry.py --bundle`): δ-hyperbolicity
and tree distortion for E1 (cosine, euclid), HiT (poincare, cosine) and two random baselines.

`bin/rollup-eval.ts --out` JSON: `{ generatedAt, gold, split, lambdaSweep, command, rows, aupc }`
where each row is `{ run, operator, contract, category, lambda, lambdaLabel, split, sound, complete,
denominator, soundPct, completePct, goldMapped, canonicals, targetUnmapped, targets, bcubedP,
bcubedR, bcubedF1, ari, probes, edgesUsed, abstractNodes, foldMs }` and each `aupc` entry is
`{ run, operator, contract, category, aupc, points: [{ lambda, targets, soundPct }] }`.

`RollupOperator.fold({ registry, category, vectors?, lambda }) → { target: Map<canonical, target>,
abstractNodes: [{ id, label, members }], edgesUsed }` (`src/Rollup/types.ts`).

## Work packages

- WP2 (this skeleton): fork, hygiene, contracts, R0/R1 + metrics + CLIs, sidecar, baseline JSON. Done.
- WP3: E1 embed for the four arms (ollama/embeddinggemma), R2, dev-split λ selection, geometry
  diagnostics. Done (gemini vectors still pending budget approval).
- WP4: E3 vectors + R3 (+ Euclidean controls); R4. Done. E2 (budget: ~800 Software concepts / 40
  per call = 20 calls per arm) not run.
- WP5: BCa/permutation wiring for roll-up rows (`bin/stats.ts` currently resamples identity
  units; a `--rollup <json>` mode over gold edges is TODO), figures, CLAIMS.md rows.

## TODO / open questions

- `stripQualifiers` rules were written against the Software labels of the four arms; a
  dev-split audit of false strips (e.g. `Cisco Firepower 1000 Series` in Device) is pending.
- **Device facet weakness (noted, not changed).** On Device the facet operator has almost nothing
  to strip (`stripQualifiers` was tuned on Software) and the gold slice is tiny (2 test-test
  units), so R1/R2/R3 numbers on Device are not interpretable; R0 on Device folds 50 % sound at
  λ = 0. Leave as is until the dev-split audit above; do not tune rules on the test slice.
- **B2 replicate question (noted, not changed).** The baseline table uses `t-b2-31b-gembed2-r3`
  for the B2 cell while the other three cells use r1 (protocol § 3: the B2 r1 headline has a
  documented transplant prefix in r2). Whether the cell-level claim should use all three B2
  replicates with the seed range, as SKEIN-R did, is still open.
- HiT on `prefLabel` alone (`hit-zeroshot`) vs on `prefLabel: definition` (`hit-zeroshot-gloss`):
  both are now measured (`recall-at-k.md`), so the encoder-vs-input confound is resolved by data.
- `hac-constrained`'s medoid rule vs `hac-constrained-root`: both measured (`rollup-r2-r4.txt`).
- The eTLD+1 table is a vendored approximation; replace with a full PSL if Domain ever becomes a
  reported slice.
- Non-additive incident counts (protocol §5) are specified but not implemented (`bin/rollup-count.ts`).
- `LlmClient` retry is opt-in (`retry` constructor option) and used only by `enrich-family-hint`;
  the SKEIN-R arms keep single-attempt semantics by design.

## Status 2026-09-16 (end of session)

Implemented and measured without LLM calls: R0, R1, R2 (`hac`, `hac-constrained`,
`hac-constrained-root`), R3 (`hyperbolic-hit`, `-hit-gloss`, `-euclid`, `-euclid-normfilter`,
`-euclid-normfilter-gloss`), R4 (`hybrid[all|broaderInstantial]+…`). Outputs:
`analysis/out/rollup-r2-r4{,-dev}.{json,txt}` (2780 rows each), `analysis/out/recall-at-k.md`,
`analysis/hyperbolic/out/geometry-<arm>-software.json` (E1 + prefLabel-HiT; gloss-HiT geometry
not yet computed). Reading and next steps: `wiki/notes/skein-skos-rollup-paper-plan.md` in the
dissertation repo ("Second measurements"). Tests: 812 passing.

## Direction decided 2026-09-16 (see the wiki note, section "Direction after the first measurements")

Roll-up stays LLM-free at query time; the hierarchy is completed at CONSTRUCTION time. Implement next:
1. `bin/complete-hierarchy.ts` + `prompts/parent-or-family-v1.md`: one pass over unparented concepts,
   forced choice = existing parent | new abstract family node (label + definition) | none-with-reason;
   writes into a COPY of the registry (`<arm>-h1`), local `gemma4:26b` via ollama, register the prompt hash.
2. `src/Rollup/PrefixParentRollup.ts`: longest token-prefix concept label of the same scheme as parent.
3. `src/Rollup/NeighbourParentRollup.ts`: orphan inherits the judge-assigned parent of its k nearest E1
   neighbours when ≥ m of them agree.
4. `bin/clean-edges.ts`: cycle removal, transitive reduction, label-consistency check (no LLM).
Then rerun `rollup-eval` on the `-h1` registries; success = completeness → ~100 % on gold with soundness ≥ R0.
Not pursued as the main line: zero-shot HiT, HAC as parent finder, HiT/Poincaré fine-tuning on 275 edges (negative results, keep in the paper).
