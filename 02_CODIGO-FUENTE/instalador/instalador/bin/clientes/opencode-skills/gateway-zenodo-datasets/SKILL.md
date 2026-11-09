---
name: gateway-zenodo-datasets
description: Use for searching Zenodo open datasets repository + OpenAlex data papers. Combines zenodo source + openalex with abstract coverage. Ideal for finding FAIR-compliant datasets, data papers, FAIR repository studies, data management plans (DMPs), research data outputs.
trigger_keywords: zenodo, dataset search, FAIR data, OpenAIRE, DMP data management plan, research data, data paper, dataset repository, DOI dataset
---

# SKILL: gateway-zenodo-datasets

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="datasets repository open access Zenodo reuse",
  sources=["zenodo","openalex"],
  yearStart="2023",
  maxSources=15,
  fastMode=true
)
  ↓ 54 papers in 134.6s (zenodo 4 + openalex 50)
```

## Validated Output (2026-08-08)

**Query: datasets repository open access Zenodo reuse**

- 54 papers en 134.6s
- Zenodo 4 (data management plans, EC2U alliance, FID move transport repository)
- OpenAlex 50 (data papers + dataset descriptions)

## Top Zenodo records:
1. Sæterli 2024 ReZilient DMP Horizon Europe - DOI 10.5281/zenodo.19001602 - rel 59.5
2. International Office for Water 2026 WATERUN DMP - DOI 10.5281/zenodo.20506999 - rel 56
3. RI4C2 Project 2024 EC2U Open Access Repository - DOI 10.5281/zenodo.13753456 - rel 36.4
4. Begoin 2025 FID move transport RDM - DOI 10.5281/zenodo.16736123 - rel 32.9

## Top OpenAlex dataset papers:
1. Milojevic-Dupont 2023 EUBUCCO 200M EU buildings - DOI 10.1038/s41597-023-02040-2 - 118 cit
2. Studier-Fischer 2023 HeiPorSPECTRAL surgical HSI - DOI 10.1038/s41597-023-02315-8
3. Demaeyer 2023 EUPPBench weather forecast dataset - DOI 10.5194/essd-15-2635-2023 - 25 cit
4. Woźnicki 2023 RadiomicsHub cancer imaging 29 datasets - 25 cit

## When to use

- PhD data management plan (DMP) templating
- Research dataset discovery & reuse
- Reproducibility studies dataset identification
- Open Science community platform comparison
- FAIR principles research methodology
- Horizon Europe Open Access mandate compliance
- Subject-specific repository selection

## Gotchas

1. **Zenodo 4 records** only directly returned — pool is much larger but letxinet pool may be limited
2. **OpenAlex has data-paper type** separate from article - filter by type
3. **High citationCount for EUBUCCO 118** indicates impact dataset
4. **DOIs are 10.5281/zenodo.XXXXX** - use these to access zenodo direct
5. **Year 2024-2026 papers** Horizon Europe DMPs cover best EC2U alliance practices

## Anti-pattern

No usar este skill si:
- Necesitas figshare/dryad/d4science datasets (not in letxinet pool)
- Necesitas datacite metadata schema details (use datacite direct API)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 134.6s (slow - zenodo API)
- Output: 54 papers (4 zenodo + 50 openalex)
- Coverage: 2 sources combined
