import { averageLinkage } from './averageLinkage';
import { FacetRollup } from './FacetRollup';
import { isAbstractId, type AbstractNode, type RollupInput, type RollupOperator, type RollupResult } from './types';
import { cosineNormalized, l2Normalize } from '../utils/vectorUtils';

/**
 * R2 — Euclidean average-linkage HAC over E1 vectors, on R1 families.
 *
 * Contract: `input.vectors` maps canonicals of the scheme to E1 vectors (`name: gloss` text,
 * `bin/embed-scheme.ts`, read from `analysis/hyperbolic/in/vectors-<arm>-<scheme>-<provider>-<model>.jsonl`;
 * re-normalised here defensively). `lambda` is the average-linkage similarity cutoff.
 *
 * Steps:
 *  (a) R1 (`FacetRollup`) first. Every R1 target is a *family representative*: the family's
 *      canonical when the stripped label resolves to one, else the `facet:` abstract node; a
 *      canonical R1 leaves alone is its own representative. A representative's vector is the
 *      L2-normalised centroid of its members' vectors (a lone canonical: its own vector).
 *      Representatives with no vector at all stay out of the clustering and fold to themselves.
 *  (b) `averageLinkage` over the representatives with cutoff `lambda`. With `constrained: true`,
 *      every judge edge of the scheme (any broader type) is a must-link between the two endpoints'
 *      representatives, merged before HAC starts.
 *  (c) Each cluster's roll-up target is its medoid — the representative with the highest mean
 *      cosine to the other representatives of the cluster; ties go to the shortest label, then the
 *      lexically smallest. Singletons target themselves. Members of an R1 family inherit the
 *      family's cluster target, so `Office 2010` follows `Microsoft Office` wherever it goes.
 *      With `targetRule: 'root'` (`hac-constrained-root`) the target is instead the cluster's
 *      judge-edge root: the representative with NO outgoing judge edge to another member of the
 *      cluster; ties → highest in-degree from cluster members, then the medoid rule among the tied.
 *      A cluster without any internal edge therefore falls back to the medoid; a cluster whose
 *      internal edges form a cycle through R1 families (possible only via family mapping) too.
 *
 * The target is therefore always a canonical or an R1 `facet:` node (a cluster whose medoid is a
 * facet node keeps that node as target); no `hac:` nodes are minted. `edgesUsed` counts the judge
 * edges consumed as must-links (0 unconstrained).
 */
export class HacRollup implements RollupOperator {
  readonly name: string;
  readonly #constrained: boolean;
  readonly #targetRule: 'medoid' | 'root';

  constructor(options: { constrained?: boolean; targetRule?: 'medoid' | 'root' } = {}) {
    this.#constrained = options.constrained ?? false;
    this.#targetRule = options.targetRule ?? 'medoid';
    this.name = (this.#constrained ? 'hac-constrained' : 'hac') + (this.#targetRule === 'root' ? '-root' : '');
  }

  fold(input: RollupInput): RollupResult {
    const { registry, category, lambda } = input;
    const vectors = input.vectors ?? new Map<string, number[]>();
    const r1 = new FacetRollup().fold(input);

    // (a) representatives and their member lists (a representative canonical is its own member).
    const membersOf = new Map<string, string[]>();
    for (const [canonical, target] of r1.target) {
      (membersOf.get(target) ?? membersOf.set(target, []).get(target)!).push(canonical);
    }
    const representatives = [...membersOf.keys()].sort();
    const repVector = new Map<string, number[]>();
    for (const rep of representatives) {
      const vecs = membersOf.get(rep)!.map((m) => vectors.get(m)).filter((v): v is number[] => !!v);
      if (vecs.length === 0) continue;
      const dims = vecs[0].length;
      const centroid = new Array<number>(dims).fill(0);
      for (const v of vecs) for (let i = 0; i < dims; i += 1) centroid[i] += v[i];
      repVector.set(rep, l2Normalize(centroid));
    }
    const clustered = representatives.filter((rep) => repVector.has(rep));
    const indexOf = new Map(clustered.map((rep, i) => [rep, i]));
    const vecs = clustered.map((rep) => repVector.get(rep)!);

    // (b) judge edges mapped through R1 to representative indices (narrower → broader); must-links
    //     when constrained, and the root rule's edge set in either case.
    const repEdges: Array<[number, number]> = [];
    for (const edge of registry.broaderEdges(category)) {
      const a = indexOf.get(r1.target.get(edge.narrower) ?? edge.narrower);
      const b = indexOf.get(r1.target.get(edge.broader) ?? edge.broader);
      if (a === undefined || b === undefined || a === b) continue;
      repEdges.push([a, b]);
    }
    const mustLink: number[][] = this.#constrained ? repEdges : [];
    const edgesUsed = this.#constrained ? repEdges.length : 0;
    const clusters = averageLinkage(vecs, lambda, mustLink);

    // (c) target per cluster (medoid or judge-edge root); representatives outside the clustering
    //     target themselves.
    const repTarget = new Map<string, string>(representatives.map((rep) => [rep, rep]));
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      const points = cluster.map((i) => ({ index: i, label: clustered[i], vector: vecs[i] }));
      const chosen = this.#targetRule === 'root' ? rootOf(points, repEdges) : medoidOf(points);
      for (const i of cluster) repTarget.set(clustered[i], chosen);
    }

    const target = new Map<string, string>();
    for (const [canonical, rep] of r1.target) target.set(canonical, repTarget.get(rep) ?? rep);

    // Abstract nodes: only R1 facet nodes that are still targets, with their final member lists.
    const abstractMembers = new Map<string, string[]>();
    for (const [canonical, t] of target) {
      if (isAbstractId(t)) (abstractMembers.get(t) ?? abstractMembers.set(t, []).get(t)!).push(canonical);
    }
    const labelOf = new Map(r1.abstractNodes.map((node) => [node.id, node.label]));
    const abstractNodes: AbstractNode[] = [...abstractMembers.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([id, members]) => ({ id, label: labelOf.get(id) ?? id.replace(/^[a-z]+:/, ''), members }));
    return { target, abstractNodes, edgesUsed };
  }
}

/**
 * Label of a cluster's judge-edge root: a member with no outgoing edge to another member; ties →
 * highest in-degree from members, then the medoid rule among the tied. Falls back to the medoid of
 * the whole cluster when every member has an outgoing internal edge (a cycle through families).
 */
export function rootOf(
  points: Array<{ index: number; label: string; vector: number[] }>,
  edges: Array<[number, number]>
): string {
  const inside = new Set(points.map((p) => p.index));
  const outgoing = new Set<number>();
  const inDegree = new Map<number, number>();
  for (const [from, to] of edges) {
    if (!inside.has(from) || !inside.has(to)) continue;
    outgoing.add(from);
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }
  const roots = points.filter((p) => !outgoing.has(p.index));
  if (roots.length === 0) return medoidOf(points);
  const top = Math.max(...roots.map((p) => inDegree.get(p.index) ?? 0));
  const tied = roots.filter((p) => (inDegree.get(p.index) ?? 0) === top);
  if (tied.length === 1) return tied[0].label;
  // Medoid rule among the tied, but mean cosine measured against the WHOLE cluster.
  const withMean = tied.map((p) => ({
    label: p.label,
    vector: p.vector,
    mean: points.filter((q) => q !== p).reduce((s, q) => s + cosineNormalized(p.vector, q.vector), 0) / Math.max(1, points.length - 1),
  }));
  const best = Math.max(...withMean.map((p) => p.mean));
  return medoidOf(withMean.filter((p) => Math.abs(p.mean - best) <= 1e-12));
}

/** Label of a cluster's medoid: highest mean cosine to the others; ties → shortest, then lexical. */
export function medoidOf(points: Array<{ label: string; vector: number[] }>): string {
  const display = (label: string) => (isAbstractId(label) ? label.replace(/^[a-z]+:/, '') : label);
  let best: { label: string; mean: number } | null = null;
  for (const p of points) {
    let total = 0;
    for (const q of points) if (q !== p) total += cosineNormalized(p.vector, q.vector);
    const mean = points.length > 1 ? total / (points.length - 1) : 1;
    if (
      !best ||
      mean > best.mean + 1e-12 ||
      (Math.abs(mean - best.mean) <= 1e-12 &&
        (display(p.label).length < display(best.label).length ||
          (display(p.label).length === display(best.label).length && display(p.label) < display(best.label))))
    ) {
      best = { label: p.label, mean };
    }
  }
  return best!.label;
}
