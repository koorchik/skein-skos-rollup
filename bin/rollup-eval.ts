#!/usr/bin/env ts-node
/**
 * Score roll-up operators against the gold hierarchy, per concept scheme, over a λ sweep.
 *
 *   npm run rollup-eval -- --run runs/experiments/<arm> [--run …] \
 *     --operator graph,facet,hac,hac-constrained,hac-constrained-root,hyperbolic-hit,hyperbolic-hit-gloss,\
 *                hyperbolic-euclid,hyperbolic-euclid-normfilter,hyperbolic-euclid-normfilter-gloss,\
 *                hybrid-hac,hybrid-hit,hybrid-euclid,hybrid-euclid-normfilter [--contract all,broaderInstantial] \
 *     [--category Software,Sector] [--lambda-sweep 0,0.5,0.7,0.8,0.85,0.9,0.95] \
 *     --gold gold/gold.json [--split test|dev] [--hierarchy-all-splits] [--out analysis/out/x.json]
 *
 * No LLM is called here: every operator is a deterministic fold over the frozen registry, plus
 * precomputed E1 vectors (R2, `analysis/hyperbolic/in/vectors-<arm>-<scheme>-…jsonl`) or ranked
 * candidates (R3, `analysis/hyperbolic/out/candidates-<arm>-<scheme>-<method>-0.json`); an R2/R3
 * cell whose file is missing is skipped with a message. `--split test` (default) scores against
 * gold edges whose BOTH endpoint clusters are test clusters — the reportable slice
 * (docs/ROLLUP-PROTOCOL.md); `--hierarchy-all-splits` scores against the whole table (iteration
 * only). `--category` defaults to every scheme that carries gold hierarchy edges.
 *
 * λ sweeps: `--lambda-sweep` applies to every swept operator when given; otherwise each operator
 * has its own default (graph: similarity brake 0…0.95; hac*: linkage cutoff 0.99…0.7; hyperbolic-hit*:
 * distance bound 2…12,∞; hyperbolic-euclid*: cosine 0.99…0.7; hybrid-X: X's sweep; facet: none).
 * `Infinity` is written to JSON as null with `lambdaLabel: "inf"` alongside every row.
 *
 * Output: one row per (run, operator, contract, category, λ) with sound%/complete%, the
 * denominator, B-cubed/ARI against the gold-projected partition, the two named probes, edges
 * traversed, abstract nodes minted and the fold's wall-clock ms; plus `aupc` (area under the
 * sound-vs-#targets curve over the sweep) per (run, operator, contract, category).
 */
import { ConceptRegistry, type BroaderType } from '../src/ConceptRegistry/ConceptRegistry';
import { loadGoldTable, selectSplit, type GoldTable, type Split } from '../src/Evaluation/gold';
import { aupc, rollupMetrics, type RollupGold, type RollupMetrics } from '../src/Evaluation/rollupMetrics';
import { normalizeSurface } from '../src/Evaluation/partition';
import { FacetRollup } from '../src/Rollup/FacetRollup';
import { GraphWalkRollup } from '../src/Rollup/GraphWalkRollup';
import { HacRollup } from '../src/Rollup/HacRollup';
import { HybridRollup } from '../src/Rollup/HybridRollup';
import { HyperbolicRollup, type CandidateMethod } from '../src/Rollup/HyperbolicRollup';
import { candidatesPath, readVectorsJsonl, schemeExportPath, vectorsPath, type SchemeExport } from '../src/Rollup/schemeIo';
import type { RollupOperator } from '../src/Rollup/types';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const flags = (name: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === `--${name}`) out.push(argv[i + 1]);
  return out;
};
const flag = (name: string, fallback = '') => flags(name)[0] ?? fallback;
const list = (name: string, fallback: string) =>
  flag(name, fallback).split(',').map((s) => s.trim()).filter(Boolean);

const RUNS = flags('run');
const OPERATORS = list('operator', 'graph');
const CONTRACTS = list('contract', 'all');
const CATEGORIES = list('category', '');
const LAMBDAS_EXPLICIT = flags('lambda-sweep').length > 0;
const LAMBDAS = list('lambda-sweep', '0,0.5,0.7,0.8,0.85,0.9,0.95').map(parseLambda);

function parseLambda(text: string): number {
  if (/^(inf|infinity|∞)$/i.test(text.trim())) return Infinity;
  return Number(text);
}
const DEFAULT_SWEEP: Record<string, number[]> = {
  graph: [0, 0.5, 0.7, 0.8, 0.85, 0.9, 0.95],
  facet: [0],
  hac: [0.99, 0.97, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
  'hac-constrained': [0.99, 0.97, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
  'hac-constrained-root': [0.99, 0.97, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
  'hyperbolic-hit': [2, 4, 6, 8, 10, 12, Infinity],
  'hyperbolic-hit-gloss': [2, 4, 6, 8, 10, 12, Infinity],
  'hyperbolic-euclid': [0.99, 0.97, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
  'hyperbolic-euclid-normfilter': [0.99, 0.97, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
  'hyperbolic-euclid-normfilter-gloss': [0.99, 0.97, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
};
/** operator name → (ranking method, candidates file method slug). `-gloss` = HiT run on `prefLabel: definition`. */
const CANDIDATE_OPERATORS: Record<string, { method: CandidateMethod; file: string }> = {
  'hyperbolic-hit': { method: 'hit', file: 'hit-zeroshot' },
  'hyperbolic-hit-gloss': { method: 'hit', file: 'hit-zeroshot-gloss' },
  'hyperbolic-euclid': { method: 'euclid', file: 'euclid' },
  'hyperbolic-euclid-normfilter': { method: 'euclid-normfilter', file: 'euclid-normfilter' },
  'hyperbolic-euclid-normfilter-gloss': { method: 'euclid-normfilter', file: 'euclid-normfilter-gloss' },
};
const GOLD = flag('gold', 'gold/gold.json');
const SPLIT = flag('split', 'test') as Split;
const ALL_SPLITS = argv.includes('--hierarchy-all-splits');
const OUT = flag('out', '');
const VECTORS_PROVIDER = process.env.EMBEDDINGS_PROVIDER ?? 'ollama';
const VECTORS_MODEL = process.env.EMBEDDINGS_MODEL ?? 'embeddinggemma';

const CONTRACT_TYPES: Record<string, BroaderType[] | null> = {
  all: null,
  broaderInstantial: ['broaderInstantial'],
  broaderGeneric: ['broaderGeneric'],
  broaderPartitive: ['broaderPartitive'],
  'version-of': ['broaderInstantial'],
};

export interface RollupEvalRow {
  run: string;
  operator: string;
  contract: string;
  category: string;
  /** null when the swept value is Infinity (see `lambdaLabel`). */
  lambda: number | null;
  lambdaLabel: string;
  split: string;
  sound: number;
  complete: number;
  denominator: number;
  soundPct: number | null;
  completePct: number | null;
  goldMapped: number;
  canonicals: number;
  targetUnmapped: number;
  targets: number;
  bcubedP: number;
  bcubedR: number;
  bcubedF1: number;
  ari: number;
  probes: RollupMetrics['probes'];
  edgesUsed: number;
  abstractNodes: number;
  foldMs: number;
}

function clusterIdOfSurface(table: GoldTable, category: string, surface: string): string | undefined {
  const want = category.trim().toLowerCase();
  const key = normalizeSurface(surface);
  return table.clusters.find(
    (c) => c.category.trim().toLowerCase() === want && c.members.some((m) => normalizeSurface(m) === key)
  )?.id;
}

function goldFor(table: GoldTable): RollupGold {
  return {
    clusters: table.clusters,
    edges: (table.edges ?? []).map((edge) => ({
      ...edge,
      fromClusterId: edge.fromClusterId ?? clusterIdOfSurface(table, edge.category, edge.from),
      toClusterId: edge.toClusterId ?? clusterIdOfSurface(table, edge.category, edge.to),
    })),
  };
}

interface OperatorCell {
  operator: RollupOperator;
  contract: string;
  needsVectors: boolean;
  lambdas: number[];
  /** Set when the cell cannot run (missing sidecar file); the CLI prints it and skips. */
  skip?: string;
}

/** The operator instances for one --operator name on one (run, category) cell. */
function operatorsFor(name: string, run: string, category: string): OperatorCell[] {
  const sweep = (key: string) => (LAMBDAS_EXPLICIT ? LAMBDAS : DEFAULT_SWEEP[key]);
  const contractCells = (make: (types: BroaderType[] | null, contract: string) => RollupOperator) =>
    CONTRACTS.map((contract) => {
      const types = CONTRACT_TYPES[contract];
      if (types === undefined) throw new Error(`unknown --contract "${contract}"; expected ${Object.keys(CONTRACT_TYPES).join(', ')}`);
      return { types, contract, operator: make(types, contract) };
    });
  const base = (key: string): OperatorCell[] => {
    switch (key) {
      case 'graph':
        return contractCells((types) => new GraphWalkRollup({ contract: types })).map((c) => ({
          operator: c.operator, contract: c.contract, needsVectors: false, lambdas: sweep('graph'),
        }));
      case 'facet':
        return [{ operator: new FacetRollup(), contract: '-', needsVectors: false, lambdas: DEFAULT_SWEEP.facet }];
      case 'hac':
      case 'hac-constrained':
      case 'hac-constrained-root':
        return [{
          operator: new HacRollup({ constrained: key !== 'hac', targetRule: key === 'hac-constrained-root' ? 'root' : 'medoid' }),
          contract: '-', needsVectors: true, lambdas: sweep(key),
        }];
      default: {
        const spec = CANDIDATE_OPERATORS[key];
        if (!spec) {
          throw new Error(`unknown --operator "${name}"; expected graph|facet|hac|hac-constrained|hac-constrained-root|${Object.keys(CANDIDATE_OPERATORS).join('|')}|hybrid-<one of those>`);
        }
        const file = candidatesPath(run, category, spec.file);
        const operator = new HyperbolicRollup({ candidatesPath: file, method: spec.method, name: key });
        return [{ operator, contract: '-', needsVectors: false, lambdas: sweep(key), skip: existsSync(file) ? undefined : `missing ${file}` }];
      }
    }
  };
  if (name.startsWith('hybrid-')) {
    const short: Record<string, string> = {
      hit: 'hyperbolic-hit', 'hit-gloss': 'hyperbolic-hit-gloss', euclid: 'hyperbolic-euclid',
      'euclid-normfilter': 'hyperbolic-euclid-normfilter', 'euclid-normfilter-gloss': 'hyperbolic-euclid-normfilter-gloss',
    };
    const inner = short[name.slice('hybrid-'.length)] ?? name.slice('hybrid-'.length);
    return base(inner).flatMap((cell) =>
      contractCells((types) => new HybridRollup({ contract: types, fallback: cell.operator })).map((c) => ({
        operator: c.operator, contract: c.contract, needsVectors: cell.needsVectors, lambdas: cell.lambdas, skip: cell.skip,
      }))
    );
  }
  return base(name);
}

/** E1 vectors keyed by canonical, joined through the scheme export's `text` field. */
function vectorsFor(run: string, category: string): Map<string, number[]> | undefined {
  const exportPath = schemeExportPath(run, category);
  const vectorsFile = vectorsPath(run, category, VECTORS_PROVIDER, VECTORS_MODEL);
  if (!existsSync(exportPath) || !existsSync(vectorsFile)) return undefined;
  const scheme = JSON.parse(readFileSync(exportPath, 'utf8')) as SchemeExport;
  const byText = readVectorsJsonl(vectorsFile);
  const out = new Map<string, number[]>();
  for (const concept of scheme.concepts) {
    const vector = byText.get(concept.text);
    if (vector) out.set(concept.prefLabel, vector);
  }
  return out;
}

const pct = (value: number | null) => (value === null ? '   -  ' : `${(value * 100).toFixed(1).padStart(5)}%`);
const f3 = (value: number) => value.toFixed(3);

async function main() {
  if (RUNS.length === 0) {
    throw new Error(
      'usage: rollup-eval --run <runDir> [--run …] --operator graph,facet [--contract all,broaderInstantial] [--category X,Y] [--lambda-sweep 0,0.5,…] --gold gold/gold.json [--split test|dev] [--hierarchy-all-splits] [--out out.json]'
    );
  }
  const fullTable = await loadGoldTable(GOLD);
  const table = ALL_SPLITS ? fullTable : selectSplit(fullTable, SPLIT);
  const gold = goldFor(table);
  const splitLabel = ALL_SPLITS ? 'all' : SPLIT;
  const schemesWithEdges = [...new Set(gold.edges.filter((e) => e.kind !== 'renamed-to').map((e) => e.category))];

  const rows: RollupEvalRow[] = [];
  const curves: Array<{ run: string; operator: string; contract: string; category: string; aupc: number | null; points: Array<{ lambda: number | null; targets: number; soundPct: number | null }> }> = [];

  for (const runDir of RUNS) {
    const run = path.basename(runDir.replace(/\/$/, ''));
    const registry = new ConceptRegistry({ filePath: path.join(runDir, 'registry.json') });
    await registry.load();
    const categories = (CATEGORIES.length ? CATEGORIES : schemesWithEdges).filter((c) =>
      registry.conceptSchemes().some((s) => s.toLowerCase() === c.toLowerCase())
    );

    for (const operatorName of OPERATORS) {
      for (const wanted of categories) {
        const category = registry.conceptSchemes().find((s) => s.toLowerCase() === wanted.toLowerCase())!;
        for (const { operator, contract, needsVectors, lambdas, skip } of operatorsFor(operatorName, run, category)) {
          if (skip) {
            console.log(`\n=== ${run} · ${operator.name} · ${category}: SKIPPED (${skip})`);
            continue;
          }
          const canonicals = Object.keys(registry.concepts(category)).map((canonical) => ({
            canonical,
            surfaces: registry.labelSurfaces(category, canonical),
          }));
          const vectors = needsVectors ? vectorsFor(run, category) : undefined;
          if (needsVectors && !vectors) {
            console.log(`\n=== ${run} · ${operator.name} · ${category}: SKIPPED (no E1 vectors for ${VECTORS_PROVIDER}/${VECTORS_MODEL})`);
            continue;
          }
          const points: Array<{ lambda: number | null; targets: number; soundPct: number | null }> = [];

          console.log(`\n=== ${run} · ${operator.name} · ${category} (${canonicals.length} canonicals, gold split=${splitLabel})`);
          console.log('  λ      sound   complete  denom  B³F1   ARI    targets  edges  abstract  exch exch! win¬off  ms');
          for (const lambda of lambdas) {
            const started = process.hrtime.bigint();
            const result = operator.fold({ registry, category, vectors, lambda });
            const foldMs = Number(process.hrtime.bigint() - started) / 1e6;
            const m = rollupMetrics({ category, result, canonicals, gold });
            const row: RollupEvalRow = {
              run, operator: operator.name, contract, category,
              lambda: Number.isFinite(lambda) ? lambda : null, lambdaLabel: Number.isFinite(lambda) ? String(lambda) : 'inf',
              split: splitLabel,
              sound: m.sound, complete: m.complete, denominator: m.denominator,
              soundPct: m.soundPct, completePct: m.completePct, goldMapped: m.goldMapped,
              canonicals: m.canonicals, targetUnmapped: m.targetUnmapped, targets: m.targets,
              bcubedP: m.bcubed.precision, bcubedR: m.bcubed.recall, bcubedF1: m.bcubed.f1, ari: m.ari,
              probes: m.probes, edgesUsed: result.edgesUsed, abstractNodes: result.abstractNodes.length,
              foldMs: Math.round(foldMs * 1000) / 1000,
            };
            rows.push(row);
            points.push({ lambda: Number.isFinite(lambda) ? lambda : null, targets: m.targets, soundPct: m.soundPct });
            const probe = (p: { ok: boolean | null }) => (p.ok === null ? ' n/a' : p.ok ? ' ok ' : 'FAIL');
            console.log(
              `  ${(Number.isFinite(lambda) ? lambda.toFixed(2) : '∞').padEnd(5)} ${pct(m.soundPct)}  ${pct(m.completePct)}   ${String(m.denominator).padStart(4)}  ` +
                `${f3(m.bcubed.f1)}  ${f3(m.ari).padStart(6)}  ${String(m.targets).padStart(6)}  ${String(result.edgesUsed).padStart(5)}  ` +
                `${String(result.abstractNodes.length).padStart(7)}   ${probe(m.probes.exchangeFamily)}  ${probe(m.probes.exchangeFamilyStrict)}  ${probe(m.probes.windowsNotOffice)}   ${foldMs.toFixed(1)}`
            );
          }
          const area = aupc(points.map((p) => ({ x: p.targets, y: p.soundPct })));
          curves.push({ run, operator: operator.name, contract, category, aupc: area, points });
          if (lambdas.length > 1) console.log(`  AUPC (sound vs #targets over the sweep): ${area === null ? '-' : f3(area)}`);
        }
      }
    }
  }

  if (OUT) {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          gold: GOLD, split: splitLabel,
          lambdaSweep: LAMBDAS_EXPLICIT ? LAMBDAS.map((l) => (Number.isFinite(l) ? l : 'inf')) : DEFAULT_SWEEP,
          command: process.argv.slice(2).join(' '),
          rows, aupc: curves,
        },
        null,
        2
      ) + '\n'
    );
    console.log(`\nwrote ${OUT} (${rows.length} rows)`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
