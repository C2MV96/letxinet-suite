---
name: osm-route-analytics
description: Use for multi-modal route analysis (car/cycling/walking) between home and work locations. Provides distance, duration, CO2 emissions, calories burned, step-by-step instructions. Ideal for commute analysis, transportation planning, last-mile delivery optimization.
trigger_keywords: route analytics, multi-modal route, commute analysis, car cycling walking, transportation planning, CO2 emissions, calories burned, route instructions
---

# SKILL: osm-route-analytics

## Proven Chain (2026-08-08)

```
letxinet-gateway.analyze_commute(
  home_latitude=<lat1>, home_longitude=<lon1>,
  work_latitude=<lat2>, work_longitude=<lon2>,
  transport_modes=["car","cycling","walking"]
)
  ↓ 3 commute options with distance, duration, CO2, calories, instructions

letxinet-gateway.get_route_directions(
  start_lat=<lat1>, start_lon=<lon1>,
  end_lat=<lat2>, end_lon=<lon2>,
  mode="car"
)
  ↓ single route with polyline, point count, route file

letxinet-gateway.geo_distance(
  from={latitude:<lat1>,longitude:<lon1>},
  to={latitude:<lat2>,longitude:<lon2>}
)
  ↓ Haversine distance in meters
```

## Validated Output (2026-08-08)

**Lima Peru: -12.05,-77.04 → -12.08,-77 analyze_commute:**

| Mode | Distance | Duration | CO2 | Calories |
|------|----------|----------|-----|----------|
| car | 9,190 m | 871s (14min) | 1.10 kg | — |
| cycling | 7,374 m | 1,999s (33min) | — | 368 kcal |
| walking | 7,004 m | 5,618s (1h33min) | — | 560 kcal |
| recommended | car | fastest | — | — |

**get_route_directions Lima (-12.05,-77.04 → -12.1226,-77.0297):**
- distance 9815.5 m (9.8 km), duration 767s (12.8 min)
- 200 route points
- route_file: /tmp/routes/route-4026617538.json

**geo_distance Lima PT1→PT2**: 8150 m (Haversine direct)

## When to use

- Commute optimization for employee relocation decisions
- Last-mile delivery route planning
- Transportation infrastructure investment study
- Carbon footprint commute analysis
- Employee wellness cycling/walking recommendation
- Real estate proximity to workplace scoring
- Urban planning multi-modal comparison

## Mode recommendations

| Distance | Recommended | CO2 consideration |
|----------|-------------|--------------------|
| <1 km | walking | zero |
| 1-5 km | cycling | zero |
| 5-15 km | car or transit | 1-3 kg CO2 |
| 15-30 km | car + transit hybrid | 3-6 kg CO2 |
| >30 km | car only | 6+ kg CO2 |

## Gotchas

1. **analyze_commute requires 3 distinct lists** as arrays not comma strings
2. **get_route_directions OSRM mode** accepts car/bike/foot (not "transit")
3. **route_file** stored server-side /tmp/routes/ — ephemeral if OSM service restarted
4. **OSRM service may be down** (degraded status) — use analyze_commute as primary
5. **geo_distance Haversine** ignores real roads — underestimate vs OSRM routing
6. **polyline_encode needs lat/lon** keys (not latitude/longitude) — silent fail otherwise

## Anti-pattern

No usar este skill si:
- Necesitas traffic-aware routing real-time (use Google Maps/Waze API direct)
- Necesitas public transit routes (OSRM doesn't support)

## Metrics

- Tools used: 3 (analyze_commute + get_route_directions + geo_distance)
- Time: ~5s combined
- Output: 3 commute options + 1 detailed route + 1 haversine distance
- Validated Lima Peru commute
