import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * File contracts shared by the export / embed / eval CLIs and the Python sidecar
 * (`analysis/hyperbolic/`). Kept tiny and dependency-free so both sides can be read side by side.
 */

/** `Government Body` → `government-body`; used in every sidecar file name. */
export function schemeSlug(category: string): string {
  return category.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const SIDECAR_IN = path.resolve(__dirname, '../../analysis/hyperbolic/in');
export const SIDECAR_OUT = path.resolve(__dirname, '../../analysis/hyperbolic/out');

/** `analysis/hyperbolic/in/scheme-<scheme>.json` — one concept scheme, self-contained. */
export interface SchemeExport {
  run: string;
  category: string;
  concepts: Array<{
    prefLabel: string;
    labels: string[];
    definition: string | null;
    /** `prefLabel: definition`, or the prefLabel alone — the E1 embedding input. */
    text: string;
  }>;
  edges: Array<{
    narrower: string;
    broader: string;
    type: string | null;
    similarityScore: number | null;
    decision: string;
  }>;
  goldMap: Record<string, string>;
  goldEdges: Array<{ fromClusterId: string; toClusterId: string; kind: string; split: 'test' | 'dev' | 'cross' }>;
}

/**
 * The arm part of every sidecar file name: the run directory's basename (e.g.
 * `t-a1-flash-gembed2-r1-35bc1387d473`), so the four baseline arms never collide on one scheme.
 * Accepts a path or a bare name.
 */
export function armSlug(run: string): string {
  return path.basename(run.replace(/\/$/, ''));
}

/** `<arm>-<scheme>` — the `--scheme` argument of the Python sidecar. */
export function armSchemeSlug(run: string, category: string): string {
  return `${armSlug(run)}-${schemeSlug(category)}`;
}

/** `analysis/hyperbolic/in/scheme-<arm>-<scheme>.json` */
export function schemeExportPath(run: string, category: string): string {
  return path.join(SIDECAR_IN, `scheme-${armSchemeSlug(run, category)}.json`);
}

/** `analysis/hyperbolic/in/vectors-<arm>-<scheme>-<provider>-<model>.jsonl` */
export function vectorsPath(run: string, category: string, provider: string, model: string): string {
  const slug = `${provider}-${model}`.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return path.join(SIDECAR_IN, `vectors-${armSchemeSlug(run, category)}-${slug}.jsonl`);
}

/** `analysis/hyperbolic/out/candidates-<arm>-<scheme>-<method>-<seed>.json` (R3 input). */
export function candidatesPath(run: string, category: string, method: string, seed = 0): string {
  return path.join(SIDECAR_OUT, `candidates-${armSchemeSlug(run, category)}-${method}-${seed}.json`);
}

/** One ranked-parent file of the sidecar (`hit_zeroshot.py`, `euclid_candidates.py`). */
export interface CandidatesFile {
  model: string;
  scheme: string;
  method?: string;
  w?: number;
  topk: number;
  text?: string;
  curvature?: number | null;
  rows: Array<{
    child: string;
    candidates: Array<{
      parent: string;
      score: number;
      dist: number;
      normChild: number | null;
      normParent: number | null;
    }>;
  }>;
}

export function readCandidatesFile(filePath: string): CandidatesFile {
  return JSON.parse(readFileSync(filePath, 'utf8')) as CandidatesFile;
}

/** Reads a `{k, t, v}` JSONL (the embeddings-cache line shape) into text → vector. */
export function readVectorsJsonl(filePath: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  if (!existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as { t: string; v: number[] };
    out.set(parsed.t, parsed.v);
  }
  return out;
}
