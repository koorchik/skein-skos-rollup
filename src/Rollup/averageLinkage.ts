import { cosineNormalized } from '../utils/vectorUtils';

/**
 * Average-linkage agglomerative clustering with a similarity cutoff: merge while the best pair of
 * clusters has mean pairwise cosine ≥ `cutoff`. Promoted from the throwaway
 * `skein-extractor/bin/spike-schemes.ts` (where single linkage had chained the whole pool into
 * one cluster on the smoke run).
 *
 * Implementation: Lance–Williams update on a dense cluster×cluster similarity matrix —
 * `sim(k, i∪j) = (|i|·sim(k,i) + |j|·sim(k,j)) / (|i|+|j|)` — which IS the mean pairwise cosine,
 * so the result equals the naive "recompute every pair" version, but each merge costs O(n) updates
 * plus one O(n²) scan for the best pair: O(n³) worst case with a tiny constant (n ≤ 2k here, and
 * R2's λ sweep re-runs it per cutoff).
 *
 * `mustLink` (optional) seeds the clustering with groups of indices that are merged unconditionally
 * BEFORE the cutoff-governed merges start (R2's `constrained` variant puts the judge edges here).
 * Overlapping groups are unioned; indices absent from every group start as singletons.
 *
 * Input vectors must already be L2-normalised (`cosineNormalized` is a plain dot product).
 * Returns clusters as arrays of input indices, largest first; the order inside a cluster is
 * insertion order, so the result is deterministic for a given input order. Ties on the best pair
 * go to the lowest (i, j) in scan order.
 */
export function averageLinkage(vecs: number[][], cutoff: number, mustLink: number[][] = []): number[][] {
  const n = vecs.length;
  if (n === 0) return [];

  // Seed clusters: union-find over the must-link groups, singletons elsewhere; clusters are
  // ordered by their lowest member so the seeding is independent of the groups' order.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const group of mustLink) {
    for (let g = 1; g < group.length; g += 1) {
      const a = find(group[0]);
      const b = find(group[g]);
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
    }
  }
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    (byRoot.get(root) ?? byRoot.set(root, []).get(root)!).push(i);
  }
  const members = [...byRoot.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list);

  const point = vecs.map((a) => vecs.map((b) => cosineNormalized(a, b)));
  const m = members.length;
  const size = members.map((c) => c.length);
  const sim: number[][] = members.map((a) =>
    members.map((b) => {
      let total = 0;
      for (const i of a) for (const j of b) total += point[i][j];
      return total / (a.length * b.length);
    })
  );
  const active: boolean[] = new Array(m).fill(true);
  let remaining = m;

  while (remaining > 1) {
    let best = -Infinity;
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < m; i += 1) {
      if (!active[i]) continue;
      const row = sim[i];
      for (let j = i + 1; j < m; j += 1) {
        if (active[j] && row[j] > best) {
          best = row[j];
          bi = i;
          bj = j;
        }
      }
    }
    if (bi < 0 || best < cutoff) break;
    const si = size[bi];
    const sj = size[bj];
    for (let k = 0; k < m; k += 1) {
      if (!active[k] || k === bi || k === bj) continue;
      const merged = (si * sim[k][bi] + sj * sim[k][bj]) / (si + sj);
      sim[k][bi] = merged;
      sim[bi][k] = merged;
    }
    members[bi].push(...members[bj]);
    members[bj] = [];
    size[bi] = si + sj;
    active[bj] = false;
    remaining -= 1;
  }
  return members.filter((_, i) => active[i]).sort((a, b) => b.length - a.length);
}
