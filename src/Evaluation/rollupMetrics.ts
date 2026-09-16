import { adjustedRandIndex, bCubedPRF, type PRF } from './clusterMetrics';
import {
  mapCanonicalsToGold,
  type GoldClusterForHierarchy,
  type GoldHierarchyEdge,
} from './hierarchyMetrics';
import { Partition, normalizeSurface } from './partition';
import { isAbstractId, type RollupResult } from '../Rollup/types';

/**
 * Roll-up scoring against the gold hierarchy (SKEIN-SKOS-rollup paper).
 *
 * A fold is scored per concept scheme, between gold clusters (never between labels): every
 * canonical is mapped to its gold cluster by surface majority (`mapCanonicalsToGold`), and the
 * gold `isa`/`part-of` edges (finer → coarser) give each cluster an ancestor set.
 *
 * - **sound**: the target's gold cluster is the canonical's own cluster or one of its gold
 *   ancestors — the fold never crossed a family boundary. A canonical left in place is sound.
 * - **complete**: the target's gold cluster is a topmost gold ancestor (a root of the canonical's
 *   ancestor DAG) — the fold went all the way up.
 * - **denominator**: canonicals mapped to a gold cluster that HAS at least one gold ancestor; a
 *   canonical whose cluster is already a root cannot be folded correctly or incorrectly.
 * - **B-cubed / ARI** of the fold partition against the gold-projected partition, where every
 *   gold cluster is rolled to its topmost ancestor (lexicographically smallest root when the DAG
 *   has several). Elements are all gold-mapped canonicals of the scheme, so over-folding root
 *   singletons is penalised.
 *
 * Abstract targets (`facet:…`, `hac:…`, `hyp:…`) map to gold through their label as a surface;
 * an unmapped target is neither sound nor complete and is counted in `targetUnmapped`.
 * `renamed-to` edges are not hierarchy and are ignored.
 */
export interface RollupProbe {
  ok: boolean | null;
  members: number;
  detail: string[];
}

export interface RollupMetrics {
  category: string;
  canonicals: number;
  goldMapped: number;
  denominator: number;
  sound: number;
  complete: number;
  soundPct: number | null;
  completePct: number | null;
  targetUnmapped: number;
  /** Distinct fold targets over the whole scheme (canonicals + abstract nodes). */
  targets: number;
  bcubed: PRF;
  ari: number;
  probes: { exchangeFamily: RollupProbe; exchangeFamilyStrict: RollupProbe; windowsNotOffice: RollupProbe };
}

export interface RollupGold {
  clusters: GoldClusterForHierarchy[];
  edges: GoldHierarchyEdge[];
}

const HIERARCHY_KINDS = new Set(['isa', 'part-of', 'broadergeneric', 'broaderinstantial', 'broaderpartitive']);

/** Ancestor sets and projected roots over the gold edges of one category. */
export function goldAncestry(gold: RollupGold, category: string): {
  ancestors: (clusterId: string) => Set<string>;
  roots: (clusterId: string) => string[];
  projectedRoot: (clusterId: string) => string;
} {
  const want = category.trim().toLowerCase();
  const ids = new Set(gold.clusters.filter((c) => c.category.trim().toLowerCase() === want).map((c) => c.id));
  const out = new Map<string, Set<string>>();
  for (const edge of gold.edges) {
    if (edge.category.trim().toLowerCase() !== want) continue;
    if (!HIERARCHY_KINDS.has(edge.kind.trim().toLowerCase())) continue;
    const from = edge.fromClusterId;
    const to = edge.toClusterId;
    if (!from || !to || from === to || !ids.has(from) || !ids.has(to)) continue;
    (out.get(from) ?? out.set(from, new Set()).get(from)!).add(to);
  }
  const memo = new Map<string, Set<string>>();
  const ancestors = (id: string): Set<string> => {
    const cached = memo.get(id);
    if (cached) return cached;
    const seen = new Set<string>();
    const stack = [...(out.get(id) ?? [])];
    while (stack.length) {
      const node = stack.pop()!;
      if (node === id || seen.has(node)) continue;
      seen.add(node);
      for (const next of out.get(node) ?? []) stack.push(next);
    }
    memo.set(id, seen);
    return seen;
  };
  const roots = (id: string): string[] => {
    const up = ancestors(id);
    if (up.size === 0) return [];
    const tops = [...up].filter((a) => (out.get(a)?.size ?? 0) === 0);
    // A cycle in gold has no sink; fall back to the whole ancestor set so the metric stays defined.
    return (tops.length ? tops : [...up]).sort();
  };
  const projectedRoot = (id: string) => roots(id)[0] ?? id;
  return { ancestors, roots, projectedRoot };
}

export function rollupMetrics(params: {
  category: string;
  result: RollupResult;
  /** The scheme's canonicals with their label surfaces (`registry.labelSurfaces`). */
  canonicals: Array<{ canonical: string; surfaces: string[] }>;
  gold: RollupGold;
}): RollupMetrics {
  const { category, result, canonicals, gold } = params;
  const want = category.trim().toLowerCase();
  const goldClusters = gold.clusters.filter((c) => c.category.trim().toLowerCase() === want);
  const mapped = mapCanonicalsToGold(
    canonicals.map((c) => ({ category, canonical: c.canonical, surfaces: c.surfaces })),
    goldClusters
  );
  const goldOf = (canonical: string) => mapped.get(`${want}|${canonical}`);

  const clusterOfSurface = new Map<string, string>();
  for (const cluster of goldClusters) {
    for (const member of cluster.members) clusterOfSurface.set(normalizeSurface(member), cluster.id);
  }
  const abstractLabel = new Map(result.abstractNodes.map((node) => [node.id, node.label]));
  const goldOfTarget = (target: string) =>
    isAbstractId(target)
      ? clusterOfSurface.get(normalizeSurface(abstractLabel.get(target) ?? target.replace(/^[a-z]+:/, '')))
      : goldOf(target);
  const labelOfTarget = (target: string) => abstractLabel.get(target) ?? target;

  const { ancestors, roots, projectedRoot } = goldAncestry(gold, category);

  let goldMapped = 0;
  let denominator = 0;
  let sound = 0;
  let complete = 0;
  let targetUnmapped = 0;
  const foldGroups = new Map<string, string[]>();
  const goldGroups = new Map<string, string[]>();

  for (const { canonical } of canonicals) {
    const own = goldOf(canonical);
    if (!own) continue;
    goldMapped += 1;
    const target = result.target.get(canonical) ?? canonical;
    (foldGroups.get(target) ?? foldGroups.set(target, []).get(target)!).push(canonical);
    const root = projectedRoot(own);
    (goldGroups.get(root) ?? goldGroups.set(root, []).get(root)!).push(canonical);

    const up = ancestors(own);
    if (up.size === 0) continue;
    denominator += 1;
    const targetGold = goldOfTarget(target);
    if (!targetGold) {
      targetUnmapped += 1;
      continue;
    }
    if (targetGold === own || up.has(targetGold)) sound += 1;
    if (roots(own).includes(targetGold)) complete += 1;
  }

  const predicted = new Partition([...foldGroups.entries()].map(([id, members]) => ({ id: `fold:${id}`, members })));
  const projected = new Partition([...goldGroups.entries()].map(([id, members]) => ({ id: `gold:${id}`, members })));

  return {
    category,
    canonicals: canonicals.length,
    goldMapped,
    denominator,
    sound,
    complete,
    soundPct: denominator ? sound / denominator : null,
    completePct: denominator ? complete / denominator : null,
    targetUnmapped,
    targets: new Set([...result.target.values()]).size,
    bcubed: bCubedPRF(predicted, projected),
    ari: adjustedRandIndex(predicted, projected),
    probes: {
      exchangeFamily: exchangeFamilyProbe(result, canonicals.map((c) => c.canonical), labelOfTarget),
      exchangeFamilyStrict: exchangeFamilyProbe(result, canonicals.map((c) => c.canonical), labelOfTarget, { strict: true }),
      windowsNotOffice: windowsNotOfficeProbe(result, canonicals.map((c) => c.canonical), labelOfTarget),
    },
  };
}

/**
 * All canonicals labelled `Microsoft Exchange Server…` fold to ONE target (loose). The `strict`
 * version additionally requires that target's label to contain `Exchange`: a family collapsed onto
 * `Windows Server` is one target but the wrong one, and the loose probe would pass it.
 */
export function exchangeFamilyProbe(
  result: RollupResult,
  canonicals: string[],
  labelOfTarget: (target: string) => string = (t) => t,
  options: { strict?: boolean } = {}
): RollupProbe {
  const members = canonicals.filter((c) => c.startsWith('Microsoft Exchange Server'));
  const targets = new Set(members.map((c) => result.target.get(c) ?? c));
  const labels = [...targets].map(labelOfTarget).sort();
  const one = targets.size === 1;
  return {
    ok: members.length === 0 ? null : options.strict ? one && /exchange/i.test(labels[0]) : one,
    members: members.length,
    detail: labels,
  };
}

/** No canonical labelled `Windows…` folds to a target whose label contains `Office`. */
export function windowsNotOfficeProbe(
  result: RollupResult,
  canonicals: string[],
  labelOfTarget: (target: string) => string = (t) => t
): RollupProbe {
  const members = canonicals.filter((c) => c.startsWith('Windows'));
  const violations = members.filter((c) => /office/i.test(labelOfTarget(result.target.get(c) ?? c)));
  return {
    ok: members.length === 0 ? null : violations.length === 0,
    members: members.length,
    detail: violations.sort(),
  };
}

/**
 * Area under a purity-vs-#clusters curve, normalised to [0, 1]: `x` is the number of fold targets
 * (or any monotone granularity axis), `y` the purity (here `soundPct`). Points are sorted by `x`,
 * `x` is rescaled to [0, 1] over its observed range and integrated by the trapezoid rule, so the
 * result is the mean purity across the swept granularities weighted by how much of the axis each
 * step covers. One point returns its `y`; no points returns null.
 */
export function aupc(points: Array<{ x: number; y: number | null }>): number | null {
  const usable = points.filter((p): p is { x: number; y: number } => p.y !== null && Number.isFinite(p.x));
  if (usable.length === 0) return null;
  if (usable.length === 1) return usable[0].y;
  const sorted = [...usable].sort((a, b) => a.x - b.x);
  const xMin = sorted[0].x;
  const xMax = sorted[sorted.length - 1].x;
  if (xMax === xMin) return sorted.reduce((s, p) => s + p.y, 0) / sorted.length;
  let area = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const dx = (sorted[i].x - sorted[i - 1].x) / (xMax - xMin);
    area += (dx * (sorted[i].y + sorted[i - 1].y)) / 2;
  }
  return area;
}
