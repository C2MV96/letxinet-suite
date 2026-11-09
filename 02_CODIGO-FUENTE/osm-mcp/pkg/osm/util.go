// Package osm provides utilities for working with OpenStreetMap data.
package osm

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/NERVsystems/osmmcp/pkg/geo"
)

const (
	// API endpoints — public defaults. Override at runtime via the
	// *BaseURLEnv() helpers (OverpassBaseURLEnv, NominatimBaseURLEnv,
	// TileProviderURLEnv, ProfileBaseURL) which read environment variables
	// so operators can point at self-hosted mirrors without patching source.
	NominatimBaseURL = "https://nominatim.openstreetmap.org"
	OverpassBaseURL  = "https://overpass-api.de/api/interpreter"
	OSRMBaseURL      = "https://router.project-osrm.org"

	// User agent for API requests (required by Nominatim's usage policy)
	// LetXinet Suite: operators may override via OSM_USER_AGENT env (e.g. to
	// include a real contact email per Nominatim's policy). Falls back to the
	// built-in default when the env var is empty.
	UserAgent = "osm-mcp-server/0.1.0"

	// Earth radius in meters (approximate) - re-exported from geo package
	EarthRadius = geo.EarthRadius
)

// UserAgentEnv returns the User-Agent string to use for outbound OSM API
// requests. Operators can override the default via the OSM_USER_AGENT
// environment variable so each deployment can declare a real contact (Nominatim
// policy requires a valid contact email or app identifier in the UA).
func UserAgentEnv() string {
	if ua := os.Getenv("OSM_USER_AGENT"); ua != "" {
		return strings.TrimSpace(ua)
	}
	return UserAgent
}

// ProfileBaseURL returns the OSRM base URL to use for a given profile name
// (car, bike, foot). Operators may override the URL per profile by setting the
// OSRM_URL_CAR, OSRM_URL_BIKE or OSRM_URL_FOOT environment variables, which
// allows routing requests to be sent to self-hosted multi-profile OSRM
// instances instead of the public demo server (which only exposes a car graph
// and silently ignores any other profile segment). When the environment
// variable for the given profile is empty, ProfileBaseURL falls back to
// OSRMBaseURL (the public demo). Unknown profiles also fall back to the demo.
func ProfileBaseURL(profile string) string {
	switch strings.ToLower(strings.TrimSpace(profile)) {
	case "car":
		if u := os.Getenv("OSRM_URL_CAR"); u != "" {
			return strings.TrimRight(u, "/")
		}
	case "bike":
		if u := os.Getenv("OSRM_URL_BIKE"); u != "" {
			return strings.TrimRight(u, "/")
		}
	case "foot":
		if u := os.Getenv("OSRM_URL_FOOT"); u != "" {
			return strings.TrimRight(u, "/")
		}
	}
	return OSRMBaseURL
}

// OverpassBaseURLEnv returns the Overpass API endpoint to use, honoring the
// OVERPASS_URL environment variable so operators can point at a self-hosted
// Overpass mirror (e.g. for higher rate limits or lower latency in their
// region). When the env var is empty or unset, falls back to the public
// Overpass instance (OverpassBaseURL).
func OverpassBaseURLEnv() string {
	if u := os.Getenv("OVERPASS_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return OverpassBaseURL
}

// NominatimBaseURLEnv returns the Nominatim API endpoint to use, honoring the
// NOMINATIM_URL environment variable so operators can point at a self-hosted
// Nominatim mirror (e.g. for higher rate limits or a regional cache). When the
// env var is empty or unset, falls back to the public Nominatim instance.
func NominatimBaseURLEnv() string {
	if u := os.Getenv("NOMINATIM_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return NominatimBaseURL
}

// TileProviderURLEnv returns the tile server base URL to use for map image
// rendering, honoring the TILE_SERVER_URL environment variable so operators
// can point at a self-hosted tile server or a regional CDN. When the env var
// is empty or unset, falls back to the public OSM tile CDN.
//
// The returned URL MUST be a template containing {z}/{x}/{y} placeholders
// (standard Slippy Map convention). Example:
//
//	TILE_SERVER_URL=https://tiles.example.com/{z}/{x}/{y}.png
func TileProviderURLEnv() string {
	if u := os.Getenv("TILE_SERVER_URL"); u != "" {
		return u
	}
	return DefaultTileProviderURL
}

// DefaultTileProviderURL is the public OSM tile CDN template used when no
// TILE_SERVER_URL env var is set. It follows the standard {z}/{x}/{y}
// Slippy Map convention.
const DefaultTileProviderURL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

// NewClient returns an HTTP client configured for OSM API requests
// Deprecated: Use GetClient(ctx) instead for connection pooling
func NewClient() *http.Client {
	return &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        10,
			MaxIdleConnsPerHost: 10,
			MaxConnsPerHost:     10,
			IdleConnTimeout:     30 * time.Second,
		},
	}
}

// HaversineDistance calculates the great-circle distance between two points
// Deprecated: Use geo.HaversineDistance instead
func HaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	return geo.HaversineDistance(lat1, lon1, lat2, lon2)
}

// NewBoundingBox creates a new empty bounding box
// Deprecated: Use geo.NewBoundingBox instead
func NewBoundingBox() *geo.BoundingBox {
	return geo.NewBoundingBox()
}

// ValidateCoords validates latitude and longitude values
// Returns an error if the coordinates are invalid
func ValidateCoords(lat, lon float64) error {
	if lat < -90 || lat > 90 {
		return fmt.Errorf("invalid latitude: %f (must be between -90 and 90)", lat)
	}
	if lon < -180 || lon > 180 {
		return fmt.Errorf("invalid longitude: %f (must be between -180 and 180)", lon)
	}
	return nil
}
