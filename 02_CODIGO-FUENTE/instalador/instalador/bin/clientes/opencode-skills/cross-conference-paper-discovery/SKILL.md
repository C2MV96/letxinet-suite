---
name: cross-conference-paper-discovery
description: Use when discovering trending research papers from HuggingFace Daily Papers + identifying optimal conference submission targets (NeurIPS, ICLR, ICML, EMNLP, ACL, CVPR, AAAI, KDD). Combines Gateway trending_papers with conference targeting recommendations output as Word report. NEURIPS-only coverage — NOT SUITABLE for biotech/material science conferences.
trigger_keywords: trending AI paper, HuggingFace Daily, NeurIPS, ICLR, ICML, EMNLP, conference submission target, AI research discovery, trending model, upvoted paper
---

# SKILL: cross-conference-paper-discovery

## Proven Chain (2026-08-08)

```
letxinet-gateway.trending_papers(maxResults=8)  [optional: query="<AI topic>"]
    ↓ 8 top-voted AI papers de HuggingFace Daily Papers (~0.4s)
letxinet-gateway.search_conferences(query="<topic>", maxResults=8)
    ↓ OpenReview ICLR/NeurIPS/ICML papers (0 for non-AI topics)
letxinet-gateway.search_paperswithcode(query="<AI_method>", maxResults=8)
    ↓ Papers With Code benchmarks + datasets + methods
word.create_document(filename="<output>.docx", title="Conference Paper Discovery: <topic>")
word.add_heading(level=1, "Conference Paper Discovery: <topic>")
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Trending HuggingFace Papers")
word.add_table(rows=N+1, cols=5, data=[["#","Title (abbreviated)","Upvotes","Year","ArXiv URL"], ...])
word.format_table(table_index=0, has_header_row=true, border_style="single")
word.add_heading(level=2, "2. Conference Targeting Recommendation")
word.add_paragraph(text="<per_paper_conference_recommendation>")
word.add_paragraph(text="<pipeline_footer>")
```

## Validated Output (2026-08-08)

### AI trending query (no filter)
- Top 8 papers from 50 found in 0.4s
- Upvotes range 4-56
- Top upvoted: MEG Decoding (56 upvotes) — spotlight NeurIPS 2026 recommendation

### Word output
- Filename: S9B6-conference-discovery-AI.docx
- Size: 38391 bytes (38 KB)
- Estructura: H1 + 2 H2 + 2 parrafos + 1 table 9x5

## When to use this skill

- AI/CS research discovery for current trends
- PhD candidates choosing conference targets
- AI research group awareness of trending papers
- ML community radar for daily HF trending
- Faculty showcase of latest AI research
- AI investor/VC scanning frontier research

## Conference targeting map by paper type

| Paper type | Top conferences | Secondary | Best venue |
|------------|-----------------|-----------|------------|
| Multimodal tokenizer | NeurIPS, ICML | ICLR | NeurIPS |
| Language model | EMNLP, ACL | NeurIPS | EMNLP |
| Robot learning | CoRL, ICML | NeurIPS | CoRL |
| World model | CVPR, AAAI | NeurIPS | CVPR |
| Vision 3D | CVPR, ICCV | NeurIPS | CVPR |
| Benchmark/eval | NeurIPS, ICLR | KDD | NeurIPS Datasets+Benchmarks track |
| Industrial application | KDD, WWW | NeurIPS Industry Track | KDD |
| Cognitive neural | NeurIPS Spotlight, CogSci | NeurIPS | NeurIPS |

## Gotchas

1. **OpenReview search_conferences** covers ICLR/NeurIPS submissions cycle ICML/ICLR NeurIPS — NOT broad coverage
2. **For biotech/materials conferences**: this skill DOES NOT WORK. Use batch_search crossref openalex scopus con "conference paper" filtro
3. **PapersWithCode covering methodology** — fails on niche biotech keyword queries
4. **HuggingFace trending bug**: sort=trending returns 0; works only with sort=recent or no-filter mode
5. **Top upvoted 56+ papers** are spotlight candidates; 40+ are oral; 15+ poster default
6. **arxiv URLs**: format arxiv.org/abs/YYMM.NNNNN (6 digits year + id)
7. **Conference cycle**: NeurIPS abstract May, ICML Jan-Feb, ICLR Sept-Oct —_adjust submission times accordingly

## Anti-pattern

No usar este skill si:
- Query es biotech/life sciences/materials (use Gateway search académico instead)
- Necesitas past conference proceedings (use dblp crossref)
- Necesitas peer review feedback (use OpenReview direct)
- Necesitas industry R&D reports (use zenodo institutional)

## Metrics

- Tools used: 4 (1 trending_papers + 1 search_conferences + 1 paperswithcode + Word)
- Time: ~30s end-to-end (most spent on Word formatting)
- Output: 1 docx ~38 KB
- Coverage: 8 top-trending AI papers + conference targeting recommendations
