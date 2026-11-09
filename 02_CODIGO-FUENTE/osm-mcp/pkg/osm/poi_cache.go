package osm

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// DefaultPOICacheTTL is how long a POI query result stays cached. POI data in
// OSM changes rarely enough that 15 minutes is a safe default; it dramatically
// reduces the load on the Overpass public instance when several users ask the
// same "restaurantes cerca de X" concurrently. Configurable at runtime via
// SetPOICacheTTL.
const DefaultPOICacheTTL = 15 * time.Minute

// poiCache is the singleton LRU-free, TTL-only cache keyed by the SHA256 of
// the rendered Overpass query. It is intentionally simple (a map guarded by
// a RWMutex with TTL entries) instead of a full LRU because:
//   - The existing TTLCache in this package already provides TTL semantics.
//   - POI queries are bounded in cardinality (categories + radius buckets),
//     so unbounded growth is unlikely in practice; a periodic Cleanup keeps
//     it in check.
//   - Using hashicorp/golang-lru here would add a dependency on an external
//     package to the osm package that previously only used stdlib + golang.org/x/time.
var (
	poiCache     *TTLCache[string, []byte]
	poiCacheOnce sync.Once
)

// initPOICache lazily constructs the singleton with the default TTL. Tests and
// callers can reconfigure the TTL via SetPOICacheTTL.
func initPOICache() {
	poiCacheOnce.Do(func() {
		poiCache = NewTTLCache[string, []byte](DefaultPOICacheTTL)
	})
}

// POICacheKey hashes the rendered Overpass query string into a stable key.
// Two queries that render to the same string (which, with the deterministic
// key-ordering in the overpass builder, they will for equivalent inputs)
// share a cache slot — exactly what we want for repeating concurrent asks.
func POICacheKey(query string) string {
	sum := sha256.Sum256([]byte(query))
	return "poi:" + hex.EncodeToString(sum[:])
}

// TryPOICache returns a cached payload for the given key, if present and fresh.
// On miss/expiry it returns nil, false and the caller should perform the
// request normally.
func TryPOICache(key string) ([]byte, bool) {
	initPOICache()
	return poiCache.Get(key)
}

// StorePOI writes a payload to the POI cache under the given key. The cache
// uses whatever TTL was configured at construction (or via SetPOICacheTTL).
func StorePOI(key string, payload []byte) {
	initPOICache()
	poiCache.Set(key, payload)
}

// SetPOICacheTTL reconfigures the singleton POI cache with a new TTL. It
// rebuilds the cache, which means existing entries are dropped; callers that
// need to preserve entries across a reconfiguration are expected to re-issue
// queries. This is mainly used at startup (e.g. from flags) and in tests.
//
// Implementation note: we reset poiCacheOnce and then call Do on it so that
// any subsequent initPOICache() call reuses the new instance instead of
// overwriting it with DefaultPOICacheTTL. Without the explicit Do, the first
// StorePOI/TryPOICache call would re-init with the default TTL, defeating the
// reconfiguration.
func SetPOICacheTTL(ttl time.Duration) {
	poiCacheOnce = sync.Once{}
	poiCacheOnce.Do(func() {
		poiCache = NewTTLCache[string, []byte](ttl)
	})
}

// CleanupPOICache evicts expired entries. Safe to call from a background
// sweeper; harmless if called concurrently with TryPOICache/StorePOI.
func CleanupPOICache() {
	initPOICache()
	poiCache.Cleanup()
}

// POICacheSize returns the current number of entries (including any that are
// expired but not yet evicted). Mainly for observability/tests.
func POICacheSize() int {
	initPOICache()
	return poiCache.Size()
}
