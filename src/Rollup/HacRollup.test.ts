import { ConceptRegistry } from '../ConceptRegistry/ConceptRegistry';
import { HacRollup, medoidOf, rootOf } from './HacRollup';
import { l2Normalize } from '../utils/vectorUtils';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const unit = (v: number[]) => l2Normalize(v);

/** A tiny Software scheme with hand vectors in R³: an Office family, a Windows facet, two apps, Firefox. */
async function scheme(): Promise<{ registry: ConceptRegistry; vectors: Map<string, number[]> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hac-rollup-'));
  const registry = new ConceptRegistry({ filePath: path.join(dir, 'registry.json') });
  await registry.load();
  const vectors = new Map<string, number[]>([
    ['Microsoft Office', unit([1, 0, 0])],
    ['Microsoft Office 2010', unit([0.99, 0.1, 0])],
    ['Microsoft Office 2013', unit([0.99, -0.1, 0])],
    ['Microsoft Word', unit([0.9, 0.3, 0.1])],
    ['Microsoft Excel', unit([0.9, -0.32, 0.1])],
    ['Windows 10', unit([0, 1, 0.05])],
    ['Windows 7', unit([0, 1, -0.05])],
    ['Firefox', unit([0, 0, 1])],
  ]);
  for (const canonical of vectors.keys()) registry.mint('Software', canonical, { doc: 1, date: '01.01.2020' }, {});
  return { registry, vectors };
}

describe('HacRollup (R2)', () => {
  it('clusters family representatives at the cutoff and picks the medoid as target', async () => {
    const { registry, vectors } = await scheme();
    // Office centroid ≈ [1,0,0]; cos(centroid, Word) ≈ 0.943, cos(centroid, Excel) ≈ 0.937; cos(Word, Excel) ≈ 0.79.
    // Average linkage at 0.85: {Office, Word} first, then Excel joins (mean ≈ 0.86 ≥ 0.85); medoid = Office.
    const result = new HacRollup().fold({ registry, category: 'Software', vectors, lambda: 0.85 });
    assert.equal(result.target.get('Microsoft Word'), 'Microsoft Office');
    assert.equal(result.target.get('Microsoft Excel'), 'Microsoft Office');
    assert.equal(result.target.get('Microsoft Office'), 'Microsoft Office');
    // R1 members inherit the family's cluster target.
    assert.equal(result.target.get('Microsoft Office 2010'), 'Microsoft Office');
    assert.equal(result.target.get('Microsoft Office 2013'), 'Microsoft Office');
    // The Windows facet (no canonical `Windows`) survives as an abstract target.
    assert.equal(result.target.get('Windows 10'), 'facet:Windows');
    assert.equal(result.target.get('Windows 7'), 'facet:Windows');
    assert.deepEqual(result.abstractNodes, [{ id: 'facet:Windows', label: 'Windows', members: ['Windows 10', 'Windows 7'] }]);
    assert.equal(result.target.get('Firefox'), 'Firefox');
    assert.equal(result.edgesUsed, 0);
  });

  it('a higher cutoff keeps Excel out; a cutoff above everything reduces to R1', async () => {
    const { registry, vectors } = await scheme();
    const at90 = new HacRollup().fold({ registry, category: 'Software', vectors, lambda: 0.9 });
    // A two-point cluster ties on mean cosine, so the shorter label is the medoid: `Microsoft Word`
    // (14 chars) over `Microsoft Office` (16); the Office family follows its representative.
    assert.equal(at90.target.get('Microsoft Office'), 'Microsoft Word');
    assert.equal(at90.target.get('Microsoft Office 2010'), 'Microsoft Word');
    assert.equal(at90.target.get('Microsoft Excel'), 'Microsoft Excel');
    const at99 = new HacRollup().fold({ registry, category: 'Software', vectors, lambda: 0.999 });
    assert.equal(at99.target.get('Microsoft Word'), 'Microsoft Word');
    assert.equal(at99.target.get('Microsoft Office 2010'), 'Microsoft Office'); // R1 still applies
    assert.equal(at99.target.get('Windows 7'), 'facet:Windows');
    assert.equal(new Set(at99.target.values()).size, 5); // Office, Word, Excel, facet:Windows, Firefox
  });

  it('R1 families follow their representative into whatever cluster it lands in', async () => {
    const { registry, vectors } = await scheme();
    const all = new HacRollup().fold({ registry, category: 'Software', vectors, lambda: -1 });
    const targets = new Set(all.target.values());
    assert.equal(targets.size, 1);
    assert.equal(all.target.get('Windows 10'), all.target.get('Firefox'));
    assert.equal(all.target.get('Microsoft Office 2013'), all.target.get('Microsoft Office'));
  });

  it('constrained: a judge edge is a must-link merged before the cutoff, and is counted in edgesUsed', async () => {
    const { registry, vectors } = await scheme();
    registry.addBroaderEdge('Software', { narrower: 'Windows 10', broader: 'Firefox', type: 'broaderGeneric', similarityScore: 0.2, docId: 1, decision: 'judge' });
    const free = new HacRollup().fold({ registry, category: 'Software', vectors, lambda: 0.999 });
    assert.equal(free.target.get('Firefox'), 'Firefox');
    assert.equal(free.target.get('Windows 7'), 'facet:Windows');
    const constrained = new HacRollup({ constrained: true });
    assert.equal(constrained.name, 'hac-constrained');
    const result = constrained.fold({ registry, category: 'Software', vectors, lambda: 0.999 });
    // {facet:Windows, Firefox} is one cluster; two points tie on mean cosine → shortest label
    // (`Windows` and `Firefox` are both 7 chars) → lexical: Firefox. The whole facet follows.
    assert.equal(result.target.get('Firefox'), 'Firefox');
    assert.equal(result.target.get('Windows 10'), 'Firefox');
    assert.equal(result.target.get('Windows 7'), 'Firefox');
    assert.equal(result.edgesUsed, 1);
    assert.deepEqual(result.abstractNodes, []);
  });

  it('a representative without any vector stays out of the clustering and folds to itself', async () => {
    const { registry, vectors } = await scheme();
    vectors.delete('Firefox');
    const result = new HacRollup().fold({ registry, category: 'Software', vectors, lambda: -1 });
    assert.equal(result.target.get('Firefox'), 'Firefox');
    assert.equal(new Set(result.target.values()).size, 2);
  });
});

describe('medoidOf', () => {
  it('prefers the highest mean cosine, then the shortest label, then lexical order', () => {
    const points = [
      { label: 'Zed', vector: unit([1, 0.3]) },
      { label: 'Centre', vector: unit([1, 0]) },
      { label: 'Yy', vector: unit([1, -0.3]) },
    ];
    assert.equal(medoidOf(points), 'Centre');
    const tie = [
      { label: 'bb', vector: unit([1, 0]) },
      { label: 'aaa', vector: unit([0, 1]) },
      { label: 'ab', vector: unit([1, 0]) },
    ];
    // bb and ab share the same mean; 'aaa' is longer; 'ab' < 'bb'.
    assert.equal(medoidOf(tie), 'ab');
    assert.equal(medoidOf([{ label: 'facet:Windows', vector: unit([1, 1]) }, { label: 'Firefox', vector: unit([1, 0]) }]), 'Firefox');
  });

  it('root rule: a member with no outgoing internal edge wins; ties → in-degree → medoid; no edges → medoid', () => {
    const pts = [
      { index: 0, label: 'Office', vector: unit([1, 0.3]) },
      { index: 1, label: 'Word', vector: unit([1, 0]) },
      { index: 2, label: 'Excel', vector: unit([1, -0.3]) },
      { index: 3, label: 'Suite', vector: unit([0, 1]) },
    ];
    assert.equal(rootOf(pts, [[1, 0], [2, 0]]), 'Office'); // Word → Office, Excel → Office
    assert.equal(rootOf(pts, [[1, 0], [1, 3], [2, 3]]), 'Suite'); // Office and Suite are roots; Suite has in-degree 2
    assert.equal(rootOf(pts, [[1, 0], [2, 3]]), 'Office'); // both roots in-degree 1 → medoid rule among {Office, Suite}
    assert.equal(medoidOf(pts), 'Office'); // Office has the highest mean cosine (0.69 vs Word's 0.64)
    assert.equal(rootOf(pts, []), 'Office'); // no edges → plain medoid
    assert.equal(rootOf(pts, [[0, 1], [1, 2], [2, 3], [3, 0]]), 'Office'); // cycle → medoid fallback
    assert.equal(rootOf(pts, [[1, 0], [9, 0]]), 'Office'); // edges to outsiders are ignored
  });
});

describe('HacRollup constrained-root', () => {
  it('folds a must-link cluster onto its judge-edge root instead of the medoid', async () => {
    const { registry, vectors } = await scheme();
    // Judge edges point AT Word (the vector-space medoid of {Office, Word, Excel} is Office), so the
    // two target rules disagree on this cluster.
    registry.addBroaderEdge('Software', { narrower: 'Microsoft Office', broader: 'Microsoft Word', type: 'broaderGeneric', similarityScore: 0.5, docId: 1, decision: 'judge' });
    registry.addBroaderEdge('Software', { narrower: 'Microsoft Excel', broader: 'Microsoft Word', type: 'broaderGeneric', similarityScore: 0.5, docId: 1, decision: 'judge' });
    registry.addBroaderEdge('Software', { narrower: 'Windows 10', broader: 'Firefox', type: 'broaderGeneric', similarityScore: 0.2, docId: 1, decision: 'judge' });
    const op = new HacRollup({ constrained: true, targetRule: 'root' });
    assert.equal(op.name, 'hac-constrained-root');
    const r = op.fold({ registry, category: 'Software', vectors, lambda: 0.999 });
    assert.equal(r.target.get('Microsoft Office'), 'Microsoft Word');
    assert.equal(r.target.get('Microsoft Excel'), 'Microsoft Word');
    assert.equal(r.target.get('Microsoft Word'), 'Microsoft Word'); // the judge root stays put (sound)
    assert.equal(r.target.get('Microsoft Office 2010'), 'Microsoft Word'); // R1 member follows its family
    // facet:Windows → Firefox via its member's edge: Firefox is the root of {facet:Windows, Firefox}.
    assert.equal(r.target.get('Windows 7'), 'Firefox');
    assert.equal(r.target.get('Firefox'), 'Firefox');
    assert.equal(r.edgesUsed, 3);
    // The medoid variant folds the judge root onto the vector centre instead (unsound for Word).
    const medoid = new HacRollup({ constrained: true }).fold({ registry, category: 'Software', vectors, lambda: 0.999 });
    assert.equal(medoid.target.get('Microsoft Word'), 'Microsoft Office');
    assert.equal(medoid.target.get('Microsoft Office'), 'Microsoft Office');
  });
});
