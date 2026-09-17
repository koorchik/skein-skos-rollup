# RUNBOOK: commands for SKEIN-SKOS-rollup

Replaces the SKEIN-R `REPRODUCE.md`: the 50 arms under `runs/experiments/` are frozen INPUT here
and are reproduced from `skein-resolver`, never re-run from this repository. Scoring rules are in
`docs/ROLLUP-PROTOCOL.md`, file and JSON shapes in `docs/CONTRACTS.md`.

## Environment

`npm install` (Node ≥ 22; ts-node, no build step). Free checks: `npm run typecheck`, `npm test`
(812 tests), `npm run hash-input -- data/extractions/gpt-5` (must print `37d57e47…`). Nothing in
sections 1 and 3 needs an API key. E1 with the default encoder needs a local Ollama server
(`ollama pull embeddinggemma`); E2 needs a local `gemma4:26b-16k` tag or another provider through
`LLM_PROVIDER` / `LLM_MODEL`. Paid providers refuse to run without `--allow-paid`.

Arms read today (full names in `runs/experiments/README.md`): A1 r1, A2 r1, B1 r1, B2 r3.

## 1. Roll-up scoring (no LLM)

```bash
# R0 / R1 baseline, one arm, Software, explicit sweep
npm run rollup-eval -- --run runs/experiments/t-b2-31b-gembed2-r3-1f86ee33b8cc \
  --operator graph,facet --contract all,broaderInstantial --category Software \
  --lambda-sweep 0,0.5,0.7,0.8,0.85,0.9,0.95 --gold gold/gold.json --out analysis/out/x.json

# everything that is committed under analysis/out/rollup-r2-r4.json (four arms, five schemes)
npm run rollup-eval -- \
  --run runs/experiments/t-a1-flash-gembed2-r1-35bc1387d473 \
  --run runs/experiments/t-a2-flash-egemma-r1-a7d0a4e56984 \
  --run runs/experiments/t-b1-31b-egemma-r1-4337e00db336 \
  --run runs/experiments/t-b2-31b-gembed2-r3-1f86ee33b8cc \
  --operator graph,facet,hac,hac-constrained,hac-constrained-root,hyperbolic-hit,hyperbolic-hit-gloss,hyperbolic-euclid,hyperbolic-euclid-normfilter,hyperbolic-euclid-normfilter-gloss,hybrid-hac,hybrid-hit,hybrid-euclid,hybrid-euclid-normfilter \
  --contract all,broaderInstantial --category "Software,Sector,Government Body,Organization,Device" \
  --gold gold/gold.json --split test --out analysis/out/rollup-r2-r4.json
```

| flag | default | meaning |
|---|---|---|
| `--run` (repeatable) | required | run directory whose `registry.json` is folded |
| `--operator` | required | `graph`, `facet`, `hac`, `hac-constrained`, `hac-constrained-root`, `hyperbolic-hit[-gloss]`, `hyperbolic-euclid`, `hyperbolic-euclid-normfilter[-gloss]`, `hybrid-<any of those>` |
| `--contract` | `all` | `all` or `broaderInstantial` (ISO 25964 BTI only); applies to `graph` and `hybrid-*` |
| `--category` | every scheme with gold edges | comma-separated scheme names |
| `--lambda-sweep` | per operator | graph: similarity brake 0…0.95; `hac*`: linkage cutoff 0.99…0.7; `hyperbolic-hit*`: distance bound 2…12, ∞; `hyperbolic-euclid*`: cosine 0.99…0.7; `hybrid-X`: X's sweep; `facet`: none |
| `--split` | `test` | `test` = reportable (both endpoint clusters are test); `dev` = λ selection only |
| `--hierarchy-all-splits` | off | whole gold table; iteration only, never reported |
| `--gold` | required | `gold/gold.json` |
| `--out` | none | JSON with `rows` and `aupc`; the console table is what the committed `.txt` files hold |

An R2 / R3 cell whose vectors or candidates file is missing is skipped with a message.
`Infinity` is written as `null` with `lambdaLabel: "inf"`.

## 2. Vocabulary-construction enrichments (write copies or sidecar files only)

```bash
# E1: export one scheme, embed it (ollama/embeddinggemma by default)
npm run export-scheme -- --run runs/experiments/<arm> --category Software [--gold gold/gold.json] [--out file]
npm run embed-scheme  -- --run runs/experiments/<arm> --category Software \
  [--provider ollama] [--model embeddinggemma] [--cache runs/embeddings-cache] [--allow-paid]

# E2: family hints into a COPY of the registry (one LLM call per ~40 concepts; not run yet)
npm run enrich-family-hint -- --run runs/experiments/<arm> --category Software \
  [--batch 40] [--provider ollama --model gemma4:26b-16k] [--out-run runs/experiments/<arm>-e2] [--allow-paid]
```

Files are arm-qualified so the arms never collide on one scheme:
`analysis/hyperbolic/in/scheme-<arm>-<scheme>.json`,
`analysis/hyperbolic/in/vectors-<arm>-<scheme>-<provider>-<model>.jsonl`. `<arm>` is the run
directory's basename, `<scheme>` is the slug (`Government Body` → `government-body`). Both
directories are git-ignored and regenerable. E2 writes `<arm>-e2/registry.json` (`concept.note`)
and `<arm>-e2/family-hints-<scheme>.jsonl`; the source registry is never touched.

## 3. Python sidecar (E3 vectors, candidate rankers, recall, geometry)

```bash
cd analysis/hyperbolic
./bootstrap.sh --cpu                       # venv; uv + Python 3.12 if available, else python3 -m venv
.venv/bin/python hit_zeroshot.py --smoke   # 12 hand pairs; transcript committed as out/smoke.txt
.venv/bin/python hit_zeroshot.py --scheme <arm>-software --topk 10               # prefLabel
.venv/bin/python hit_zeroshot.py --scheme <arm>-software --topk 10 --text text   # prefLabel: definition
.venv/bin/python euclid_candidates.py --scheme <arm>-software   # cosine, cosine + HiT norm filter
.venv/bin/python recall_report.py                               # out/recall-*.json + ../out/recall-at-k.md
.venv/bin/python geometry.py --bundle <arm>-software            # δ-hyperbolicity, tree distortion
```

Details and the file-exchange table: `analysis/hyperbolic/README.md`. The HiT checkpoint is
downloaded once from the Hugging Face Hub; no LLM or paid API is called. `geoopt` is deliberately
not a dependency (Poincaré operations are vendored in `poincare_ops.py`).

## 4. Inherited SKEIN-R tools that still matter here

`npm run fold -- --run runs/experiments/<arm> --category Software --contract broaderInstantial`
(the reference traversal R0 wraps), `npm run evaluate` (identity and hierarchy scoring of a
registry, needed again once `-h1` copies exist), `npm run stats` (bootstrap and permutation
machinery; a `--rollup` mode is to be added), `npm run export-skos -- <registry.json> out.ttl`,
`npm run view` / `regen-view` (run replay page), `scripts/score-runs.py`, `scripts/gold-slice.py`.
`scripts/run-arm.sh` runs a full SKEIN-R arm and is not needed unless a registry has to be
rebuilt with a changed construction prompt.

## Not built yet

`bin/complete-hierarchy.ts` with `prompts/parent-or-family-v1.md` (H1), `PrefixParentRollup` (H2),
`NeighbourParentRollup` (H3), `bin/clean-edges.ts` (H4), `bin/stats.ts --rollup` (H6),
`bin/rollup-count.ts` (H7), `analysis/figures_rollup.py` (H8). See `docs/EXPERIMENT-PLAN.md`.
