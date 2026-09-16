# skein-skos-rollup

Experiment repository for the **SKEIN-SKOS-rollup** paper: *LLM-free roll-up aggregation of
concepts inside one SKOS concept scheme*, over the frozen registries the SKEIN-R paper produced.

Forked **with history** from [`skein-resolver`](https://github.com/koorchik/skein-resolver) at
commit `23cdfc2` (the SKEIN-R publication artifact). Nothing under `runs/experiments/` changes
here: those 50 arms are the INPUT of this paper, not its output. The SKEIN-R pipeline, scorer,
gold table and claims ledger are carried unchanged so every number can still be re-derived;
the SKEIN-R `README` is preserved in git history and summarised in
[`runs/experiments/README.md`](runs/experiments/README.md).

## The question

A flat registry answers "how many mentions of *Microsoft Office 2010*". An analyst wants "how
many mentions of Office at product granularity", or of Windows, or of the whole Microsoft
family — a different answer for every choice of fold. SKEIN-R stores typed `skos:broader` edges
and folds along them at query time (`bin/fold-registry.ts`); this paper asks how well that fold —
and cheaper, LLM-free alternatives — recover the gold hierarchy, per scheme, at what cost.

Two stages, with a hard line between them:

1. **Vocabulary construction** (LLM allowed; already done by SKEIN-R). Optional one-off
   enrichments of a *copy* of a registry:
   - **E1** `name: gloss` Euclidean vectors (`npm run embed-scheme`, any encoder, cached);
   - **E2** an LLM family-hint note per concept (`npm run enrich-family-hint`, batched, written
     as `concept.note` into `runs/experiments/<arm>-e2/`);
   - **E3** hyperbolic (Poincaré-ball) vectors from a Hierarchy Transformer, zero-shot
     (`analysis/hyperbolic/hit_zeroshot.py`).
2. **Roll-up** (NO LLM calls, ever): a deterministic fold with one continuous parameter λ,
   scored per scheme against the gold hierarchy (`npm run rollup-eval`). The roll-up stage's
   cost is reported in milliseconds with zero LLM calls; the build stage's cost in tokens.

### Operators

| id | operator | source | λ |
|---|---|---|---|
| R0 | graph walk over stored `skos:broader` edges (`ConceptRegistry.rollupTarget`, highest-similarity parent per hop, optional ISO 25964 contract) | `src/Rollup/GraphWalkRollup.ts` | similarity brake |
| R1 | facet stripping: deterministic family from the label (versions/editions for Software & Device, eTLD+1 for Domain, identity elsewhere) | `src/Rollup/FacetRollup.ts` | – |
| R2 | Euclidean HAC over E1 vectors (average linkage, `averageLinkage.ts`), on R1 families; medoid target; `hac-constrained` adds judge edges as must-links, `hac-constrained-root` targets the judge-edge root of each cluster | `src/Rollup/HacRollup.ts` | linkage cutoff |
| R3 | ranked parent from a candidates file, on R1 families: `hyperbolic-hit[-gloss]` (HiT ball, norm-ordered; prefLabel or `prefLabel: definition`), `hyperbolic-euclid` (cosine control), `hyperbolic-euclid-normfilter[-gloss]` (cosine + HiT norm filter) | `src/Rollup/HyperbolicRollup.ts` | distance bound (HiT) / cosine floor |
| R4 | hybrid: R0 (λ = 0) where a judge edge exists, R1/R2/R3 fallback elsewhere (`hybrid-<fallback>`) | `src/Rollup/HybridRollup.ts` | the fallback's |

R1 is a dependency of R2 and R3: version labels enter clustering as families, not one by one
(`docs/PLAN.md`). The method matrix, JSON contracts and split discipline live in
[`docs/PLAN.md`](docs/PLAN.md) and [`docs/ROLLUP-PROTOCOL.md`](docs/ROLLUP-PROTOCOL.md); the
claims–evidence matrix for this paper is [`docs/CLAIMS.md`](docs/CLAIMS.md) (empty until the
paper's numbers are frozen).

## How to run

```
npm install                       # node ≥ 22; ts-node, no build step
npm run typecheck && npm test     # 800+ tests, the SKEIN-R suite plus src/Rollup and rollupMetrics

# R0 / R1 baseline over the four factorial arms, all schemes with gold edges, λ sweep
npm run rollup-eval -- --run runs/experiments/t-b2-31b-gembed2-r3-1f86ee33b8cc \
  --operator graph,facet --contract all,broaderInstantial --category Software \
  --lambda-sweep 0,0.5,0.7,0.8,0.85,0.9,0.95 --gold gold/gold.json --out analysis/out/x.json
#   --split test (default) = reportable slice; --hierarchy-all-splits = iteration only
# R2–R4 (each operator has its own default λ sweep; needs the E1 / candidates files below)
npm run rollup-eval -- --run runs/experiments/<arm> \
  --operator hac,hac-constrained,hac-constrained-root,hyperbolic-hit,hyperbolic-hit-gloss,hyperbolic-euclid,hyperbolic-euclid-normfilter,hyperbolic-euclid-normfilter-gloss,hybrid-hac,hybrid-hit,hybrid-euclid

# E1: export one scheme, embed it (ollama/embeddinggemma by default; gemini needs --allow-paid).
# Files are arm-qualified: in/scheme-<arm>-<scheme>.json, in/vectors-<arm>-<scheme>-<provider>-<model>.jsonl
npm run export-scheme -- --run runs/experiments/<arm> --category Software
npm run embed-scheme  -- --run runs/experiments/<arm> --category Software

# E2: family hints into a COPY of the registry (one LLM call per ~40 concepts; not run yet)
npm run enrich-family-hint -- --run runs/experiments/<arm> --category Software

# E3 + rankers + recall + geometry: Python sidecar (--scheme takes <arm>-<scheme>)
cd analysis/hyperbolic && ./bootstrap.sh --cpu && .venv/bin/python hit_zeroshot.py --smoke
.venv/bin/python hit_zeroshot.py --scheme <arm>-software --topk 10     # out/candidates-<arm>-software-hit-zeroshot-0.json
.venv/bin/python hit_zeroshot.py --scheme <arm>-software --topk 10 --text text   # …-hit-zeroshot-gloss-0.json (prefLabel: definition)
.venv/bin/python euclid_candidates.py --scheme <arm>-software          # …-euclid-0.json, …-euclid-normfilter-0.json, …-euclid-normfilter-gloss-0.json
.venv/bin/python recall_report.py                                       # out/recall-*.json + ../out/recall-at-k.md
.venv/bin/python geometry.py --bundle <arm>-software                    # out/geometry-<arm>-software.json

# The SKEIN-R fold CLI is unchanged and still the reference traversal
npm run fold -- --run runs/experiments/t-a2-flash-egemma-r2-4e86447ddfce --category Software --contract broaderInstantial
```

## Layout

- `src/Rollup/` — operator contract (`types.ts`), R0–R4, `averageLinkage.ts`, file contracts
  shared with the sidecar (`schemeIo.ts`).
- `src/Evaluation/rollupMetrics.ts` — sound% / complete% / denominator, B-cubed & ARI against
  the gold-projected partition, AUPC, the `exchangeFamily` (loose and strict) and
  `windowsNotOffice` probes.
- `bin/rollup-eval.ts`, `bin/export-scheme.ts`, `bin/embed-scheme.ts`, `bin/enrich-family-hint.ts`
  — the four new CLIs (`npm run <name>`); every SKEIN-R CLI (`evaluate`, `fold`, `stats`, …) still works.
- `src/LlmClient/retry.ts` — opt-in exponential backoff (429/5xx), used by the enrichments only.
- `prompts/family-hint-v1.md` — the E2 prompt, hashed in `prompts/manifest.json` like every other.
- `analysis/hyperbolic/` — Python sidecar (own README).
- `analysis/out/rollup-*.json|txt` — roll-up outputs (regenerable): `rollup-r0-r1*` baseline,
  `rollup-r2-r4` (test) and `rollup-r2-r4-dev` (λ selection); `recall-at-k.md` — ranker recall.
- `runs/experiments/` — the 50 frozen SKEIN-R arms (input); `runs/experiments/<arm>-e2/` are
  the only registries this repo ever writes, and only as copies.
- `gold/`, `docs/statistical-protocol.md`, `docs/REPRODUCE.md`, `data/` — carried from SKEIN-R, unchanged.

Predecessors: V. Turskyi, *SKEIN-R* (streaming SKOS/ISO-25964 concept-registry construction,
this repository's parent) and *"A Formal Model for Constructing Sensitive Data Graphs from Cyber
Reports using Large Language Models"*, TACS 7(2), 2025.
