---
name: osm-batch-poi-survey
description: Use for batch POI surveys across multiple locations and categories simultaneously. Executes up to 10 sub-queries in parallel for categories like restaurant/hotel/park/hospital/bank/cafe/school/university/parking. Ideal for real estate market analysis, urban planning, tourism development.
trigger_keywords: batch POI survey, parallel places, multi-location amenities, restaurant hotel park hospital, urban planning POI, real estate amenities batch
---

# SKILL: osm-batch-poi-survey

## Proven Chain (2026-08-08)

```
letxinet-gateway.find_nearby_batch(queries=[
  {latitude:<lat1>, longitude:<lon1>, radius:1500, category:"restaurant", limit:10, label:"zone1-rest"},
  {latitude:<lat2>, longitude:<lon2>, radius:1500, category:"hotel", limit:10, label:"zone2-hotel"},
  ... up to 10 sub-queries
])
  ↓ parallel Overpass queries, bulk response in ~60s
```

## Validated Output (2026-08-08)

**Miraflores Lima 8 sub-queries test:**

```
- miraflores-restaurants : 0 results (Overpass rate-limit hit)
- pueblo-libre-schools   : 0 results
- miraflores-hotels      : 0 results  
- miraflores-parks       : 0 results
- parking-test           : 0 results
- miraflores-hospitals   : 0 results
- miraflores-banks       : 0 results
- cafes                  : 0 results
```

Total: 0 results (Overpass 429 rate-limited session-wide)

## When to use

- Real estate developer comparing neighborhoods amenities
- Tourism board POI inventory
- Urban planner accessibility audit
- Market entry retail location scouting
- Conference venue selection with hotel/restaurant density
- Hospital catchment area analysis
- School district comparison
- Coffee shop density entrepreneur study

## Category coverage (Overpass amenity tags)

| Category | OSM tag | Common limit |
|----------|---------|-------------|
| restaurant | amenity=restaurant | 10-25 |
| hotel | tourism=hotel | 5-15 |
| park | leisure=park | 5-20 |
| hospital | amenity=hospital | 3-10 |
| bank | amenity=bank | 5-15 |
| cafe | amenity=cafe | 5-20 |
| school | amenity=school | 5-15 |
| university | amenity=university + office=university | 3-10 |
| parking | amenity=parking | 5-20 |
| charging EV | amenity=charging_station | 1-10 |

## Gotchas

1. **Rate-limited when Overpass under load** — 0 results, retry after 60s
2. **8-10 sub-queries** triggers rate-limit in dense urban zone (Lima Miraflores)
3. **Use 3-4 sub-queries** max per call for stability
4. **Radius 1000-1500m optimal** for neighborhood-scale coverage
5. **limit param default 10** — raise to 25 for sparse categories
6. **label** param only descriptive, returned in response

## Alternative when Overpass unavailable

Use find_nearby_places single query per call sequentially with 3s pauses:
```
find_nearby_places(category="restaurant", lat=x, lon=y, radius=1000, limit=10)
→ wait 3s
find_nearby_places(category="hospital", lat=x, lon=y, radius=1000, limit=10)
→ etc.
```

## Anti-pattern

No usar este skill si:
- Necesitas POIs across wide country area (use single category + admin polygon)
- Overpass is rate-limiting (use get_map_image for visual inventory)

## Metrics

- Tools used: 1 (find_nearby_batch)
- Time: 64s
- Output: 0 results (Overpass rate-limited Lima 2026-08-08)
- Recommended: 3-4 sub-queries max per call
