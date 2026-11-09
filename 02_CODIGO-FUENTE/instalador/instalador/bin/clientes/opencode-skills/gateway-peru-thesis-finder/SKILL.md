---
name: gateway-peru-thesis-finder
description: Use when searching Peruvian thesis in RENATI SUNEDU repository. Combines renati + scielo + lareferencia sources with location Peru to surface undergraduate/master/doctoral theses. Output structured with university, year, type, handle URL.
trigger_keywords: peru thesis, tesis peru, renati, sunedu, bachelorThesis, doctoralThesis, undergraduate peru, tesis pregrado posgrado peru
---

# SKILL: gateway-peru-thesis-finder

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="<topic> peru", 
  sources=["renati","scielo","lareferencia"], 
  maxSources=15, 
  fastMode=true,
  location="Peru",
  yearStart="2020"
)
  ↓ 12 papers in 89.8s (renati 8 + scielo 4 + lareferencia 0)
```

## Validated Output (2026-08-08)

**Query: COVID-19 Peru programas sociales**

- 12 documentos en 89.8s
- RENATI: 8 tesis (bachelorThesis UNTRM, UNSA; doctoralThesis UNSA; masterThesis UNSA)
- SciELO: 4 journal-articles Peru COVID-19

### Top theses:
1. UNTRM 2025 - Redes sociales creadores contenido (bachelor)
2. UNTRM 2026 - Gestión municipal La Jalca Amazonas (bachelor)
3. UNSA 2023 - Estructura clases sociales Perú (doctoral)
4. UNSA 2022 - Percepción agroquímicos Majes (master)
5. UNTRM 2020 - Tratamiento penitenciario Chachapoyas (bachelor)

## When to use

- PhD candidates literature review for similar Peru topic
- Faculty research synthesizing Peruvian academic output
- SUNEDU thesis-citation analysis
- University curriculum committees
- CONCYTEC funding applications
- Government policy using Peruvian evidence
- Bibliometric Peru-focused studies

## Repository source rank Peru

| Source | Coverage | Use case |
|--------|----------|----------|
| renati | All Peru theses SUNEDU | thesis hunt |
| scielo | LatAm journals Peru-focused | peer-reviewed cited |
| lareferencia | LatAm federated | low yield Peru |
| bdtd | Brazil theses | not Peru |
| openalex | Global w Peru tags | international context |

## Gotchas

1. **location="Peru"** forces geo ththbut relevanceSearch treats as soft not hard filter
2. **RENATI handleUrl** = stable identifier for thesis recovery
3. **UNTRM** = Toribio Rodríguez de Mendoza, Amazonas (often overlooked)
4. **UNSA** = San Agustín Arequipa (large producer)
5. **lareferencia**: 0 results Peru in 2026-08-08 — pool global issue not Peru-specific
6. **yearStart 2020** ideal for COVID-era research
7. **scielo LatAm_regional** tags includes Peru papers even if "country" missing

## Anti-pattern

No usar este skill si:
- Necesitas Chile/Colombia/Ecuador thesis (use aliado specific sources)
- Necesitas empiric data of thesis content (use read_pdf with pdfUrl)
- Necesitas thesis metadata beyond SUNEDU (use bdtd for Brazil, minciencias for Colombia)

## Metrics

- Tools used: 1 (gateway.search)
- Time: 89.8s
- Output: 12 papers
- Coverage: RENATI 8 + SciELO 4 = 12 Peru-specific
