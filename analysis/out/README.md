# analysis/out: committed outputs

Regenerable, committed so that every number quoted in `docs/MEASUREMENTS-2026-09-16.md` and,
later, in `docs/CLAIMS.md` can be traced to a file. Each roll-up JSON carries the command that
produced it (`command`), the gold file, the split and the generation time.

## Article 4 (roll-up)

| file | what it is |
|---|---|
| `rollup-r0-r1-test.json` / `.txt` | R0 graph walk (contracts `all`, `broaderInstantial`) and R1 facet, four arms × five schemes, **test split: the reportable baseline**, 300 rows |
| `rollup-r0-r1.json` / `.txt` | the same on ALL gold splits (`--hierarchy-all-splits`): iteration only; the first baseline table of the wiki plan note quotes this file |
| `rollup-r2-r4.json` / `.txt` | R0–R4 with every enriched operator, test split, 2,780 rows; supersedes the R0 / R1 rows above with the strict Exchange probe added |
| `rollup-r2-r4-dev.json` / `.txt` | the same on the dev split: λ selection only, never reported |
| `recall-at-k.md` | recall@{1,5,10}, MRR and coverage of every ranked-parent file against the gold hierarchy, with bootstrap intervals (written by `analysis/hyperbolic/recall_report.py`) |

Row and `aupc` schema: `docs/CONTRACTS.md`. The `.txt` files are the console tables of the same
runs (one block per arm × operator × scheme, whole λ sweep).

## Inherited from SKEIN-R (article 2), unchanged

`test-main.json`, `test-main-core.json` (scored factorial cells and baselines), `stats-*.json`
(bootstrap and permutation outputs of `npm run stats`), `order-ari.json`, `blocker.json`: the
inputs of `analysis/figures.py`, kept as the frozen SKEIN-R record. Two inherited files have
names that look like roll-up outputs and are not: `rollup-a2r2-software.txt` is a transcript of
SKEIN-R's `npm run fold` on arm A2 r2 (the traversal R0 wraps), and `registry-a2r2.ttl` is the
worked `export-skos` example of the same arm.
