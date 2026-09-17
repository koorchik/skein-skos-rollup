import type { ConceptRegistry } from '../ConceptRegistry/ConceptRegistry';

/**
 * The roll-up stage contract (SKEIN-SKOS-rollup paper).
 *
 * A roll-up operator folds every concept of ONE concept scheme (category) onto a target: either
 * another canonical of the same scheme or an abstract node the operator minted (`facet:…`,
 * `hac:…`, `hyp:…`). A fold must be a *function* — one target per canonical — so that mention
 * counts aggregate without double counting. Targets that are themselves canonicals are NOT
 * re-folded by the caller; an operator that wants transitive folding does it inside `fold`.
 *
 * No operator may call an LLM. `vectors` are precomputed (E1/E3 enrichments, read from
 * `analysis/hyperbolic/in/`), and `lambda` is the operator's single continuous knob (similarity
 * threshold for R0/R2, norm-gap weight for R3), swept by `bin/rollup-eval.ts`.
 */
export interface RollupInput {
  registry: ConceptRegistry;
  category: string;
  /** canonical → vector (already L2-normalised for Euclidean operators; raw ball point for R3). */
  vectors?: Map<string, number[]>;
  lambda: number;
}

export interface AbstractNode {
  /** Namespaced id, never colliding with a canonical: `facet:<label>`, `hac:<n>`, `hyp:<label>`. */
  id: string;
  label: string;
  /** Canonicals folded onto this node. */
  members: string[];
}

export interface RollupResult {
  /** canonical → target: a canonical of the same scheme (possibly itself) or an abstract node id. */
  target: Map<string, string>;
  abstractNodes: AbstractNode[];
  /** Registry edges the fold actually traversed (0 for label-only operators). */
  edgesUsed: number;
}

export interface RollupOperator {
  name: string;
  fold(input: RollupInput): RollupResult;
}

/** Operators mint abstract ids under a prefix so a target string is self-describing. */
export const ABSTRACT_PREFIXES = ['facet:', 'hac:', 'hyp:'] as const;

export function isAbstractId(target: string): boolean {
  return ABSTRACT_PREFIXES.some((prefix) => target.startsWith(prefix));
}

export class NotImplemented extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet — see docs/EXPERIMENT-PLAN.md`);
    this.name = 'NotImplemented';
  }
}
