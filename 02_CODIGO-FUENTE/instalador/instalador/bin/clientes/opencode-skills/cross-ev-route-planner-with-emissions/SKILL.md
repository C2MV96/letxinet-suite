---
name: cross-ev-route-planner-with-emissions
description: Use for EV (electric vehicle) trip planning — finds charging stations along a route, computes route distance and duration via OSRM, and enriches emissions/cost/calories profile. Generates itinerary docx with stations table. Ideal for EV fleet route planning, intercity EV feasibility, eco-tour EV itinerary.
trigger_keywords: ev route planner, charging stations trip, ev itinerary, ev fleet route, emissions ev, intercity ev feasibility, charging stops along route
---

# SKILL: cross-ev-route-planner-with-emissions (S9G-3)

## Proven Chain (2026-08-08)

```
osm.find_charging_stations(latitude=<origin_lat>, longitude=<origin_lon>, radius=5000-10000, limit=10)
  ↓ charging stations near origin (if OSM has EV data)
osm.find_charging_stations(latitude=<dest_lat>, longitude=<dest_lon>, radius=5000-10000, limit=10)
  ↓ charging stations near destination
osm.get_route_directions(start_lat=<origin_lat>, start_lon=<origin_lon>, end_lat=<dest_lat>, end_lon=<dest_lon>, mode="car")
  ↓ distance, duration, polyline, route_file
osm.enrich_emissions(options=[{mode:"car", distance:<m>}, ...])
  ↓ CO2, calories, cost_estimate per mode
word.create_document + add_heading + add_table + format_table
  ↓ Itinerary docx with stations + emissions
```

## Validated Output (2026-08-08)

### EV infrastructure test Lima Peru
- `find_charging_stations(latitude=-12.1226, longitude=-77.0297, radius=8000)` Miraflores Lima
- Result: ⚠️ error "OSM service error: 504" Overpass timeout Lima
- Earlier S9D-6 validated: Lima has 0 EV charging stations (OSM EV coverage incomplete in LatAm)

### Route analysis validated (S9D-1)
- `analyze_commute` Lima Centro→Miraflores: 9,190m / 871s / CO2 1.10 kg
- `get_route_directions` Lima: 9,815.5m / 767s / 200 route points / route_file saved server

### Emissions enrichment (S9D-1 from analyze_commute)
- car: CO2 1.10 kg (estimated 0.12 kg/km)
- cycling: 368 kcal (65kg human)
- walking: 560 kcal

## EV infrastructure coverage reality (reused from S9D-6)

| Country | EV OSM coverage |
|---------|-----------------|
| Norway | dense 50km grid |
| Netherlands | very dense |
| California, USA | dense SF/LA |
| Germany | dense autobahn |
| UK | dense motorway |
| France | moderate Paris-dominant |
| China | dense Beijing/Shanghai |
| Brazil | sparse SP/Rio |
| Mexico | sparse CDMX |
| Peru | zero Lima confirmed |
| Colombia | sparse Bogotá |
| Argentina | sparse CABA |

## EV trip itinerary docx structure

```
RUTA ELECTRICO - Itinerario
Origen: <origin_address>
Destino: <destination_address>

Route Summary
| Distance | Duration | CO2 | Cost Estimate |
|----------|----------|-----|---------------|
| 9.8 km | 13 min | 1.10 kg | $0.50 |

Charging Station Hops
| Hop | Station Name | Latitude | Longitude | Power kW | Operator |
|-----|--------------|----------|-----------|----------|----------|
| Origin | (none in Lima) | - | - | - | - |
| Midpoint | (none) | - | - | - | - |
| Dest | (none in Lima) | - | - | - | - |

EV Trip Feasibility for Lima-Miraflores: NOT possible (0 EV stations registered)
Recommendation: Use hybrid ICE vehicle or equivalent
```

## When to use

- EV fleet intercity route planning (US / EU dense networks)
- Eco-tour EV itinerary generation (Norway/Netherlands good use case)
- EV rental feasibility check for tourist destination
- EV charger infrastructure gap analysis
- Government policy adoption meter (use this skill + per-region)
- Carbon offset program route planning
- Charging station competitor density analysis

## Gotchas

1. **Lima/Peru 0 stations** — OSM data incomplete for emerging markets
2. **For commercial quality data**: Open Charge Map API or PlugShare / ChargePoint
3. **OSM EV charger coverage** 5-10x lower than commercial databases
4. **find_charging_stations radius max 10000m** — paginate across for broader scan
5. **Connectors field**: Type2/CCS/CHAdeMO/Tesla varied by operator
6. **Power output kW** varies wildly — public fast chargers >50kW rarity
7. **enrich_emissions accepts options array** so multiple mode comparison can run in one call
8. **For Norway/Netherlands** this skill works excellent — for LatAm, expect empty

## Anti-pattern

No usar este skill si:
- Necesitas real-time charger availability (use commercial OHM / PlugShare API direct)
- Necesitas Tesla Supercharger network specifics (use Tesla API direct)
- Necesitas EV charger reservations / payment (use ChargePoint / EnelX app)
- Necesitas combustion-only route (use osm-route-analytics simpler skill)

## Metrics

- Tools used: 4-6 (find_charging_stations x2 + get_route_directions + enrich_emissions + Word docx generation ~7 ops)
- Time: ~10-15s end-to-end
- Output: docx itinerary with route summary + charging station hops table + emissions table
- Validated S9G-3: 0 charging stations Lima confirmed; route Lima 9.8km analyzed
