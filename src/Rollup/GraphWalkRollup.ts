import type { BroaderType } from '../ConceptRegistry/ConceptRegistry';
import type { RollupInput, RollupOperator, RollupResult } from './types';

/**
 * R0 — graph walk over the stored skos:broader edges: a thin adapter around
 * `ConceptRegistry.rollupTarget`, which is the traversal `bin/fold-registry.ts` and every
 * downstream analysis already use (highest-similarity parent per hop, semantic brake).
 *
 * `lambda` is the brake: the walk stops before an edge whose frozen `similarityScore` is below
 * it. `lambda <= 0` means no brake (null-score edges are followed too), matching the fold CLI's
 * `--threshold 0` default. `contract` restricts the walk to ISO 25964 broader types; null = all.
 *
 * `edgesUsed` is the number of distinct edges traversed. Because the fold is a function, every
 * traversed edge is the first hop of exactly one canonical, so this equals the count of
 * canonicals whose target is not themselves.
 */
export class GraphWalkRollup implements RollupOperator {
  readonly name: string;
  readonly #contract: BroaderType[] | null;

  constructor(options: { contract?: BroaderType[] | null } = {}) {
    this.#contract = options.contract ?? null;
    this.name = this.#contract ? `graph[${this.#contract.join('+')}]` : 'graph';
  }

  fold(input: RollupInput): RollupResult {
    const { registry, category, lambda } = input;
    const options = { threshold: lambda > 0 ? lambda : null, contract: this.#contract };
    const target = new Map<string, string>();
    let edgesUsed = 0;
    for (const canonical of Object.keys(registry.concepts(category))) {
      const folded = registry.rollupTarget(category, canonical, options);
      target.set(canonical, folded);
      if (folded !== canonical) edgesUsed += 1;
    }
    return { target, abstractNodes: [], edgesUsed };
  }
}
