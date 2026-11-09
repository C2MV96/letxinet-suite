---
name: gateway-latam-agro-bioeconomy
description: Use for searching LatAm agroindustrial residues/bioeconomy/circular economy research. Combines scielo + openalex + bdtd to surface LatAm regional publications and Brazilian theses. Relevant for sustainable development SDG9/12, biorefinery, BC production from agro wastes.
trigger_keywords: agroindustrial residues, bioeconomy, circular economy, biorefinery, brazil agricultural waste, LatAm sustainable, BC production, agro wastes
---

# SKILL: gateway-latam-agro-bioeconomy

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="agroindustrial residues Brazil bioeconomy circular economy",
  sources=["scielo","openalex","bdtd"],
  yearStart="2022",
  maxSources=15,
  fastMode=true
)
  ↓ 52 papers in 87.8s (scielo 0 + openalex 50 + bdtd 2)
```

## Validated Output (2026-08-08)

**Query: agroindustrial residues Brazil bioeconomy circular economy**

- 52 papers en 87.8s
- OpenAlex 50 (international + LatAm journals indexed)
- SciELO 0 (citation filter probably missed regional tags)
- BDTD 2 (Brazilian theses on bioeconomy)

## Top cited LatAm agro-bioeconomy:
1. Souza 2022 Polysaccharides (Military Institute Engineering) 77 cit
2. Cuadrado 2022 Colombia bioproducts residues 57 cit
3. Marzban 2025 Smart biorefineries (Leibniz ATB) 53 cit
4. Maximo 2022 Forest bioeconomy Brazil 45 cit
5. Ogbu 2023 Agro-industrial waste management 44 cit

## When to use

- Agroindustrial sustainability R&D scoping
- Biorefinery project literature review
- Climate-smart agriculture policy briefs
- SDG 9/12 LatAm implementation reports
- Bacterial cellulose production from wastes (relevant to BC work)
- Bioeconomy transition studies LatAm
- PhD thesis Latin American universities bioeconomy

## Source pool by topic focus

| Topic | Recommended sources |
|-------|---------------------|
| Bioeconomy LatAm | scielo + openalex + bdtd |
| Sustainability Brazil | bdtd + scielo + openalex |
| Biorefinery global | openalex + crossref + zenodo |
| Forest products LatAm | scielo + openalex |
| Crop residues valorization | openalex + bdtd + scielo |

## Gotchas

1. **SciELO 0 results sometimes** — citation filter excludes LatAm-tagged low-relevance but relevant content. Try alternate phrasings.
2. **BDTD only 2 results** — Brazilian theses more indexed in Portuguese query
3. **OpenAlex 50 dominant** — international coverage broader
4. **reuse searches across S9B3-BC-Brazil + this skill** for cumulative bibliography
5. SDG tagging works well in openalex

## Anti-pattern

No usar este skill si:
- Necesitas specifically Brazilian Portuguese language only (use bdtd solo with Portuguese query)
- Necesitas industrial patents valorization (use cross-patent-prior-art S9B2)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 87.8s
- Output: 52 papers (LatAm focus)
- Coverage: 3 sources LatAm-relevant
