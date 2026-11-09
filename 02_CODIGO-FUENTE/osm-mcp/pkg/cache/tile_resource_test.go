// Package cache provides caching mechanisms for API responses
package cache

import (
	"context"
	"log/slog"
	"testing"
	"time"
)

func TestTileResourceManager(t *testing.T) {
	logger := slog.Default()
	trm := NewTileResourceManager(logger)

	// Test basic resource creation
	t.Run("GetTileResource", func(t *testing.T) {
		resource, err := trm.GetTileResource(context.Background(), 100, 200, 10)
		if err != nil {
			t.Fatalf("failed to get tile resource: %v", err)
		}

		if resource.URI != "osm://tile/10/100/200" {
			t.Errorf("expected URI 'osm://tile/10/100/200', got %s", resource.URI)
		}

		if resource.Metadata.X != 100 || resource.Metadata.Y != 200 || resource.Metadata.Zoom != 10 {
			t.Errorf("metadata coordinates mismatch: got x=%d, y=%d, zoom=%d",
				resource.Metadata.X, resource.Metadata.Y, resource.Metadata.Zoom)
		}
	})

	// Test coordinate validation
	t.Run("InvalidCoordinates", func(t *testing.T) {
		// Invalid zoom
		_, err := trm.GetTileResource(context.Background(), 0, 0, 25)
		if err == nil {
			t.Error("expected error for invalid zoom level")
		}

		// Invalid coordinates for zoom level
		_, err = trm.GetTileResource(context.Background(), 1000, 1000, 5)
		if err == nil {
			t.Error("expected error for invalid coordinates")
		}
	})

	// Test setting tile data
	t.Run("SetTileData", func(t *testing.T) {
		uri := "osm://tile/5/10/15"
		testData := []byte("test image data")

		err := trm.SetTileData(uri, testData)
		if err != nil {
			t.Fatalf("failed to set tile data: %v", err)
		}

		// Verify data was set
		result, err := trm.ReadTileResource(context.Background(), uri)
		if err != nil {
			t.Fatalf("failed to read tile resource: %v", err)
		}

		// Should have metadata and blob content
		if len(result.Contents) != 2 {
			t.Errorf("expected 2 contents, got %d", len(result.Contents))
		}
	})

	// Test listing resources
	t.Run("ListTileResources", func(t *testing.T) {
		// Add a few more tiles
		_ = trm.SetTileData("osm://tile/1/0/0", []byte("tile1"))
		_ = trm.SetTileData("osm://tile/2/1/1", []byte("tile2"))

		resources := trm.ListTileResources()
		if len(resources) < 2 {
			t.Errorf("expected at least 2 resources, got %d", len(resources))
		}

		// Check that resources have correct properties
		for _, resource := range resources {
			if resource.URI == "" {
				t.Error("resource URI should not be empty")
			}
			if resource.Name == "" {
				t.Error("resource name should not be empty")
			}
		}
	})

	// Test cache stats
	t.Run("GetCacheStats", func(t *testing.T) {
		stats := trm.GetCacheStats()

		cachedTiles, ok := stats["cached_tiles"].(int)
		if !ok {
			t.Error("cached_tiles should be an integer")
		}

		if cachedTiles <= 0 {
			t.Error("should have some cached tiles")
		}

		maxTiles, ok := stats["max_tiles"].(int)
		if !ok || maxTiles != MaxCachedTiles {
			t.Errorf("max_tiles should be %d, got %v", MaxCachedTiles, maxTiles)
		}
	})
}

func TestTileURIParsing(t *testing.T) {
	tests := []struct {
		uri          string
		expectedX    int
		expectedY    int
		expectedZoom int
		shouldError  bool
	}{
		{"osm://tile/10/100/200", 100, 200, 10, false},
		{"osm://tile/0/0/0", 0, 0, 0, false},
		{"osm://tile/19/524287/524287", 524287, 524287, 19, false},
		{"invalid://scheme/1/2/3", 0, 0, 0, true},
		{"osm://wrong/1/2/3", 0, 0, 0, true},
		{"osm://tile/not/numbers/here", 0, 0, 0, true},
		{"osm://tile/1/2", 0, 0, 0, true},
	}

	for _, test := range tests {
		t.Run(test.uri, func(t *testing.T) {
			x, y, zoom, err := parseTileURI(test.uri)

			if test.shouldError {
				if err == nil {
					t.Errorf("expected error for URI %s", test.uri)
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error for URI %s: %v", test.uri, err)
				return
			}

			if x != test.expectedX || y != test.expectedY || zoom != test.expectedZoom {
				t.Errorf("parsing mismatch for %s: got (%d,%d,%d), expected (%d,%d,%d)",
					test.uri, x, y, zoom, test.expectedX, test.expectedY, test.expectedZoom)
			}
		})
	}
}

func TestTileMetadataCalculation(t *testing.T) {
	logger := slog.Default()
	trm := NewTileResourceManager(logger)

	// Test known tile coordinates
	metadata := trm.createTileMetadata(0, 0, 0)

	// At zoom 0, tile (0,0) should cover the entire world
	if metadata.Zoom != 0 || metadata.X != 0 || metadata.Y != 0 {
		t.Errorf("zoom 0 metadata mismatch: got zoom=%d, x=%d, y=%d",
			metadata.Zoom, metadata.X, metadata.Y)
	}

	// Bounds should be roughly the world
	if metadata.WestLon >= metadata.EastLon {
		t.Error("west longitude should be less than east longitude")
	}

	if metadata.SouthLat >= metadata.NorthLat {
		t.Error("south latitude should be less than north latitude")
	}

	// Pixel size should be reasonable
	if metadata.PixelSize <= 0 {
		t.Error("pixel size should be positive")
	}
}

func TestCacheExpiration(t *testing.T) {
	logger := slog.Default()

	// Create a cache with very short TTL for testing
	shortTTL := 10 * time.Millisecond
	trm := &TileResourceManager{
		cache:  NewTTLCache(shortTTL, time.Millisecond, 100),
		logger: logger.With("component", "tile_resource_manager"),
	}

	// Add a resource
	uri := "osm://tile/1/0/0"
	err := trm.SetTileData(uri, []byte("test"))
	if err != nil {
		t.Fatalf("failed to set tile data: %v", err)
	}

	// Should be available immediately
	resources := trm.ListTileResources()
	if len(resources) == 0 {
		t.Error("resource should be available immediately")
	}

	// Wait for expiration
	time.Sleep(20 * time.Millisecond)

	// Should be expired now
	resources = trm.ListTileResources()
	if len(resources) > 0 {
		t.Error("resource should be expired")
	}
}

// TestCacheStats_HitMissCounters valida los nuevos campos de estadística
// hit/miss + por-zoom (Phase 3 Éxito 3.23).
func TestCacheStats_HitMissCounters(t *testing.T) {
	logger := slog.Default()
	trm := NewTileResourceManager(logger)

	// 1er GetTileResource(zoom=10) → miss (crea recurso, no cacheado).
	_, _ = trm.GetTileResource(context.Background(), 100, 100, 10)
	// 2do GetTileResource(zoom=10) → hit (ya cacheado).
	_, _ = trm.GetTileResource(context.Background(), 100, 100, 10)
	// 1er GetTileResource(zoom=12) → miss.
	_, _ = trm.GetTileResource(context.Background(), 200, 200, 12)

	stats := trm.GetCacheStats()

	hits, ok := stats["hits_total"].(int64)
	if !ok {
		t.Fatalf("hits_total should be int64, got %T (%v)", stats["hits_total"], stats["hits_total"])
	}
	if hits != 1 {
		t.Errorf("hits_total = %d, want 1", hits)
	}

	misses, ok := stats["misses_total"].(int64)
	if !ok {
		t.Fatalf("misses_total should be int64, got %T (%v)", stats["misses_total"], stats["misses_total"])
	}
	if misses != 2 {
		t.Errorf("misses_total = %d, want 2", misses)
	}

	ratio, ok := stats["hit_ratio"].(float64)
	if !ok {
		t.Fatalf("hit_ratio should be float64, got %T (%v)", stats["hit_ratio"], stats["hit_ratio"])
	}
	if ratio < 0.32 || ratio > 0.34 { // 1/3 ≈ 0.333…
		t.Errorf("hit_ratio = %f, want ~0.333", ratio)
	}

	byZoom, ok := stats["by_zoom"].(map[string]map[string]int64)
	if !ok {
		t.Fatalf("by_zoom should be map[string]map[string]int64, got %T (%v)", stats["by_zoom"], stats["by_zoom"])
	}
	z10, ok := byZoom["z10"]
	if !ok {
		t.Fatalf("by_zoom should have z10 entry, got: %v", byZoom)
	}
	if z10["hit"] != 1 || z10["miss"] != 1 {
		t.Errorf("z10 hit/miss = %d/%d, want 1/1", z10["hit"], z10["miss"])
	}
	z12, ok := byZoom["z12"]
	if !ok {
		t.Fatalf("by_zoom should have z12 entry, got: %v", byZoom)
	}
	if z12["hit"] != 0 || z12["miss"] != 1 {
		t.Errorf("z12 hit/miss = %d/%d, want 0/1", z12["hit"], z12["miss"])
	}
}

// TestCacheStats_HitRatioZeroOnEmpty valida edge case: sin actividad previa,
// hit_ratio = 0 (no NaN ni DivByZero panic).
func TestCacheStats_HitRatioZeroOnEmpty(t *testing.T) {
	logger := slog.Default()
	trm := NewTileResourceManager(logger)
	stats := trm.GetCacheStats()

	hits, _ := stats["hits_total"].(int64)
	misses, _ := stats["misses_total"].(int64)
	ratio, _ := stats["hit_ratio"].(float64)
	if hits != 0 || misses != 0 {
		t.Errorf("fresh trm: expected 0/0, got %d/%d", hits, misses)
	}
	if ratio != 0.0 {
		t.Errorf("fresh trm hit_ratio = %f, want 0.0", ratio)
	}
}
