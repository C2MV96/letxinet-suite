---
name: gateway-scielo-fulltext
description: Use for searching SciELO LatAm open access full-text journals. SciELO covers 1,720+ journals from 15 LatAm countries, 908K+ documents, diamond OA. Ideal for regional LatAm science, Spanish/Portuguese literature, public health LatAm, SciELO network analysis.
trigger_keywords: SciELO, LatAm journals, open access, Spanish literature, Portuguese literature, diamond OA, regional journals, OLIVA, Brazilian journals, ABEC
---

# SKILL: gateway-scielo-fulltext

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="SciELO full text Latin America open access biotechnology",
  sources=["scielo"],
  maxSources=15,
  fastMode=true
)
  ↓ 8 papers in 2.6s (scielo 8)
```

## Validated Output (2026-08-08)

**Query: SciELO full text Latin America open access biotechnology**

- 8 papers en 2.6s (very fast - single source)
- All SciELO records (open access, full text DOIs)

## Top SciELO records:
1. Poch 2025 "Open Access Dynamics LatAm Chilean case" - DOI 10.1590/scielopreprints.11826 - rel 49
2. Beigel 2022 OLIVA "SciELO+Redalyc 908,982 documents, 1,720 journals, 15 countries" - DOI 10.1590/scielopreprints.4637 - 10 cit
3. Beigel 2024 OLIVA Dados "Disciplinary Diversity SciELO Redalyc 1995-2018" - 4-18 cit
4. Costa+Leite 2016 "Open Access Budapest Initiative" - 28 cit
5. Stueber 2022 "Covid-19 SciELO platform analysis 2020" - 2 cit

## When to use

- LatAm open access literature review
- Diamond OA journals identification
- SciELO network bibliometric study
- Open Science LatAm policy analysis
- Regional citation patterns
- Brazilian/Chilean/Argentine medical research
- LatAm humanities/Spanish literature
- Community publishing vs gold APC comparison

## SciELO coverage map

| Country | Active SciELO journals | Coverage |
|---------|------------------------|----------|
| Brazil | 400+ | strongest |
| Chile | 130+ | mature |
| Mexico | 80+ | mature |
| Colombia | 60+ | growing |
| Argentina | 50+ | stable |
| Venezuela | 30+ | declining |
| Peru | 10+ | minimal |
| Others LatAm | ~25 | varied |

## Gotchas

1. **SciELO 2.6s ultra-fast** vs other 60-100s - single source benefit
2. **citationCount sometimes null** for SciELO preprints
3. **OLIVA 908K documents** important baseline
4. **Plan S tension** - LatAm diamond OA bypasses European gold model
5. **APC $9 million cost Chile 2023** identified in Poch 2025 - critical policy finding
6. **citation counts low for SciELO** - regional citation patterns differ from Scopus/WoS

## Anti-pattern

No usar este skill si:
- Necesitas English-language only international journals (use crossref+openalex)
- Necesitas biomedical PubMed-indexed (use pubmed source)
- Necesitas Brazilian Portuguese only (use bdtd + scielo Portuguese query)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 2.6s (fastest source)
- Output: 8 SciELO records full text DOIs
- Coverage: LatAm OA circuit
