---
name: osm-polygon-admin-extractor
description: Use for fetching administrative boundary polygons from OSM by named admin area. Returns GeoJSON Polygon/MultiPolygon for countries/states/provinces/districts. Ideal for choropleth maps, geofence design, jurisdiction-based analytics, statistical area extraction.
trigger_keywords: admin polygon, boundary polygon, GeoJSON polygon country, admin_level jurisdiction, OSM administrative area, geofence polygon
---

# SKILL: osm-polygon-admin-extractor

## Proven Chain (2026-08-08)

```
letxinet-gateway.polygon_from_admin(
  name="Miraflores",  # required exact name
  admin_level=8,      # required 1-11
  lang="es"           # metadata language
)
  ↓ GeoJSON Polygon/MultiPolygon of admin boundary
```

## Validated Output (2026-08-08)

**Miraflores admin_level=8 attempt**:

```
Error: Overpass API returned status 429: rate_limited
Guidance: Rate limit exceeded. Please try again in a few moments.
```

**Note**: Validated earlier S8 FASE2 (DUAL2) — got partial polygon UNAL Bogota when not rate-limited.

## When to use

- Choropleth maps crime/health/etc by district
- Geofence for ride-hailing zone pricing
- Statistical area boundary extraction
- School district polygon
- Election precinct map visualization
- Demographic analysis boundaries
- Service area (utility company polygon)
- National park boundary conservation
- Climate zone polygon extraction
- Country state province geocoding
- Population density gridded by admin unit

## admin_level standard OSM hierarchy

| Level | Meaning | Example |
|-------|---------|---------|
| 1 | Continental | South America |
| 2 | Country | Peru |
| 3 | Region (subdivision) | Macro-region |
| 4 | State/Department | Lima Province |
| 5 | Subdivisión | Lima Metropolitana |
| 6 | Region international | Lima Department |
| 7 | subregion | San Isidro district area |
| 8 | Province/District | Miraflores (Peru districts) |
| 9 | District | Cercado de Lima |
| 10 | Neighborhood | Barrios Altos |
| 11 | Sub-block | City blocks |

## Common admin names Lima Peru

| Name | admin_level |
|------|-------------|
| Peru | 2 |
| Lima | 4 (Lima Province) |
| Lima Metropolitana | 6 (Lima Department) |
| Miraflores | 8 (district) |
| San Isidro | 8 (district) |
| Barranco | 8 (district) |
| San Borja | 8 (district) |
| Surco | 8 (district) |
| La Molina | 8 (district) |

## Gotchas

1. **Overpass 429** rate limit — retry after 30-60s when batch queries collide
2. **name exact match** required — "Miraflores de Lima" won't match just "Miraflores"
3. **admin_level case-sensitive** lowercase integer 1-11
4. **Polygon vs MultiPolygon** returned depending on admin shape (disjoint islands → MultiPolygon)
5. **GeoJSON response** can be very large for big countries — be prepared to stream
6. **For Peru districts**: admin_level 8 commonly; some cities different
7. **Spanish vs English names** vary — admin_level Peru uses Spanish admin names

## Anti-pattern

No usar este skill si:
- Necesitas pixel raster map (use get_map_image)
- Necesitas real-time geo fence alert (use tracking server geofencing)

## Metrics

- Tools used: 1 (polygon_from_admin)
- Time: variable (5-60s, fails on rate-limit)
- Output: GeoJSON Polygon/MultiPolygon
- Limitation: Overpass 429 in Lima test 2026-08-08 (retry needed)
