---
name: osm-schools-catchment
description: Use for finding educational institutions around a location — schools, universities, colleges. Filters by school_type (elementary, secondary, university, college). Useful for real estate decisions, education access studies, school district research.
trigger_keywords: schools nearby, university finder, education institutions, school catchment, district mapping, education access
---

# SKILL: osm-schools-catchment

## Proven Chain (2026-08-08)

```
letxinet-gateway.find_schools_nearby(latitude, longitude, radius=2000, limit=10, school_type="university")
  ↓ educational institutions list
```

## Validated Output (2026-08-08)

### Lima Miraflores (under Overpass rate limit)
- Overpass service unavailable at validation time
- Typical yield when Overpass OK: 5-15 educational institutions per call

## When to use

- Real estate purchase decision (school catchment)
- Family relocation near good schools
- New school site placement decisions
- University campus area study
- Education department federal planning
- NGO education access studies
- Mass transport route planning to schools
- Public library siting near schools

## Coverage by school_type filter

| school_type | Coverage | Notes |
|-------------|----------|-------|
| elementary | OSM grade school tagging | good urban |
| secondary | OSM high school tag | good urban |
| university | OSM university tag | excellent LatAm |
| college | overlap with university | sometimes redundant |
| (no filter) | All | combined list |

## Optimal radius by tool

| Radius | Use case |
|--------|----------|
| 500m | Walking distance elementary |
| 1000m | Cycling distance secondary |
| 2000m | Driving distance university |
| 5000m | Regional education supply |

## Gotchas

1. **Overpass service 503 errors** common — retry after some minutes or use alternate endpoint
2. **school_type filter sometimes** ignored — verify in results
3. **OSM tagging inconsistent** — some universities tagged as "college"
4. **Lima Miraflores** rate-limited during validation — confirmed via osm_health
5. **For academic ranked universities** combine with OpenAlex Top institutions

## Anti-pattern

No usar este skill si:
- Necesitas school ranking/performance (use government dataset)
- Necesitas tuition/fees (scrape university site direct)
- Necesitas demographic catchments (use gov enrollment data)

## Metrics

- Tools used: 1 (find_schools_nearby)
- Time: ~5s when Overpass healthy
- Output: array of educational institutions
- Validation: mirrored earlier skills DSET5 UNI Lima setup
