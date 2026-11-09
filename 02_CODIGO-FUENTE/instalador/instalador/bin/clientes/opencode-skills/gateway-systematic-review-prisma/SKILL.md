---
name: gateway-systematic-review-prisma
description: Use for searching existing systematic reviews and meta-analyses on PubMed+Crossref. Specialized for evidence-based medicine (EBM) queries with PRISMA conforming searches. Ideal for finding pre-existing systematic reviews on a clinical question before designing a new one.
trigger_keywords: systematic review, meta-analysis, PRISMA, EBM, evidence-based medicine, PubMed meta, clinical review, interventional review, network meta-analysis
---

# SKILL: gateway-systematic-review-prisma

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="systematic review meta-analysis <PICO topic>",
  sources=["pubmed","cochrane","crossref"],
  yearStart="2023",
  maxSources=15,
  fastMode=true
)
  ↓ 46 papers in 74.9s (pubmed 38 + cochrane 0 + crossref 8)
```

## Validated Output (2026-08-08)

**Query: systematic review meta-analysis antibiotic resistance**

- 46 papers en 74.9s
- PubMed 38 systematic reviews 2024-2026
- Cochrane 0 (no API access via letxinet)
- Crossref 8 (meta-analyses 2023-2025)

## Top systematic reviews found:
1. Kamran 2026 antibiotic resistance pediatric Pakistan
2. Zhan 2026 non-typhoidal Salmonella 19 developing countries
3. Lucaciu 2026 antibiotic COVID-19 influenza RSV
4. Sale 2026 natural products antibiotic resistance (196 studies meta-analysis)
5. Yusof 2023 bacterial coinfection COVID-19 (212K patients)
6. Itaeli 2025 antibiotic resistance Tanzania

## When to use

- EBM researchers searching existing systematic reviews
- PhD/MD literature review for thesis introduction
- Clinical guideline committee evidence appraisal
- Health technology assessment agencies (NICE, CADTH)
- WHO/PAHO systematic review evidence derivation
- Cochrane review assistant scoping
- Medico-legal expert literature assessment

## Source pool comparison

| Source | Yield | Notes |
|--------|-------|-------|
| pubmed | 38/46 | primary for systematic reviews indexed in MEDLINE |
| crossref | 8/46 | broader publisher coverage not in MEDLINE |
| cochrane | 0/46 | no API access through letxinet as 2026-08-08 |
| openalex | (not tested) | recommended as 4th source for meta reviews |

## Recommended PRISMA derivation patterns

1. For clinical intervention:
   `pubmed + crossref + openalex` (3 fuentes) yearStart 5 años atrás
2. For public health:
   `pubmed + scielo + openalex` (Latin America addition)
3. For biomedical new technologies:
   `pubmed + crossref + zenodo + openalex` (4 fuentes incl preprints)
4. For health policy LatAm:
   `pubmed + scielo + lareferencia + openalex` (4 fuentes regional)

## Gotchas

1. **Cochrane returns 0** - use crossref as 2nd source
2. **Limit 38 per source** - need multiple sources for broader coverage
3. **fastMode=true** skips DME metadata enhancement - speed wins
4. **Year filter 2023+** captures recent high-quality reviews
5. **Crossref sortFilter abstracts present** - useful for screening

## Anti-pattern

No usar este skill si:
- Necesitas realizar de novo PRISMA screening (use cross-ebm-prisma-review S9B1 instead)
- Necesitas cochrane-only systematic reviews (use cochrane library direct)
- Necesitas health economic reviews (use specialized CHEC, NHS EED databases)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 74.9s
- Output: 46 systematic reviews ranked
- Coverage: PubMed + Crossref (cochrane API unavailable)
