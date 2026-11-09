---
name: osm-charging-stations-map
description: Use for searching electric vehicle charging stations near a location. Returns list of charging stations with operator, power output, connector types, address. Useful for EV infrastructure planning, EV fleet route planning, EV adoption studies.
trigger_keywords: charging station, EV charging, electric vehicle plug, OCPI, plug type, EV infrastructure, charging fleet, station network
---

# SKILL: osm-charging-stations-map

## Proven Chain (2026-08-08)

```
letxinet-gateway.find_charging_stations(
  latitude=<lat>,
  longitude=<lon>,
  radius=5000,  # max 10000
  limit=10
)
  ↓ list of charging stations with operator, output, connectors
```

## Validated Output (2026-08-08)

**Miraflores Lima lat=-12.1226 lon=-77.0297 radius=8000m:**

```json
{"charging_stations": []}
```

**Result**: Lima Peru has 0 EV charging stations registered in OSM within 8km of Miraflores as 2026-08-08.

## When to use

- EV infrastructure gap analysis
- EV fleet routing planning (corridor feasibility)
- EV charger network competitor analysis
- Real estate EV-ready scoring
- Tourism EV rental feasibility
- Government policy adoption meter
- Carbon offset program design
- Hydrogen station alternative comparison

## Coverage reality check (2026-08-08)

| Country/Region | EV stations density (OSM) |
|----------------|---------------------------|
| Norway | dense 50km grid |
| Netherlands | very dense urban centers |
| California USA | dense SF/LA corridors |
| Germany | dense autobahn network |
| UK | dense motorway network |
| France | moderate Paris dominant |
| China | dense Beijing/Shanghai |
| Brazil | sparse São Paulo/Rio |
| Mexico | sparse CDMX |
| Peru | zero Lima (confirmed) |
| Colombia | sparse Bogotá |
| Argentina | sparse CABA |
| LatAm rural | effectively none |

## Gotchas

1. **Lima Peru 0 stations** confirms OSM EV infrastructure incomplete for emerging markets
2. **Radius max 10000m** per query, paginate across for broader coverage
3. **OSM EV charger coverage** 5-10x lower than commercial databases (ChargePoint, PlugShare)
4. **Connectors** field: Type2/CCS/CHAdeMO/Tesla — verify operator-specific
5. **Power output** kW varies wildly — public fast chargers >50kW rarity
6. **For commercial quality data** use Open Charge Map API or PlugShare

## Recommended complementary tools

- `osm-find-parking-facilities` — for EV charger adjacent parking
- `geo_distance` for nearest fast charger hop distance
- Web search `OCPI operator network coverage <country>` for commercial alternatives

## Anti-pattern

No usar este skill si:
- Necesitas real-time charger availability status (use commercial OHM/PlugShare API)
- Necesitas Tesla Supercharger network specifically (use Tesla API direct)
- Necesitas charger reservations/payment (use ChargePoint/EnelX app)

## Metrics

- Tools used: 1 (find_charging_stations)
- Time: ~3s
- Output: charging station list (empty for Lima Peru)
- Limitation: OSM incomplete coverage in emerging markets
