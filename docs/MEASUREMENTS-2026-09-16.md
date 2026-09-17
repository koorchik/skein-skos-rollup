# Measurements 2026-09-16: roll-up operators R0–R4 on the frozen SKEIN-R registries

Exploratory, not yet claims: `docs/CLAIMS.md` stays empty until a number is frozen for the
manuscript. No LLM call was made for anything on this page. Four arms (A1 r1, A2 r1, B1 r1, B2 r3;
see `runs/experiments/README.md`) × five schemes with gold hierarchy edges; gold
`gold/gold.json`, reportable slice = test-test edges (`docs/ROLLUP-PROTOCOL.md`). Confidence
intervals for the roll-up rows are not wired yet (`bin/stats.ts --rollup` is to-do); recall@k
carries percentile-bootstrap intervals.

**Every table below is generated from the committed JSON, not typed.** Percentages are sound% /
complete% as defined in the protocol; "targets" = number of distinct fold targets (fewer = more
folding); AUPC = area under sound% vs number of targets over the operator's λ sweep. For each
swept operator two rows of its sweep are shown: the loosest setting (folds most) and the strictest
(folds least); the whole sweep is in the `.txt` next to each JSON. λ has not been frozen on the
dev slice for any operator yet. The wiki plan note quotes the first baseline on ALL gold splits
(`analysis/out/rollup-r0-r1.json`, e.g. B2 r3 87.3 / 63.0); the numbers here are the test split
(`rollup-r0-r1-test.json`, B2 r3 89.9 / 63.3), so the two differ by up to about 2 points by design.

## Findings

1. **Judge edges are sound but incomplete (R0).** Software at λ = 0: 81.3–89.9% sound and
   63.3–80.4% complete across the four arms, fold time under 2 ms. Raising the similarity brake
   buys soundness by not folding: at λ = 0.95 soundness is 100% and completeness 0–1.4%.
2. **The instantial contract is almost always right and rarely finishes.** `broaderInstantial`
   only: 99.3–100% sound, 18.8–21.6% complete on Software, AUPC ≥ 0.996.
3. **Facet stripping (R1) is sound and nearly never complete:** 94.0–94.4% sound, 9.0–10.1%
   complete on Software; on the schemes without version-like qualifiers it is the identity.
4. **Every vector operator is best at its strictest setting, where it equals R1.** Euclidean
   clustering (R2 `hac`), cosine ranking and zero-shot hyperbolic ranking (R3) all reach their
   highest soundness at the end of the sweep that folds nothing beyond R1, and lose soundness
   as they fold more (B2 r3 Software, loosest setting: `hac` 49.6%,
   `hyperbolic-euclid` 38.8%, `hyperbolic-hit` 14.4% sound).
5. **Must-links with a medoid target are a designed failure; with a root target they reproduce
   R0.** `hac-constrained` 33–35% sound; `hac-constrained-root` 87.8–89.9% sound and
   62.6–63.3% complete on B2 r3, that is R0's numbers, with the strict Exchange probe failing at
   every λ.
6. **Hybrids inherit R0.** `hybrid[all]+X` equals R0 at the strict end of X's sweep and loses
   soundness at the loose end. Over all hybrid rows on Software, the only ones that match their
   R0 baseline on soundness and beat it on completeness do so by a single concept (A1 r1,
   `broaderInstantial` contract: 28 instead of 27 complete of 144, from the R1 fallback).
7. **Zero-shot HiT ranks parents about half as well as plain cosine** (Software recall@10:
   cosine 43–49, cosine with the HiT norm filter 36–41, HiT 23–25, HiT on `prefLabel: definition`
   14–24; table below), so the norm filter removes recall and gloss text does not rescue HiT.
   On the 12-pair smoke test the HiT norm order agrees with the hand label on 7 of 12 pairs, with
   all norms between 20.8 and 22.9 (`analysis/hyperbolic/out/smoke.txt`).
8. **Probes.** At λ ≤ 0.5 the loose Exchange probe passes on all four arms for the wrong
   reason: the family does fold to one target, but that target is `Windows` (A1, B1, B2) or
   `Microsoft SQL Server (MSSQL)` (A2), a chain merge inherited from the registry. The strict
   variant (`exch!`, target label contains `Exchange`) fails there and passes only at
   λ = 0.7–0.9 on A1 and B2 and at λ = 0.7 on B1, never on A2. Report both probes.
9. **Device is not interpretable** (2 test-test units; stripping rules were tuned on Software).

Consequence, decided 2026-09-16: post-hoc vector methods cannot add the missing parents; the
hierarchy has to be completed when the vocabulary is built, and the fold stays a deterministic
graph walk with model-free fallbacks. See `docs/EXPERIMENT-PLAN.md`.

## R0 / R1 baseline, test-test edges

source `analysis/out/rollup-r0-r1-test.json` · split `test` · generated 2026-09-16T12:33:33.268Z · 300 rows


**Software**

| operator | contract | arm | denom | loosest λ: sound / complete / B³F1 / targets | strictest λ: sound / complete / B³F1 / targets | AUPC | ms |
|---|---|---|---|---|---|---|---|
| graph | all | A1 r1 | 144 | λ=0: 87.5 / 77.8 / 0.841 / 461 | λ=0.95: 100.0 / 1.4 / 0.865 / 764 | 0.937 | 0.6 |
| graph[broaderInstantial] | broaderInstantial | A1 r1 | 144 | λ=0: 99.3 / 18.8 / 0.872 / 718 | λ=0.95: 100.0 / 1.4 / 0.864 / 766 | 0.999 | 0.3 |
| facet | - | A1 r1 | 144 | λ=0: 94.4 / 9.7 / 0.868 / 738 | – | – | 1.9 |
| graph | all | A2 r1 | 134 | λ=0: 81.3 / 72.4 / 0.841 / 490 | λ=0.95: 100.0 / 0.0 / 0.875 / 772 | 0.934 | 0.2 |
| graph[broaderInstantial] | broaderInstantial | A2 r1 | 134 | λ=0: 100.0 / 20.1 / 0.887 / 733 | λ=0.95: 100.0 / 0.0 / 0.875 / 772 | 1.000 | 0.2 |
| facet | - | A2 r1 | 134 | λ=0: 94.0 / 9.0 / 0.879 / 748 | – | – | 0.6 |
| graph | all | B1 r1 | 143 | λ=0: 87.4 / 80.4 / 0.833 / 486 | λ=0.95: 100.0 / 0.0 / 0.868 / 805 | 0.934 | 0.2 |
| graph[broaderInstantial] | broaderInstantial | B1 r1 | 143 | λ=0: 99.3 / 18.9 / 0.879 / 761 | λ=0.95: 100.0 / 0.0 / 0.868 / 805 | 0.996 | 0.1 |
| facet | - | B1 r1 | 143 | λ=0: 94.4 / 9.8 / 0.874 / 775 | – | – | 0.5 |
| graph | all | B2 r3 | 139 | λ=0: 89.9 / 63.3 / 0.877 / 526 | λ=0.95: 100.0 / 1.4 / 0.873 / 791 | 0.941 | 0.2 |
| graph[broaderInstantial] | broaderInstantial | B2 r3 | 139 | λ=0: 99.3 / 21.6 / 0.888 / 747 | λ=0.95: 100.0 / 0.7 / 0.872 / 792 | 0.996 | 0.1 |
| facet | - | B2 r3 | 139 | λ=0: 94.2 / 10.1 / 0.876 / 765 | – | – | 0.4 |

**Sector**

| operator | contract | arm | denom | loosest λ: sound / complete / B³F1 / targets | strictest λ: sound / complete / B³F1 / targets | AUPC | ms |
|---|---|---|---|---|---|---|---|
| graph | all | A1 r1 | 52 | λ=0: 94.2 / 57.7 / 0.633 / 20 | λ=0.95: 100.0 / 0.0 / 0.495 / 93 | 0.923 | 0.1 |
| graph[broaderInstantial] | broaderInstantial | A1 r1 | 52 | λ=0: 100.0 / 0.0 / 0.490 / 93 | λ=0.95: 100.0 / 0.0 / 0.490 / 94 | 1.000 | 0.0 |
| facet | - | A1 r1 | 52 | λ=0: 100.0 / 0.0 / 0.490 / 94 | – | – | 0.0 |
| graph | all | A2 r1 | 56 | λ=0: 89.3 / 12.5 / 0.612 / 22 | λ=0.95: 100.0 / 0.0 / 0.467 / 95 | 0.957 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | A2 r1 | 56 | λ=0: 100.0 / 0.0 / 0.467 / 95 | λ=0.95: 100.0 / 0.0 / 0.467 / 95 | 1.000 | 0.0 |
| facet | - | A2 r1 | 56 | λ=0: 100.0 / 0.0 / 0.467 / 95 | – | – | 0.0 |
| graph | all | B1 r1 | 53 | λ=0: 69.8 / 26.4 / 0.522 / 16 | λ=0.95: 100.0 / 0.0 / 0.481 / 93 | 0.867 | 0.1 |
| graph[broaderInstantial] | broaderInstantial | B1 r1 | 53 | λ=0: 98.1 / 1.9 / 0.484 / 88 | λ=0.95: 100.0 / 0.0 / 0.481 / 93 | 0.983 | 0.0 |
| facet | - | B1 r1 | 53 | λ=0: 100.0 / 0.0 / 0.481 / 93 | – | – | 0.0 |
| graph | all | B2 r3 | 53 | λ=0: 71.7 / 24.5 / 0.486 / 13 | λ=0.95: 100.0 / 0.0 / 0.485 / 90 | 0.896 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | B2 r3 | 53 | λ=0: 100.0 / 0.0 / 0.485 / 88 | λ=0.95: 100.0 / 0.0 / 0.485 / 90 | 1.000 | 0.0 |
| facet | - | B2 r3 | 53 | λ=0: 100.0 / 0.0 / 0.485 / 90 | – | – | 0.0 |

**Government Body**

| operator | contract | arm | denom | loosest λ: sound / complete / B³F1 / targets | strictest λ: sound / complete / B³F1 / targets | AUPC | ms |
|---|---|---|---|---|---|---|---|
| graph | all | A1 r1 | 27 | λ=0: 100.0 / 63.0 / 0.866 / 33 | λ=0.95: 100.0 / 3.7 / 0.653 / 62 | 1.000 | 0.1 |
| graph[broaderInstantial] | broaderInstantial | A1 r1 | 27 | λ=0: 100.0 / 0.0 / 0.643 / 62 | λ=0.95: 100.0 / 0.0 / 0.641 / 63 | 1.000 | 0.0 |
| facet | - | A1 r1 | 27 | λ=0: 100.0 / 0.0 / 0.641 / 63 | – | – | 0.0 |
| graph | all | A2 r1 | 27 | λ=0: 100.0 / 74.1 / 0.859 / 34 | λ=0.95: 100.0 / 0.0 / 0.641 / 63 | 1.000 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | A2 r1 | 27 | λ=0: 100.0 / 0.0 / 0.641 / 63 | λ=0.95: 100.0 / 0.0 / 0.641 / 63 | 1.000 | 0.0 |
| facet | - | A2 r1 | 27 | λ=0: 100.0 / 0.0 / 0.641 / 63 | – | – | 0.0 |
| graph | all | B1 r1 | 30 | λ=0: 76.7 / 63.3 / 0.744 / 28 | λ=0.95: 100.0 / 0.0 / 0.625 / 65 | 0.884 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | B1 r1 | 30 | λ=0: 100.0 / 0.0 / 0.625 / 65 | λ=0.95: 100.0 / 0.0 / 0.625 / 65 | 1.000 | 0.0 |
| facet | - | B1 r1 | 30 | λ=0: 100.0 / 0.0 / 0.625 / 65 | – | – | 0.0 |
| graph | all | B2 r3 | 25 | λ=0: 92.0 / 48.0 / 0.839 / 32 | λ=0.95: 100.0 / 0.0 / 0.658 / 60 | 0.994 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | B2 r3 | 25 | λ=0: 100.0 / 0.0 / 0.658 / 60 | λ=0.95: 100.0 / 0.0 / 0.658 / 60 | 1.000 | 0.0 |
| facet | - | B2 r3 | 25 | λ=0: 100.0 / 0.0 / 0.658 / 60 | – | – | 0.0 |

**Organization**

| operator | contract | arm | denom | loosest λ: sound / complete / B³F1 / targets | strictest λ: sound / complete / B³F1 / targets | AUPC | ms |
|---|---|---|---|---|---|---|---|
| graph | all | A1 r1 | 8 | λ=0: 87.5 / 75.0 / 0.979 / 144 | λ=0.95: 100.0 / 0.0 / 0.969 / 160 | 0.910 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | A1 r1 | 8 | λ=0: 100.0 / 0.0 / 0.969 / 160 | λ=0.95: 100.0 / 0.0 / 0.969 / 160 | 1.000 | 0.0 |
| facet | - | A1 r1 | 8 | λ=0: 100.0 / 0.0 / 0.969 / 160 | – | – | 0.0 |
| graph | all | A2 r1 | 8 | λ=0: 100.0 / 100.0 / 0.996 / 144 | λ=0.95: 100.0 / 0.0 / 0.969 / 160 | 1.000 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | A2 r1 | 8 | λ=0: 100.0 / 0.0 / 0.969 / 160 | λ=0.95: 100.0 / 0.0 / 0.969 / 160 | 1.000 | 0.0 |
| facet | - | A2 r1 | 8 | λ=0: 100.0 / 0.0 / 0.969 / 160 | – | – | 0.0 |
| graph | all | B1 r1 | 8 | λ=0: 87.5 / 87.5 / 0.989 / 144 | λ=0.95: 100.0 / 0.0 / 0.965 / 160 | 0.934 | 0.1 |
| graph[broaderInstantial] | broaderInstantial | B1 r1 | 8 | λ=0: 100.0 / 0.0 / 0.965 / 160 | λ=0.95: 100.0 / 0.0 / 0.965 / 160 | 1.000 | 0.0 |
| facet | - | B1 r1 | 8 | λ=0: 100.0 / 0.0 / 0.965 / 160 | – | – | 0.0 |
| graph | all | B2 r3 | 8 | λ=0: 87.5 / 87.5 / 0.989 / 146 | λ=0.95: 100.0 / 0.0 / 0.965 / 159 | 0.918 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | B2 r3 | 8 | λ=0: 100.0 / 0.0 / 0.965 / 159 | λ=0.95: 100.0 / 0.0 / 0.965 / 159 | 1.000 | 0.0 |
| facet | - | B2 r3 | 8 | λ=0: 100.0 / 0.0 / 0.965 / 159 | – | – | 0.0 |

**Device**

| operator | contract | arm | denom | loosest λ: sound / complete / B³F1 / targets | strictest λ: sound / complete / B³F1 / targets | AUPC | ms |
|---|---|---|---|---|---|---|---|
| graph | all | A1 r1 | 2 | λ=0: 50.0 / 50.0 / 0.702 / 14 | λ=0.95: 100.0 / 0.0 / 0.963 / 31 | 0.706 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | A1 r1 | 2 | λ=0: 100.0 / 0.0 / 0.963 / 31 | λ=0.95: 100.0 / 0.0 / 0.963 / 31 | 1.000 | 0.0 |
| facet | - | A1 r1 | 2 | λ=0: 100.0 / 0.0 / 0.910 / 27 | – | – | 0.1 |
| graph | all | A2 r1 | 2 | λ=0: 100.0 / 50.0 / 0.946 / 25 | λ=0.95: 100.0 / 0.0 / 0.963 / 31 | 1.000 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | A2 r1 | 2 | λ=0: 100.0 / 0.0 / 0.963 / 31 | λ=0.95: 100.0 / 0.0 / 0.963 / 31 | 1.000 | 0.0 |
| facet | - | A2 r1 | 2 | λ=0: 100.0 / 0.0 / 0.910 / 27 | – | – | 0.1 |
| graph | all | B1 r1 | 2 | λ=0: 50.0 / 50.0 / 0.886 / 21 | λ=0.95: 100.0 / 0.0 / 0.963 / 30 | 0.917 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | B1 r1 | 2 | λ=0: 100.0 / 0.0 / 0.963 / 30 | λ=0.95: 100.0 / 0.0 / 0.963 / 30 | 1.000 | 0.0 |
| facet | - | B1 r1 | 2 | λ=0: 100.0 / 0.0 / 0.910 / 26 | – | – | 0.1 |
| graph | all | B2 r3 | 2 | λ=0: 50.0 / 50.0 / 0.434 / 7 | λ=0.95: 100.0 / 0.0 / 0.963 / 30 | 0.674 | 0.0 |
| graph[broaderInstantial] | broaderInstantial | B2 r3 | 2 | λ=0: 100.0 / 0.0 / 0.963 / 30 | λ=0.95: 100.0 / 0.0 / 0.963 / 30 | 1.000 | 0.0 |
| facet | - | B2 r3 | 2 | λ=0: 100.0 / 0.0 / 0.910 / 26 | – | – | 0.0 |

## R2 / R3 / R4, test-test edges, Software

source `analysis/out/rollup-r2-r4.json` · split `test` · generated 2026-09-16T14:19:00.686Z · 2780 rows


**Software**

| operator | contract | arm | denom | loosest λ: sound / complete / B³F1 / targets | strictest λ: sound / complete / B³F1 / targets | AUPC | ms |
|---|---|---|---|---|---|---|---|
| graph | all | A1 r1 | 144 | λ=0: 87.5 / 77.8 / 0.841 / 461 | λ=0.95: 100.0 / 1.4 / 0.865 / 764 | 0.937 | 1.3 |
| graph[broaderInstantial] | broaderInstantial | A1 r1 | 144 | λ=0: 99.3 / 18.8 / 0.872 / 718 | λ=0.95: 100.0 / 1.4 / 0.864 / 766 | 0.999 | 0.5 |
| facet | - | A1 r1 | 144 | λ=0: 94.4 / 9.7 / 0.868 / 738 | – | – | 4.2 |
| hac | - | A1 r1 | 144 | λ=0.7: 61.8 / 20.1 / 0.773 / 427 | λ=0.99: 94.4 / 9.7 / 0.868 / 738 | 0.766 | 693.6 |
| hac-constrained | - | A1 r1 | 144 | λ=0.7: 27.1 / 16.0 / 0.704 / 298 | λ=0.99: 29.9 / 16.0 / 0.832 / 455 | 0.291 | 507.5 |
| hac-constrained-root | - | A1 r1 | 144 | λ=0.7: 85.4 / 78.5 / 0.704 / 298 | λ=0.99: 86.8 / 77.1 / 0.832 / 455 | 0.859 | 504.9 |
| hyperbolic-hit | - | A1 r1 | 144 | λ=inf: 14.6 / 10.4 / 0.290 / 82 | λ=2: 94.4 / 9.7 / 0.867 / 736 | 0.548 | 10.4 |
| hyperbolic-hit-gloss | - | A1 r1 | 144 | λ=inf: 13.9 / 9.7 / 0.328 / 101 | λ=2: 94.4 / 9.7 / 0.867 / 734 | 0.546 | 9.6 |
| hyperbolic-euclid | - | A1 r1 | 144 | λ=0.7: 38.2 / 18.1 / 0.799 / 560 | λ=0.99: 94.4 / 9.7 / 0.868 / 738 | 0.590 | 9.2 |
| hyperbolic-euclid-normfilter | - | A1 r1 | 144 | λ=0.7: 46.5 / 12.5 / 0.716 / 371 | λ=0.99: 94.4 / 9.7 / 0.868 / 738 | 0.685 | 8.8 |
| hyperbolic-euclid-normfilter-gloss | - | A1 r1 | 144 | λ=0.7: 47.9 / 13.2 / 0.714 / 380 | λ=0.99: 94.4 / 9.7 / 0.868 / 738 | 0.698 | 8.4 |
| hybrid[all]+hac | all | A1 r1 | 144 | λ=0.7: 85.4 / 78.5 / 0.714 / 322 | λ=0.99: 87.5 / 77.8 / 0.841 / 462 | 0.863 | 740.3 |
| hybrid[broaderInstantial]+hac | broaderInstantial | A1 r1 | 144 | λ=0.7: 61.8 / 23.6 / 0.775 / 423 | λ=0.99: 99.3 / 19.4 / 0.874 / 715 | 0.789 | 797.1 |
| hybrid[all]+hyperbolic-hit | all | A1 r1 | 144 | λ=inf: 78.5 / 77.8 / 0.434 / 115 | λ=2: 87.5 / 77.8 / 0.840 / 461 | 0.835 | 10.0 |
| hybrid[broaderInstantial]+hyperbolic-hit | broaderInstantial | A1 r1 | 144 | λ=inf: 24.3 / 20.1 / 0.322 / 92 | λ=2: 99.3 / 19.4 / 0.873 / 713 | 0.621 | 2.6 |
| hybrid[all]+hyperbolic-euclid | all | A1 r1 | 144 | λ=0.7: 84.7 / 80.6 / 0.771 / 409 | λ=0.99: 87.5 / 77.8 / 0.841 / 462 | 0.863 | 8.7 |
| hybrid[broaderInstantial]+hyperbolic-euclid | broaderInstantial | A1 r1 | 144 | λ=0.7: 45.1 / 25.7 / 0.802 / 554 | λ=0.99: 99.3 / 19.4 / 0.874 / 715 | 0.648 | 3.0 |
| hybrid[all]+hyperbolic-euclid-normfilter | all | A1 r1 | 144 | λ=0.7: 83.3 / 77.8 / 0.677 / 291 | λ=0.99: 87.5 / 77.8 / 0.841 / 462 | 0.854 | 8.5 |
| hybrid[broaderInstantial]+hyperbolic-euclid-normfilter | broaderInstantial | A1 r1 | 144 | λ=0.7: 53.5 / 20.8 / 0.718 / 367 | λ=0.99: 99.3 / 19.4 / 0.874 / 715 | 0.741 | 3.7 |
| graph | all | A2 r1 | 134 | λ=0: 81.3 / 72.4 / 0.841 / 490 | λ=0.95: 100.0 / 0.0 / 0.875 / 772 | 0.934 | 0.4 |
| graph[broaderInstantial] | broaderInstantial | A2 r1 | 134 | λ=0: 100.0 / 20.1 / 0.887 / 733 | λ=0.95: 100.0 / 0.0 / 0.875 / 772 | 1.000 | 0.2 |
| facet | - | A2 r1 | 134 | λ=0: 94.0 / 9.0 / 0.879 / 748 | – | – | 0.9 |
| hac | - | A2 r1 | 134 | λ=0.7: 59.0 / 17.2 / 0.753 / 421 | λ=0.99: 94.0 / 9.0 / 0.879 / 748 | 0.785 | 786.1 |
| hac-constrained | - | A2 r1 | 134 | λ=0.7: 20.1 / 8.2 / 0.695 / 309 | λ=0.99: 22.4 / 6.7 / 0.836 / 486 | 0.206 | 540.0 |
| hac-constrained-root | - | A2 r1 | 134 | λ=0.7: 79.1 / 73.1 / 0.695 / 309 | λ=0.99: 80.6 / 71.6 / 0.836 / 486 | 0.789 | 514.0 |
| hyperbolic-hit | - | A2 r1 | 134 | λ=inf: 14.2 / 9.7 / 0.297 / 85 | λ=2: 94.0 / 9.0 / 0.877 / 745 | 0.554 | 8.5 |
| hyperbolic-hit-gloss | - | A2 r1 | 134 | λ=inf: 13.4 / 9.0 / 0.297 / 90 | λ=2: 94.0 / 9.0 / 0.875 / 737 | 0.564 | 9.2 |
| hyperbolic-euclid | - | A2 r1 | 134 | λ=0.7: 35.8 / 14.9 / 0.811 / 570 | λ=0.99: 94.0 / 9.0 / 0.879 / 748 | 0.582 | 8.7 |
| hyperbolic-euclid-normfilter | - | A2 r1 | 134 | λ=0.7: 46.3 / 11.2 / 0.688 / 355 | λ=0.99: 94.0 / 9.0 / 0.879 / 748 | 0.698 | 8.8 |
| hyperbolic-euclid-normfilter-gloss | - | A2 r1 | 134 | λ=0.7: 47.8 / 12.7 / 0.703 / 374 | λ=0.99: 94.0 / 9.0 / 0.879 / 748 | 0.702 | 9.4 |
| hybrid[all]+hac | all | A2 r1 | 134 | λ=0.7: 78.4 / 74.6 / 0.694 / 318 | λ=0.99: 81.3 / 72.4 / 0.841 / 490 | 0.791 | 746.6 |
| hybrid[broaderInstantial]+hac | broaderInstantial | A2 r1 | 134 | λ=0.7: 63.4 / 24.6 / 0.759 / 419 | λ=0.99: 100.0 / 20.1 / 0.888 / 732 | 0.820 | 746.8 |
| hybrid[all]+hyperbolic-hit | all | A2 r1 | 134 | λ=inf: 72.4 / 72.4 / 0.389 / 109 | λ=2: 81.3 / 72.4 / 0.839 / 488 | 0.772 | 8.7 |
| hybrid[broaderInstantial]+hyperbolic-hit | broaderInstantial | A2 r1 | 134 | λ=inf: 25.4 / 20.9 / 0.322 / 91 | λ=2: 100.0 / 20.1 / 0.886 / 729 | 0.636 | 2.1 |
| hybrid[all]+hyperbolic-euclid | all | A2 r1 | 134 | λ=0.7: 76.1 / 74.6 / 0.766 / 413 | λ=0.99: 81.3 / 72.4 / 0.841 / 490 | 0.775 | 8.3 |
| hybrid[broaderInstantial]+hyperbolic-euclid | broaderInstantial | A2 r1 | 134 | λ=0.7: 44.8 / 25.4 / 0.813 / 562 | λ=0.99: 100.0 / 20.1 / 0.888 / 732 | 0.659 | 1.9 |
| hybrid[all]+hyperbolic-euclid-normfilter | all | A2 r1 | 134 | λ=0.7: 76.1 / 73.1 / 0.644 / 280 | λ=0.99: 81.3 / 72.4 / 0.841 / 490 | 0.783 | 8.3 |
| hybrid[broaderInstantial]+hyperbolic-euclid-normfilter | broaderInstantial | A2 r1 | 134 | λ=0.7: 53.7 / 21.6 / 0.692 / 351 | λ=0.99: 100.0 / 20.1 / 0.888 / 732 | 0.765 | 1.9 |
| graph | all | B1 r1 | 143 | λ=0: 87.4 / 80.4 / 0.833 / 486 | λ=0.95: 100.0 / 0.0 / 0.868 / 805 | 0.934 | 0.4 |
| graph[broaderInstantial] | broaderInstantial | B1 r1 | 143 | λ=0: 99.3 / 18.9 / 0.879 / 761 | λ=0.95: 100.0 / 0.0 / 0.868 / 805 | 0.996 | 0.3 |
| facet | - | B1 r1 | 143 | λ=0: 94.4 / 9.8 / 0.874 / 775 | – | – | 0.9 |
| hac | - | B1 r1 | 143 | λ=0.7: 57.3 / 14.0 / 0.783 / 474 | λ=0.99: 94.4 / 9.8 / 0.874 / 775 | 0.733 | 794.5 |
| hac-constrained | - | B1 r1 | 143 | λ=0.7: 25.9 / 14.0 / 0.715 / 331 | λ=0.99: 28.0 / 14.7 / 0.827 / 481 | 0.269 | 549.4 |
| hac-constrained-root | - | B1 r1 | 143 | λ=0.7: 83.2 / 77.6 / 0.715 / 331 | λ=0.99: 85.3 / 78.3 / 0.827 / 481 | 0.842 | 541.2 |
| hyperbolic-hit | - | B1 r1 | 143 | λ=inf: 14.7 / 10.5 / 0.292 / 89 | λ=2: 94.4 / 9.8 / 0.872 / 772 | 0.563 | 8.8 |
| hyperbolic-hit-gloss | - | B1 r1 | 143 | λ=inf: 12.6 / 9.8 / 0.311 / 99 | λ=2: 94.4 / 9.8 / 0.872 / 769 | 0.523 | 8.6 |
| hyperbolic-euclid | - | B1 r1 | 143 | λ=0.7: 42.7 / 16.8 / 0.823 / 626 | λ=0.99: 94.4 / 9.8 / 0.874 / 775 | 0.599 | 8.5 |
| hyperbolic-euclid-normfilter | - | B1 r1 | 143 | λ=0.7: 52.4 / 14.7 / 0.727 / 425 | λ=0.99: 94.4 / 9.8 / 0.874 / 775 | 0.711 | 8.6 |
| hyperbolic-euclid-normfilter-gloss | - | B1 r1 | 143 | λ=0.7: 50.3 / 12.6 / 0.741 / 434 | λ=0.99: 94.4 / 9.8 / 0.874 / 775 | 0.753 | 8.6 |
| hybrid[all]+hac | all | B1 r1 | 143 | λ=0.7: 85.3 / 80.4 / 0.714 / 341 | λ=0.99: 87.4 / 80.4 / 0.833 / 487 | 0.865 | 789.9 |
| hybrid[broaderInstantial]+hac | broaderInstantial | B1 r1 | 143 | λ=0.7: 60.8 / 21.0 / 0.784 / 479 | λ=0.99: 98.6 / 19.6 / 0.880 / 759 | 0.776 | 787.2 |
| hybrid[all]+hyperbolic-hit | all | B1 r1 | 143 | λ=inf: 80.4 / 80.4 / 0.410 / 112 | λ=2: 87.4 / 80.4 / 0.830 / 484 | 0.846 | 9.2 |
| hybrid[broaderInstantial]+hyperbolic-hit | broaderInstantial | B1 r1 | 143 | λ=inf: 24.5 / 20.3 / 0.314 / 100 | λ=2: 98.6 / 19.6 / 0.878 / 756 | 0.628 | 2.4 |
| hybrid[all]+hyperbolic-euclid | all | B1 r1 | 143 | λ=0.7: 84.6 / 81.8 / 0.775 / 432 | λ=0.99: 87.4 / 80.4 / 0.833 / 487 | 0.854 | 8.8 |
| hybrid[broaderInstantial]+hyperbolic-euclid | broaderInstantial | B1 r1 | 143 | λ=0.7: 48.3 / 23.8 / 0.820 / 623 | λ=0.99: 98.6 / 19.6 / 0.880 / 759 | 0.641 | 2.2 |
| hybrid[all]+hyperbolic-euclid-normfilter | all | B1 r1 | 143 | λ=0.7: 85.3 / 80.4 / 0.680 / 313 | λ=0.99: 87.4 / 80.4 / 0.833 / 487 | 0.865 | 8.8 |
| hybrid[broaderInstantial]+hyperbolic-euclid-normfilter | broaderInstantial | B1 r1 | 143 | λ=0.7: 58.0 / 22.4 / 0.728 / 430 | λ=0.99: 98.6 / 19.6 / 0.880 / 759 | 0.751 | 2.2 |
| graph | all | B2 r3 | 139 | λ=0: 89.9 / 63.3 / 0.877 / 526 | λ=0.95: 100.0 / 1.4 / 0.873 / 791 | 0.941 | 0.4 |
| graph[broaderInstantial] | broaderInstantial | B2 r3 | 139 | λ=0: 99.3 / 21.6 / 0.888 / 747 | λ=0.95: 100.0 / 0.7 / 0.872 / 792 | 0.996 | 1.9 |
| facet | - | B2 r3 | 139 | λ=0: 94.2 / 10.1 / 0.876 / 765 | – | – | 0.9 |
| hac | - | B2 r3 | 139 | λ=0.7: 49.6 / 10.1 / 0.769 / 451 | λ=0.99: 94.2 / 10.1 / 0.876 / 765 | 0.691 | 777.1 |
| hac-constrained | - | B2 r3 | 139 | λ=0.7: 33.1 / 20.9 / 0.742 / 348 | λ=0.99: 35.3 / 20.9 / 0.874 / 521 | 0.344 | 574.2 |
| hac-constrained-root | - | B2 r3 | 139 | λ=0.7: 87.8 / 62.6 / 0.742 / 348 | λ=0.99: 89.9 / 63.3 / 0.874 / 521 | 0.888 | 574.2 |
| hyperbolic-hit | - | B2 r3 | 139 | λ=inf: 14.4 / 10.8 / 0.293 / 89 | λ=2: 94.2 / 10.1 / 0.874 / 762 | 0.561 | 8.7 |
| hyperbolic-hit-gloss | - | B2 r3 | 139 | λ=inf: 12.9 / 10.8 / 0.264 / 87 | λ=2: 94.2 / 10.1 / 0.874 / 760 | 0.583 | 8.8 |
| hyperbolic-euclid | - | B2 r3 | 139 | λ=0.7: 38.8 / 16.5 / 0.823 / 609 | λ=0.99: 94.2 / 10.1 / 0.876 / 765 | 0.586 | 9.0 |
| hyperbolic-euclid-normfilter | - | B2 r3 | 139 | λ=0.7: 53.2 / 14.4 / 0.727 / 419 | λ=0.99: 94.2 / 10.1 / 0.876 / 765 | 0.686 | 8.3 |
| hyperbolic-euclid-normfilter-gloss | - | B2 r3 | 139 | λ=0.7: 56.1 / 12.9 / 0.732 / 422 | λ=0.99: 94.2 / 10.1 / 0.876 / 765 | 0.712 | 8.2 |
| hybrid[all]+hac | all | B2 r3 | 139 | λ=0.7: 84.9 / 64.7 / 0.739 / 368 | λ=0.99: 89.9 / 63.3 / 0.877 / 527 | 0.869 | 795.1 |
| hybrid[broaderInstantial]+hac | broaderInstantial | B2 r3 | 139 | λ=0.7: 61.2 / 25.9 / 0.772 / 456 | λ=0.99: 99.3 / 21.6 / 0.888 / 748 | 0.744 | 786.8 |
| hybrid[all]+hyperbolic-hit | all | B2 r3 | 139 | λ=inf: 77.7 / 63.3 / 0.437 / 127 | λ=2: 89.9 / 63.3 / 0.875 / 525 | 0.846 | 11.4 |
| hybrid[broaderInstantial]+hyperbolic-hit | broaderInstantial | B2 r3 | 139 | λ=inf: 25.9 / 22.3 / 0.326 / 100 | λ=2: 99.3 / 21.6 / 0.886 / 745 | 0.641 | 2.2 |
| hybrid[all]+hyperbolic-euclid | all | B2 r3 | 139 | λ=0.7: 83.5 / 65.5 / 0.813 / 473 | λ=0.99: 89.9 / 63.3 / 0.877 / 527 | 0.857 | 8.5 |
| hybrid[broaderInstantial]+hyperbolic-euclid | broaderInstantial | B2 r3 | 139 | λ=0.7: 46.8 / 26.6 / 0.825 / 608 | λ=0.99: 99.3 / 21.6 / 0.888 / 748 | 0.650 | 2.7 |
| hybrid[all]+hyperbolic-euclid-normfilter | all | B2 r3 | 139 | λ=0.7: 84.9 / 63.3 / 0.715 / 338 | λ=0.99: 89.9 / 63.3 / 0.877 / 527 | 0.868 | 8.7 |
| hybrid[broaderInstantial]+hyperbolic-euclid-normfilter | broaderInstantial | B2 r3 | 139 | λ=0.7: 60.4 / 25.2 / 0.734 / 420 | λ=0.99: 99.3 / 21.6 / 0.888 / 748 | 0.742 | 2.1 |

## Ranked-parent recall, Software (from `analysis/out/recall-at-k.md`)

Unit = gold-mapped concept with a gold ancestor over test-test edges; `trans.` columns credit
any gold ancestor, `direct` columns only the direct parent; 1000-resample percentile bootstrap,
seed 42. The other schemes are in the source file.

| arm | method | n | cov. | R@1 | R@5 | R@10 | MRR | R@10 CI | direct R@1 | R@5 | R@10 | direct MRR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid | 143 | 98% | 12.6 | 32.2 | 46.9 | 0.210 | [39, 55] | 12.6 | 32.2 | 46.9 | 0.210 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter | 143 | 98% | 14.0 | 28.0 | 39.9 | 0.203 | [32, 48] | 14.0 | 27.3 | 39.2 | 0.200 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter-gloss | 143 | 98% | 7.7 | 19.6 | 31.5 | 0.137 | [24, 39] | 7.7 | 19.6 | 31.5 | 0.137 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot | 143 | 98% | 7.0 | 18.2 | 25.2 | 0.118 | [18, 32] | 6.3 | 17.5 | 24.5 | 0.111 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot-gloss | 143 | 98% | 2.8 | 10.5 | 14.0 | 0.059 | [8, 20] | 2.8 | 10.5 | 14.0 | 0.059 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid | 133 | 97% | 9.8 | 29.3 | 43.6 | 0.189 | [36, 52] | 9.8 | 28.6 | 43.6 | 0.186 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter | 133 | 97% | 11.3 | 27.1 | 37.6 | 0.180 | [29, 46] | 10.5 | 26.3 | 36.8 | 0.172 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter-gloss | 133 | 97% | 9.8 | 24.1 | 36.8 | 0.168 | [29, 46] | 9.8 | 24.1 | 36.8 | 0.167 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot | 133 | 97% | 5.3 | 15.8 | 22.6 | 0.097 | [15, 30] | 4.5 | 15.0 | 21.8 | 0.089 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot-gloss | 133 | 97% | 3.8 | 10.5 | 15.8 | 0.069 | [10, 22] | 3.8 | 10.5 | 15.8 | 0.069 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid | 141 | 100% | 12.1 | 31.2 | 42.6 | 0.198 | [35, 51] | 12.1 | 31.2 | 41.8 | 0.197 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter | 141 | 100% | 14.2 | 33.3 | 41.1 | 0.213 | [33, 49] | 14.2 | 32.6 | 40.4 | 0.209 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter-gloss | 141 | 100% | 10.6 | 29.1 | 41.8 | 0.183 | [33, 50] | 10.6 | 28.4 | 41.8 | 0.183 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot | 141 | 100% | 7.1 | 17.7 | 24.1 | 0.117 | [18, 31] | 6.4 | 17.0 | 23.4 | 0.110 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot-gloss | 141 | 100% | 6.4 | 14.9 | 24.1 | 0.107 | [17, 30] | 6.4 | 14.9 | 23.4 | 0.106 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid | 138 | 99% | 13.8 | 31.2 | 49.3 | 0.218 | [41, 57] | 13.8 | 31.2 | 49.3 | 0.218 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter | 138 | 99% | 12.3 | 30.4 | 36.2 | 0.197 | [28, 44] | 12.3 | 30.4 | 36.2 | 0.197 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter-gloss | 138 | 99% | 13.0 | 23.9 | 31.2 | 0.178 | [23, 38] | 13.0 | 23.9 | 31.2 | 0.178 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot | 138 | 99% | 7.2 | 17.4 | 24.6 | 0.117 | [17, 32] | 6.5 | 16.7 | 23.9 | 0.109 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot-gloss | 138 | 99% | 8.0 | 18.1 | 23.9 | 0.118 | [17, 31] | 8.0 | 18.1 | 23.9 | 0.118 |

## Environment of the hyperbolic runs

`analysis/hyperbolic/out/env.json`: Python 3.14.4, torch 2.14.0+cpu, model
`Hierarchy-Transformers/HiT-MiniLM-L12-WordNetNoun` (sha `b170cbfa…`), dimension 384, curvature
1/384, CPU. Geometry diagnostics (δ-hyperbolicity, tree distortion) are written to
`analysis/hyperbolic/out/geometry-<arm>-software.json`, which is generated and git-ignored; the
figures quoted in the wiki plan note come from those files and must be regenerated
(`geometry.py --bundle`) before they are cited.

## Not measured yet

E2 family hints (never run); E1 with the cloud encoder (needs `--allow-paid`); gloss-HiT
geometry; confidence intervals and paired tests for roll-up rows; non-additive incident counts
under a fold; anything on a registry with a completed hierarchy (`<arm>-h1`).
