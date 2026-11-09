---
name: osm-centroid-bbox-tools
description: Use for computing geographic centroids and bounding boxes of point sets. Useful for finding meeting midpoint, defining area of interest for analysis, drawing map rectangles. Two atomic operations from coordinate lists.
trigger_keywords: centroid, bbox, bounding box, mean center, geo midpoint, point set area
---

# SKILL: osm-centroid-bbox-tools

## Proven Chain (2026-08-08)

```
# Compute centroid (mean center)
letxinet-gateway.centroid_points(
  points=[
    {"latitude":<lat1>,"longitude":<lon1>},
    {"latitude":<lat2>,"longitude":<lon2>},
    {"latitude":<lat3>,"longitude":<lon3>}
  ]
)
  ↓ centroid {latitude, longitude}

# Compute bounding box
letxinet-gateway.bbox_from_points(
  points=[
    {"latitude":<lat1>,"longitude":<lon1>},
    {"latitude":<lat2>,"longitude":<lon2>},
    {"latitude":<lat3>,"longitude":<lon3>}
  ]
)
  ↓ bbox {minLat, minLon, maxLat, maxLon}
```

## Validated Output (2026-08-08)

### centroid_points 3 points Lima

**Input:**
```json
[
  {"latitude":-12.1226,"longitude":-77.0297},
  {"latitude":-12.05,"longitude":-77.04},
  {"latitude":-12.08,"longitude":-77}
]
```

**Output:**
```json
{
  "centroid": {
    "latitude": -12.0842,
    "longitude": -77.02323333
  }
}
```

### bbox_from_points 3 points Lima

**Output:**
```json
{
  "bbox": {
    "minLat": -12.1226,
    "minLon": -77.04,
    "maxLat": -12.05,
    "maxLon": -77
  }
}
```

## When to use

- Meeting point optimization (3+ participants find central gathering)
- Spatial query area definition (bbox for Overpass queries)
- Map view fit-to-points in dashboards
- Geographic clustering validation (mean center dispersion)
- Tour itinerary midpoint hotel selection
- Sports event venue centroid (multi-team competition)
- Asset distribution network hub planning
- Geofence rectangle design (security)

## Centroid math vs geodesic median

| Method | Property |
|--------|----------|
| Arithmetic mean (this tool) | Fastest, good for small areas |
| Geographic centroid | accurate for great-circle |
| Geodesic median | minimizes sum distances |
| Weber point | minimizes weighted distances |

For Peru-city-wide small scales, arithmetic mean is sufficient.

## Bbox use cases

- Overpass query scope (osm_query_bbox)
- Static map fit-to-bounds zoom calculation
- Heatmap rendering boundaries
- Spatial database SELECT bbox
- SAR (search and rescue) scenario grid

## Gotchas

1. **Param key mismatch**: must use `latitude/longitude` (NOT `lat/lon`) for centroid_points and bbox_from_points
2. **polyline_encode expects `lat/lon`** but centroid/bbox expect `latitude/longitude` — frustrating inconsistency
3. **Arithmetic mean drifts** at scale - approximate for <=500km box
4. **bbox minLat < maxLat** (north positive), but minLon can wrap at anti-meridian (180/-180 line)
5. **For meetings** use centroid; for **hub placement** use geodesic median (commercial tools)

## Anti-pattern

No usar este skill si:
- Necesitas travel-time midpoint (use analyze_commute iteratively)
- Necesitas population-weighted centroid (use census API)

## Metrics

- Tools used: 2 (centroid_points + bbox_from_points)
- Time: ~1s combined
- Output: centroid + bbox for 3-point Lima set
- Validated Lima: centroid (-12.0842, -77.02323) ; bbox maxLat -12.05 minLat -12.1226
