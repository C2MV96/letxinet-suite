---
name: gateway-biotech-pubmed-cancer
description: Use when searching PubMed+OpenAlex+Crossref biotechnology/cancer/genetics/CRISPR literature. High-yield biotech source pool (98 papers in 106s). Output ranked by citationCount.
trigger_keywords: pubmed, biotech, cancer, CRISPR, gene editing, CAR-T, immunotherapy, clinical trial, oncology, genetic therapy
---

# SKILL: gateway-biotech-pubmed-cancer

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="CRISPR cas9 gene editing cancer therapy",
  sources=["pubmed","openalex","crossref"],
  yearStart="2023",
  maxSources=15,
  fastMode=true
)
  ↓ 98 papers in 106s (pubmed 40 + openalex 50 + crossref 8)
```

## Validated Output (2026-08-08)

**Query: CRISPR Cas9 cancer therapy**

- 98 papers en 106.3s
- PubMed 40 (mostly 2026 articles + PMC)
- OpenAlex 50 (reviews 2023-2024 with citationCount)
- Crossref 8

### Top cited (OpenAlex):
1. Tao 2024 Front Immunol - CAR-T CRISPR/Cas9 92 cit
2. Feng 2024 J Hematol Oncol - CRISPR/Cas9 immunotherapy 64 cit
3. Yi 2023 Adv Mater - nanomaterials CRISPR/Cas9 61 cit
4. Cetin 2025 Eur Respir Rev - gene therapy trials 57 cit
5. Wu 2024 Acta Pharm Sin B - cuproptosis CRISPR 26 cit

## When to use

- Pharmaceutical R&D scoping CRISPR genetic therapy landscape
- Oncology biotech startups literature review
- Clinical trial design prior art search
- PhD proposal CRISPR immunotherapy
- Patent prior art for CRISPR/Cas9 modifications
- AI/ML biotech startup molecule discovery targets

## Source pool selection by subtype

| Subtype | Sources |
|---------|---------|
| CRISPR general | pubmed + openalex + crossref |
| CAR-T specific | pubmed + openalex |
| Clinical trial | pubmed PMC + crossref |
| Review monograph | openalex |
| Patent prior art | crossref + openalex |
| Cancer genomics | pubmed + openalex |

## Gotchas

1. **PubMed abstracts often empty** in letxinet response - relies on titles + DOIs only
2. **OpenAlex abstracts rich** - prefer openalex for review search
3. **PMC IDs** include full text PDFs via pmc.ncbi.nlm.nih.gov
4. **Crossref 8** small but DOIs clean for downstream resolve_pdf
5. **qualityScore pubmed=55 openalex=90** - prefer openalex ranked
6. **citationCount null for pubmed recent** - use openalex for citation context
7. **2026 papers** pubmed futuristic due indexing — filter yearStart appropriately

## Anti-pattern

No usar este skill si:
- Necesitas preprints no-peer-reviewed (use preprints-discovery)
- Necesitas patents (use cross-patent-prior-art with openalex+zenodo+scopus+crossref 4-source pool)
- Necesitas conference proceedings (use search_conferences for AI/CS only)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 106.3s
- Output: 98 papers ranked
- Coverage: 3 sources parallel
