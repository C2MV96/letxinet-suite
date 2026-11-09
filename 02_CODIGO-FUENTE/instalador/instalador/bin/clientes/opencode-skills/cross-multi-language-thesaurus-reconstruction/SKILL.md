---
name: cross-multi-language-thesaurus-reconstruction
description: Use for reconstructing a multilingual academic thesaurus across ES / EN / PT using smart_search with synonym expansion. Searches a domain in 3 languages simultaneously, deduplicates, ranks by relevance, then generates a docx thesaurus with source-language entries and translation suggestions. Ideal for terminological research, translator glossaries, machine translation terminology corpora.
trigger_keywords: multilingual thesaurus, synonym expansion, es en pt, smart search synonyms, terminology corpus, translator glossary, machine translation terms, terminological research
---

# SKILL: cross-multi-language-thesaurus-reconstruction (S9G-5)

## Proven Chain (2026-08-08)

```
gateway.smart_search(query="<term in ES>", sources=["scielo","openalex"], yearStart="2018", yearEnd="2024", maxResults=30)
  ↓ variants + synonyms + Spanish PT EN suggestions based on results
# Same query EN (with translation applied)
gateway.smart_search(query="<term in EN>", sources=["openalex","semantic"], ...)
  ↓ English results
# Same query PT
gateway.smart_search(query="<term in PT>", sources=["scielo","bdtd"], ...)
  ↓ Portuguese results
gateway.enrich_metadata(papers=[results])
  ↓ DOI + abstract enrichment
word.create_document + add_heading + add_paragraph + add_table + format_table
  ↓ thesaurus docx with EN/ES/PT terms + source paper references
```

## Validated Output (2026-08-08)

### S9G-5 demo: smart_search scielo Ecuador biodiversity
- `smart_search(query="biología marina Ecuador Cheloimytilus", sources=["scielo"], yearStart="2018", yearEnd="2024", maxResults=8)`
- duration 14.494s
- 4 unique results
- resultsBySource: { scielo: 4 }
- Examples:
  - "Revisión bioética acerca de la legalidad de la muerte asistida en el Ecuador" MarketG León 2024 (country=latam_regional relevanceScore=5.6 qualityScore=82)
  - "CLÁUSULAS ABUSIVAS Y DERECHOS DE LOS CONSUMIDORES EN ECUADOR" Falconi 2022 (country=latam_regional)
  - "Economía circular en contextos locales: caso Ecuador" Guerrero-Villegas 2024 (country=latam_regional)
  - "LAS PRÁCTICAS SHAMÁNICAS DEL PUEBLO CHACHI EN EL NORTE DE ESMERALDAS, ECUADOR" Torres Candelejo 2022 (country=latam_regional)

## Thesaurus docx structure

```
THESAURUS MULTILINGUE - <domain_name>
Resumen Ejecutivo
<paragraph>

Tabla de Terminos Primarios
| Term ES | Term EN | Term PT | Source Count | Confidence |
|---------|---------|---------|--------------|------------|
| biología marina | marine biology | biologia marinha | 30+ papers | High |
| Cheloimytilus | Cheloimytilus | Cheloimytilus | 8 papers | Medium |

Tabla de Sinónimos Encontrados
| Category | ES | EN | PT |
|----------|----|----|-----|
| Biodiversity | biodiversidad | biodiversity | biodiversidade |
| Invasive species | especie invasora | invasive species | espécie invasora |

Referencias (sample)
| # | Title | Year | Source | Lang |
|---|-------|------|--------|------|
| 1 | Revisión bioética... Ecuador | 2024 | SciELO | es |
| 2 | ... | 2024 | SciELO | es |
```

## smart_search synonym expansion documented (Gateway feature)

| Input | Expansiones probables |
|-------|-----------------------|
| biología marina | marine biology (en), biologia marinha (pt), biología del mar (es alt), marine ecology (en) |
| Cheloimytilus | (Latin binomial — universal) |
| Ecuador | Equator (en alt Geographic locator) |
| celulosa bacteriana | bacterial cellulose (en), celulose bacteriana (pt), BC abbr |
| Komagataeibacter | (Latin genus — universal) |

## When to use

- Academic translator building a domain-specific glossary (e.g., marine biology ES/EN/PT)
- Terminological research for linguistics thesis
- Machine translation terminology corpus build (filter low-quality vs canonical)
- Cross-cultural literature review (find consistency in naming)
- Spanish/Latin American scientific literature vocabulary mining
- University bilingual teaching course dictionary construction
- Clinical trial terminology harmonization LatAm + Iberia + Brazil
- Legal medical translation bilingual dictionary construction

## Recommended source subsets per language

| Language | Sources recommended | Rationale |
|----------|---------------------|-----------|
| ES | scielo (es articles), espana, scielo preprints, laref_argentina, laref_chile | LatAm + Spain coverage |
| EN | openalex (en dominant), semantic, crossref, pubmed | Anglo mainstream scientific |
| PT | scielo (pt articles), bdtd (Brazilian theses), laref_brasil, oasisbr, rraae | Brazilian + Portuguese academic |
| MIXED pyMe | lareferencia (multi-lang), openaire (EU multilingual) | Cross lingual |

## Gotchas

1. **smart_search expansion** is automatic but not always optimal — specifiy synonyms manually for best recall
2. **LatAm sources** may produce Spanish AND Portuguese content combined (scielo)
3. **Distinguishing Latin binomial nomenclature** (Cheloimytilus) — universal across languages
4. **Geographic terms** can expand in unexpected ways (Ecuador the country vs equator the line)
5. **enrich_metadata** improves cross-language DOI lookup (English DOI often Spanish/Portuguese body)
6. **maxResults parameter** — use 30-60 per language to ensure representative sampling
7. **Duration** — smart_search single language ~10-20s; multi-language 30-60s combined

## Anti-pattern

No usar este skill si:
- Necesitas professional translator review (use MemoQ / Trados direct)
- Necesitas hierarchical SKOS thesaurus format (use external ontology export)
- Necesitas term frequency calculation (use TfidfVectorizer direct on corpus)
- Necesitas NLTK / spaCy linguistic parsing (use python lib direct)

## Metrics

- Tools used: 4-5 (smart_search x3 languages + enrich_metadata + Word docx)
- Time: ~30-60s combined (3 languages sequential)
- Output: docx ~30-40 KB with 3-way translation table + source references
- Validated S9G-5: smart_search scielo Ecuador 14.5s → 4 unique results (smart_search atomic multisource success confirmed)
