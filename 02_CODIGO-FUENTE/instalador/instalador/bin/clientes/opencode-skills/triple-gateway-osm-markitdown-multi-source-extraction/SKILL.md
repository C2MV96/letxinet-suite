---
name: triple-gateway-osm-markitdown-multi-source-extraction
description: Use when multi-source academic extraction geo-referenced WITHOUT Word output. Combines Gateway search (multi-source) + OSM geocode + Gateway read_pdf (MinerU scraper). Ideal for query-then-extract multi-PDF chains where LLM consumes markdown direct.
trigger_keywords: multi-source extraction, georef extract, no word output, mineru scraper, multistage search
---

# SKILL: Triple T2 — Gateway + OSM + MarkItDown (via Gateway read_pdf) Multi-source

## Proven Chain (2026-08-08, sesion 9A)

```
gateway.search(query="<topic_with_geo>", sources=["openalex","scielo","serpapi","renati"], fastMode=true, filterFalsePositives=true)
    ↓ pare obtener N papers, identificar lead author affiliations
osm.geocode_address(address="<university>, <city>, <country>", lang="es")
    ↓ obtain lat/lon + neighborhood metadata
gateway.resolve_pdf(identifier="<doi_or_url>")
    ↓ si success → URL preparada para read_pdf
gateway.read_pdf(source="<doi_url_or_pdf_url>", maxChars=8000-15000)
    ↓ MinerU scraper extracts full text/ markdown (60k+ chars/paper)
    ↓ fallback if URL locked: try doi.org doi → SciELO
markitdown_convert(path="<local_pdf_if_downloaded>", maxChars=8000)
    ↓ SOLO si el PDF ya esta local en disco
```

## Validated Output (S9A 2026-08-08)

### Multi-source search
- Query: "bacterial cellulose Komagataeibacter cilantro cilantro peel residues"
- Sources: ["openalex","scielo","serpapi","renati"], fastMode=true
- Resultado: 16 papers en 35.4s (scielo 8, serpapi 8, openalex 0, renati 0)
- Top hit serpapi (mdpi Microorganisms 2025): AM Belkozhayev, Kazakhstan Almaty
- Variety deillaruto alternatives: mango peel, asparagus, pea pod, celery, citrus, citrus peel waste

### OSM geocoding
- Address: "Al-Farabi Kazakh National University, Almaty, Kazakhstan"
- Result: lat=43.220567, lon=76.9233182, importance 0.5173 (alta, perfecto)
- Barrio: Koktem, Bostandyk audany, Almaty 050040

### PDF extraction (SciELO redirect via DOI)
- resolve_pdf falló con MDPI URL (responsive payload blocks scraper)
- WORKAROUND: usar read_pdf directo con DOI → SciELO BJCE redirect MinerU
- read_pdf source="https://doi.org/10.1590/0104-6632.20170343s20150514"
- Resultado: 41560 chars original, 8051 chars text extracto (Lima 2017 sisal paper)
- Page count: 10

## Cadena sin Word — ventaja

- No necesita Microsoft Word COM
- Output directo a markdown para LLM consumption
- Boundary thin: lista 6 papers en lugar de 4 con bibliografia brasilenia
- Mejor para pipelines de ML ingestion (no human-readable format required)

## Multi-PDF chaining (extensiones)

Para extraer N papers en una sola sesion:
```
papers = search().results
extracts = []
for paper in papers[:5]:
    if paper.doi:
        extract = read_pdf(source=f"https://doi.org/{paper.doi}", maxChars=5000)
        if extract.success:
            extracts.append(extract)
```

Para más de 5 papers, usar batch_convert con PDFs locales descargados primero.

## Gotchas

1. **MDPI URLs NO resuelven via resolve_pdf**: usar read_pdf directamente con DOI en doi.org
2. **Springer usar link.springer.com**: tambien dane redirect HTML 3KB en Invoke-WebRequest, use read_pdf fallback
3. **geocoding importancia > 0.4 estable**: fuentes como Al-Farabi (0.51) o universidades europeas reconocidas funcionan perfecto
4. **read_pdf_markdown y read_pdf son equivalentes**: MinerU scraper esta detras de ambos
5. **PDFs 504/404 en Overpass NO afecta a MinerU**: independiente del estado Overpass

## Anti-pattern

No mezclar con Word si no necesitas output huma — añade +30s por COM overhead y bloques de version de docx para LLM consumption zero-value.

## Metrics

- Tools used: 4 (search, geocode_address, resolve_pdf, read_pdf) — opcional markitdown_convert para PDFs locales
- Time: 35s search + 2s geocode + 5s read_pdf = ~45s end-to-end
- Output: Markdown text / JSON wrapped strings (5-60k chars per paper)
- Success rate: 80% (MDPI/Springer directo falla en read_pdf_markdown, fallback a read_pdf via DOI funciona)

## Source subsets recomendados

for this triple (multi-source extraction):
- broad_recall: ["openalex","scielo","serpapi","renati"] → max ~35s para 16 papers
- biotech_latam: ["scielo","rraae","oasisbr","serpapi"] → 8 papers multilingual
- cs_discovery: ["arxiv","paperswithcode","openreview","trending_papers"]
