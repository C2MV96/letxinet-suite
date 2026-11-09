---
name: osm-geocode-reverse-pair
description: Use for paired geocoding operations — forward geocoding (address → coords) and reverse geocoding (coords → address). Validates OSM Nominatim API returns with importance score, multiple candidates, formatted address. Ideal for address verification apps, fleet GPS tracking, delivery apps.
trigger_keywords: geocode, reverse geocode, address to coords, coords to address, nominatim, importance score, formatted address
---

# SKILL: osm-geocode-reverse-pair

## Proven Chain (2026-08-08)

```
# Forward geocode
letxinet-gateway.geocode_address(
  address="<street>, city, country",
  lang="es"  # ISO 639-1 for localized output
)
  ↓ coords + formatted address + importance + candidates

# Reverse geocode
letxinet-gateway.reverse_geocode(
  latitude=<lat>, longitude=<lon>,
  lang="es"
)
  ↓ place name + structured address + importance
```

## Validated Output (2026-08-08)

### Forward — Parque de la Muralla Lima Peru

```json
{
  "id": "3740313",
  "name": "Parque de La Muralla, Urbanización Barrios Altos, Lima, Lima Metropolitana, Lima, Perú",
  "location": {"latitude": -12.0445544, "longitude": -77.0262526},
  "importance": 0.189
}
```

### Reverse — coords -12.1226, -77.0297 (Miraflores Lima)

```json
{
  "id": "3660099",
  "name": "Kaffe, 276, Calle Schell, Miraflores, Lima, Lima Metropolitana, Lima, 15074, Perú",
  "location": {"latitude": -12.1227314, "longitude": -77.0297292},
  "address": {
    "street": "Calle Schell",
    "house_number": "276",
    "city": "Miraflores",
    "state": "Lima",
    "country": "Perú",
    "postal_code": "15074"
  },
  "importance": 0.0000773
}
```

## When to use

- Address verification e-commerce checkout
- Fleet GPS tracker address resolution
- Ride-hailing app endpoint validation
- Field service location dispatch
- Geofence accuracy validation
- Real estate listing coords enrichment
- POI database enrichment from addresses
- Address parser training data generation
- I18n localized address localization

## Supported address inputs

```
"123 Main Street, New York, NY 10001"
"Parque de la Muralla, Lima, Peru"
"Av. Paulista 1578, São Paulo, Brazil"
"Eiffel Tower, Paris, France"
"MGRS: 54SVK2747201448"
"UTM: 47N 485986 2197460"
"DMS: 19°51'22\"N 99°48'59\"E"
```

## Lang options

| Code | Language |
|------|----------|
| es | Spanish localized |
| en | English default |
| pt | Portuguese |
| fr | French |
| de | German |
| it | Italian |
| ja | Japanese |
| zh | Chinese |
| ru | Russian |

## Gotchas

1. **importance** is 0-1 score from OSM Nominatim — high >0.5 means prominent landmark; building-level often <0.001
2. **Reverse geocode may return nearby POI** instead of next address if coords hit a coffee shop building
3. **Lang affects display_name** only — structured address fields returned in original country language
4. **House numberings**** vary by country convention (US "123 Main", Japan "Main 1-2-3")
5. **Postal code** included when OSM has it — Mexico/LatAm often missing
6. **Multiple candidates** returned for ambiguous queries — confidence trick

## Anti-pattern

No usar este skill si:
- Necesitas Google Places quality (use Google Maps API direct)
- Necesitas geofence polygon (use polygon_from_admin admin_level)
- Necesitas coords from cell tower (use telecom API)

## Metrics

- Tools used: 2 (geocode_address + reverse_geocode)
- Time: ~2-5s combined
- Output: 2-way address ↔ coords resolution
- Lima Peru validated both directions
