---
name: gateway-cs-ai-trending
description: Use for CS/AI trending papers and conference discovery. Combines HuggingFace trending_papers + OpenReview search_conferences + Papers With Code search_paperswithcode. Identifies frontier AI/ML research and conference submission targets. NOT suitable for biotech/material science conferences.
trigger_keywords: trending AI, HuggingFace Daily, OpenReview, NeurIPS, ICLR, ICML, EMNLP, paperswithcode, AI/CS frontier
---

# SKILL: gateway-cs-ai-trending

## Proven Chain (2026-08-08)

```
letxinet-gateway.trending_papers(maxResults=8, query=None)
  ↓ 8 top-voted AI papers from HuggingFace Daily Papers (~0.4s)
  
letxinet-gateway.search_conferences(query="<topic>", maxResults=8)
  ↓ ICLR/NeurIPS/ICML papers indexed on OpenReview
  
letxinet-gateway.search_paperswithcode(query="<AI_method>", maxResults=8)
  ↓ Papers With Code benchmarks + datasets + methods
```

## Validated Output (2026-08-08)

### trending_papers
- Top 8 papers from 50 found in 0.4s
- Upvotes range 4-56
- Top: MEG Decoding 56 upvotes (NeurIPS spotlight candidate)
- ArXiv URLs format: arxiv.org/abs/YYMM.NNNNN

### search_conferences
- 0 results for biotech topics
- Returns ICLR/NeurIPS papers for AI/CS topics
- OpenReview coverage NeurIPS > ICLR > ICML

### search_paperswithcode
- 0 results for biotech queries
- Returns CS/AI papers with linked code/benchmark/dataset
- Useful code implementations discovery

## When to use

- AI/CS research frontier radar
- PhD students targeting NeurIPS/ICML/ICLR
- Tech investor research frontier monitoring
- Conference submission strategy
- CS education showcase latest trends
- ML/AI engineer learning roadmap

## Conference targeting map

| Paper type | Top conferences | Notes |
|------------|-----------------|-------|
| Multimodal tokenizer | NeurIPS | spotlight candidates |
| Language model | EMNLP, ACL | also NeurIPS |
| Robot learning | CoRL | ICML alt |
| World model | CVPR, NeurIPS |
| Vision 3D | CVPR, ICCV |
| Benchmark/eval | NeurIPS Datasets+Benchmarks track |
| Industrial application | KDD, WWW |
| Cognitive neural | NeurIPS, CogSci |

## Gotchas

1. **HuggingFace trending bug**: sort=trending returns 0; use no-sort or sort=recent
2. **Top upvoted 56+** spotlight candidates; 40+ oral; 15+ poster
3. **OpenReview only NeurIPS/ICLR/ICML** - not broad conference coverage
4. **paperswithcode fails on niche biotech** - specialized topics
5. **arXiv URLs**: 6-digit format YYMM.NNNNN
6. **Conference cycle**: NeurIPS abstract May, ICML Jan-Feb, ICLR Sept-Oct

## Anti-pattern

No usar este skill si:
- Necesitas biotech/life sci/materials conferences (no coverage)
- Necesitas conference proceedings old (use dblp + crossref)
- Necesitas peer review content (use OpenReview direct)

## Metrics

- Tools used: 3 (trending + conferences + paperswithcode)
- Time: ~5s combined
- Output: 8 trending + 0 conferences + 0 paperswithcode (non-AI topics)
- Limitation: CS/AI only - no biotech support
