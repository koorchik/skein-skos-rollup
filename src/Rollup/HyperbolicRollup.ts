import { FacetRollup } from './FacetRollup';
import { readCandidatesFile, type CandidatesFile } from './schemeIo';
import { isAbstractId, type AbstractNode, type RollupInput, type RollupOperator, type RollupResult } from './types';

export type CandidateMethod = 'hit' | 'euclid' | 'euclid-normfilter';

/**
 * R3 — ranked-parent roll-up over a precomputed candidates file, on R1 families.
 *
 * The candidates come from the Python sidecar (`analysis/hyperbolic/out/candidates-<arm>-<scheme>-<method>-0.json`):
 *  - `hit`: HiT zero-shot ball vectors, `score = -(dist(c,p) + w·(norm0(p) − norm0(c)))`, parents
 *    restricted to a SMALLER origin-norm than the child (`hit_zeroshot.py`);
 *  - `euclid`: top-k by cosine on the E1 vectors, no restriction (`euclid_candidates.py`);
 *  - `euclid-normfilter`: the same cosine ranking restricted to smaller-HiT-norm parents — the
 *    control that isolates what the norm order carries beyond cosine.
 *
 * Fold: R1 first. For every canonical whose R1 target is itself (family representatives and
 * unfamilied concepts), take the best-ranked candidate that clears `lambda` — for `hit` λ is a
 * geodesic DISTANCE bound (`dist ≤ λ`, `Infinity` = no bound); for the two Euclidean methods λ is a
 * cosine threshold (`score ≥ λ`) — and whose R1 representative is not the concept itself. A
 * candidate that is an R1 member (e.g. `Office 2010`) is resolved to its family representative,
 * so families are the units on both ends. R1 members (versions, editions) keep their R1 target.
 *
 * Walk (`hit` and `euclid-normfilter`, i.e. whenever the ranking carries norms): from the
 * representative reached, keep following ITS best acceptable candidate while the candidate's
 * origin-norm is strictly below the current node's (a node's own norm is read from its row's
 * `normChild`), at most `maxDepth` hops (default 4), cycle-guarded over resolved representatives;
 * the fold lands on the last node reached. Plain `euclid` is one hop (cosine has no direction, so
 * a walk would drift).
 *
 * `edgesUsed` counts the candidate hops followed. Abstract nodes are R1's facet nodes with their
 * final member lists.
 */
export class HyperbolicRollup implements RollupOperator {
  readonly name: string;
  readonly #candidatesPath: string;
  readonly #method: CandidateMethod;
  readonly #maxDepth: number;
  readonly #walk: boolean;
  #file: CandidatesFile | null = null;

  /** `name` overrides the reported operator name (e.g. `hyperbolic-hit-gloss` for a gloss-text ranking). */
  constructor(options: { candidatesPath: string; method: CandidateMethod; maxDepth?: number; walk?: boolean; name?: string }) {
    this.#candidatesPath = options.candidatesPath;
    this.#method = options.method;
    this.#maxDepth = options.maxDepth ?? 4;
    this.#walk = options.walk ?? options.method !== 'euclid';
    this.name = options.name ?? `hyperbolic-${options.method}`;
  }

  get method(): CandidateMethod {
    return this.#method;
  }

  #candidates(): CandidatesFile {
    if (!this.#file) this.#file = readCandidatesFile(this.#candidatesPath);
    return this.#file;
  }

  /** The λ gate: a distance bound for `hit`, a cosine floor for the Euclidean rankings. */
  accepts(candidate: { score: number; dist: number }, lambda: number): boolean {
    return this.#method === 'hit' ? candidate.dist <= lambda : candidate.score >= lambda;
  }

  fold(input: RollupInput): RollupResult {
    const { registry, category, lambda } = input;
    const r1 = new FacetRollup().fold(input);
    const canonicals = new Set(Object.keys(registry.concepts(category)));
    const rows = new Map(this.#candidates().rows.map((row) => [row.child, row.candidates]));
    const resolve = (label: string) => r1.target.get(label) ?? label;

    // A concept's own origin-norm, read from its row (every candidate of a row carries `normChild`).
    const normOf = new Map<string, number>();
    for (const [child, candidates] of rows) {
      const norm = candidates.find((c) => c.normChild !== null)?.normChild;
      if (norm !== undefined && norm !== null) normOf.set(child, norm);
    }
    /** Best acceptable candidate of `child`, resolved through R1, that is neither `self` nor already seen. */
    const step = (child: string, self: string, seen: Set<string>, belowNorm: number | null) =>
      (rows.get(child) ?? []).find((c) => {
        if (!canonicals.has(c.parent) || !this.accepts(c, lambda)) return false;
        if (belowNorm !== null && (c.normParent === null || c.normParent >= belowNorm)) return false;
        const resolved = resolve(c.parent);
        return resolved !== self && !seen.has(resolved);
      });

    const target = new Map<string, string>(r1.target);
    let edgesUsed = 0;
    for (const canonical of canonicals) {
      if (r1.target.get(canonical) !== canonical) continue; // R1 members keep their family
      const seen = new Set<string>([canonical]);
      const first = step(canonical, canonical, seen, null);
      if (!first) continue;
      let current = resolve(first.parent);
      let norm: number | null = normOf.get(current) ?? first.normParent;
      let hops = 1;
      seen.add(current);
      // Walk: from the representative reached, follow ITS best acceptable candidate while the
      // origin-norm keeps decreasing; a facet node has no row, so the walk ends there.
      while (this.#walk && hops < this.#maxDepth && norm !== null && !isAbstractId(current)) {
        const next = step(current, canonical, seen, norm);
        if (!next) break;
        current = resolve(next.parent);
        norm = normOf.get(current) ?? next.normParent;
        seen.add(current);
        hops += 1;
      }
      target.set(canonical, current);
      edgesUsed += hops;
    }

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
