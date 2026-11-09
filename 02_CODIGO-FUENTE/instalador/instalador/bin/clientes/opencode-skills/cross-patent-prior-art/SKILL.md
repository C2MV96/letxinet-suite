---
name: cross-patent-prior-art
description: Use when conducting patent prior art searches where academic literature mentions inventions or patent applications. Combines Gateway search on 4 sources (crossref + openalex + zenodo + scopus) in parallel with Word formatting of claim mapping matrix and novelty assessment. Output is NPL-based patent prior art report suitable for inventors, lawyers, and R&D teams as complement to formal WIPO/EPO/USPTO database searches.
trigger_keywords: patent, prior art, novelty, NPL, claim mapping, patentability, invention, inventor, assignee, WIPO, EPO, USPTO, INDECOPI
---

# SKILL: cross-patent-prior-art

## Proven Chain (2026-08-08, sesion 9B test 2)

```
letxinet-gateway.search(
  query="<invention technical terms> patent",
  sources=["crossref","openalex","zenodo","scopus"],
  maxSources=10,
  fastMode=true
)
    ↓ Returns 50-80 academic papers in ~10s
[Optional step: enrich_metadata for missing abstracts]
word.create_document(filename="<output>.docx", title="Patent Prior Art Search: <topic>")
word.add_heading(level=1, text="Patent Prior Art Search Report: <topic>")
word.add_paragraph(text="<pipeline_intro_with_disclaimer>")
word.add_heading(level=2, "1. Executive Summary - Novelty Assessment")
word.add_paragraph(text="<novelty_outlook_high_level>")
word.add_heading(level=2, "2. Identified Patents and Patent Applications")
word.add_table(rows=N+1, cols=6, data=[["Device","Number","Year","Inventor/Assignee","Title/Subject","Source identification"], ...])
word.format_table(table_index=0, has_header_row=true, border_style="single")
word.add_heading(level=2, "3. Non-Patent Literature (NPL) - Top Cited Prior Art")
word.add_table(rows=M+1, cols=6, data=[["#","Author / Year","Title (abbreviated)","Citations","Source","DOI"], ...])
word.format_table(table_index=1, has_header_row=true, border_style="single")
word.add_heading(level=2, "4. Claim Mapping - Novelty Comparison Matrix")
word.add_paragraph(text="<assumption_intro>")
word.add_table(rows=K+1, cols=5, data=[["Claim Element","Anticipated?","Closest Prior Art","Differentiation","Strength"], ...])
word.format_table(table_index=2, has_header_row=true, border_style="single")
word.add_heading(level=2, "5. Conclusions - Patentability Outlook")
word.add_paragraph(text="<conclusions_with_next_steps>")
word.add_paragraph(text="<pipeline_footer_disclaimer>")
```

## Validated Output (2026-08-08)

### Query: "bacterial cellulose Komagataeibacter fermentation production patent"
- crossref: 8 results (MDPI fermentation, Springer)
- openalex: 50 results (most comprehensive)
- zenodo: 8 results (datasets, some PUCP records)
- scopus: 0 results (no direct matches)
- Total: 66 papers in 8.535s

### Key findings
- **1 explicit patent found in academic literature**: Polish Patent App P.431265 (Cielecka 2021)
  - Inventors: Cielecka, Ryngajłło, Maniukiewicz, Bielecki (Lodz University of Technology)
  - Subject: Highly Stretchable BNC + Vitamin C enhancement method
  - Strain: Komagataeibacter hansenii SI1
- Generic patent mentions in 2 reviews without numbers
- 66 papers in 8 years confirm field is heavily published (mature technology)

### Novelty assessment
- 4 WEAK novelty claim elements: strain, substrate, static cultivation, standard characterization
- 4 MODERATE novelty angles: specific property mechanism, co-culture pairings, synthetic RBS targets, vegan leather product
- Recommended formal searches: WIPO Patentscope, EPO Espacenet, USPTO Patent Public Search, INDECOPI Peru

## When to use this skill

- R&D teams evaluating novelty before filing provisional patent application
- Inventors performing self-prior-art check
- Patent attorneys requesting NPL complement to formal patent database search
- Technology transfer offices assessing portfolio inventions
- Innovation hubs screening startup ideas
- Academics writing patent inquiries
- Pre-filing novelty searches (literatura cientifica angles)

## Recommended source pool by technology field

| Field | Sources pool | Why |
|-------|--------------|-----|
| Biotech/microbiology | crossref + openalex + zenodo + pubmed | Biomedical + crossref covers MDPI/Springer patents-mentioned, pubmed biomedical patents |
| Materials science | crossref + scopus + openalex + zenodo | Scopus covers materials patents literature, zenodo dataset patents-adjacent |
| CS/AI | arxiv + openreview + dblp + paperswithcode | Preprints + conferences patents Emerging Tech |
| Pharma | pubmed + crossref + scopus + doaj | Drug patents indexed crossref, pubmed clinical trials, scopus patent citations |
| Agritech | crossref + scielo + zenodo + openalex | LatAm agro research indexed scielo, CERN datasets zenodo |
| Energy/renewables | crossref + openalex + scopus + zenodo | Scopus Elsevier energy patents, openalex coverage |
| Medical devices | pubmed + crossref + openalex + scopus | Clinical trials + patents indexer |

## Anti-pattern(s)

No usar este skill si:
- Necesitas formal patentability novelty opinion (require patent attorney + patent database)
- Invention pertains to recently filed (<18 months) patents NOT yet published academic literature
- Requieres citas from patent examiner (require formal database like EPO Opus esp@cenet)
- Necesitas indexed patent claims text (use WIPO Patentscope directly)
- Necesitas legal opinion of infringement (this is prior art search only)

## Gotchas

1. **Academic literature RARELY mentions patent numbers** explicitly — typically 0-3 patents found per 60-80 papers searched
2. **Polish Patent P.431265** found because authors Cielecka 2021 made their own invention in paper — NOT because patent publication type appears indexed in Crossref/OpenAlex directly
3. **Scopus returned 0** despite being operative — scopus coverage of "patent" keyword in title/abstract lower than crossref
4. **OpenAlex returns 50 results** by default; can be increased to maxSources=15 for more citationCount metadata
5. **Citation count heuristic**: top 10 cited papers are strongest prior art for novelty disputes
6. **Claim mapping matrix** requires manual claim element decomposition by inventor/team — pipeline provides scaffold
7. **VEAK/MODERATE/STRONG novelty classifications** are heuristic — needs patent attorney sign-off for formal filing

## Comparison vs traditional workflow

| Aspecto | Manual (Patent attorney + Patentscope + Espacenet + InnovationQ+) | This skill |
|---------|--------------------------------------------------------------------|-----------|
| Source pool | USPTO+WIPO+EPO+INDECOPI+JP+KR patent DBs | crossref+openalex+zenodo+scopus academic |
| Search time | 8-40 hours | 60 seconds |
| Patent numbers found | 50-500 (per database) | 1-10 (literature mentions only) |
| NPL cited top-10 | 4-8h to compile | 30s |
| Claim mapping matrix | 4-8h | 5 min (template) |
| Novelty assessment | Formal opinion 8-40h | Heuristic 10 min |
| Cost | $2,000-10,000 (attorney) | Free (this skill) |
| **TOTAL** | 16-100 hours + $$ | **5 min** |
| Use case | Formal filing prior art | Pre-filing screening, NPL complement |

## Output structure recap

Section 1: Executive Summary
Section 2: Identified Patents and Patent Applications table (Device/Number/Year/Inventor/Title/Source)
Section 3: Top NPL Prior Art table (#/Author-Year/Title/Citations/Source/DOI)
Section 4: Claim Mapping Novelty Matrix table (Claim/Anticipated?/Closest Prior Art/Differentiation/Strength)
Section 5: Conclusions with next steps (formal patent database search recommendation)

## Metrics

- Tools used: 14 (1 search + 13 word)
- Time: ~75s end-to-end
- Output: 1 docx ~40 KB
- Sources pool: 4 academic databases in parallel
- Coverage: NPL-focused prior art, NOT formal patent DB coverage
