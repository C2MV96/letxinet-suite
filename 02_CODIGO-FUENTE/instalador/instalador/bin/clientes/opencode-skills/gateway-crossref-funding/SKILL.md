---
name: gateway-crossref-funding
description: Use for searching funding acknowledgment patterns in research grants via Crossref. Identifies NIH/ERC/CONICYT/FAPESP sponsored research, grant oversight issues, funding acknowledgement trends. Useful for funding policy research, grant accountability studies.
trigger_keywords: funding grant, NIH, ERC, CONICYT, FAPESP, research sponsor, grant oversight, research funding acknowledgment, funding body
---

# SKILL: gateway-crossref-funding

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="funding grant acknowledgment research sponsor NIH ERC CONICYT",
  sources=["crossref","openalex"],
  yearStart="2023",
  maxSources=15,
  fastMode=true
)
  ↓ 8 papers in 49.7s (crossref 8 + openalex 0)
```

## Validated Output (2026-08-08)

**Query: funding grant acknowledgment research sponsor NIH ERC CONICYT**

- 8 papers en 49.7s
- Crossref 8 records (funding-related publications)
- OpenAlex 0 (filter conditions blocked funding search)

## Top results:
1. Choudhury 2023 IJCV "Curious Layperson Fine-Grained Image Recognition" - 11 cit
2. Naji 2025 Sci Rep "Lymph node super-resolution ultrasound" - 10 cit
3. Han 2023 OSF "Issues with NIH Oversight Bat Virus China" - policy paper
4. Science 2026 "NIH grant funding rates plummeted in 2025" - editorial
5. Science 2023 "Watchdog problems NIH bat virus funding China" - editorial
6. West 2025 "Michigan researcher explains NIH funding" - explainer
7. Reyes 2023 IJMS "EBV gastric cancer southern Chile genetic diversity" (CONICYT likely)
8. Weiner 2025 "Antibody discovery fidelity benchmarking"

## When to use

- Funding agency accountability research
- Grant policy oversight studies
- Academic R&D funding trends
- Funder-paper attribution analysis
- NIH/ERC policy briefs
- Government audit literature review

## Source pool limitations

- crossref has funder_name metadata but competitive/retrieval varies
- openalex with same query returned 0 due to filter conditions
- alt option: try "research grant" + "funder" combinations
- For NIH specifically: search crossref with "NIH" exact match works

## Gotchas

1. **OpenAlex 0 results** unusual - probably filter issue, retry alt query
2. **Crossref returns opinion/editorial pieces** about funding (Science editorials)
3. **Funder metadata not in abstract** - rely on title + DOI follow-up
4. **For Mexico CONACYT/Peru CONCYTEC specific** - use location="Mexico" or "Peru" + grant terms
5. **NIH funding rates declining** documented 2025-2026 editorial coverage

## Anti-pattern

No usar este skill si:
- Necesitas grant database per funder (use NIH RePORTER or CORDIS direct)
- Necesitas grant amounts/abstracts (use OpenAlex grants endpoint when available)
- NecesitasLatAm-specific funders CONCYTEC Peru (use renati + manual cross-ref)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 49.7s
- Output: 8 papers (crossref dominant)
- Insights: NIH funding narrative 2023-2026
