import type { RollupInput, RollupOperator, RollupResult } from './types';

/**
 * R1 — facet stripping: a deterministic, LLM-free, vector-free parent from the label alone.
 *
 * Software / Device: trailing version and edition qualifiers are stripped greedily in ONE pass
 * (`Windows Server 2008 R2` → `Windows Server`, `Microsoft Windows 7 for 32-bit Systems SP1` →
 * `Microsoft Windows`). The parent is (in order):
 *   1. the stripped string when it resolves to another concept of the same scheme — as a
 *      canonical or as any of its label surfaces (`registry.resolve`, case-insensitive);
 *   2. an abstract node `facet:<stripped>` when at least two canonicals strip to the same string;
 *   3. the canonical itself.
 * One step only: the parent is not itself re-stripped (a facet is a family, not a ladder).
 *
 * Domain: eTLD+1 through a small vendored public-suffix approximation (`etldPlusOne`). A full
 * Public Suffix List would replace `SECOND_LEVEL_SUFFIXES`; the approximation is documented as
 * a limitation, not hidden.
 *
 * Every other scheme: identity.
 *
 * Identifier guard: labels shaped like `CVE-2024-1234` / `UAC-0002` (`^[A-Z]{2,5}-\d{4}(-\d+)?$`)
 * are never touched — their digits are the identity, not a version.
 */
export class FacetRollup implements RollupOperator {
  readonly name = 'facet';

  fold(input: RollupInput): RollupResult {
    const { registry, category } = input;
    const canonicals = Object.keys(registry.concepts(category));
    const stem = facetStem(category);
    const target = new Map<string, string>();
    if (!stem) {
      for (const canonical of canonicals) target.set(canonical, canonical);
      return { target, abstractNodes: [], edgesUsed: 0 };
    }

    // Pass 1: the family string per canonical, and how many canonicals share each family.
    const familyOf = new Map<string, string>();
    const familySize = new Map<string, number>();
    for (const canonical of canonicals) {
      const family = stem(canonical);
      if (family === canonical) continue;
      familyOf.set(canonical, family);
      familySize.set(family, (familySize.get(family) ?? 0) + 1);
    }

    // Pass 2: resolve each family to a concept, an abstract node, or nothing.
    const abstractMembers = new Map<string, string[]>();
    for (const canonical of canonicals) {
      const family = familyOf.get(canonical);
      if (family === undefined) {
        target.set(canonical, canonical);
        continue;
      }
      const resolved = registry.resolve(category, family);
      if (resolved && resolved !== canonical) {
        target.set(canonical, resolved);
      } else if ((familySize.get(family) ?? 0) >= 2) {
        const id = `facet:${family}`;
        target.set(canonical, id);
        (abstractMembers.get(id) ?? abstractMembers.set(id, []).get(id)!).push(canonical);
      } else {
        target.set(canonical, canonical);
      }
    }

    const abstractNodes = [...abstractMembers.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([id, members]) => ({ id, label: id.slice('facet:'.length), members }));
    return { target, abstractNodes, edgesUsed: 0 };
  }
}

/** The stemming rule for a scheme, or undefined for identity schemes. */
export function facetStem(category: string): ((label: string) => string) | undefined {
  switch (category.trim().toLowerCase()) {
    case 'software':
    case 'device':
      return stripQualifiers;
    case 'domain':
      return etldPlusOne;
    default:
      return undefined;
  }
}

// --- Software / Device -------------------------------------------------------------------------

const IDENTIFIER = /^[A-Z]{2,5}-\d{4}(-\d+)?$/;

/** A trailing token that is a version/edition qualifier rather than part of the name. */
const QUALIFIER_TOKEN = [
  /^(19|20)\d{2}$/, // years
  /^\d+$/, // bare numbers: Windows 10, Windows 7, Beta 1
  /^v?\.?\d+(\.\d+)+[a-z]?$/i, // 2.7.18, v2.5, 5.70, 3.0
  /^v\d+$/i, // v4
  /^(SP|R|RC|CU|U|KB)\d+$/i, // SP1, R2, RC1
  /^(ESR|LTS|LTSC|LTSB|Pro|CC|DC|CS\d?|CE|EE|SE|MR\d?)$/i,
  /^(Beta|Alpha|RTM|Preview|Insider)$/i,
  /^(Edition|Enterprise|Professional|Home|Ultimate|Standard|Datacenter|Premium|Basic|Starter|Lite)$/i,
  /^(version|ver\.?|v\.?|release|build|update)$/i,
  /^(32-bit|64-bit|x64|x86|x86_64|amd64|arm64|Itanium|ia64)(-based)?$/i,
  /^Systems?$/i,
  /^(for|для)$/i, // a dangling connective once its platform object is gone
];

/** `for x64-based Systems`, `for Windows`, `для Mac`, `для iOS`. */
const PLATFORM_TAIL =
  /\s+(?:for|для)\s+(?:32-bit|64-bit|x64|x86|x86_64|amd64|arm64|Itanium|ia64)(?:-based)?(?:\s+Systems?)?$|\s+(?:for|для)\s+(?:Windows|Win|Mac|macOS|OS X|iOS|iPadOS|Android|Linux|Unix|Web)$/i;

/**
 * Strip trailing qualifiers greedily in one pass. Never strips the whole label (at least one token
 * survives), never touches identifiers, and only ever removes from the tail so a leading brand
 * (`Microsoft`, `Cisco`) is preserved.
 */
export function stripQualifiers(label: string): string {
  let current = label.trim();
  if (IDENTIFIER.test(current)) return current;
  for (;;) {
    const before = current;
    // Trailing parenthetical qualifier: `Adobe Reader (DC)`, `DROWN (CVE-2016-0800)`.
    current = current.replace(/\s*\([^()]*\)$/, '').trim();
    current = current.replace(PLATFORM_TAIL, '').trim();
    const tokens = current.split(/\s+/);
    while (tokens.length > 1) {
      const tail = tokens[tokens.length - 1];
      if (IDENTIFIER.test(tail)) break;
      if (!QUALIFIER_TOKEN.some((rule) => rule.test(tail))) break;
      tokens.pop();
    }
    current = tokens.join(' ').replace(/[\s,;:\-–—]+$/, '').trim();
    if (current === before || current.length === 0) break;
  }
  return current.length === 0 ? label.trim() : current;
}

// --- Domain --------------------------------------------------------------------------------------

/**
 * Second-level public suffixes under which the registrable name is the THIRD label from the
 * right. A vendored approximation of the Public Suffix List, covering what the corpus actually
 * contains (Ukrainian ccTLD second levels first). A full PSL (e.g. the `psl` package) would replace
 * this table; the interface (`etldPlusOne`) stays the same.
 */
export const SECOND_LEVEL_SUFFIXES = new Set([
  'com.ua', 'gov.ua', 'org.ua', 'net.ua', 'edu.ua', 'in.ua', 'kiev.ua', 'kyiv.ua', 'od.ua',
  'lviv.ua', 'kharkiv.ua', 'kh.ua', 'dp.ua', 'zp.ua', 'if.ua', 'mil.gov.ua', 'co.uk', 'org.uk',
  'gov.uk', 'ac.uk', 'me.uk', 'com.br', 'net.br', 'org.br', 'co.jp', 'ne.jp', 'or.jp', 'com.au',
  'net.au', 'org.au', 'co.il', 'org.il', 'com.tr', 'com.pl', 'com.ru', 'org.ru', 'net.ru',
  'com.cn', 'com.de', 'com.mx', 'com.ar', 'co.za', 'co.in', 'com.tw', 'co.kr', 'com.hk', 'com.sg',
  'com.pk', 'com.ng', 'com.eg', 'com.sa', 'com.ph', 'com.vn', 'com.my', 'co.nz', 'co.id', 'web.id',
  'or.id', 'ac.id', 'github.io', 'web.app', 'firebaseapp.com', 'ddns.net', 'no-ip.org', 'no-ip.com',
  'sytes.net', 'hopto.org', 'zapto.org', 'myftp.org', 'myftp.biz', 'servehttp.com', 'serveftp.com',
  'redirectme.net', 'onthewifi.com', 'duckdns.org', 'blogspot.com', 'wordpress.com', 'weebly.com',
  'wixsite.com', 'netlify.app', 'vercel.app', 'pages.dev', 'workers.dev', 'herokuapp.com',
  'appspot.com', 'azurewebsites.net', 'cloudfront.net', 'amazonaws.com', 'xsph.ru', 'frge.io',
  '000webhostapp.com', 'ucoz.ru', 'ucoz.ua', 'ucoz.net', 'narod.ru', 'at.ua', 'my1.ru',
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Registrable domain (eTLD+1) under the vendored suffix table; IPs and bare hosts pass through. */
export function etldPlusOne(label: string): string {
  const host = label.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (IPV4.test(host) || host.includes(':') || host.includes('/')) return label.trim();
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join('.');
  const lastThree = labels.slice(-3).join('.');
  if (labels.length > 3 && SECOND_LEVEL_SUFFIXES.has(lastThree)) return labels.slice(-4).join('.');
  if (SECOND_LEVEL_SUFFIXES.has(lastTwo)) return lastThree;
  return lastTwo;
}
