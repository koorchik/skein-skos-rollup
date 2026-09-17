# CONTRACTS: operator semantics, dependencies, file and JSON contracts

What the roll-up code does and which files it exchanges, as implemented. Moved verbatim from the
former `docs/PLAN.md` (2026-09-17); the experiment plan and its status are in
`docs/EXPERIMENT-PLAN.md`, the scoring rules in `docs/ROLLUP-PROTOCOL.md`, the commands in
`docs/RUNBOOK.md`. Change this file in the same commit as the code it describes.

## Operator semantics as implemented

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
