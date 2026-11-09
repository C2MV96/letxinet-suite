---
name: cross-tactical-coordinates-mgrs-mapping
description: Use for military / tactical / field operations mapping — geocodes MGRS (Military Grid Reference System), UTM (Universal Transverse Mercator), or DMS (Degrees Minutes Seconds) coordinates to lat/lon, then renders a tactical situation report in docx format with embedded map data. Ideal for tactical dispatch, geolocation of assets, search and rescue grid coordinates integration.
trigger_keywords: tactical mapping, mgrs geocode, utm geocode, dms geocode, military grid, situation report, sar grid, asset coordinates, field ops
---

# SKILL: cross-tactical-coordinates-mgrs-mapping (S9G-2)

## Proven Chain (2026-08-08)

```
osm.geocode_address(address="<MGRS or UTM or DMS string>", lang="en")
  ↓ lat/lon parsed from militar coordinate system
word.create_document(filename="<output.docx>", title="<SitRep>")
word.add_heading level=1 "TACTICAL SITUATION REPORT"
word.add_paragraph "<event id + datetime>"
word.add_heading level=2 "Coordinates Resolution"
word.add_table rows=N cols=4 [System|Original|Lat|Lon]
word.format_table border_style="thick" has_header_row=true
word.add_heading level=2 "Map Reference"
word.add_paragraph "Grid coordinates plotted in attached map"
word.add_picture image_path="<local.png>" width=6.0  # optional get_map_image result
```

## Validated Output (2026-08-08)

### MGRS geocode test (parser success)
- Attempt 1: `geocode_address("MGRS: 17SLA2897456710", lang="en")` → ❌ NO_RESULTS (prefix `MGRS:` not accepted, parser confused by colon)
- Attempt 2: `geocode_address("17SLA2897456710", lang="en")` → ✅ OK
```json
{
  "place": {
    "id": "coord-mgrs",
    "name": "Coordinates (mgrs format)",
    "location": {"latitude": 36.6406178445318, "longitude": -82.91308216153287},
    "address": {"formatted": "36.640618, -82.913082"},
    "importance": 1
  },
  "candidates": [
    {"id":"coord-mgrs","name":"Coordinates (mgrs format)","location":{"latitude":36.6406178445318,"longitude":-82.91308216153287},"address":{"formatted":"36.640618, -82.913082"},"importance":1}
  ]
}
```
- Parsed: lat=36.640618, lon=-82.913082 (Tennessee/Kentucky border area)

## Coordinate systems supported (no prefix)

| System | Example | Notes |
|--------|---------|-------|
| MGRS | "17SLA2897456710" | Military Grid Reference System |
| UTM | "47N 485986 2197460" | Universal Transverse Mercator |
| DMS | "19°51'22\"N 99°48'59\"E" | Degrees Minutes Seconds |
| Decimal | "12.05,-77.04" | Standard lat,lon |
| Address | "Av. Arequipa 100, Lima, Peru" | Standard address |

## When to use

- Search and rescue (SAR) grid report generation
- Military tactical dispatch documentation
- Field operations asset coordination report
- Geolocation verification of generator input coordinates
- Hiking expedition waypoint report
- Mining exploration geolocation dossier
- Geocaching challenge report
- Survey data digitization from field notebook
- Earthquake epicenter mapping report
- Hurricane / disaster grid analysis

## Output structure (SitRep docx)

```
TACTICAL SITUATION REPORT
Event ID: <event-id>
Datetime: <ISO-8601>

Coordinates Resolution
| System | Original | Latitude | Longitude |
|--------|----------|----------|-----------|
| MGRS   | 17SLA2897456710 | 36.640618 | -82.913082 |
| DMS    | N36°38'26.2"    | 36.640618 | -82.913082 |  # example
| UTM    | 17S 4182574    | 36.640618 | -82.913082 |  # example

Map Reference
Grid coordinates plotted on attached imagery.

[Optional: Map image embedded]
```

## Gotchas

1. **NO colon prefix** — `MGRS:` rejected; use bare `"17SLA2897456710"`
2. **MGRS precision varies**: 4-digit (10km grid), 6-digit (1km), 8-digit (100m), 10-digit (10m), 12-digit (1m)
3. **DMS requires escaped quotes** `\"` for the seconds sign in JSON
4. **Coordinate system auto-detected** by Nominatim parser — no need to call tools separately
5. **importance=1** for coord-system geocodes (not a OSM place)
6. **Output address field** is just decimal coords when using MGRS/UTM/DMS

## Anti-pattern

No usar este skill si:
- Necesitas tactical overlay on satellite image (use direct QGIS)
- Necesitas distance-bearing calculations (use external geodesy library)
- Necesitas encrypted body for classified (use protect_document then transport via secure channel)

## Metrics

- Tools used: 1 (geocode) + 6-8 Word ops
- Time: ~5-10s
- Output: docx tactical sitrep with coordinates resolution table
- Validated S9G-2: MGRS parser success lat=36.640618 lon=-82.913082
