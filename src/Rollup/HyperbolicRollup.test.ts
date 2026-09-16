import { ConceptRegistry } from '../ConceptRegistry/ConceptRegistry';
import { HyperbolicRollup } from './HyperbolicRollup';
import type { CandidatesFile } from './schemeIo';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const CONCEPTS = [
  'Microsoft Office', 'Microsoft Office 2010', 'Microsoft Word', 'Productivity Software', 'Software',
  'Windows 10', 'Windows 7', 'Firefox', 'Web Browser',
];

/** Norms: Software 10 < Productivity Software 15 < Microsoft Office 18 < Word 20; Firefox 19 ↔ Web Browser 21. */
const NORM: Record<string, number> = {
  'Software': 10, 'Productivity Software': 15, 'Microsoft Office': 18, 'Microsoft Office 2010': 19.5,
  'Microsoft Word': 20, 'Windows 10': 20, 'Windows 7': 20.5, 'Firefox': 19, 'Web Browser': 21,
};

function cand(child: string, parent: string, dist: number, score = -dist) {
  return { parent, score, dist, normChild: NORM[child], normParent: NORM[parent] };
}

/** A synthetic HiT-style ranking: dist bounds decide hops; the walk Word → Office → Productivity → Software. */
const HIT: CandidatesFile = {
  model: 'synthetic', scheme: 'test-software', topk: 10, w: 0.5,
  rows: [
    { child: 'Microsoft Word', candidates: [cand('Microsoft Word', 'Microsoft Office 2010', 4), cand('Microsoft Word', 'Microsoft Office', 5), cand('Microsoft Word', 'Software', 9)] },
    { child: 'Microsoft Office', candidates: [cand('Microsoft Office', 'Productivity Software', 7), cand('Microsoft Office', 'Software', 11)] },
    { child: 'Productivity Software', candidates: [cand('Productivity Software', 'Software', 9)] },
    { child: 'Windows 10', candidates: [cand('Windows 10', 'Windows 7', 3)] }, // R1 member: ignored
    { child: 'Firefox', candidates: [cand('Firefox', 'Software', 13)] },
    { child: 'Web Browser', candidates: [cand('Web Browser', 'Firefox', 6), cand('Web Browser', 'Software', 12)] },
    { child: 'Software', candidates: [] },
  ],
};

/** A cosine-style ranking for the Euclidean methods. */
const EUCLID: CandidatesFile = {
  model: 'synthetic', scheme: 'test-software', topk: 10, method: 'euclid',
  rows: [
    { child: 'Microsoft Word', candidates: [{ parent: 'Microsoft Office', score: 0.9, dist: 0.1, normChild: null, normParent: null }, { parent: 'Software', score: 0.6, dist: 0.4, normChild: null, normParent: null }] },
    { child: 'Microsoft Office', candidates: [{ parent: 'Microsoft Word', score: 0.9, dist: 0.1, normChild: null, normParent: null }, { parent: 'Microsoft Office 2010', score: 0.88, dist: 0.12, normChild: null, normParent: null }] },
    { child: 'Firefox', candidates: [{ parent: 'Web Browser', score: 0.82, dist: 0.18, normChild: null, normParent: null }] },
    { child: 'Web Browser', candidates: [{ parent: 'Firefox', score: 0.82, dist: 0.18, normChild: null, normParent: null }] },
  ],
};

async function setup(file: CandidatesFile): Promise<{ registry: ConceptRegistry; candidatesPath: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyp-rollup-'));
  const registry = new ConceptRegistry({ filePath: path.join(dir, 'registry.json') });
  await registry.load();
  for (const c of CONCEPTS) registry.mint('Software', c, { doc: 1, date: '01.01.2020' }, {});
  const candidatesPath = path.join(dir, 'candidates.json');
  await fs.writeFile(candidatesPath, JSON.stringify(file));
  return { registry, candidatesPath };
}

describe('HyperbolicRollup (R3)', () => {
  it('hit: walks up while the norm decreases, at most maxDepth hops, and resolves R1 members to their family', async () => {
    const { registry, candidatesPath } = await setup(HIT);
    const op = new HyperbolicRollup({ candidatesPath, method: 'hit' });
    assert.equal(op.name, 'hyperbolic-hit');
    const r = op.fold({ registry, category: 'Software', lambda: Infinity });
    // Word's first candidate is `Office 2010` (an R1 member) → resolved to `Microsoft Office`; then
    // Office → Productivity Software → Software (norms 18 → 15 → 10), 3 hops.
    assert.equal(r.target.get('Microsoft Word'), 'Software');
    assert.equal(r.target.get('Microsoft Office'), 'Software');
    assert.equal(r.target.get('Productivity Software'), 'Software');
    assert.equal(r.target.get('Software'), 'Software');
    // Web Browser → Firefox (norm 21 → 19), then Firefox's candidate Software (13) is followed too.
    assert.equal(r.target.get('Web Browser'), 'Software');
    assert.equal(r.target.get('Firefox'), 'Software');
    // R1 members keep their facet target; the facet node is reported with its members.
    assert.equal(r.target.get('Windows 10'), 'facet:Windows');
    assert.deepEqual(r.abstractNodes, [{ id: 'facet:Windows', label: 'Windows', members: ['Windows 10', 'Windows 7'] }]);
    assert.equal(r.edgesUsed, 3 + 2 + 1 + 1 + 2); // Word 3, Office 2, Productivity 1, Firefox 1, Web Browser 2
    const shallow = new HyperbolicRollup({ candidatesPath, method: 'hit', maxDepth: 1 }).fold({ registry, category: 'Software', lambda: Infinity });
    assert.equal(shallow.target.get('Microsoft Word'), 'Microsoft Office');
    assert.equal(shallow.target.get('Web Browser'), 'Firefox');
  });

  it('hit: λ is a distance bound at every hop', async () => {
    const { registry, candidatesPath } = await setup(HIT);
    const op = new HyperbolicRollup({ candidatesPath, method: 'hit' });
    const r8 = op.fold({ registry, category: 'Software', lambda: 8 });
    // Word → Office 2010 (4) → Office; Office → Productivity (7) ok; Productivity → Software (9) blocked.
    assert.equal(r8.target.get('Microsoft Word'), 'Productivity Software');
    assert.equal(r8.target.get('Productivity Software'), 'Productivity Software');
    assert.equal(r8.target.get('Firefox'), 'Firefox'); // 13 > 8
    assert.equal(r8.target.get('Web Browser'), 'Firefox'); // 6 ≤ 8, Firefox's own hop blocked
    const r3 = op.fold({ registry, category: 'Software', lambda: 3 });
    assert.equal(new Set(r3.target.values()).size, CONCEPTS.length - 2); // only R1 moved: Office 2010 → Office, Windows 10 + 7 → facet
    assert.equal(r3.edgesUsed, 0);
  });

  it('euclid: one hop at a cosine floor; mutual nearest neighbours do not swap through a cycle', async () => {
    const { registry, candidatesPath } = await setup(EUCLID);
    const op = new HyperbolicRollup({ candidatesPath, method: 'euclid' });
    assert.equal(op.name, 'hyperbolic-euclid');
    const r = op.fold({ registry, category: 'Software', lambda: 0.85 });
    assert.equal(r.target.get('Microsoft Word'), 'Microsoft Office');
    assert.equal(r.target.get('Microsoft Office'), 'Microsoft Word'); // symmetric cosine: each hops once
    assert.equal(r.target.get('Firefox'), 'Firefox'); // 0.82 < 0.85
    const loose = op.fold({ registry, category: 'Software', lambda: 0.8 });
    assert.equal(loose.target.get('Firefox'), 'Web Browser');
    assert.equal(loose.target.get('Web Browser'), 'Firefox');
    assert.equal(loose.edgesUsed, 4);
  });

  it('euclid-normfilter walks like hit but gates on cosine', async () => {
    const { registry, candidatesPath } = await setup({
      ...HIT,
      method: 'euclid-normfilter',
      rows: HIT.rows.map((row) => ({ ...row, candidates: row.candidates.map((c) => ({ ...c, score: 1 - c.dist / 20 })) })),
    });
    const op = new HyperbolicRollup({ candidatesPath, method: 'euclid-normfilter' });
    const r = op.fold({ registry, category: 'Software', lambda: 0.6 }); // dist ≤ 8 in the original units
    assert.equal(r.target.get('Microsoft Word'), 'Productivity Software');
    assert.equal(r.target.get('Web Browser'), 'Firefox');
  });
});
