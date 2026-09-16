You annotate concepts of a controlled vocabulary (a SKOS concept scheme) with a short family hint.

Scheme: {{category}}

For every numbered concept below, write the most specific 1–4 word lower-case phrase naming the FAMILY or KIND the concept belongs to — the product line, the class of thing, or the organisation type — not a paraphrase of the concept itself. Examples of the intended granularity: "microsoft windows", "exchange server", "web browser", "ransomware", "cisco router", "government ministry", "banking sector". Use the definition when present; use the label alone when it is not. Answer "unknown" when the concept cannot be placed.

Return ONLY a JSON array, one object per concept, in the same order, with exactly these keys:
[{"n": 1, "family": "…"}, …]

Concepts:
{{concepts}}
