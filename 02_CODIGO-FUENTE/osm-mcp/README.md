---
title: LetXipu OSM MCP
emoji: 🗺️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# LetXipu OSM MCP

MCP server (Docker / Go) for OpenStreetMap queries (Nominatim, Overpass, OSRM). Exposes geocoding,
reverse geocoding, routing, POI exploration, parking, schools, neighborhoods, and meeting-point
suggestion tools over the [Model Context Protocol](https://modelcontextprotocol.io/) HTTP transport.

## Architecture
- `cmd/osmmcp` — entrypoint, flags for `--overpass-rps`, `--overpass-burst`, `--nominatim-*`,
  `--osrm-*`, `--user-agent`, `--enable-http`, `--http-only`, `--http-addr`.
- `pkg/osm` — clients for OSM service providers, rate-limiters (`pkg/osm/ratelimit.go`),
  POI cache (`pkg/osm/poi_cache.go`), Overpass builder (`pkg/osm/overpass/`).
- `pkg/tools` — MCP tool implementations grouped by feature.
- `pkg/server` — HTTP/SSE MCP transport + middleware.

## Run with Docker
The provided `Dockerfile` builds a static `osmmcp` binary on `golang:1.24-alpine` and runs it on
port `7860` with conservative rate-limits consistent with the public OSM services.

```
docker build -t letxipu-osm-mcp .
docker run -p 7860:7860 letxipu-osm-mcp
```

## Run locally (Go)
Requires Go 1.24+.

```
go build -o osmmcp ./cmd/osmmcp
./osmmcp --enable-http --http-only --http-addr 127.0.0.1:7082
```

Useful flags:
| Flag | Default | Description |
|---|---|---|
| `--enable-http` | `false` | Enable HTTP+SSE transport |
| `--http-only` | `false` | Skip stdio (requires `--enable-http`) |
| `--http-addr` | `:7082` | HTTP bind address |
| `--http-auth-type` | `none` | `none`\|`bearer`\|`basic` |
| `--nominatim-rps` | `1.0` | Requests/sec to Nominatim |
| `--overpass-rps` | `1.0` | Requests/sec to Overpass |
| `--osrm-rps` | `1.0` | Requests/sec to OSRM |
| `--enable-monitoring` | `true` | Prometheus metrics + `/health` on `:9090` |
| `--monitoring-addr` | `:9090` | Monitoring server address |

## MCP tools (28)

### Geocoding (lang-aware)
- **`geocode`** `address, lang=es` — Forward geocoding. `lang` (ISO 639-1) controls `Accept-Language`
  header sent to Nominatim and the cache key, so `geocode("Lima","es")` and `geocode("Lima","en")`
  return localized place names without invalidating each other.
- **`reverse_geocode`** `latitude, longitude, lang=es` — Reverse geocoding with same `lang` semantics.

### Spatial primitives
- **`geo_distance`** — Haversine distance between two points.
- **`bbox_from_points`** — Bounding box from coordinates.
- **`centroid_points`** — Centroid of points.
- **`polygon_from_admin`** `name, admin_level, lang=es` — Fetch the administrative boundary polygon
  (GeoJSON Polygon/MultiPolygon) of a named OSM area via Overpass. `admin_level` 1-11 (2=country,
  4=state, 6=region, 8=province, 9=district, 10=neighbourhood). Useful for area analysis, joins,
  and clipping. [Phase 2]

### Routing
- **`route`** `from, to, profile` — OSRM routing (car/bike/foot).
- **`route_with_alternatives`** — Multiple route options.
- **`route_multi`** — Multiple waypoints.
- **`polyline_encode`** / **`polyline_decode`** — Google polyline format.

### Places & exploration
- **`find_nearby_places`** `latitude, longitude, radius, category, limit` — Single-location POI search
  around a point. Cached 24h.
- **`find_nearby_batch`** `queries[]` — Bulk POI search for up to 10 sub-queries
  (`{latitude,longitude,radius,category,limit,label}`). Concurrency capped at 3 to respect Overpass
  rate limits. Useful for `analyze_neighborhood`-style multi-category runs in a single trip. [Phase 2]
- **`explore_area`** — Area exploration with curated POI mix (cached 24h).
- **`analyze_neighborhood`** — Livability analysis (walk score, amenities, key issues). Cached 24h
  keyed by hash(lat4dp \| lon4dp \| radius \| name \| price \| lang). [Phase 2 cache added]
- **`suggest_meeting_point`** — Optimal midpoint computation.
- **`osm_query_bbox`** — Raw Overpass QL within a bbox.

### Specialized
- **`parking_search`** — Parking infrastructure.
- **`schools_in_area`** — Education amenities.
- **`commute_analysis`** — Commute metrics.

### Health & metadata
- **`osm_health`** — Live probes against Nominatim/Overpass/OSRM (3s timeout each). Returns
  `{status, nominatim, osrm, overpass, latency_ms, uptime_seconds}`. [Phase 1]
- **`get_version`** — Version tag.
- **`filter_tags`**, **`sort_by_distance`** — Result post-processing.
- **`tile_cache`** — Tile cache management. `stats` action returns `hits_total`, `misses_total`,
  `hit_ratio`, and `by_zoom` breakdown with per-zoom hit/miss counters (Phase 3).

## Endpoints
- `GET /health` — Health probe `{service, version, status, uptime_seconds}`.
- `GET /metrics` — Prometheus text (if `--enable-monitoring`).
- `GET /sse` — Tool discovery (JSON listing all 28 tools).
- `POST /mcp` — JSON-RPC 2.0 `tools/call` endpoint.

## Caching & rate limiting
- **POI cache** (`pkg/osm/poi_cache.go`): LRU + 24h TTL, keyed by SHA-256 of the rendered Overpass query.
- **POI cache shared**: hit/miss counters exposed via `tile_cache` tool stats.
- **Tile cache** (`pkg/cache/`): hit/miss total + per-zoom atomic counters (Phase 3).
- **Per-service rate-limiters**: token-bucket per upstream, persisted across restarts.

## License
MIT — see upstream repository.
