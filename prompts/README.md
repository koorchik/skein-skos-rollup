# Prompts

Every LLM instruction the code sends. Loaded by `src/Normalization/PromptProvider.ts`; the sha256
of every prompt a run used is written into its run card (for the inherited pipeline it is also
folded into the `runId`). **No prompt is ever used on the roll-up path:** prompts belong to
vocabulary construction only (`docs/ROLLUP-PROTOCOL.md` §6).

## Format

Plain text with `{{placeholder}}` variables. `PromptProvider.render()` is strict in both
directions: every placeholder must be supplied and every supplied variable must be used, so a
literal `{{concepts}}` can never reach the model.

`manifest.json` records per prompt its file, byte length, sha256 and placeholders.
`PromptProvider.test.ts` checks the live files against it (19 ids, 19 files).

## Editing a prompt

Prompt text is an experimental variable, not an implementation detail.

1. Edit the `.md` file.
2. `npm test` fails: the manifest hash no longer matches. That failure is the feature.
3. Update `sha256` and `bytes` in `manifest.json` deliberately (the values are those reported by
   `prompts.get(id)`).
4. A new prompt file needs a new manifest entry, or the "finds every extracted prompt" test fails.

For an experiment arm that needs different text, add a new prompt id instead of editing: the
baseline text stays pinned and the comparison stays honest.

## Article-4 prompts (vocabulary construction)

| id | used by | variables | role |
|---|---|---|---|
| `family-hint-v1` | `bin/enrich-family-hint.ts` (E2) | `category`, `concepts` | One batched call per ~40 concepts: a 1–4 word family or kind phrase per concept, written as `concept.note` into a COPY of the registry (`<arm>-e2`). Not run yet |

Planned: `parent-or-family-v1` (H1: forced choice for an unparented concept between an existing
parent, a new abstract family node with label and definition, or none with a reason; writes
`<arm>-h1`).

## Inherited SKEIN-R prompts

Kept byte-identical to `skein-resolver`: they produced the frozen registries this paper folds,
the tests pin them, and they are the starting point if a registry is rebuilt with a
construction-time change. Do not edit; do not delete without removing the decision strategy and
tests that load them.

| id | used by | note |
|---|---|---|
| `listwise-id-v1` | `ListwiseGraphDecision` when `DECOUPLE=1` | identity pass of the SKEIN-R headline configuration |
| `listwise-skos-v7` | review pass (`REVIEW_PROMPT_ID` default) | the pass that writes the typed `skos:broader` edges R0 folds along |
| `listwise-skos-v1` … `v6`, `listwise-graph-v2` | `ListwiseGraphDecision` via `LISTWISE_PROMPT_ID` | superseded variants and SKEIN-R ablation arms |
| `listwise-select`, `listwise-select-compact-v1` | `ListwiseMintCandidateDecision` | baseline numbered choice with an explicit new-entity option |
| `comem-select` | `ComemSelectDecision` | SKEIN-R comparison strategy |
| `link-judge` | `StreamingNormalizer` | built-in link / mint / defer judge |
| `repair-judge`, `repair-judge-compact-v1` | `StreamingRepairer` | suspect-component adjudication |
| `extract-streaming`, `type-judge` | `StreamingExtractor`, `SchemaRegistry` | per-document extraction and type decisions |
| `psi-norm-batch` | batch normalization baseline | the published 2025 Ψ_norm prompt |
