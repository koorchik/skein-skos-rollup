#!/usr/bin/env ts-node
/**
 * E2 enrichment — a family/kind hint per concept, from one batched LLM call per ~40 concepts.
 *
 *   npm run enrich-family-hint -- --run runs/experiments/<arm> --category Software \
 *     [--batch 40] [--provider ollama --model gemma4:26b-16k] [--out-run runs/experiments/<arm>-e2]
 *
 * This is a VOCABULARY-CONSTRUCTION step, not a roll-up step: it runs once, offline, and writes
 * into a COPY of the registry (`<arm>-e2/registry.json`, `concept.note`), so the frozen SKEIN-R
 * artifact is never touched and the roll-up operators stay LLM-free. The raw answers are kept as
 * `<arm>-e2/family-hints-<scheme>.jsonl` (one `{prefLabel, family, batch}` line per concept) so a
 * re-run can be diffed against the previous one. Prompt: `prompts/family-hint-v1.md` (hashed in
 * `prompts/manifest.json`); provider/model from `LLM_PROVIDER`/`LLM_MODEL` unless overridden.
 * A paid provider refuses to run without `--allow-paid`.
 */
import { ConceptRegistry } from '../src/ConceptRegistry/ConceptRegistry';
import { createLlmBackend } from '../src/LlmClient/createBackend';
import { LlmClient } from '../src/LlmClient/LlmClient';
import { prompts } from '../src/Normalization/PromptProvider';
import { schemeSlug } from '../src/Rollup/schemeIo';
import dotenv from 'dotenv';
import { appendFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { jsonrepair } from 'jsonrepair';
import path from 'path';

dotenv.config();

const argv = process.argv.slice(2);
const flag = (name: string, fallback = '') => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};
const RUN = flag('run');
const CATEGORY = flag('category');
const BATCH = Number(flag('batch', '40'));
const PROVIDER = flag('provider', process.env.LLM_PROVIDER ?? 'ollama');
const MODEL = flag('model', process.env.LLM_MODEL ?? 'gemma4:26b-16k');
const OUT_RUN = flag('out-run', '');
const ALLOW_PAID = argv.includes('--allow-paid');
const PROMPT_ID = 'family-hint-v1';

interface Hint {
  n: number;
  family: string;
}

/** Parse `[{"n":1,"family":"…"}, …]` leniently (jsonrepair handles fences and trailing commas). */
export function parseHints(text: string, expected: number): Map<number, string> {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  const body = start !== -1 && end > start ? text.slice(start, end + 1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = JSON.parse(jsonrepair(body));
  }
  const out = new Map<number, string>();
  if (!Array.isArray(parsed)) return out;
  for (const item of parsed as Partial<Hint>[]) {
    const n = Number(item?.n);
    const family = typeof item?.family === 'string' ? item.family.trim().toLowerCase() : '';
    if (Number.isInteger(n) && n >= 1 && n <= expected && family) out.set(n, family);
  }
  return out;
}

async function main() {
  if (!RUN || !CATEGORY) {
    throw new Error('usage: enrich-family-hint --run <runDir> --category <scheme> [--batch 40] [--provider p --model m] [--out-run dir] [--allow-paid]');
  }
  if (PROVIDER !== 'ollama' && !ALLOW_PAID) {
    throw new Error(`provider "${PROVIDER}" is a paid call — re-run with --allow-paid once the budget is approved`);
  }
  const source = RUN.replace(/\/$/, '');
  const outRun = OUT_RUN || `${source}-e2`;
  if (path.resolve(outRun) === path.resolve(source)) throw new Error('refusing to write into the source run');

  // The copy carries everything the source run had (run card, decisions, transcripts) so the
  // enriched registry is still self-describing; only registry.json changes.
  if (!existsSync(outRun)) {
    mkdirSync(outRun, { recursive: true });
    cpSync(source, outRun, { recursive: true, filter: (src) => !src.includes('/llm-calls/') });
  }
  const registry = new ConceptRegistry({ filePath: path.join(outRun, 'registry.json') });
  await registry.load();
  const category = registry.conceptSchemes().find((s) => s.toLowerCase() === CATEGORY.toLowerCase());
  if (!category) throw new Error(`no scheme "${CATEGORY}" in ${source}`);
  const records = registry.concepts(category);
  const names = Object.keys(records).sort();

  const client = new LlmClient({
    backend: createLlmBackend({ provider: PROVIDER, model: MODEL }),
    defaultCallOptions: { temperature: 0, maxTokens: 4096 },
    retry: {},
  });
  const hintsPath = path.join(outRun, `family-hints-${schemeSlug(category)}.jsonl`);
  writeFileSync(hintsPath, '');
  console.log(`${category}: ${names.length} concepts in ${Math.ceil(names.length / BATCH)} batches → ${PROVIDER}/${MODEL}; prompt ${PROMPT_ID} ${prompts.get(PROMPT_ID).sha256.slice(0, 12)}`);

  let annotated = 0;
  for (let start = 0, batch = 0; start < names.length; start += BATCH, batch += 1) {
    const chunk = names.slice(start, start + BATCH);
    const lines = chunk.map((name, i) => {
      const definition = records[name].definition;
      return `${i + 1}. ${name}${definition ? ` — ${definition}` : ''}`;
    });
    const instructions = prompts.render(PROMPT_ID, { category, concepts: lines.join('\n') });
    const response = await client.send(instructions, 'Return the JSON array now.', { operator: 'family-hint', docId: null });
    const hints = parseHints(response.text, chunk.length);
    chunk.forEach((name, i) => {
      const family = hints.get(i + 1) ?? null;
      if (family && family !== 'unknown') {
        registry.setNote(category, name, family);
        annotated += 1;
      }
      appendFileSync(hintsPath, JSON.stringify({ prefLabel: name, family, batch }) + '\n');
    });
    console.log(`  batch ${batch}: ${hints.size}/${chunk.length} hints (${response.usage.inputTokens}+${response.usage.outputTokens} tokens)`);
  }

  await registry.save();
  console.log(`annotated ${annotated}/${names.length} concepts → ${path.join(outRun, 'registry.json')}; raw hints in ${hintsPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
