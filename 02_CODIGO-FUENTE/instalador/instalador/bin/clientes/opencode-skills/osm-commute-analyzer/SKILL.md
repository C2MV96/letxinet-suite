---
name: osm-commute-analyzer
description: Use for detailed commute analysis comparing 3 transport modes (car/cycling/walking). Provides step-by-step navigation instructions per mode, CO2 emissions for car, calories burned for cycling/walking. Recommends optimal mode. Ideal for relocation decisions, employee wellness programs, nomadic remote work site selection.
trigger_keywords: commute analyzer, transport mode comparison, car vs cycling vs walking, CO2 commute, calories commute, step-by-step navigation, relocation commute analysis
---

# SKILL: osm-commute-analyzer

## Proven Chain (2026-08-08)

```
letxinet-gateway.analyze_commute(
  home_latitude=<H_lat>, home_longitude=<H_lon>,
  work_latitude=<W_lat>, work_longitude=<W_lon>,
  transport_modes=["car","cycling","walking"]
)
  ↓ JSON commute_analysis with 3 mode options comparison
```

## Validated Output (2026-08-08)

**Home: -12.05,-77.04 Lima Centro → Work: -12.08,-77 Miraflores**

### Mode compare table

```
car     | 9,190 m | 871s (14min)  | CO2: 1.10 kg | instructions: 21 steps
cycling | 7,374 m | 1,999s (33min) | calories: 369 kcal | instructions: 22 steps
walking | 7,004 m | 5,618s (1h33min) | calories: 560 kcal | instructions: 58 steps
recommended: car (fastest)
```

### Step-by-step (car mode extract):
1. Start your journey
2. Turn left onto Jirón Chancay
3. Turn left onto Jirón Chota
4. Turn left onto Avenida Bolivia
5. Slight right onto Avenida Paseo de la República
6. Straight onto Túnel del Metropolitano
7. Merge onto Vía Expresa Luis Fernán Bedoya Reyes
8. Turn left onto Avenida Javier Prado Este
9. Merge onto Avenida Javier Prado Este
10. Turn left onto Avenida Aviación
... 21 steps total to destination

## When to use

- Employee relocation package design
- Remote worker café/office site selection
- Cycling infrastructure investment analysis
- Urban wellness program design
- Carbon emissions company-wide commute study
- Real estate investment proximity scoring
- E-bike viability study
- Walking school bus route planning

## Decision matrix

| Factor | car wins | cycling wins | walking wins |
|--------|----------|--------------|--------------|
| Speed | <5km | rarely | rarely |
| Cost | expensive | free | free |
| CO2 | 1 kg | zero | zero |
| Health | none | moderate | high |
| Distance | 5-25 km | 1-10 km | <5 km |
| Hills/Obstacles | none | moderate | high |
| Weather | all | clear dry | clear pleasant |

## Gotchas

1. **duration calculated** by OSRM per mode (car=-fast estimate, walking=speed 5km/h, cycling=15km/h)
2. **calories burned** estimated 65kg human walking 5km/h, cycling 15km/h intensity
3. **CO2 kg** estimated 0.12 kg/km car-mode
4. **instructions** use OSRM standard text — translate if Spanish needed
5. **transport_modes** must be array `["car","cycling","walking"]` not comma string
6. **mode accepts** car/bike/foot also in some endpoints — analyze_commute uses car/cycling/walking naming

## Anti-pattern

No usar este skill si:
- Single mode analysis only (use get_route_directions directly)
- Long-haul inter-city routes (use Google Maps composite)
- Public transit needed (not supported by OSRM)

## Metrics

- Tools used: 1 (analyze_commute)
- Time: ~3s
- Output: 3 mode options + recommended + 60+ instructions
- Lima Peru validated -12.05→-12.08
