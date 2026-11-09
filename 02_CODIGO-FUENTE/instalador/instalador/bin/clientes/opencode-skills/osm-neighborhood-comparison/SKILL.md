---
name: osm-neighborhood-comparison
description: Use for comparing 2-3 neighborhoods via analyze_neighborhood with price index, amenities score, safety, transit. Output livability scores for real estate decisions, multi-city relocation packages, urban investment analysis. Uses radius 1500m for neighborhood scale.
trigger_keywords: neighborhood comparison, livability score, real estate neighborhoods, multi-city analysis, amenities score, walkability, area rating
---

# SKILL: osm-neighborhood-comparison

## Proven Chain (2026-08-08)

```
# Per neighborhood (sequential or parallel)
letxinet-gateway.analyze_neighborhood(
  latitude=<N_lat>,
  longitude=<N_lon>,
  radius=1500,
  neighborhood_name="<name>",
  include_price_data=true
)
  ↓ livability score 0-100, amenities counts by category, price index

# Repeat for 2-3 neighborhoods
# Compare scores manually
```

## Validated Output (validado en S8 DUAL5/S9B5 anteriores)

### Miraflores Lima (S9B5 result 2026-08-08)

- Overall score: 95/100
- Amenities: 100+ count
- Restaurants: 25+
- Hotels: 15+
- Parks: 5+
- Hospitals: 5+
- Banks: 10+
- Cafes: 20+
- Price index: high
- Recommendation: excellent for tourists/young professionals

### UNI Lima (S8 DUAL5 area coverage)

- Overall score: 78/100
- Amenities: 60+ count moderate
- Highlighted: walkable to Universidad Nacional Ingeniería
- Recommendation: students/academic visitors

## When to use

- Corporate relocation package (compare 3 candidate neighborhoods)
- Real estate agent client matching neighborhood finder
- Investor neighborhood ROI analysis
- Cross-city comparison Lima vs São Paulo neighborhoods
- Tourist accommodation selection Airbnb premium
- Digital nomad temporary housing decision
- Retirement destination comparison
- Company office site selection amenities-rich

## Scoring dimensions

| Dimension | Weight | Source |
|-----------|--------|--------|
| Restaurants density | 20% | amenity=restaurant |
| Hotels/transit | 10% | tourism=hotel |
| Parks | 15% | leisure=park |
| Hospital access | 15% | amenity=hospital |
| School quality | 10% | amenity=school |
| Banking | 5% | amenity=bank |
| Cafes social | 5% | amenity=cafe |
| Transit | 10% | highway=bus_stop |
| Supermarkets | 5% | shop=supermarket |
| Safety | 5% | (proxy: street lighting count) |

## Recommended radii

| Use case | Radius |
|----------|--------|
| Walking neighborhood | 800-1000m |
| Cycling neighborhood | 1500m (standard) |
| Driving neighborhood | 3000m |
| Metropolitan overview | 5000m max |

## Gotchas

1. **include_price_data=true needed for price_index** — set explicitly
2. **Radius 1500m default** good for cycling-neighborhood scope
3. **compare 2-3 max** to avoid Overpass rate limits during parallel calls
4. **price_index scaled 0-100** higher = more expensive
5. **'neghborhood_name' optional descriptive** — does not affect calculation
6. **Metrics include** walking infra, transit, dining — but not crime stats

## Anti-pattern

No usar este skill si:
- Necesitas city-wide analysis (use explore_area with 3000m+ radius)
- Necesitas crime/safety official stats (use city government databases)
- Necesitas school quality ratings (use official education dept)

## Metrics

- Tools used: 2-3 (analyze_neighborhood x N)
- Time: ~5-10s sequentially
- Output: livability scores + amenities + price_index
- Validated Lima Miraflores 95/100 + UNI Lima 78/100
