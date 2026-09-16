import { averageLinkage } from './averageLinkage';
import { l2Normalize } from '../utils/vectorUtils';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const unit = (v: number[]) => l2Normalize(v);

describe('averageLinkage', () => {
  it('merges two tight groups and keeps an outlier apart', () => {
    const vecs = [
      unit([1, 0, 0]),
      unit([0.98, 0.02, 0]),
      unit([0, 1, 0]),
      unit([0.02, 0.98, 0]),
      unit([0, 0, 1]),
    ];
    const clusters = averageLinkage(vecs, 0.9);
    const asSets = clusters.map((c) => [...c].sort().join(','));
    assert.deepEqual(asSets.sort(), ['0,1', '2,3', '4']);
  });

  it('a cutoff above every similarity leaves singletons; a cutoff of -1 merges everything', () => {
    const vecs = [unit([1, 0]), unit([0, 1]), unit([1, 1])];
    assert.equal(averageLinkage(vecs, 1.01).length, 3);
    assert.equal(averageLinkage(vecs, -1).length, 1);
  });

  it('uses the AVERAGE linkage, so a chain does not collapse into one cluster', () => {
    // a~b (0.95), b~c (0.95), a~c (0.55): single linkage would chain a,b,c; average at 0.8 does
    // not — after {a,b}, the link to c is mean(0.95, 0.55) = 0.75 < 0.8.
    const a = unit([1, 0]);
    const b = unit([Math.cos(0.3), Math.sin(0.3)]);
    const c = unit([Math.cos(0.6), Math.sin(0.6)]);
    const cutoff = 0.9;
    const clusters = averageLinkage([a, b, c], cutoff);
    assert.equal(clusters.length, 2);
    assert.equal(Math.max(...clusters.map((x) => x.length)), 2);
  });

  it('is empty on empty input and sorted largest-first', () => {
    assert.deepEqual(averageLinkage([], 0.5), []);
    const vecs = [unit([1, 0, 0]), unit([1, 0.01, 0]), unit([1, 0, 0.01]), unit([0, 1, 0])];
    const clusters = averageLinkage(vecs, 0.9);
    assert.equal(clusters[0].length, 3);
  });

  it('must-link groups are merged before the cutoff applies, even across dissimilar points', () => {
    const vecs = [unit([1, 0, 0]), unit([0, 1, 0]), unit([0.98, 0.02, 0]), unit([0, 0, 1])];
    const free = averageLinkage(vecs, 0.9).map((c) => [...c].sort().join(','));
    assert.deepEqual(free.sort(), ['0,2', '1', '3']);
    const linked = averageLinkage(vecs, 0.9, [[0, 1], [1, 3]]).map((c) => [...c].sort().join(','));
    // {0,1,3} is forced (overlapping groups are unioned); 2 then joins only if its mean cosine to
    // the group clears 0.9 — it does not (≈0.33), so it stays apart.
    assert.deepEqual(linked.sort(), ['0,1,3', '2']);
    assert.deepEqual(averageLinkage(vecs, -1, [[0, 1]]).length, 1);
  });
});
