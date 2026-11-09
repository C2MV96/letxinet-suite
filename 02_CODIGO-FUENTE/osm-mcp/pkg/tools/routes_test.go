package tools

import (
	"math"
	"os"
	"strings"
	"testing"
)

func TestSphericalCentroid_AntimeridianWrap(t *testing.T) {
	// Two participants at the same latitude on opposite sides of the
	// antimeridian. The naive arithmetic mean would produce longitude 0
	// (middle of the Atlantic, opposite side of the planet).
	// sphericalCentroid must return ~180 so the search center is correctly
	// between them.
	locs := []participantLocation{
		{Latitude: 0, Longitude: -179.5},
		{Latitude: 0, Longitude: 179.5},
	}
	lat, lon := sphericalCentroid(locs)
	if math.Abs(lat) > 1e-9 {
		t.Fatalf("expected latitude ~0 for symmetric equatorial pair, got %f", lat)
	}
	// longitude should be ~180 (or ~-180). atan2(0, -cos) returns pi which is
	// 180 degrees.
	if d := math.Abs(math.Abs(lon) - 180.0); d > 1e-6 {
		t.Fatalf("expected longitude ~180 for antimeridian pair, got %f (deviation %f)", lon, d)
	}
}

func TestSphericalCentroid_SimpleMeanWhenNoWrap(t *testing.T) {
	// When longitudes are clustered well away from the antimeridian, the
	// spherical centroid should approximate the arithmetic mean.
	locs := []participantLocation{
		{Latitude: 40.0, Longitude: -74.0},
		{Latitude: 40.0, Longitude: -74.0},
		{Latitude: 40.0, Longitude: -74.0},
	}
	lat, lon := sphericalCentroid(locs)
	if math.Abs(lat-40.0) > 1e-9 {
		t.Fatalf("expected latitude 40.0, got %f", lat)
	}
	if math.Abs(lon-(-74.0)) > 1e-9 {
		t.Fatalf("expected longitude -74.0, got %f", lon)
	}
}

func TestSphericalCentroid_AntimeridianThreePoints(t *testing.T) {
	// Three points: -179, +179, +180. Their arithmetic mean (-179+179+180)/3
	// = 60, which is wrong (should be ~180). sphericalCentroid must yield ~180.
	locs := []participantLocation{
		{Latitude: 1.0, Longitude: -179.0},
		{Latitude: 1.0, Longitude: 179.0},
		{Latitude: 1.0, Longitude: 180.0},
	}
	_, lon := sphericalCentroid(locs)
	if d := math.Abs(math.Abs(lon) - 180.0); d > 1e-6 {
		t.Fatalf("expected longitude ~180 for three-point antimeridian cluster, got %f (deviation %f)", lon, d)
	}
}

func TestSphericalCentroid_Empty(t *testing.T) {
	lat, lon := sphericalCentroid(nil)
	if lat != 0 || lon != 0 {
		t.Fatalf("expected (0,0) for empty input, got (%f, %f)", lat, lon)
	}
}

func TestSphericalCentroid_AntipodalPoleFallback(t *testing.T) {
	// North + south pole contributions cancel X/Y. The fallback arithmetic
	// mean of longitudes should apply (atan2(0,0) would otherwise be NaN).
	locs := []participantLocation{
		{Latitude: 90.0, Longitude: 10.0},
		{Latitude: -90.0, Longitude: 20.0},
	}
	lat, lon := sphericalCentroid(locs)
	if math.IsNaN(lat) || math.IsNaN(lon) {
		t.Fatalf("got NaN for antipodal-pole case: lat=%f lon=%f", lat, lon)
	}
	// Arithmetic mean of longitudes is (10+20)/2 = 15.
	if math.Abs(lon-15.0) > 1e-9 {
		t.Fatalf("expected longitude 15 from fallback mean, got %f", lon)
	}
}

// TestMapModeToProfile_AllSpellings checks that the unified helper recognizes
// every mode alias used across the routing tools. The previous code only
// handled bike/bicycle/foot/walk/walking and defaulted everything else
// (including "cycling", "driving", "drive") to "car", which silently turned
// analyze_commute's default ["car","cycling","walking"] into ["car","car","foot"].
func TestMapModeToProfile_AllSpellings(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"car", "car"},
		{"driving", "car"},
		{"drive", "car"},
		{"DRIVING", "car"}, // case-insensitive
		{" bike ", "bike"}, // whitespace trimmed
		{"bike", "bike"},
		{"bicycle", "bike"},
		{"cycling", "bike"},
		{"foot", "foot"},
		{"walk", "foot"},
		{"walking", "foot"},
		{"", "car"},           // empty -> default
		{"unknown", "car"},    // unknown -> default
		{"transit", "car"},    // not a real OSRM profile
	}
	for _, c := range cases {
		got := mapModeToProfile(c.in)
		if got != c.want {
			t.Errorf("mapModeToProfile(%q) = %q; want %q", c.in, got, c.want)
		}
	}
}

// TestGetRouteDirections_NoHardcodedBaseURL is a source-level regression test.
// HandleGetRouteDirections must NOT set options.BaseURL to osm.OSRMBaseURL
// because that bypasses osm.ProfileBaseURL(profile) which respects
// OSRM_URL_CAR/BIKE/FOOT env overrides. Leaving BaseURL empty lets
// core.GetRoute fall through to ProfileBaseURL so foot/bike can hit a
// different self-hosted server than car.
func TestGetRouteDirections_NoHardcodedBaseURL(t *testing.T) {
	source, err := os.ReadFile("routes.go")
	if err != nil {
		t.Skipf("cannot read source: %v", err)
	}
	src := string(source)

	// Find the HandleGetRouteDirections function body and check that
	// the OSRMOptions literal does not hardcode BaseURL.
	funcStart := strings.Index(src, "func HandleGetRouteDirections")
	if funcStart < 0 {
		t.Fatalf("HandleGetRouteDirections not found in routes.go")
	}
	funcBody := src[funcStart:]

	if strings.Contains(funcBody, "BaseURL:") && strings.Contains(funcBody, "osm.OSRMBaseURL") {
		t.Fatalf("HandleGetRouteDirections hardcodes BaseURL: osm.OSRMBaseURL, which bypasses ProfileBaseURL. Remove the BaseURL field so core.GetRoute uses ProfileBaseURL(profile).")
	}
}
