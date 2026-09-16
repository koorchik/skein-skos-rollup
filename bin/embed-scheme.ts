#!/usr/bin/env ts-node
/**
 * E1 enrichment: embed the `text` field (`prefLabel: definition`) of one exported scheme.
 *
 *   npm run embed-scheme -- --run runs/experiments/<arm> --category Software [--provider ollama] [--model embeddinggemma] [--cache runs/embeddings-cache]
 *
 * Reads `analysis/hyperbolic/in/scheme-<arm>-<scheme>.json` (from `export-scheme`), embeds every text
 * through `createEmbeddingsClient` into the SHARED on-disk cache (same key scheme as the pipeline:
 * `(model, text)`), and ALSO writes a per-scheme JSONL
 * `analysis/hyperbolic/in/vectors-<arm>-<scheme>-<provider>-<model>.jsonl` with lines `{k, t, v}` so
 * the Python sidecar and the R2 operator read one small file rather than the whole cache.
 *
 * Provider/model default to the open-weight encoder (ollama/embeddinggemma). The cloud encoder
 * (`gemini`) is a paid call and refuses to run without `--allow-paid`.
 */
import { createEmbeddingsClient } from '../src/EmbeddingsClient/createEmbeddingsClient';
import { cacheKey } from '../src/EmbeddingsClient/EmbeddingCache';
import { schemeExportPath, vectorsPath, type SchemeExport } from '../src/Rollup/schemeIo';
import dotenv from 'dotenv';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

dotenv.config();

const argv = process.argv.slice(2);
const flag = (name: string, fallback = '') => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};
const RUN = flag('run');
const CATEGORY = flag('category');
const IN = flag('in', '');
const PROVIDER = flag('provider', process.env.EMBEDDINGS_PROVIDER ?? 'ollama');
const MODEL = flag('model', process.env.EMBEDDINGS_MODEL ?? 'embeddinggemma');
const CACHE = flag('cache', process.env.EMBEDDINGS_CACHE ?? path.resolve(__dirname, '../runs/embeddings-cache'));
const ALLOW_PAID = argv.includes('--allow-paid');

async function main() {
  if ((!CATEGORY || !RUN) && !IN) throw new Error('usage: embed-scheme --run <runDir> --category <scheme> | --in scheme.json [--provider ollama] [--model embeddinggemma] [--cache dir] [--allow-paid]');
  if (PROVIDER !== 'ollama' && !ALLOW_PAID) {
    throw new Error(`provider "${PROVIDER}" is a paid call — re-run with --allow-paid once the budget is approved`);
  }
  const inPath = IN || schemeExportPath(RUN, CATEGORY);
  const scheme = JSON.parse(readFileSync(inPath, 'utf8')) as SchemeExport;
  const texts = [...new Set(scheme.concepts.map((c) => c.text))].sort();
  console.log(`${scheme.category} (${scheme.run}): ${texts.length} texts → ${PROVIDER}/${MODEL}, cache ${CACHE}`);

  mkdirSync(CACHE, { recursive: true });
  const client = createEmbeddingsClient({ provider: PROVIDER, model: MODEL, cacheDir: CACHE });
  const started = Date.now();
  const vectors = await client.embed(texts, { operator: 'embed-scheme' });
  const elapsed = Date.now() - started;

  const outPath = vectorsPath(scheme.run, scheme.category, PROVIDER, MODEL);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    texts.map((t, i) => JSON.stringify({ k: cacheKey(MODEL, t), t, v: vectors[i] })).join('\n') + '\n'
  );
  const dims = vectors[0]?.length ?? 0;
  console.log(`wrote ${outPath}: ${texts.length} vectors × ${dims} dims in ${elapsed} ms (cache ${JSON.stringify(client.cacheStats ?? null)})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
