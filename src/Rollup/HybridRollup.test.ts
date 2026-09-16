import { ConceptRegistry } from '../ConceptRegistry/ConceptRegistry';
import { FacetRollup } from './FacetRollup';
import { HybridRollup } from './HybridRollup';
import type { RollupInput, RollupOperator, RollupResult } from './types';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

async function registryWithEdges(): Promise<ConceptRegistry> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hybrid-rollup-'));
  const registry = new ConceptRegistry({ filePath: path.join(dir, 'registry.json') });
  await registry.load();
  for (const c of ['Word', 'Office', 'Microsoft Products', 'Windows 10', 'Windows 7', 'Firefox', 'Orphan App']) {
    registry.mint('Software', c, { doc: 1, date: '01.01.2020' }, {});
  }
  registry.addBroaderEdge('Software', { narrower: 'Word', broader: 'Office', type: 'broaderPartitive', similarityScore: 0.7, docId: 1, decision: 'judge' });
  registry.addBroaderEdge('Software', { narrower: 'Office', broader: 'Microsoft Products', type: 'broaderGeneric', similarityScore: 0.3, docId: 1, decision: 'judge' });
  registry.addBroaderEdge('Software', { narrower: 'Windows 10', broader: 'Microsoft Products', type: 'broaderInstantial', similarityScore: null, docId: 1, decision: 'judge' });
  return registry;
}

/** A stand-in for R2/R3: folds every orphan onto one abstract node. */
const everythingToHac: RollupOperator = {
  name: 'stub',
  fold(input: RollupInput): RollupResult {
    const target = new Map<string, string>();
    const members: string[] = [];
    for (const c of Object.keys(input.registry.concepts(input.category))) {
      target.set(c, `hac:${input.lambda}`);
      members.push(c);
    }
    return { target, abstractNodes: [{ id: `hac:${input.lambda}`, label: 'everything', members }], edgesUsed: 0 };
  },
};

describe('HybridRollup (R4)', () => {
  it('R0 at λ = 0 where a judge edge exists (all types, null scores included), the fallback elsewhere', async () => {
    const registry = await registryWithEdges();
    const op = new HybridRollup({ fallback: everythingToHac });
    assert.equal(op.name, 'hybrid[all]+stub');
    const r = op.fold({ registry, category: 'Software', lambda: 0.9 });
    assert.equal(r.target.get('Word'), 'Microsoft Products'); // walks the whole chain, brake off
    assert.equal(r.target.get('Office'), 'Microsoft Products');
    assert.equal(r.target.get('Windows 10'), 'Microsoft Products'); // null-score edge followed
    assert.equal(r.target.get('Microsoft Products'), 'hac:0.9'); // a root has no edge: fallback
    assert.equal(r.target.get('Firefox'), 'hac:0.9');
    assert.equal(r.target.get('Orphan App'), 'hac:0.9');
    assert.equal(r.edgesUsed, 3);
    assert.deepEqual(r.abstractNodes, [{ id: 'hac:0.9', label: 'everything', members: ['Microsoft Products', 'Windows 7', 'Firefox', 'Orphan App'] }]);
  });

  it('honours the contract: only the named broader types count as edges', async () => {
    const registry = await registryWithEdges();
    const op = new HybridRollup({ contract: ['broaderInstantial'], fallback: new FacetRollup() });
    assert.equal(op.name, 'hybrid[broaderInstantial]+facet');
    const r = op.fold({ registry, category: 'Software', lambda: 0 });
    assert.equal(r.target.get('Windows 10'), 'Microsoft Products'); // the instantial edge
    assert.equal(r.target.get('Word'), 'Word'); // partitive edge ignored; facet leaves Word alone
    // The fallback runs on the whole scheme: facet:Windows was minted for {Windows 10, Windows 7}
    // and survives for Windows 7 alone once R0 has taken Windows 10 (pass-through, by design).
    assert.equal(r.target.get('Windows 7'), 'facet:Windows');
    assert.equal(r.edgesUsed, 1);
    assert.deepEqual(r.abstractNodes, [{ id: 'facet:Windows', label: 'Windows', members: ['Windows 7'] }]);
  });

  it('passes the fallback\'s abstract nodes through only while they are still targets', async () => {
    const registry = await registryWithEdges();
    registry.addBroaderEdge('Software', { narrower: 'Windows 7', broader: 'Microsoft Products', type: 'broaderInstantial', similarityScore: 0.5, docId: 1, decision: 'judge' });
    const r = new HybridRollup({ fallback: new FacetRollup() }).fold({ registry, category: 'Software', lambda: 0 });
    // Facet would mint facet:Windows for {Windows 10, Windows 7}, but both have judge edges.
    assert.equal(r.target.get('Windows 7'), 'Microsoft Products');
    assert.deepEqual(r.abstractNodes, []);
  });
});
