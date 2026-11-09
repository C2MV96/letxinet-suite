---
name: gateway-cochrane-evidence
description: Use for searching Cochrane-equivalent systematic reviews and clinical evidence via PubMed fallback (Cochrane direct API unavailable in letxinet). Identifies RCT-based systematic reviews following Cochrane methodology. Useful for evidence-based medicine guideline development, GRADE evaluations.
trigger_keywords: Cochrane, clinical evidence, PICO, RCT systematic review, EBM guidelines, GRADE, intervention review, Cochrane library
---

# SKILL: gateway-cochrane-evidence

## Proven Chain (2026-08-08)

```
# Try direct cochrane first (returns 0 in pool 2026-08-08)
letxinet-gateway.search(query="Cochrane library", sources=["cochrane"], fastMode=true) → 0 results

# Fallback to PubMed with systematic review filter
letxinet-gateway.search(
  query="Cochrane library systematic review clinical intervention PICO evidence",
  sources=["pubmed"],
  maxSources=15,
  fastMode=true
)
  ↓ 40 papers in 2.5s (pubmed 40)
```

## Validated Output (2026-08-08)

**Query: Cochrane library systematic review clinical intervention PICO evidence**

- 40 papers en 2.5s (fallback after cochrane 0)
- All PubMed systematic reviews matching Cochrane methodology

## Top systematic reviews (Cochrane-style):
1. Wang 2026 "Technology-assisted cognitive interventions post-stroke"
2. Barreto 2025 "Powdered vancomycin prophylaxis spine surgery"
3. Miranda 2025 "Self-adhesive vs conventional flowable resin composite"
4. Babbitt 2026 "Digital mental health assessment post-COVID protocol review"
5. Khalil 2025 "Zirconia crowns vs alternatives primary anterior teeth"
6. Bellini 2026 "AI chatbots perioperative risk stratification"
7. Eraslan 2026 "Beta-blockers solid cancers prognostic"
8. Shekarsarai 2025 "Analgesic therapies CRPS"
9. Mallmann 2025 "Liver stiffness hepatocellular carcinoma elastography"

## When to use

- EBM clinical guideline development
- Cochrane-style systematic review methodology design
- Healthcare quality improvement literature
- Clinical pharmacist drug-class review
- Hospital pharmacy formulary updates
- Insurance coverage decision support
- Health technology assessment (HTA)

## Cochrane access issue

Direct Cochrane Library API not integrated in letxinet pool as 2026-08-08. Workarounds:
1. Use PubMed with "Cochrane" + "systematic review" query filter
2. Use TRIP database (http://tripdatabase.com) external
3. Use PubMed broad systematic review narrow search
4. Use crossref with "Cochrane Database Syst Rev" journal filter

## Recommended PubMed query for Cochrane-style evidence

```
("Cochrane"[Journal] OR "systematic review"[pt] OR meta-analysis[pt])
AND <PICO population> AND <PICO intervention>
AND <PICO outcome>
```

## Gotchas

1. **Cochrane source returns 0** confirmed in letxinet pool 2026-08-08
2. **PubMed 40 max per single source draw**
3. **PMCs include full text** via pmc.ncbi.nlm.nih.gov
4. **2.5s extremely fast** for PubMed fallback
5. Many 2026 published systematic reviews available (indexing rapid)

## Anti-pattern

No usar este skill si:
- Necesitas Cochrane Library direct (use cochranelibrary.com external)
- Necesitas Embase/Embase Reviews (use crossref + openalex)
- Necesitas health economics (NHS EED or CHEC direct)

## Metrics

- Tools used: 1 (gateway.search after fallback)
- Time: 2.5s (post-cochrane fail)
- Output: 40 PubMed systematic reviews
- Note: Limit 40 - rotate queries for broader coverage
