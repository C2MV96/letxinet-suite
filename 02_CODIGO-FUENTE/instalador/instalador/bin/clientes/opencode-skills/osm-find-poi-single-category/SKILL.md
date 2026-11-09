---
name: osm-find-poi-single-category
description: Use for single-category POI search using find_nearby_places. Returns up to 50 POIs of one category near a point. Simplest tool — single lat/lon + category + radius. Recommended when find_nearby_batch hits rate limits.
trigger_keywords: find nearby, POI search, single category places, restaurant search single, hospital nearby, school nearby
---

# SKILL: osm-find-poi-single-category

## Proven Chain (2026-08-08)

```
letxinet-gateway.find_nearby_places(
  latitude=<lat>,
  longitude=<lon>,
  radius=1000,  # max 50000
  category="restaurant",  # optional
  limit=10
)
  ↓ list of POIs with name, address, distance
```

## Validated Output (2026-08-08)

**Earlier S8/S9A validated POI queries:**
- T4 Arequipa Plaza de Armas restaurants: 8 found within 1000m radius
- S8 DUAL2 UNAL Bogota POI: 144 found within 1500m (museos + bibliotecas)
- S9A T1 Joinville SC Brazil: 72 POIs within 1500m radius

**Categories tested in 2026-08-08:**
- restaurant, hotel, park, hospital, bank, cafe, school, parking, charging_station

## When to use

- Single category POI inventory for small radius
- Plan B when find_nearby_batch ratelimited
- Casual traveler listing nearby restaurants
- Quick neighborhood amenity sanity check
- Conference venue restaurant inventory
- Field researcher area familiarization
- Tour guide stop planning

## Category matrix

| Category | Returns |
|----------|---------|
| restaurant | amenity=restaurant |
| cafe | amenity=cafe |
| hotel | tourism=hotel |
| hospital | amenity=hospital |
| bank | amenity=bank |
| pharmacy | amenity=pharmacy |
| school | amenity=school |
| university | office=university OR amenity=university |
| park | leisure=park |
| supermarket | shop=supermarket |
| bar | amenity=bar |
| pub | amenity=pub |
| fast_food | amenity=fast_food |
| cinema | amenity=cinema |
| theatre | amenity=theatre |
| museum | tourism=museum |
| library | amenity=library |
| fuel | amenity=fuel |
| atm | amenity=atm |
| parking | amenity=parking |
| charging_station | amenity=charging_station |
| subway_entrance | railway=subway_entrance |
| bus_stop | highway=bus_stop |
| tram_stop | railway=tram_stop |
| police | amenity=police |
| fire_station | amenity=fire_station |
| place_of_worship | amenity=place_of_worship |
| gym | leisure=fitness_centre |

## Radius options

| Radius | Range |
|--------|-------|
| 500 | immediate walking |
| 1000 | walking comfort (~12min walk) |
| 1500 | moderate walk (~17min) |
| 2000 | cycling short |
| 5000 | cycling moderate |
| 10000-50000 | driving |

## Gotchas

1. **Empty category** returns mixed unfiltered results — useful when unsure which to ask for
2. **Rate-limit when querying category simultaneously** with batch — sequential per category
3. **For "small business listings"** category-based queries miss many shops without amenities tag
4. **For Lima Peru** results variable — some districts richer OSM coverage than others
5. **'name' field often missing** for small POIs — use address fallback
6. **Distance field in meters** — sort internally if needed

## Anti-pattern

No usar este skill si:
- Necesitas 5+ categories simultaneously (use find_nearby_batch)
- Necesitas admin boundary (use polygon_from_admin)
- Necesitas rich textual description (use explore_area)

## Metrics

- Tools used: 1 (find_nearby_places)
- Time: 3-5s per query
- Output: list of POIs with name/address/distance
- Validated Lima ~50-150 POIs per category within 1500m
