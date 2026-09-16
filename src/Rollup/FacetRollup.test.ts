import { ConceptRegistry } from '../ConceptRegistry/ConceptRegistry';
import { FacetRollup, etldPlusOne, stripQualifiers } from './FacetRollup';
import { GraphWalkRollup } from './GraphWalkRollup';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

async function seeded(
  entries: Array<{ category: string; canonical: string; aliases?: string[]; definition?: string }>
): Promise<ConceptRegistry> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'facet-rollup-'));
  const registry = new ConceptRegistry({ filePath: path.join(dir, 'registry.json') });
  await registry.load();
  for (const entry of entries) {
    registry.mint(entry.category, entry.canonical, { doc: 1, date: '01.01.2020' }, { definition: entry.definition });
    for (const alias of entry.aliases ?? []) registry.link(entry.category, entry.canonical, alias, { docId: 1 });
  }
  return registry;
}

describe('stripQualifiers (Software/Device facet stem)', () => {
  const cases: Array<[string, string]> = [
    ['Microsoft Exchange Server 2013', 'Microsoft Exchange Server'],
    ['Windows Server 2008 R2', 'Windows Server'],
    ['Microsoft Windows 7 for 32-bit Systems SP1', 'Microsoft Windows'],
    ['Microsoft Windows Server 2008 R2 for Itanium-based Systems SP1', 'Microsoft Windows Server'],
    ['Python 2.7.18', 'Python'],
    ['Firefox ESR', 'Firefox'],
    ['Firefox для iOS', 'Firefox'],
    ['VMRC для Mac', 'VMRC'],
    ['Windows 10 version 1809', 'Windows'],
    ['Windows 10', 'Windows'],
    ['WinRAR 5.70 Beta 1', 'WinRAR'],
    ['GandCrab v4.1', 'GandCrab'],
    ['Formbook/XLoader v2.5', 'Formbook/XLoader'],
    ['Adobe Reader DC', 'Adobe Reader'],
    ['VMware Fusion Pro', 'VMware Fusion'],
    ['VTune Amplifier for Windows', 'VTune Amplifier'],
    ['DROWN (CVE-2016-0800)', 'DROWN'],
    ['Microsoft Office 2016', 'Microsoft Office'],
    ['SSL 3.0', 'SSL'],
  ];
  for (const [input, expected] of cases) {
    it(`${input} -> ${expected}`, () => assert.equal(stripQualifiers(input), expected));
  }

  it('leaves identifiers alone (CVE / UAC shaped labels)', () => {
    assert.equal(stripQualifiers('CVE-2024-1234'), 'CVE-2024-1234');
    assert.equal(stripQualifiers('UAC-0002'), 'UAC-0002');
    assert.equal(stripQualifiers('CVE-2021-26855'), 'CVE-2021-26855');
  });

  it('never strips a label down to nothing and leaves single tokens untouched', () => {
    assert.equal(stripQualifiers('2019'), '2019');
    assert.equal(stripQualifiers('RC4'), 'RC4');
    assert.equal(stripQualifiers('Log4j'), 'Log4j');
    assert.equal(stripQualifiers('Win32k'), 'Win32k');
  });

  it('only strips from the tail — a leading brand or an inner parenthetical survives', () => {
    assert.equal(stripQualifiers('Cisco Adaptive Security Appliance (ASA) Software'), 'Cisco Adaptive Security Appliance (ASA) Software');
    assert.equal(stripQualifiers('KB5017371.exe'), 'KB5017371.exe');
  });
});

describe('etldPlusOne (Domain facet stem)', () => {
  it('takes the last two labels for ordinary TLDs', () => {
    assert.equal(etldPlusOne('accounts.google2.certifiedauth.in'), 'certifiedauth.in');
    assert.equal(etldPlusOne('www.Example.COM'), 'example.com');
    assert.equal(etldPlusOne('a0322810.xsph.ru'), 'a0322810.xsph.ru');
  });
  it('keeps three labels under a second-level public suffix', () => {
    assert.equal(etldPlusOne('mail.rada.gov.ua'), 'rada.gov.ua');
    assert.equal(etldPlusOne('x.y.gov.ua'), 'y.gov.ua');
    assert.equal(etldPlusOne('01mirror.com.ua'), '01mirror.com.ua');
    assert.equal(etldPlusOne('login.some.co.uk'), 'some.co.uk');
  });
  it('passes IPs and bare hosts through', () => {
    assert.equal(etldPlusOne('185.193.38.78'), '185.193.38.78');
    assert.equal(etldPlusOne('ukr.net'), 'ukr.net');
  });
});

describe('FacetRollup.fold', () => {
  it('folds to an existing canonical, to a label surface owner, to an abstract node, or to itself', async () => {
    const registry = await seeded([
      { category: 'Software', canonical: 'Microsoft Exchange Server' },
      { category: 'Software', canonical: 'Microsoft Exchange Server 2013' },
      { category: 'Software', canonical: 'Microsoft Exchange Server 2016' },
      { category: 'Software', canonical: 'MS Office', aliases: ['Microsoft Office'] },
      { category: 'Software', canonical: 'Microsoft Office 2010' },
      { category: 'Software', canonical: 'Windows Server 2008 R2' },
      { category: 'Software', canonical: 'Windows Server 2016' },
      { category: 'Software', canonical: 'Python 2.7.18' },
      { category: 'Software', canonical: 'CVE-2024-1234' },
      { category: 'Software', canonical: 'Log4j' },
    ]);
    const result = new FacetRollup().fold({ registry, category: 'Software', lambda: 0 });
    assert.equal(result.target.get('Microsoft Exchange Server 2013'), 'Microsoft Exchange Server');
    assert.equal(result.target.get('Microsoft Exchange Server 2016'), 'Microsoft Exchange Server');
    assert.equal(result.target.get('Microsoft Exchange Server'), 'Microsoft Exchange Server');
    // Label surface of another concept: `Microsoft Office` is an alias of `MS Office`.
    assert.equal(result.target.get('Microsoft Office 2010'), 'MS Office');
    // Two versions, no family concept: abstract node.
    assert.equal(result.target.get('Windows Server 2008 R2'), 'facet:Windows Server');
    assert.equal(result.target.get('Windows Server 2016'), 'facet:Windows Server');
    assert.deepEqual(result.abstractNodes, [
      { id: 'facet:Windows Server', label: 'Windows Server', members: ['Windows Server 2008 R2', 'Windows Server 2016'] },
    ]);
    // One version only, no family concept: stays put.
    assert.equal(result.target.get('Python 2.7.18'), 'Python 2.7.18');
    assert.equal(result.target.get('CVE-2024-1234'), 'CVE-2024-1234');
    assert.equal(result.target.get('Log4j'), 'Log4j');
    assert.equal(result.edgesUsed, 0);
  });

  it('is identity on schemes without a facet rule', async () => {
    const registry = await seeded([
      { category: 'Sector', canonical: 'energy sector 2022' },
      { category: 'Sector', canonical: 'energy sector' },
    ]);
    const result = new FacetRollup().fold({ registry, category: 'Sector', lambda: 0 });
    assert.equal(result.target.get('energy sector 2022'), 'energy sector 2022');
    assert.equal(result.abstractNodes.length, 0);
  });

  it('folds Domain to eTLD+1', async () => {
    const registry = await seeded([
      { category: 'Domain', canonical: 'ukr.net' },
      { category: 'Domain', canonical: 'mail.ukr.net' },
      { category: 'Domain', canonical: 'a.gov.ua' },
      { category: 'Domain', canonical: 'b.a.gov.ua' },
      { category: 'Domain', canonical: 'x.evil.com' },
      { category: 'Domain', canonical: 'y.evil.com' },
    ]);
    const result = new FacetRollup().fold({ registry, category: 'Domain', lambda: 0 });
    assert.equal(result.target.get('mail.ukr.net'), 'ukr.net');
    assert.equal(result.target.get('b.a.gov.ua'), 'a.gov.ua');
    assert.equal(result.target.get('x.evil.com'), 'facet:evil.com');
    assert.equal(result.target.get('y.evil.com'), 'facet:evil.com');
  });
});

describe('GraphWalkRollup.fold (R0)', () => {
  it('walks broader edges under the brake and counts traversed edges', async () => {
    const registry = await seeded([
      { category: 'Software', canonical: 'Office 2010' },
      { category: 'Software', canonical: 'Office' },
      { category: 'Software', canonical: 'Microsoft Products' },
      { category: 'Software', canonical: 'Word' },
    ]);
    registry.addBroaderEdge('Software', { narrower: 'Office 2010', broader: 'Office', type: 'broaderInstantial', similarityScore: 0.9, docId: 1, decision: 'judge' });
    registry.addBroaderEdge('Software', { narrower: 'Office', broader: 'Microsoft Products', type: 'broaderGeneric', similarityScore: 0.6, docId: 1, decision: 'judge' });
    registry.addBroaderEdge('Software', { narrower: 'Word', broader: 'Office', type: 'broaderPartitive', similarityScore: 0.7, docId: 1, decision: 'judge' });

    const all = new GraphWalkRollup().fold({ registry, category: 'Software', lambda: 0 });
    assert.equal(all.target.get('Office 2010'), 'Microsoft Products');
    assert.equal(all.target.get('Word'), 'Microsoft Products');
    assert.equal(all.edgesUsed, 3);

    const braked = new GraphWalkRollup().fold({ registry, category: 'Software', lambda: 0.85 });
    assert.equal(braked.target.get('Office 2010'), 'Office');
    assert.equal(braked.target.get('Word'), 'Word');
    assert.equal(braked.edgesUsed, 1);

    const instantialOperator = new GraphWalkRollup({ contract: ['broaderInstantial'] });
    assert.equal(instantialOperator.name, 'graph[broaderInstantial]');
    const instantial = instantialOperator.fold({ registry, category: 'Software', lambda: 0 });
    assert.equal(instantial.target.get('Office 2010'), 'Office');
    assert.equal(instantial.target.get('Word'), 'Word');
    assert.equal(instantial.edgesUsed, 1);
  });
});
