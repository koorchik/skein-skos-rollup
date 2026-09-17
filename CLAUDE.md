# skein-skos-rollup: experiment repo for article 4

LLM-free roll-up (aggregation along `skos:broader` inside one SKOS concept scheme) over the frozen
SKEIN-R registries. Fork of `skein-resolver` (SKEIN-R, article 2). The paper text lives in the
dissertation repo (`~/work/kpi/dissert/wiki/raw-papers/my/skein-skos-rollup/paper.md`, built with
`make tacs-skein-skos-rollup`); this repo holds code, prompts, outputs and the numbers.

## Hard rules

- **Never commit without the author's explicit confirmation. Never add Co-Authored-By or any
  other trailer.** The repository is pushed to GitHub; never push without being asked.
- **`~/work/kpi/skein-resolver` is frozen** (the SKEIN-R paper artifact, also the `upstream`
  remote). Read it, never edit it.
- **No LLM call inside a roll-up operator, inside `rollup-eval`, or anywhere on the fold path.**
  An LLM is allowed only in vocabulary-construction steps (enrichments E2, the planned H1 pass),
  which run once, offline.
- `runs/experiments/<arm>/`, `runs/imported/`, `gold/`, `data/` are frozen inputs. A registry is
  never edited in place: construction steps write COPIES (`<arm>-e2`, `<arm>-h1`).
- Paid providers only with an explicit `--allow-paid` and the author's consent; defaults are
  local (`ollama/embeddinggemma`, `gemma4:26b`).
- Only `--split test` numbers are reportable. λ, cutoffs, `w`, prompt text and stripping rules
  are chosen on the dev slice; `--hierarchy-all-splits` and `--split dev` never back a result.
  `docs/ROLLUP-PROTOCOL.md` is fixed before any reported number: amend it only in a separate,
  dated change that says why the change is not result-driven.
- Folded weights are distinct-incident counts recomputed from artifacts, never sums of children.
- `docs/CLAIMS.md` rows are filled only when a number is frozen for the manuscript.
- A prompt is an experimental variable: editing `prompts/*.md` fails `npm test` until
  `prompts/manifest.json` is updated deliberately; a new arm gets a new prompt id.
- No `geoopt` and no source led by a Russian or mainland-Chinese institution, in code
  dependencies or citations (dissertation repo policy). Never print, log or commit `.env`.

## Where the truth lives

| What | Where |
|---|---|
| Decisions, predictions, risks, gold options, direction | `~/work/kpi/dissert/wiki/notes/skein-skos-rollup-paper-plan.md` (governing plan), RQ9 in `wiki/notes/research-questions.md` |
| Related work to engage with, gaps | `~/work/kpi/dissert/wiki/notes/skein-rollup-reading-map.md` |
| Numbers | `analysis/out/*.json` (index: `analysis/out/README.md`); narrative: `docs/MEASUREMENTS-2026-09-16.md` |
| Scoring rules | `docs/ROLLUP-PROTOCOL.md`, inherited `docs/statistical-protocol.md` |
| What is planned, status, open decisions | `docs/EXPERIMENT-PLAN.md` |
| Operator semantics, file and JSON contracts | `docs/CONTRACTS.md`, `analysis/hyperbolic/README.md` |
| Commands | `docs/RUNBOOK.md` |
| Paper vocabulary | `docs/TERMINOLOGY-ALIGNMENT.md` |
| Inherited, unchanged, referenced from code | `docs/statistical-protocol.md`, `docs/GOLD-TABLE.md`, `gold/README.md`; `docs/BALLOT-COMPOSITION-2026-08-22.md` (why judge hierarchy recall is incomplete) |

When this repo and the wiki plan note disagree on a decision, the wiki note wins; when they
disagree on a number, the JSON under `analysis/out/` wins (the wiki's first baseline table is on
all gold splits, the reportable numbers are the test split).

## Design decisions that code must respect

1. **Two stages with a hard line:** vocabulary construction (LLM allowed, once, into copies) and
   roll-up (deterministic fold with one continuous parameter λ, zero LLM calls, cost in ms).
2. **Operator contract:** `RollupOperator.fold({ registry, category, vectors?, lambda })` returns
   `{ target, abstractNodes, edgesUsed }` (`src/Rollup/types.ts`). Abstract node ids carry the
   prefixes `facet:`, `hac:`, `hyp:`. A new operator implements this contract and gets a test.
3. **R1 before R2 and R3:** version and edition labels are folded to families first; clustering
   and ranking operate on family representatives.
4. **Contracts:** `all` edges or `broaderInstantial` (ISO 25964 BTI) only; both are reported.
5. **Per scheme, always;** Software is the primary slice; schemes are never pooled.
6. **Direction (2026-09-16):** complete the hierarchy at construction (forced choice: existing
   parent, new abstract family, or none with a reason), add model-free fallbacks (longest prefix,
   neighbour-inherited parent, deterministic edge cleaning). Zero-shot hyperbolic ranking,
   clustering as a parent finder and small-data hyperbolic fine-tuning stay in the paper as
   measured negative results; do not extend them.
7. **Sweeps, not points:** every swept operator reports the dev-selected λ plus the whole curve
   (AUPC). Probes (`exchangeFamily` loose and strict, `windowsNotOffice`) are reported, never
   filtered.
8. **Open, do not decide silently:** external reference tables in code (CPE, Public Suffix List,
   ISO 3166), the hierarchy gold option, the B2 replicate question, the headline contract
   (`docs/EXPERIMENT-PLAN.md`, "Open decisions").

## Code map

- Article-4 code: `src/Rollup/` (`types.ts`, `GraphWalkRollup` R0, `FacetRollup` R1, `HacRollup`
  R2, `HyperbolicRollup` R3, `HybridRollup` R4, `averageLinkage.ts`, `schemeIo.ts`),
  `src/Evaluation/rollupMetrics.ts`, `bin/rollup-eval.ts`, `bin/export-scheme.ts`,
  `bin/embed-scheme.ts`, `bin/enrich-family-hint.ts`, `src/LlmClient/retry.ts` (opt-in backoff,
  enrichments only), `prompts/family-hint-v1.md`, Python sidecar `analysis/hyperbolic/`.
- Reused from SKEIN-R: `src/ConceptRegistry/` (`rollupTarget`, the traversal R0 wraps),
  `src/Evaluation/` (`hierarchyMetrics.mapCanonicalsToGold`, `gold.ts`, `bootstrap.ts`,
  `partition.ts`), `src/EmbeddingsClient/` with the shared cache, `src/LlmClient/`,
  `src/Normalization/PromptProvider.ts`.
- Inherited and otherwise untouched: the streaming identity pipeline (`bin/app.ts`,
  `src/Normalization/`, `src/DataProcessors/`, `src/Repair/`), scorers and viewers. Do not
  refactor it for taste; it matters again when a registry is rebuilt with a construction-time
  change.
- TypeScript through ts-node, no build step, Node ≥ 22. `npm run typecheck` and `npm test`
  (node:test, 812 tests) must pass before any hand-off. Python sidecar: own venv under
  `analysis/hyperbolic/.venv` (git-ignored), CPU torch is enough.

## Working conventions

- Sidecar exchange files are arm-qualified (`<arm>-<scheme>`) and live in git-ignored
  `analysis/hyperbolic/in|out`; only `out/env.json` and `out/smoke.txt` are committed. Anything
  cited from an ignored file (geometry diagnostics) must be regenerated before it is quoted.
- Committed outputs go to `analysis/out/` with the generating command inside the JSON
  (`command`); add a line to `analysis/out/README.md` for every new file.
- Figures follow the TACS column contract of `analysis/figures.py`: 3.0 in wide, STIXGeneral,
  saved without `bbox_inches='tight'`, one panel per figure.
- Documentation in this repo is English. Prose that may end up in the paper follows the
  dissertation repo's style audit: no em dashes, no first person, no emphasis italics.
