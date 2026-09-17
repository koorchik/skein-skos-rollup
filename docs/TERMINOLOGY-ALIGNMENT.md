# Terminology alignment for article 4: project vocabulary → community vocabulary

Purpose: keep the roll-up paper legible to reviewers from the OLAP / graph-OLAP, thesaurus and
SKOS, taxonomy-induction and hierarchy-embedding communities. The code keeps its internal names;
the paper introduces each internal name once, in parentheses after the standard term. The
article-2 alignment (mint = NIL verdict, registry = entity store, judge = LLM-as-judge, blocking,
and so on) still holds for everything inherited; it is readable with
`git show 23cdfc2:docs/TERMINOLOGY-ALIGNMENT.md`.

Anchors are citekeys of `~/work/kpi/dissert/references/references.bib`, checked on 2026-09-17.
"No anchor yet" means the bib and the wiki have no peer-reviewed source for the term: the paper
must not lean on the term as a claim until one is ingested (gap list:
`dissert/wiki/notes/skein-rollup-reading-map.md`). The inherited file named several classic
anchors that are NOT in the bib (the data-cube paper, Hearst patterns, the SemEval TExEval tasks,
a semantic-drift source); they are listed as gaps below, not as citations.

## 1. What to call the task

> **Roll-up along a concept hierarchy inside one SKOS concept scheme** (informational OLAP's
> roll-up, applied to the node dimension of an LLM-built vocabulary): a deterministic, LLM-free
> **fold** that maps every concept to an ancestor at a chosen granularity, evaluated for
> **soundness and completeness against a gold hierarchy**, with the hierarchy itself produced at
> **vocabulary-construction time**.

Do not call it taxonomy induction (that is the construction stage, and only partly this paper's)
or hierarchy embedding (a measured negative result here).

## 2. The operation

| Project term | Community term | Anchor | Paper usage |
|---|---|---|---|
| roll-up, fold, `rollupTarget` | **roll-up** along a dimension hierarchy; on graphs: informational vs topological OLAP | `chen2008grapholap` (names I-OLAP / T-OLAP and the measure classes), `zhao2011graphcube` (cuboids, aggregate network); the data-cube origin: no anchor yet | "roll-up (the *fold*)" once; say that Graph OLAP defines the operation and gives no correctness metric |
| fold target, abstract node (`facet:`, `hac:`, `hyp:`) | **condensed vertex / aggregate node**; a minted node = node label of the coarser level | `zhao2011graphcube` | "aggregate node (*abstract node*)" |
| λ | **granularity parameter**; per-dimension level choice (a crossboid when it differs per scheme) | `zhao2011graphcube`; purpose-relative identity as the costly alternative: `genossar2023flexer`; per-query level: `sarthi2024raptor` | one continuous parameter; R0's λ is a similarity brake, not a level index: say so |
| similarity brake | **semantic-drift guard** along licensed chains | `w3c2009skos` (`skos:broader` is deliberately not transitive); drift literature: no anchor yet | two-part defence as in SKEIN-R |
| non-additive weight rule | **holistic (non-distributive) measure; summarizability** of a non-strict hierarchy | measure classes: `chen2008grapholap`; additivity assumption to argue against: `zhao2011graphcube` Theorem 1; summarizability conditions: no anchor yet (the most load-bearing gap) | "distinct-incident counts are holistic and the hierarchy is non-strict, so child weights are never summed" |
| multi-parent concept | **non-strict hierarchy / polyhierarchy** | thesaurus standard: `iso2011thesauri`; containment models that break on it: `jiang2023box` | — |
| per-scheme reporting | one dimension at a time | — | schemes are never pooled |

## 3. The vocabulary and its edges

| Project term | Community term | Anchor | Paper usage |
|---|---|---|---|
| registry, concept, scheme | SKOS concept scheme of `skos:Concept`s with labels and definitions | `w3c2009skos` | inherited wording |
| edge `type` broaderGeneric / Partitive / Instantial; contract `broaderInstantial` | **ISO 25964 BTG / BTP / BTI**, in RDF through iso-thes | `iso2011thesauri`, `desmedt2015isothes` | "instantial contract (BTI only)" |
| judge edges | hierarchy edges asserted by the LLM adjudicator during streaming construction | SKEIN-R (own, under review); `turskyi2025formal` for the series | — |
| orphan, unparented concept | concept with no broader term; **top concept by omission** | `w3c2009skos`; thesaurus quality checks (orphans, cycles): no anchor yet | — |
| vocabulary construction vs roll-up | build time vs query time; **one validated build-time pass** | `ayoughi2025hyperbolic` (LLM restructures once behind a validator; its objective is the wrong one for roll-up), `peng2024wikidata` (cleaning checklist) | the hard line between the stages is the paper's design principle |
| "existing parent or abstract family" forced choice (H1) | **taxonomy completion / expansion with an explicit no-parent option** | NIL as a classified option: `dong2023reveal`; expansion as a task: `jiang2023box`, `fang2026geometric`; taxonomy-completion benchmarks: no anchor yet | — |
| family hint (E2) | type or family gloss as side information | — | a factor, not a default |
| edge cleaning (H4) | cycle removal, **transitive reduction**, reversed-edge repair | operational: `peng2024wikidata`; algorithmic primary: no anchor yet | deterministic subset only |
| validity gate | instance-of / subclass-of stratification check before any fold | `dadalto2024disarray` | precondition of a fold, not an operator |
| ladder rungs g0–g3 | taxonomy levels / granularity strata; path granularity | `kargupta2025taxoadapt` (operational definitions) | attributes of a concept, not edges |

## 4. Operators

| Project term | Community term | Anchor | Paper usage |
|---|---|---|---|
| R0 graph walk | hierarchy traversal to an ancestor under a score threshold | — | the baseline; describes what SKEIN-R already stores |
| R1 facet stripping, `stripQualifiers` | **facet analysis** (version, edition as facets of a product); lexical head–modifier heuristic; eTLD+1 by the Public Suffix List | faceted classification and lexical hypernym heuristics: no anchor yet | "rule-based facet stripping" |
| R2 `hac`, `hac-constrained` | **average-linkage agglomerative clustering** (UPGMA), with must-link constraints; medoid as representative | price of a guaranteed hierarchy and gold-free scores: `braverman2025learningaugmented`; why a bare cosine threshold over-merges: see the wiki approach `llm-free-embedding-threshold-merging` | — |
| R3 `hyperbolic-hit` | **norm-ordered subsumption retrieval** in the Poincaré ball | `he2024hit` (the instrument), `nickel2017poincare` (norm encodes generality), `ganea2018cones` (collapse without observed closure: this paper's regime) | report as a measured negative result; never cite `fang2026geometric` for "LLM embeddings are hyperbolic" |
| `hyperbolic-euclid`, `-normfilter` | cosine nearest-neighbour ranking; the control isolating the norm order | — | "Euclidean control" |
| R4 hybrid | back-off composition: stored edges first, fallback elsewhere | — | — |
| H2 longest-prefix parent | string-prefix hypernym heuristic | no anchor yet | — |
| H3 neighbour parent | k-nearest-neighbour label propagation of the parent | — | describe; no claim of novelty |
| R5 (optional ceiling) | LLM-only top-down taxonomy induction | `zeng2024chainoflayer` | ceiling only, outside the LLM-free claim |

## 5. Evaluation

| Project term | Community term | Anchor | Paper usage |
|---|---|---|---|
| sound%, complete% | ancestor correctness of the fold target; reaching the topmost gold ancestor | own metrics; nearest published set: Ancestor / Edge / node F1 in `zeng2024chainoflayer`; hierarchical precision / recall / F and Wu–Palmer: no anchor yet | define formally in the paper; do not rename to "precision / recall" |
| denominator | concepts with at least one gold ancestor | — | always printed next to a percentage |
| gold-projected partition, B-cubed, ARI | clustering agreement against the gold rolled to its roots | inherited SKEIN-R usage | — |
| AUPC | area under the soundness curve over the λ sweep | `douglas2026prism` (threshold sweep reported as an area) | never one hand-picked λ |
| recall@k, MRR of ranked parents | retrieval metrics of taxonomy expansion | `jiang2023box`, `fang2026geometric` | transitive and direct credit both reported |
| δ-hyperbolicity, tree distortion | Gromov four-point δ, embedding distortion | measured here; `nickel2017poincare` for distortion of tree embeddings | state only the measured δ values |
| probes (`exchangeFamily`, strict variant, `windowsNotOffice`) | named behavioural checks | — | a failing probe is a finding |
| cost split | construction tokens vs roll-up milliseconds with zero LLM calls | oracle-call pricing of a hierarchy: `braverman2025learningaugmented` | — |
| gold option C | LLM judge validated by κ on a human-labelled sample | `islam2026clusterrefinement` | admissible at build time only |

## 6. Words to avoid

- "precision / recall" for sound% / complete% (different denominators), "accuracy" for either.
- "hyperbolic embeddings improve roll-up": the measurement says the opposite in this regime.
- "taxonomy" for the registry as a whole: it is a set of concept schemes with partial hierarchies.
- "ground truth" for the gold hierarchy: single-expert adjudication with pooled candidates.
- In Ukrainian text: an established Ukrainian term or the English word in Latin script, never a
  transliterated anglicism.
