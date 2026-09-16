#!/usr/bin/env ts-node
/**
 * Export ONE concept scheme of a frozen SKEIN-R registry as a self-contained JSON for the Python
 * sidecar (`analysis/hyperbolic/`) and the embed step.
 *
 *   npm run export-scheme -- --run runs/experiments/<arm> --category Software [--gold gold/gold.json] [--out file]
 *
 * Writes `analysis/hyperbolic/in/scheme-<arm>-<scheme>.json` (`<arm>` = the run dir's basename):
 *   { run, category,
 *     concepts: [{ prefLabel, labels: [surfaces], definition, text: "prefLabel: definition" | prefLabel }],
 *     edges:    [{ narrower, broader, type, similarityScore, decision }],
 *     goldMap:  { prefLabel: clusterId },        // surface-majority mapping (mapCanonicalsToGold)
 *     goldEdges:[{ fromClusterId, toClusterId, kind, split }] }   // split = test | dev | cross
 *
 * `split` is derived from the two endpoint clusters' `split` fields: both test → test, both dev →
 * dev, otherwise cross. The reportable slice is `test` (docs/ROLLUP-PROTOCOL.md).
 */
import { ConceptRegistry } from '../src/ConceptRegistry/ConceptRegistry';
import { loadGoldTable } from '../src/Evaluation/gold';
import { mapCanonicalsToGold } from '../src/Evaluation/hierarchyMetrics';
import { schemeExportPath, type SchemeExport } from '../src/Rollup/schemeIo';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const flag = (name: string, fallback = '') => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};
const RUN = flag('run');
const CATEGORY = flag('category');
const GOLD = flag('gold', 'gold/gold.json');
const OUT = flag('out', '');

async function main() {
  if (!RUN || !CATEGORY) throw new Error('usage: export-scheme --run <runDir> --category <scheme> [--gold gold/gold.json] [--out file]');
  const registry = new ConceptRegistry({ filePath: path.join(RUN, 'registry.json') });
  await registry.load();
  const category = registry.conceptSchemes().find((s) => s.toLowerCase() === CATEGORY.toLowerCase());
  if (!category) throw new Error(`no scheme "${CATEGORY}" in ${RUN}; have ${registry.conceptSchemes().join(', ')}`);

  const table = await loadGoldTable(GOLD);
  const want = category.toLowerCase();
  const clusters = table.clusters.filter((c) => c.category.trim().toLowerCase() === want);
  const splitOf = new Map(clusters.map((c) => [c.id, c.split]));

  const records = registry.concepts(category);
  const concepts = Object.keys(records).sort().map((prefLabel) => {
    const definition = records[prefLabel].definition ?? null;
    return {
      prefLabel,
      labels: [...new Set(registry.labelSurfaces(category, prefLabel))],
      definition,
      text: definition ? `${prefLabel}: ${definition}` : prefLabel,
    };
  });
  const mapped = mapCanonicalsToGold(
    concepts.map((c) => ({ category, canonical: c.prefLabel, surfaces: c.labels })),
    clusters
  );
  const goldMap: Record<string, string> = {};
  for (const [key, clusterId] of mapped) goldMap[key.slice(key.indexOf('|') + 1)] = clusterId;

  const out: SchemeExport = {
    run: path.basename(RUN.replace(/\/$/, '')),
    category,
    concepts,
    edges: registry.broaderEdges(category).map((edge) => ({
      narrower: edge.narrower,
      broader: edge.broader,
      type: edge.type ?? null,
      similarityScore: edge.similarityScore ?? null,
      decision: edge.decision,
    })),
    goldMap,
    goldEdges: (table.edges ?? [])
      .filter((edge) => edge.category.trim().toLowerCase() === want && edge.fromClusterId && edge.toClusterId)
      .map((edge) => {
        const a = splitOf.get(edge.fromClusterId!);
        const b = splitOf.get(edge.toClusterId!);
        return {
          fromClusterId: edge.fromClusterId!,
          toClusterId: edge.toClusterId!,
          kind: edge.kind,
          split: a === 'test' && b === 'test' ? 'test' : a === 'dev' && b === 'dev' ? 'dev' : 'cross',
        } as const;
      }),
  };

  const target = OUT || schemeExportPath(RUN, category);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(out, null, 1) + '\n');
  console.log(
    `wrote ${target}: ${concepts.length} concepts, ${out.edges.length} edges, ${Object.keys(goldMap).length} gold-mapped, ` +
      `${out.goldEdges.length} gold edges (${out.goldEdges.filter((e) => e.split === 'test').length} test-test)`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
