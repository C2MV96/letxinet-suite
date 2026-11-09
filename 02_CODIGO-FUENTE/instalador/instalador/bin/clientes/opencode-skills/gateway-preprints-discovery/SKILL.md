---
name: gateway-preprints-discovery
description: Use for searching preprint literature bioRxiv/medRxiv/arXiv/SSRN from OpenAlex+Crossref. Identifies non-peer-reviewed early research. Useful for tracking emerging discoveries before formal publication, COVID-19 scientific communication studies, AI-LLM impact on writing studies.
trigger_keywords: preprint, bioRxiv, medRxiv, arXiv, SSRN, early research, non-peer-reviewed, scientific communication, preprint media coverage
---

# SKILL: gateway-preprints-discovery

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="preprint bioRxiv medRxiv early research",
  sources=["openalex","crossref"],
  yearStart="2024",
  maxSources=15,
  fastMode=true
)
  ↓ 54 papers in 136.6s (openalex 48 + crossref 6)
```

## Validated Output (2026-08-08)

**Query: preprint bioRxiv medRxiv early research**

- 54 papers en 136.6s
- OpenAlex 48 (preprints + preprint methodology articles)
- Crossref 6

## Top preprint papers:
1. Minikel 2024 Nature "Refining impact genetic evidence clinical success" - DOI 10.1038/s41586-024-07316-0 - 302 cit - Broad Institute
2. AlSaad 2024 JMIR "Multimodal LLMs in Healthcare" - 277 cit
3. Li 2024 Comput Biol Med "Deep learning multimodal fusion medical image" - 197 cit
4. Park 2024 BMC Med Inform Decis Mak "LLMs clinical utility scoping review" - 177 cit
5. Avissar-Whiting 2024 PLoS Biol "Open preprint peer review recommendations" - 24 cit
6. Henke 2024 Quant Sci Sci "Public engagement COVID-19 preprints" - 4 cit
7. Biesenbender 2024 Scientometrics "Life scientists preprint posting pandemic" - 7 cit
8. Fleerackers 2024 Quant Sci Sci "Preprint media coverage 2014-2021 11K preprints" - 8 cit

## When to use

- Preprint media coverage tracking
- COVID-19 scientific communication studies
- AI-augmented writing detection (LLM infiltration)
- Open Science preprint culture research
- Preprint-publication similarity analysis
- Bibliometric preprint impact evaluation
- Preprint-vs-journal publishing behavior
- Science journalism scholarly communication
- Bioinformatics preprint methodology

## Recommendations on preprint platforms

| Platform | Domain | Use |
|----------|--------|-----|
| bioRxiv | Biology | Bio preprints post-2013 |
| medRxiv | Medicine | Medical preprints post-2019 |
| arXiv | Physics/CS/Math | Quant preprints since 1991 |
| SSRN | Social Sciences humanities | All |
| Research Square | Multidisciplinary | Springer Nature |
| ChemRxiv | Chemistry | ACS-led |

## Gotchas

1. **OpenAlex type="preprint"** can be filtered via type parameter (not available in letxinet search)
2. **Two-period analysis**: pre-COVID vs during-COVID (PreprintToPaper dataset 145K preprints)
3. **Binoculars LLM detector** Cheng 2024 quantified AI influence on preprints post-ChatGPT
4. **Preprint-journal similarity** Mikulic 2025 found 51 nursing pairs >95% match
5. **Open preprint peer review** Avissar-Whiting 2024 has 50+ author recommendations

## Anti-pattern

No usar este skill si:
- Necesitas bioRxiv direct API (use api.biorxiv.org direct)
- Necesitas preprint citation counts only (use OpenAlex citations endpoint direct)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 136.6s (slow - openalex wider corpus)
- Output: 54 preprint-related papers
- Top: Minikel Nature 2024 302 cit (drug discovery genetic evidence)
