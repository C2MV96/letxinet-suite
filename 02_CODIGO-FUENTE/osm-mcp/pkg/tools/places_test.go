package tools

import (
	"strings"
	"testing"
)

// TestBuildFindNearbyPlacesQuery_RestaurantORNotAND is the regression anchor for
// the OR-vs-AND bug that produced
//
//	[amenity=restaurant][amenity=cafe][amenity=fast_food]...
//
// (an impossible AND on the same key) for category="restaurant". With the
// unified builder, a single amenity key with multiple values MUST render as a
// regex OR filter: [amenity~"restaurant|cafe|fast_food|bar|pub|food_court"].
func TestBuildFindNearbyPlacesQuery_RestaurantORNotAND(t *testing.T) {
	tags := mapCategoryToOSMTags("restaurant")
	q := buildFindNearbyPlacesQuery(-9.07, -78.59, 5000, tags)

	if strings.Contains(q, "[amenity=restaurant]") {
		t.Fatalf("query collapsed OR into AND (saw [amenity=restaurant] literal): %s", q)
	}
	if strings.Contains(q, "][amenity=") {
		t.Fatalf("query contains repeated single-value [amenity=...] filters (AND-of-same-key): %s", q)
	}
	want := `[amenity~"restaurant|cafe|fast_food|bar|pub|food_court"]`
	if !strings.Contains(q, want) {
		t.Fatalf("query is missing the expected regex OR filter %q: %s", want, q)
	}
}

func TestBuildFindNearbyPlacesQuery_ParkORNotAND(t *testing.T) {
	tags := mapCategoryToOSMTags("park")
	q := buildFindNearbyPlacesQuery(40.71, -74.0, 1000, tags)

	leisureLiteral := strings.Count(q, "[leisure=")
	if leisureLiteral > 1 {
		t.Fatalf("park query collapsed OR into AND (saw %d [leisure=...] literals): %s", leisureLiteral, q)
	}
	want := `[leisure~"park|garden|playground|nature_reserve"]`
	if !strings.Contains(q, want) {
		t.Fatalf("park query is missing the expected regex OR filter %q: %s", want, q)
	}
}

func TestBuildFindNearbyPlacesQueryAroundSpatial(t *testing.T) {
	tags := mapCategoryToOSMTags("restaurant")
	q := buildFindNearbyPlacesQuery(1.5, 2.5, 1234.0, tags)
	if !strings.Contains(q, "(around:1234.0,1.500000,2.500000)") {
		t.Fatalf("query missing the around spatial filter: %s", q)
	}
}

// TestBuildExploreAreaQueryNoEmptyValueTagsNoLeisureConflict is the regression
// anchor for explore_area: the legacy code emitted
//
//	WithTag("amenity", "") -> [amenity=] (empty literal, matches nothing)
//	WithTag("leisure", "") -> [leisure=]
//	WithTag("leisure","park") -> [leisure=park]   (AND with the empty [leisure=] above)
//
// producing an impossible AND on the same key plus comparisons against the
// empty string. The new query must NOT contain "[amenity=]", "[leisure=]",
// "[shop=]", etc., and must NOT have two [leisure...] filters on the same
// sub-query.
func TestBuildExploreAreaQuery_NoEmptyValueTags(t *testing.T) {
	q := buildExploreAreaQuery(40.71, -74.0, 1000)

	for _, bad := range []string{
		"[amenity=]",
		"[shop=]",
		"[tourism=]",
		"[leisure=]",
		"[natural=]",
		"[place=]",
		"[landuse=]",
	} {
		if strings.Contains(q, bad) {
			t.Fatalf("query contains empty-value filter %q (should be existence-only or removed): %s", bad, q)
		}
	}
}

func TestBuildExploreAreaQuery_LeisureNotDuplicatedWithinOneElement(t *testing.T) {
	q := buildExploreAreaQuery(40.71, -74.0, 1000)

	// Split into sub-queries by ";" and verify no single sub-query has two
	// [leisure...] (which would be an impossible AND on the same key).
	subs := strings.Split(q, ";")
	for i, s := range subs {
		if strings.Count(s, "[leisure") > 1 {
			t.Fatalf("sub-query %d has multiple [leisure...] filters (AND on same key): %q\nfull: %s", i, s, q)
		}
		if strings.Count(s, "[landuse") > 1 {
			t.Fatalf("sub-query %d has multiple [landuse...] filters (AND on same key): %q\nfull: %s", i, s, q)
		}
	}
}

func TestBuildExploreAreaQuery_ExistenceAndValueFiltersPresent(t *testing.T) {
	q := buildExploreAreaQuery(40.71, -74.0, 1000)

	for _, want := range []string{"[amenity]", "[shop]", "[tourism]", "[leisure]", "[natural]", "[place]", "[leisure=park]", "[landuse=park]"} {
		if !strings.Contains(q, want) {
			t.Fatalf("explore query is missing expected filter %q: %s", want, q)
		}
	}
}

func TestBuildExploreAreaQuery_AroundSpatial(t *testing.T) {
	q := buildExploreAreaQuery(1.5, 2.5, 2500.0)
	if !strings.Contains(q, "(around:2500.0,1.500000,2.500000)") {
		t.Fatalf("explore query missing the around spatial filter: %s", q)
	}
}

// TestBuildSearchCategoryQuery_RestaurantORNotAND is the regression anchor for
// the OR-vs-AND bug in HandleSearchCategory. The legacy code built the query
// by hand with strings.Builder and a nested loop that appended one "[k=v]" per
// value, producing an impossible AND on the same key. The new builder collapses
// multiple values into a single regex OR and renders a deterministic string.
func TestBuildSearchCategoryQuery_RestaurantORNotAND(t *testing.T) {
	tags := mapCategoryToOSMTags("restaurant")
	q := buildSearchCategoryQuery(40.7, -74.0, 40.8, -73.9, tags)

	if strings.Contains(q, "[amenity=restaurant]") {
		t.Fatalf("query collapsed OR into AND (saw [amenity=restaurant] literal): %s", q)
	}
	if strings.Contains(q, "][amenity=") {
		t.Fatalf("query contains repeated single-value [amenity=...] filters (AND-of-same-key): %s", q)
	}
	want := `[amenity~"restaurant|cafe|fast_food|bar|pub|food_court"]`
	if !strings.Contains(q, want) {
		t.Fatalf("query is missing the expected regex OR filter %q: %s", want, q)
	}
}

func TestBuildSearchCategoryQuery_BBoxSpatial(t *testing.T) {
	q := buildSearchCategoryQuery(40.7, -74.0, 40.8, -73.9, mapCategoryToOSMTags("restaurant"))
	want := "(40.700000,-74.000000,40.800000,-73.900000)"
	if !strings.Contains(q, want) {
		t.Fatalf("search_category query missing bbox spatial filter %q: %s", want, q)
	}
}

func TestBuildSearchCategoryQuery_Deterministic(t *testing.T) {
	tags := mapCategoryToOSMTags("park")
	q1 := buildSearchCategoryQuery(1, 2, 3, 4, tags)
	q2 := buildSearchCategoryQuery(1, 2, 3, 4, tags)
	if q1 != q2 {
		t.Fatalf("search_category query is non-deterministic:\nq1=%s\nq2=%s", q1, q2)
	}
}

// TestBuildFindNearbyPlacesQuery_CafeKeysAreOR_notAND is the regression anchor
// for the inter-key AND bug: cafe maps to {amenity: [cafe, ice_cream],
// shop: [coffee, tea]} — two distinct keys. The previous code passed all keys
// to a single AddAll, which ANDs them inside each sub-query, producing
// [amenity~"cafe|ice_cream"][shop~"coffee|tea"] — an impossible AND since no
// OSM element has both amenity=cafe AND shop=coffee. The fix emits one AddAll
// per key so the union block ORs them. This test asserts that no single
// sub-query (delimited by ";") contains both an [amenity...] and a [shop...]
// filter.
func TestBuildFindNearbyPlacesQuery_CafeKeysAreOR_notAND(t *testing.T) {
	tags := mapCategoryToOSMTags("cafe")
	q := buildFindNearbyPlacesQuery(40.71, -74.0, 1000, tags)

	subs := strings.Split(q, ";")
	for i, s := range subs {
		hasAmenity := strings.Contains(s, "[amenity")
		hasShop := strings.Contains(s, "[shop")
		if hasAmenity && hasShop {
			t.Fatalf("sub-query %d ANDs amenity+shop (inter-key AND): %q\nfull: %s", i, s, q)
		}
	}

	if !strings.Contains(q, `[amenity~"cafe|ice_cream"]`) {
		t.Fatalf("cafe query missing [amenity~\"cafe|ice_cream\"]: %s", q)
	}
	if !strings.Contains(q, `[shop~"coffee|tea"]`) {
		t.Fatalf("cafe query missing [shop~\"coffee|tea\"]: %s", q)
	}
}

// TestBuildFindNearbyPlacesQuery_ParkKeysAreOR_notAND checks the 3-key case:
// park maps to {leisure, landuse, natural} — three distinct keys that must be
// OR'd across sub-queries, never AND'd within one.
func TestBuildFindNearbyPlacesQuery_ParkKeysAreOR_notAND(t *testing.T) {
	tags := mapCategoryToOSMTags("park")
	q := buildFindNearbyPlacesQuery(40.71, -74.0, 1000, tags)

	subs := strings.Split(q, ";")
	for i, s := range subs {
		count := 0
		for _, key := range []string{"[leisure", "[landuse", "[natural"} {
			if strings.Contains(s, key) {
				count++
			}
		}
		if count > 1 {
			t.Fatalf("sub-query %d ANDs %d distinct keys (inter-key AND): %q\nfull: %s", i, count, s, q)
		}
	}

	if !strings.Contains(q, `[leisure~"park|garden|playground|nature_reserve"]`) {
		t.Fatalf("park query missing [leisure~\"...\"]: %s", q)
	}
}

// TestBuildSearchCategoryQuery_CafeKeysAreOR_notAND mirrors the above for the
// search_category variant which uses a BBox spatial filter instead of around.
func TestBuildSearchCategoryQuery_CafeKeysAreOR_notAND(t *testing.T) {
	tags := mapCategoryToOSMTags("cafe")
	q := buildSearchCategoryQuery(40.7, -74.0, 40.8, -73.9, tags)

	subs := strings.Split(q, ";")
	for i, s := range subs {
		hasAmenity := strings.Contains(s, "[amenity")
		hasShop := strings.Contains(s, "[shop")
		if hasAmenity && hasShop {
			t.Fatalf("sub-query %d ANDs amenity+shop (inter-key AND): %q\nfull: %s", i, s, q)
		}
	}

	if !strings.Contains(q, `[amenity~"cafe|ice_cream"]`) {
		t.Fatalf("cafe search query missing [amenity~\"cafe|ice_cream\"]: %s", q)
	}
	if !strings.Contains(q, `[shop~"coffee|tea"]`) {
		t.Fatalf("cafe search query missing [shop~\"coffee|tea\"]: %s", q)
	}
}

// TestBuildFindNearbyPlacesQuery_HasOutCenter verifies that the query uses
// "out center;" (not "out body;") so ways/relations resolve coordinates via
// the recursive ">;out center;" tail. Without this, parks mapped as ways
// return lat=0,lon=0 and get silently skipped or misplaced. This is the
// regression anchor for the ways/relations coordinate bug.
func TestBuildFindNearbyPlacesQuery_HasOutCenter(t *testing.T) {
	tags := mapCategoryToOSMTags("park")
	q := buildFindNearbyPlacesQuery(40.71, -74.0, 1000, tags)

	if !strings.Contains(q, "out center") {
		t.Fatalf("find_nearby query must use 'out center' so ways/relations get coordinates, got: %s", q)
	}
	if strings.Contains(q, "out body;") {
		t.Fatalf("find_nearby query must NOT use 'out body;' (ways have no coords), got: %s", q)
	}
}
