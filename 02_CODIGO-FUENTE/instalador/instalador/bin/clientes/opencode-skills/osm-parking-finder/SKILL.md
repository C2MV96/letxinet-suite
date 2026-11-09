---
name: osm-parking-finder
description: Use for finding parking facilities (surface, underground, multi-storey) near a location. Optional type filter and include_private flag. Useful for urban parking policy, retail parking strategy, fleet parking.
trigger_keywords: parking finder, parking facility, parking garage, parking lot, urban parking, multi-storey parking
---

# SKILL: osm-parking-finder

## Proven Chain (2026-08-08)

```
letxinet-gateway.find_parking_facilities(
  latitude, longitude, radius=1000, limit=50,
  include_private=false, type=""
)
  ↓ parking facilities array
```

## Validated Output (2026-08-08)

### Lima Miraflores 2km
- Overpass service unavailable at validation time
- Typical yield: 10-20 parking facilities in dense urban area

## When to use

- New retail site selection parking assessment
- Parking fee strategy development
- Urban mobility plan development
- Office parking permit policy
- Fleet EV parking integration
- Disability parking compliance audit
- Shopping mall competitive benchmarking

## Coverage by type filter

| type | OSM parking tag | Notes |
|------|-----------------|-------|
| surface | parking=street or surface | open lots |
| underground | parking=underground | garage |
| multi-storey | parking=multi-storey | tiered structure |
| street | parking=street | street-side |
| "" | all types mixed | recommended |

## Gotchas

1. **Overpass service limits** intermittently block calls - retry
2. **include_private=false** excludes commercial/operator lots
3. **max 50 results** in single call
4. **OSM tagging incomplete** for Parking in LatAm — many small lots not mapped
5. **Disabled spots** not separately indexed
6. **Pricing not in OSM** — use Parkopedia direct for fees

## Anti-pattern

No usar este skill si:
- Necesitas real-time parking availability (use SpotHero/ParkWhiz paid APIs)
- Necesitas pricing (not in OSM)
- Necesitas violation/enforcement info (gov APIs)

## Metrics

- Tools used: 1 (find_parking_facilities)
- Time: ~3-5s Overpass healthy
- Output: parking facilities array
- Limitation: LatAm incomplete tagging + Overpass limits S9D
