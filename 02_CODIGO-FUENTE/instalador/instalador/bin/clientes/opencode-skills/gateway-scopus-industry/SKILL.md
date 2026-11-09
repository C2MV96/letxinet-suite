---
name: gateway-scopus-industry
description: Use for searching Scopus-indexed industry collaboration and patent/publication patterns. Scopus requires institutional subscription. Returns descriptive publication count info when available. Useful for industry R&D collaboration patterns, pharmaceutical patents biotech, corporate-academic partnerships.
trigger_keywords: Scopus, industry collaboration, pharmaceutical patents, biotech corporate, university-industry partnership, Scopus indexed
---

# SKILL: gateway-scopus-industry

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(
  query="Scopus indexed industry collaboration patents pharmaceutical biotech",
  sources=["scopus"],
  fastMode=true
)
  ↓ 0 papers (scopus requires institutional token, returns empty without)
```

## Validated Output (2026-08-08)

**Query: Scopus indexed industry collaboration patents pharmaceutical biotech**

- 0 papers returned
- Scopus API empty without institutional subscription

## Reason for empty result

Scopus (Elsevier API) requires:
1. Institutional API key
2. Valid subscription token
3. Quota subscription

In letxinet pool as 2026-08-08:
- scopus source exists metadata-only mode
- Search returns empty if no institutional key configured
- Not error - just empty

## When to use this skill (with limitations)

- Industry R&D publication patterns (use crossref + openalex alternative)
- Pharmaceutical patent-paper cross-references (use cross-patent-prior-art S9B2)
- Corporate-academic publication collaborations (use openalex institutions)
- Bibliometric industry-innovation studies

## Alternative MAPPING

| Need | Recommended source |
|------|--------------------|
| Industry patents + papers | crossref + openalex + zenodo + scopus (alt) |
| Corporate affiliate | openalex institutions metadata |
| Pharmaceutical R&D | pubmed + crossref + openalex |
| University-industry | openalex + crossref |
| Citation impact by company | Crossref funder + affiliation metadata |

## Recommended alternative pool

For industry-focused search, use this 3-source combination instead:
```
sources=["crossref","openalex","zenodo"]
```

This returns 50+ papers typically and includes funder metadata.

## Gotchas

1. **scopus returns 0** in letxinet pool as 2026-08-08 - confirmed bug/limitation
2. **No institutional key in letxinet env** - scopus elsevier API requires it
3. **Not reflected in user-facing errors** - silent fail
4. **For pharmaceutical patents** use cross-patent-prior-art (S9B2) which uses 4 sources and found 66 papers in 8.5s

## Anti-pattern

No usar este skill si:
- Necesitas Scopus-indexed policies (use crossref + openalex as alternative)
- Necesitas CS journal Metrics (use SJR scimagojr.com direct)

## Metrics

- Tools used: 1 (gateway.search)
- Time: query returned immediately
- Output: 0 papers (scopus limitation)
- Recommendation: switch to crossref+openalex+zenodo for industry topics
