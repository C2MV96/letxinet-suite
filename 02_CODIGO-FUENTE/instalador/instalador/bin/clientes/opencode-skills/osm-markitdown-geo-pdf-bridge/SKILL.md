---
name: osm-markitdown-geo-pdf-bridge
description: Use when you have geographic data from OSM and need to convert it to/from PDF format. Bridge pipeline: OSM generates POI data → Word generates a docx → convert_to_pdf creates PDF → markitdown_convert extracts back to markdown for LLM consumption. Ideal for iterating on geographic reports with LLM feedback.
trigger_keywords: geo pdf, osm to pdf, pdf to markdown, bridge, roundtrip, pdf geo, reverse extraction
---

# SKILL: OSM + MarkItDown — Geo PDF Bridge

## Proven Chain (2026-08-08)

This is a flexible bridge pipeline. OSM alone doesn't produce documents — it returns JSON. To feed that into MarkItDown (which only reads files), use Word as intermediate converter:

```
osm.geocode_address(address="<location>")
    ↓ returns lat/lon
osm.analyze_neighborhood(latitude, longitude, radius=1000)
    ↓ returns POIs + scores JSON
word.create_document() + add_heading + add_paragraph + add_table + format_table
    ↓ builds structured docx
word.convert_to_pdf(filename="<output.docx>", output_filename="<output.pdf>")
    ↓ PDF generated via Word COM
markitdown.markitdown_convert(path="<output.pdf>")
    ↓ 1891 chars markdown structured extract
```

## Validated Output (sesion 8)

### Test: UNI Lima neighborhood report round-trip
- OSM geocode "Universidad Nacional de Ingenieria, Lima, Peru" → -12.02, -77.048
- OSM analyze_neighborhood (1000m) → overall 81/100, 50+ amenities
- Word docx: 38 KB, 5 sections + 2 tables (12x3 scores + 16x3 amenities)
- Word convert_to_pdf → analisis-vecindario-UNI-Lima.pdf (161 KB, 2 pages)
- markitdown_convert → 1891 chars markdown with both tables preserved as pipe-tables

## Roundtrip integrity check

- Headings H1/H2 → markdown `#` and `##` preserved ✓
- Tables → markdown pipe-tables preserved ✓
- Some cells with `<br>` tags appear in narrow columns (Word wraps into line breaks)
- Paragraphs and text preserved verbatim ✓

## Bridge use cases

1. **LLM feedback loop**: generate PDF → convert to markdown → feed to LLM → regenerate docx
2. **Document digitization reversal**: sometimes you receive a PDF that needs to be parsed; markitdown_convert extracts it
3. **Format interoperability**: Word → PDF → Markdown (editable form)
4. **Geographic report propagation**: produce a PDF of neighborhood data, archive it, and have a markdown version for collaborative editing

## Dependencies

- **Microsoft Word installed** (for convert_to_pdf via COM automation)
- **MarkItDown service** at http://127.0.0.1:7860/ (PyMuPDF4LLM)
- **OMNI Word MCP** running on Node (loads Word COM)

## Pre-flight checks

```bash
# Verify all backends:
curl http://127.0.0.1:7082/         # OSM
curl http://127.0.0.1:7860/         # MarkItDown
# Word conversion test:
python -c "import win32com.client; w = win32com.client.Dispatch('Word.Application'); w.Quit()"
```

## Metrics

- Tools used: 9 (geocode, analyze_neighborhood, create_document, add_heading x2, add_paragraph, add_table x2, format_table x2, convert_to_pdf, markitdown_convert)
- Time: ~45s end-to-end
- Output: 3 artefacts (docx + pdf + markdown)
- Filesystem footprint: ~200 KB total
