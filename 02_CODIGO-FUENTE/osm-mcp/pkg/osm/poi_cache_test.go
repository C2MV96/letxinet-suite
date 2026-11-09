package osm

import (
	"testing"
	"time"
)

func TestPOICacheKeyStable(t *testing.T) {
	q := "[out:json][timeout:25];(node(around:1000.0,1.000000,2.000000)[amenity];);out body;>;out center;"
	k1 := POICacheKey(q)
	k2 := POICacheKey(q)
	if k1 != k2 {
		t.Fatalf("POICacheKey not stable for same query: %s != %s", k1, k2)
	}
	if k1 == "" {
		t.Fatalf("POICacheKey returned empty")
	}
	// Key should carry the namespace prefix so it is distinguishable from
	// other caches that might share a future generic K/V store.
	if len(k1) <= 4 || k1[:4] != "poi:" {
		t.Fatalf("POICacheKey missing 'poi:' prefix: %q", k1)
	}
}

func TestPOICacheKeyDistinguishesQueries(t *testing.T) {
	q1 := "[out:json];node[amenity=restaurant];out body;"
	q2 := "[out:json];node[amenity=cafe];out body;"
	if POICacheKey(q1) == POICacheKey(q2) {
		t.Fatalf("distinct queries produced identical cache keys")
	}
}

func TestPOICacheStoreAndTry(t *testing.T) {
	// Reconfigure with a fresh TTL so this test does not observe entries
	// written by other tests (the singleton is package-global).
	SetPOICacheTTL(1 * time.Second)
	defer SetPOICacheTTL(DefaultPOICacheTTL)

	k := POICacheKey("test-query-store-and-try")
	if _, ok := TryPOICache(k); ok {
		t.Fatalf("unexpected cache hit on fresh key")
	}
	StorePOI(k, []byte("payload"))
	got, ok := TryPOICache(k)
	if !ok {
		t.Fatalf("expected cache hit after StorePOI")
	}
	if string(got) != "payload" {
		t.Fatalf("payload mismatch: got %q want %q", string(got), "payload")
	}
}

func TestPOICacheExpiry(t *testing.T) {
	// 50ms TTL exercises expiry quickly.
	SetPOICacheTTL(50 * time.Millisecond)
	defer SetPOICacheTTL(DefaultPOICacheTTL)

	k := POICacheKey("test-query-expiry")
	StorePOI(k, []byte("short"))
	if _, ok := TryPOICache(k); !ok {
		t.Fatalf("expected hit immediately after store")
	}
	// Wait long enough that even with scheduler/clock jitter the entry is past
	// its expiry. 250ms is ~5x the TTL.
	time.Sleep(250 * time.Millisecond)
	// Force a sweep so the entry is removed even if Get hasn't been called
	// against this key since expiry.
	CleanupPOICache()
	if _, ok := TryPOICache(k); ok {
		t.Fatalf("expected miss after TTL expiry + cleanup")
	}
}

func TestPOICacheCleanup(t *testing.T) {
	SetPOICacheTTL(50 * time.Millisecond)
	defer SetPOICacheTTL(DefaultPOICacheTTL)

	StorePOI(POICacheKey("a"), []byte("a"))
	StorePOI(POICacheKey("b"), []byte("b"))
	size := POICacheSize()
	if size != 2 {
		t.Fatalf("expected size 2 after two stores, got %d", size)
	}
	time.Sleep(250 * time.Millisecond)
	CleanupPOICache()
	if s := POICacheSize(); s != 0 {
		t.Fatalf("expected size 0 after expiry+Cleanup, got %d", s)
	}
}
