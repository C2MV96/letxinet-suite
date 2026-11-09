---
name: gateway-openalex-citations
description: Use for bibliometric analysis, citation tracking, h-index metrics, journal impact evaluation via OpenAlex database. OpenAlex covers 250M+ works with rich metadata. Ideal for research evaluation, citation network analysis, university rankings, Open Science metrics.
trigger_keywords: bibliometric analysis, citations, h-index, impact factor, OpenAlex, Scopus comparison, citation network, journal metrics, scholarly output assessment
---

# SKILL: gateway-openalex-citations

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="citations bibliometric analysis openalex h-index impact factor",
  sources=["openalex"],
  yearStart="2023",
  maxSources=15,
  fastMode=true
)
  ↓ 46 papers in 57.4s (openalex 46)
```

## Validated Output (2026-08-08)

**Query: citations bibliometric analysis openalex h-index impact factor**

- 46 papers en 57.4s
- All OpenAlex (focused bibliometric methodology papers)

## Top bibliometric methodology papers:
1. Gusenbauer 2024 "Beyond Google Scholar Scopus WoS: 59 databases citation indices" - 118 cit
2. Szluka 2023 "Bibliometric indicators university rankings" - 43 cit
3. Alonso-Álvarez 2024 OpenAlex coverage African research - 4 cit
4. Simard 2024 Open Access coverage OpenAlex/Scopus/WoS - 13 cit
5. Haupka 2025 publication/document types in OpenAlex/WoS/Scopus/PubMed - 20 cit
6. Vélez-Estévez 2023 "New trends bibliometric APIs" - 69 cit
7. Okamura 2023 "Half-century global collaboration Shrinking World" (OpenAlex data) - 26 cit
8. Ansorge 2024 "Bibliometric Studies as Publication Strategy" - 5 cit

## When to use

- Research assessment office bibliometric report
- University ranking scientometric analysis
- Open Science policy evaluation LatAm
- Funding agency bibliometric literature review
- PhD thesis bibliometric chapter
- Journal editorial impact evaluation
- Department head scientometric performance review
- Citation network analysis methodology selection

## Source comparison literature

| Database | Coverage | Cost | Specialty |
|----------|----------|------|-----------|
| OpenAlex | 250M+ works, free | Free | Most comprehensive |
| Scopus | 84M works | Subscription | Elsevier paywall |
| WoS | 90M works | Subscription | Clarivate paywall |
| PubMed | 36M biomedical | Free | Biomed only |
| Semantic Scholar | 200M+ works | Free API | CS/AI enriched |
| Lens | 230M+ works | Free | Patent-paper links |
| Dimensions | 140M+ works | Free + Pro | Grant data rich |

## Gotchas

1. **OpenAlex single source 46 papers** - for broader coverage add crossref or scopus
2. **citationCount pubmed null in letxinet** - but openalex always has citationCount
3. **type label differences** - OpenAlex "article" maps to crossref "journal-article"
4. **coverage African research** lower in OpenAlex for affiliations - verified Alonso-Álvarez 2024 finding
5. **Hybrid OA metadata** Simard 2024 found gold+diamond OA variations in OpenAlex indexing

## Anti-pattern

No usar este skill si:
- Necesitas real-time citation count (use OpenAlex API direct - faster)
- Necesitas patent citations (use Lens.org direct or Scopus patent subsource)
- Necesitas institution-specific reports (use OpenAlex institutions endpoint)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 57.4s
- Output: 46 bibliometric methodology papers
- Top: Gusenbauer 118 cit (59 database citation coverage comparison)
