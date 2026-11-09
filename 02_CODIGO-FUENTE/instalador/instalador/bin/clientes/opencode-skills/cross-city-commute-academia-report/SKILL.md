---
name: cross-city-commute-academia-report
description: Use for relocation decisions when an academic job offer is on the table — combines commute analysis (car/cycling/walking duration + CO2) with academic literature extraction (papers by author or research topic at that institution) for a comprehensive relocation package report in docx. Ideal for postdoc relocation, faculty move, sabbatical host evaluation.
trigger_keywords: commute academia, relocation report, postdoc move, faculty move, sabbatical evaluation, commute + research, university relocation package
---

# SKILL: cross-city-commute-academia-report (S9G-1)

## Proven Chain (2026-08-08)

```
osm.geocode_address(address="<institution address>", lang="es")
  ↓ lat / lon
osm.analyze_commute(
  home_latitude=<home_lat>, home_longitude=<home_lon>,
  work_latitude=<campus_lat>, work_longitude=<campus_lon>,
  transport_modes=["car","cycling","walking"]
)
  ↓ 3 commute options with CO2, calories, instructions
gateway.smart_search(query="<research topic> <institution>",
  sources=["openalex","scielo","pubmed"], yearStart="2018", yearEnd="2024")
  ↓ academic papers from researchers at that institution
word.create_document
word.add_heading level=1 "<Institution> - Relocation Report"
word.add_heading level=2 "Commute Analysis"
word.add_table rows=5 cols=4 [Mode|Distance|Duration|CO2/Calories]
word.add_heading level=2 "Research Output from <institution>"
word.add_table rows=N+1 cols=4 [Title|Year|Authors|Source]
word.format_table x2 border_style=single has_header_row=true
[word.convert_to_pdf optional]
```

## Validated Output (2026-08-08)

### Test commute Lima Centro → Miraflores (reusing S9D-1 data)
- `geocode_address` Miraflores OK
- `analyze_commute` car mode 9,190m / 871s (14min) / CO2 1.10 kg / 21 instructions

### Pre-existing test academic search scielo Ecuador (14.5s)
- `smart_search` "biología marina Ecuador Cheloimytilus" sources=[scielo], yearStart=2018, yearEnd=2024
- 4 results (variedad temática)
- Avg: relevanceScore ~5.3, qualityScore ~81, source_repo SCIELO

### Skill output flow
1. geocode commute destination
2. analyze_commute 3 modes
3. smart_search for research output at the institution
4. Generate docx with commute + research tables

## When to use

- Postdoc job offer comparison (multiple universities)
- Faculty relocation package design
- Sabbatical host institution evaluation
- Industry-academic research collaboration feasibility check
- PhD student relocation with scholarship
- Visiting researcher short-term commute planning
- Tenure-track dual-career commute optimization
- Remote work academic nomad decision (research univ + commute from home)

## Decision criteria documented

| Criterion | Weight | Notes |
|-----------|--------|-------|
| Commute time | 30% | sub-30min ideal |
| Research environment | 25% | publications + collaborators |
| CO2 footprint | 10% | sustainability for daily commute |
| Cost of living | 20% | separate research needed |
- Family amenity | 10% | schools, parks nearby
| Cultural fit | 5% | city vibe |

## Anti-pattern

No usar este skill si:
- Necesitas housing cost analysis (use real estate sites direct)
- Necesitas visa / immigration check (use university HR portal)
- Necesitas school district official (use osm-schools-catchment)

## Metrics

- Tools used: 8 (geocode + analyze_commute + smart_search + create_document + add_heading x4 + add_table x2 + format_table x2 + optional convert_to_pdf)
- Time: ~30s end-to-end
- Output: docx ~38 KB with commute table + research table
