import type { BroaderType } from '../ConceptRegistry/ConceptRegistry';
import { GraphWalkRollup } from './GraphWalkRollup';
import { isAbstractId, type AbstractNode, type RollupInput, type RollupOperator, type RollupResult } from './types';

/**
 * R4 — hybrid: the graph walk (R0, λ = 0 i.e. every judge edge of the contract is followed) where
 * the concept has a judge edge, the enriched operator (R2 / R3, or R1) for the orphans.
 *
 * `lambda` is passed to the fallback only; R0 always walks to the top of its chain. A concept R0
 * moves takes R0's target as is (the target is not re-folded through the fallback: a fold is a
 * function and targets are never re-folded by the caller — see `types.ts`). The fallback is run on
 * the WHOLE scheme, so an R1/R2 abstract node minted for two concepts can survive with one member
 * when R0 took the other; abstract nodes are the fallback's, restricted to the ones still in use. `edgesUsed` is the number of canonicals R0
 * moved (= distinct judge edges consumed as first hops).
 */
export class HybridRollup implements RollupOperator {
  readonly name: string;
  readonly #graph: GraphWalkRollup;
  readonly #fallback: RollupOperator;

  constructor(options: { contract?: BroaderType[] | null; fallback: RollupOperator }) {
    this.#graph = new GraphWalkRollup({ contract: options.contract ?? null });
    this.#fallback = options.fallback;
    const contract = options.contract ? options.contract.join('+') : 'all';
    this.name = `hybrid[${contract}]+${options.fallback.name}`;
  }

  fold(input: RollupInput): RollupResult {
    const r0 = this.#graph.fold({ ...input, lambda: 0 });
    const fb = this.#fallback.fold(input);
    const target = new Map<string, string>();
    let edgesUsed = 0;
    for (const [canonical, walked] of r0.target) {
      if (walked !== canonical) {
        target.set(canonical, walked);
        edgesUsed += 1;
      } else {
        target.set(canonical, fb.target.get(canonical) ?? canonical);
      }
    }
    const abstractMembers = new Map<string, string[]>();
    for (const [canonical, t] of target) {
      if (isAbstractId(t)) (abstractMembers.get(t) ?? abstractMembers.set(t, []).get(t)!).push(canonical);
    }
    const labelOf = new Map(fb.abstractNodes.map((node) => [node.id, node.label]));
    const abstractNodes: AbstractNode[] = [...abstractMembers.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([id, members]) => ({ id, label: labelOf.get(id) ?? id.replace(/^[a-z]+:/, ''), members }));
    return { target, abstractNodes, edgesUsed };
  }
}
