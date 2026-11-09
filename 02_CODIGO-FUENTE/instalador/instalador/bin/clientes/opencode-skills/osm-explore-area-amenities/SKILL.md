---
name: osm-explore-area-amenities
description: Use for exploring an area around a coordinate point with descriptive natural-language summary of amenities, geography, surroundings. Single-call generates rich context description for unfamiliar locations. Ideal for travel planning, site visits prep, due diligence reports.
trigger_keywords: explore area, area description, natural language area summary, neighborhood context, surroundings exploration, site visit prep, area reconnaissance
---

# SKILL: osm-explore-area-amenities

## Proven Chain (2026-08-08)

```
letxinet-gateway.explore_area(
  latitude=<lat>,
  longitude=<lon>,
  radius=1500  # max 5000
)
  ↓ natural-language description: nearby roads, amenities, area type
```

## Validated Output (2026-08-08)

**Miraflores Lima lat=-12.1226 lon=-77.0297 radius=1500m attempt:**

```
Error code: SERVICE_UNAVAILABLE
Message: Overpass service error: Failed to communicate with OSM service
Guidance: The service is temporarily unavailable. Please try again later.
```

**Validated earlier in S9A T1/T4** when Overpass up:
- T1 Joinville Brazil 72 POIs within 1500m radius
- T4 Arequipa Plaza de Armas 50+ restaurants/museums within 1000m
- DUAL S8 explore_area success for UNAL Bogota 144 POIs

## When to use

- Travel itinerary planning pre-trip area context
- Real estate investor area overview before site visit
- Conference venue location briefing
- Field work pre-mission area briefing
- Disaster response zone reconnaissance
- Real estate listing enhanced descriptions
- Tour guide narrative generation
- News reporting area context paragraph
- Digital nomad destination scouting narrative
- Real estate brochure generation

## Output content (validated when Overpass up):

```
"<location> is in <city>, <country>. The area within 1500m contains:
- <count> restaurants, focusing on <cusine types>
- <count> cafés, common nightlife venues
- <count> supermarkets for daily provisions
- <count> pharmacies and <count> clinics/hospitals
- <count> parks and recreation areas
- <count> museums and cultural sites
- <count> hotels and accommodations
- <count> transit stations (bus/metro)
- Highways: <list of nearest main roads>
- Geographic feature: <river/coast/mountain if any>"
```

## Radius recommendations

| Use case | Radius |
|----------|--------|
| Walk score | 800m |
| Restaurant district scope | 1000m |
| Neighborhood amenities | 1500m standard |
| Bikeshed reach | 3000m |
| Driveshed reach | 5000m max |

## Gotchas

1. **Overpass service can be rate-limited** — retry after 30s
2. **Output is natural language** not structured JSON parsed into tools
3. **Combine with analyze_neighborhood** for structured amenity counts
4. **radius max 5000m** — exceeds the parameter API limits
5. **For 50+ POI bulk results** prefer find_nearby_batch (more structured output)
6. **get_map_image** complements with tile image visual

## Anti-pattern

No usar este skill si:
- Necesitas structured POI JSON list (use find_nearby_places)
- Necesitas polygon boundary (use polygon_from_admin)
- Necesitas commute routes (use analyze_commute)

## Metrics

- Tools used: 1 (explore_area)
- Time: 3-15s
- Output: natural language area description (~300-500 words)
- Limitation: Overpass rate-limit Lima 2026-08-08 (retry intervals)
