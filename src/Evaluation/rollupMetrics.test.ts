import { aupc, goldAncestry, rollupMetrics, type RollupGold } from './rollupMetrics';
import type { RollupResult } from '../Rollup/types';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const near = (actual: number | null, expected: number, tolerance = 1e-9) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < tolerance, `expected ${expected}, got ${actual}`);

// Gold: Exchange 2013 → Exchange (isa); Exchange 2016 → Exchange; Word → Office (part-of);
// Office → Microsoft Products (isa); Windows 10 → Windows; Windows and Microsoft Products are roots.
const gold: RollupGold = {
  clusters: [
    { id: 'g-exch', category: 'Software', members: ['Microsoft Exchange Server', 'MS Exchange'] },
    { id: 'g-exch13', category: 'Software', members: ['Microsoft Exchange Server 2013'] },
    { id: 'g-exch16', category: 'Software', members: ['Microsoft Exchange Server 2016'] },
    { id: 'g-word', category: 'Software', members: ['Word'] },
    { id: 'g-office', category: 'Software', members: ['MS Office', 'Microsoft Office'] },
    { id: 'g-msp', category: 'Software', members: ['Microsoft Products'] },
    { id: 'g-win', category: 'Software', members: ['Windows'] },
    { id: 'g-win10', category: 'Software', members: ['Windows 10'] },
    { id: 'g-other', category: 'Sector', members: ['energy'] },
  ],
  edges: [
    { category: 'Software', from: 'Microsoft Exchange Server 2013', to: 'Microsoft Exchange Server', kind: 'isa', fromClusterId: 'g-exch13', toClusterId: 'g-exch' },
    { category: 'Software', from: 'Microsoft Exchange Server 2016', to: 'Microsoft Exchange Server', kind: 'isa', fromClusterId: 'g-exch16', toClusterId: 'g-exch' },
    { category: 'Software', from: 'Word', to: 'MS Office', kind: 'part-of', fromClusterId: 'g-word', toClusterId: 'g-office' },
    { category: 'Software', from: 'MS Office', to: 'Microsoft Products', kind: 'isa', fromClusterId: 'g-office', toClusterId: 'g-msp' },
    { category: 'Software', from: 'Windows 10', to: 'Windows', kind: 'isa', fromClusterId: 'g-win10', toClusterId: 'g-win' },
    { category: 'Software', from: 'Old', to: 'New', kind: 'renamed-to', fromClusterId: 'g-win', toClusterId: 'g-msp' },
  ],
};

const canonicals = [
  'Microsoft Exchange Server', 'Microsoft Exchange Server 2013', 'Microsoft Exchange Server 2016',
  'Word', 'MS Office', 'Microsoft Products', 'Windows', 'Windows 10', 'Unknown Thing',
].map((canonical) => ({ canonical, surfaces: [canonical] }));

const fold = (pairs: Record<string, string>, abstractNodes: RollupResult['abstractNodes'] = []): RollupResult => ({
  target: new Map(canonicals.map((c) => [c.canonical, pairs[c.canonical] ?? c.canonical])),
  abstractNodes,
  edgesUsed: Object.keys(pairs).length,
});

describe('goldAncestry', () => {
  it('computes transitive ancestors and roots, ignoring renamed-to', () => {
    const { ancestors, roots, projectedRoot } = goldAncestry(gold, 'Software');
    assert.deepEqual([...ancestors('g-word')].sort(), ['g-msp', 'g-office']);
    assert.deepEqual(roots('g-word'), ['g-msp']);
    assert.deepEqual(roots('g-win'), []); // renamed-to is not hierarchy
    assert.equal(projectedRoot('g-win'), 'g-win');
    assert.equal(projectedRoot('g-exch13'), 'g-exch');
  });
});

describe('rollupMetrics', () => {
  it('identity fold: all sound, none complete, partition = gold singletons vs projected families', () => {
    const m = rollupMetrics({ category: 'Software', result: fold({}), canonicals, gold });
    assert.equal(m.canonicals, 9);
    assert.equal(m.goldMapped, 8); // Unknown Thing is not in gold
    assert.equal(m.denominator, 5); // exch13, exch16, Word, MS Office, Windows 10
    assert.equal(m.sound, 5);
    assert.equal(m.complete, 0);
    near(m.soundPct, 1);
    near(m.completePct, 0);
    assert.equal(m.targets, 9);
    assert.ok(m.bcubed.f1 < 1);
    assert.equal(m.probes.exchangeFamily.ok, false);
    assert.equal(m.probes.exchangeFamily.members, 3);
    assert.equal(m.probes.windowsNotOffice.ok, true);
  });

  it('perfect fold to roots: sound = complete = denominator, B-cubed 1, ARI 1', () => {
    const m = rollupMetrics({
      category: 'Software',
      result: fold({
        'Microsoft Exchange Server 2013': 'Microsoft Exchange Server',
        'Microsoft Exchange Server 2016': 'Microsoft Exchange Server',
        Word: 'Microsoft Products',
        'MS Office': 'Microsoft Products',
        'Windows 10': 'Windows',
      }),
      canonicals,
      gold,
    });
    assert.equal(m.sound, 5);
    assert.equal(m.complete, 5);
    near(m.bcubed.f1, 1);
    near(m.ari, 1);
    assert.equal(m.probes.exchangeFamily.ok, true);
    assert.equal(m.probes.exchangeFamilyStrict.ok, true);
    assert.deepEqual(m.probes.exchangeFamily.detail, ['Microsoft Exchange Server']);
  });

  it('exchangeFamily: the loose probe passes a family collapsed onto ONE wrong target; the strict one does not', () => {
    const m = rollupMetrics({
      category: 'Software',
      result: fold({
        'Microsoft Exchange Server': 'Windows',
        'Microsoft Exchange Server 2013': 'Windows',
        'Microsoft Exchange Server 2016': 'Windows',
      }),
      canonicals,
      gold,
    });
    assert.equal(m.probes.exchangeFamily.ok, true);
    assert.deepEqual(m.probes.exchangeFamily.detail, ['Windows']);
    assert.equal(m.probes.exchangeFamilyStrict.ok, false);
    assert.equal(m.probes.exchangeFamilyStrict.members, 3);
  });

  it('partial fold is sound but not complete; a wrong fold is neither', () => {
    const m = rollupMetrics({
      category: 'Software',
      result: fold({
        Word: 'MS Office', // one rung up: sound, not complete
        'Windows 10': 'MS Office', // wrong family: unsound, and trips the probe
      }),
      canonicals,
      gold,
    });
    assert.equal(m.sound, 4); // three untouched + Word
    assert.equal(m.complete, 0);
    assert.equal(m.probes.windowsNotOffice.ok, false);
    assert.deepEqual(m.probes.windowsNotOffice.detail, ['Windows 10']);
  });

  it('abstract targets map to gold through their label; unmapped targets are counted', () => {
    const m = rollupMetrics({
      category: 'Software',
      result: fold(
        {
          'Microsoft Exchange Server 2013': 'facet:MS Exchange',
          'Microsoft Exchange Server 2016': 'facet:MS Exchange',
          'Windows 10': 'facet:Nowhere',
        },
        [
          { id: 'facet:MS Exchange', label: 'MS Exchange', members: ['Microsoft Exchange Server 2013', 'Microsoft Exchange Server 2016'] },
          { id: 'facet:Nowhere', label: 'Nowhere', members: ['Windows 10'] },
        ]
      ),
      canonicals,
      gold,
    });
    assert.equal(m.sound, 4); // 2 exchange versions via the alias surface + Word + MS Office untouched
    assert.equal(m.complete, 2);
    assert.equal(m.targetUnmapped, 1);
    assert.equal(m.probes.exchangeFamily.ok, false); // the parent concept itself stays apart
  });
});

describe('aupc', () => {
  it('is null on no points, y on one point, and the trapezoid area over normalised x', () => {
    assert.equal(aupc([]), null);
    near(aupc([{ x: 3, y: 0.5 }]), 0.5);
    near(aupc([{ x: 0, y: 1 }, { x: 10, y: 0 }]), 0.5);
    near(aupc([{ x: 0, y: 1 }, { x: 5, y: 1 }, { x: 10, y: 0 }]), 0.75);
    near(aupc([{ x: 10, y: 0 }, { x: 0, y: 1 }]), 0.5); // order-independent
    near(aupc([{ x: 1, y: 0.2 }, { x: 1, y: 0.4 }]), 0.3); // degenerate x-range: mean y
    near(aupc([{ x: 0, y: null }, { x: 1, y: 0.7 }]), 0.7); // null purity points are skipped
  });
});
