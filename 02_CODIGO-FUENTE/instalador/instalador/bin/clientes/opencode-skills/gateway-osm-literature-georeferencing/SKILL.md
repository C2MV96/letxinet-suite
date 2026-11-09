---
name: gateway-osm-literature-georeferencing
description: Use when you need to locate institutions mentioned in academic search results on a map. Combines Gateway search with OSM geocode + explore_area to produce geographic context of where research is happening. Ideal for systematic literature reviews with geo-mapping of research groups.
trigger_keywords: geographic, systematic review, mapping, research groups, university location, author affiliations, geocontext
---

# SKILL: Gateway + OSM — Literature Georeferencing

## Proven Chain (2026-08-08)

```
gateway.search(query="<topic_with_place_hint>", sources=["openalex","scielo","serpapi"], fastMode=true)
    ↓ identify author affiliations or university in titles/abstracts
osm.geocode_address(address="<university_name>, <city>, <country>", lang="es")
    ↓ returns lat/lon (or fallback to manual coords)
osm.explore_area(latitude=<lat>, longitude=<lon>, radius=1000)
    ↓ returns POIs in vicinity: libraries, museums, restaurants nearby
```

## Validated Output (sesion 8)

### Test 1: UNAM Mexico bacterial cellulose
- search: 61 results (unam 50, scielo 8, openalex 3)
- geocode "Universidad Nacional de Colombia Bogota" → LOW_CONFIDENCE (importance 0.0000783)
- Workaround: pass known coords manually (Bogota UNAL: 4.6382, -74.0838)
- explore_area returned 144 POIs (16 restaurants, 5 museums, 4 libraries, neighborhood La Esmeralda)

### Test 2: Komagataeibacter <ciudad_usuario> Ancash Peru
- search: 5 results in 10.8s (1 Izquierdo Reyna 2025 UNS thesis)
- geocode "Universidad Nacional del Santa, <ciudad_usuario>, Ancash" → OK lat=-9.12, lon=-78.51
- explore_area (800m due to Overpass timeout) returned 186 POIs in Garatea quarter

## Reverse application: search → institution → map

This workflow allows you to:
1. Find where the research is being done (geographically)
2. Identify research cluster campuses (e.g., UNAL Bogota with 5 museums + 4 libraries)
3. Spot satellite campuses or affiliated institutions nearby
4. Produce spatial context for systematic reviews

## Gotchas

1. Geocode fails with importance < 0.05 — workaround: pass approximate coords of city
2. Overpass API has 504 timeouts in dense metro areas (Bogota centro) — reduce radius to 800m
3. `analyze_neighborhood` is heavier than `explore_area` — use explore_area for quick POI scan
4. Certain Mexican universities are in OSM under names with accents — try with/without

## For richer analysis, consider extend

Add to chain:
- `osm.find_nearby_places(latitude, longitude, category="restaurant", limit=10)` for venue-specific data
- `osm.get_route_directions()` between two institution coordinates (if OSRM up)
- `osm.get_map_image()` for static OSM tile images saved as PNG attachments

## Metrics

- Tools used: 3 (search, geocode_address, explore_area)
- Time: 10s (search) + 2s (geocode) + 5s (explore) = ~17s
- Output: structured POI count + location metadata
- Failure modes: Geocode importance filter, Overpass 504
