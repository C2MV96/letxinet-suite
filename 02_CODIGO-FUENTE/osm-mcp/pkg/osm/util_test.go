package osm

import (
	"os"
	"strings"
	"testing"
)

func TestValidateCoords(t *testing.T) {
	tests := []struct {
		name    string
		lat     float64
		lon     float64
		wantErr bool
	}{
		{
			name:    "valid coordinates",
			lat:     40.7128,
			lon:     -74.0060,
			wantErr: false,
		},
		{
			name:    "valid coordinates at boundaries",
			lat:     90.0,
			lon:     180.0,
			wantErr: false,
		},
		{
			name:    "valid coordinates at negative boundaries",
			lat:     -90.0,
			lon:     -180.0,
			wantErr: false,
		},
		{
			name:    "invalid latitude too high",
			lat:     91.0,
			lon:     -74.0060,
			wantErr: true,
		},
		{
			name:    "invalid latitude too low",
			lat:     -91.0,
			lon:     -74.0060,
			wantErr: true,
		},
		{
			name:    "invalid longitude too high",
			lat:     40.7128,
			lon:     181.0,
			wantErr: true,
		},
		{
			name:    "invalid longitude too low",
			lat:     40.7128,
			lon:     -181.0,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCoords(tt.lat, tt.lon)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCoords() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestProfileBaseURL_Fallback verifies that when no per-profile env override is
// set, ProfileBaseURL returns the public demo OSRM URL.
func TestProfileBaseURL_Fallback(t *testing.T) {
	if err := os.Unsetenv("OSRM_URL_CAR"); err != nil {
		t.Fatalf("unsetenv: %v", err)
	}
	if got := ProfileBaseURL("car"); got != OSRMBaseURL {
		t.Errorf("ProfileBaseURL(car) without env = %q; want %q", got, OSRMBaseURL)
	}
	if got := ProfileBaseURL("bike"); got != OSRMBaseURL {
		t.Errorf("ProfileBaseURL(bike) without env = %q; want %q", got, OSRMBaseURL)
	}
	if got := ProfileBaseURL("foot"); got != OSRMBaseURL {
		t.Errorf("ProfileBaseURL(foot) without env = %q; want %q", got, OSRMBaseURL)
	}
	if got := ProfileBaseURL("unknown"); got != OSRMBaseURL {
		t.Errorf("ProfileBaseURL(unknown) = %q; want %q (fallback to demo)", got, OSRMBaseURL)
	}
}

// TestProfileBaseURL_EnvOverride verifies that OSRM_URL_CAR/BIKE/FOOT are
// honored, including trailing-slash trimming and case-insensitivity.
func TestProfileBaseURL_EnvOverride(t *testing.T) {
	customs := map[string]string{
		"OSRM_URL_CAR":  "http://osrm car:5000/",
		"OSRM_URL_BIKE": "http://osrm-bike:5001",
		"OSRM_URL_FOOT": "http://osrm-foot:5002/",
	}
	defer func() {
		for k := range customs {
			_ = os.Unsetenv(k)
		}
	}()
	for k, v := range customs {
		if err := os.Setenv(k, v); err != nil {
			t.Fatalf("setenv %s: %v", k, err)
		}
	}

	if got, want := ProfileBaseURL("car"), "http://osrm car:5000"; got != want {
		t.Errorf("ProfileBaseURL(car) = %q; want %q (trailing slash trimmed)", got, want)
	}
	if got, want := ProfileBaseURL("BIKE"), "http://osrm-bike:5001"; got != want {
		t.Errorf("ProfileBaseURL(BIKE) = %q; want %q (case-insensitive)", got, want)
	}
	if got, want := ProfileBaseURL("foot"), "http://osrm-foot:5002"; got != want {
		t.Errorf("ProfileBaseURL(foot) = %q; want %q", got, want)
	}
}

// TestProfileBaseURL_EmptyEnvIgnored verifies that an empty OSRM_URL_* env var
// is treated like unset and falls back to the demo.
func TestProfileBaseURL_EmptyEnvIgnored(t *testing.T) {
	if err := os.Setenv("OSRM_URL_CAR", ""); err != nil {
		t.Fatalf("setenv: %v", err)
	}
	defer func() { _ = os.Unsetenv("OSRM_URL_CAR") }()
	if got := ProfileBaseURL("car"); got != OSRMBaseURL {
		t.Errorf("ProfileBaseURL(car) with empty env = %q; want %q (fallback)", got, OSRMBaseURL)
	}
	_ = strings.TrimSpace // keep import used if strings becomes needed later
}

// TestOverpassBaseURLEnv_Fallback verifies that when OVERPASS_URL is unset,
// the helper returns the public default.
func TestOverpassBaseURLEnv_Fallback(t *testing.T) {
	_ = os.Unsetenv("OVERPASS_URL")
	if got := OverpassBaseURLEnv(); got != OverpassBaseURL {
		t.Errorf("OverpassBaseURLEnv() without env = %q; want %q", got, OverpassBaseURL)
	}
}

// TestOverpassBaseURLEnv_EnvOverride verifies that OVERPASS_URL is honored,
// including trailing-slash trimming.
func TestOverpassBaseURLEnv_EnvOverride(t *testing.T) {
	if err := os.Setenv("OVERPASS_URL", "https://overpass-mirror.local/feed/"); err != nil {
		t.Fatalf("setenv: %v", err)
	}
	defer func() { _ = os.Unsetenv("OVERPASS_URL") }()
	if got, want := OverpassBaseURLEnv(), "https://overpass-mirror.local/feed"; got != want {
		t.Errorf("OverpassBaseURLEnv() = %q; want %q (trailing slash trimmed)", got, want)
	}
}

// TestOverpassBaseURLEnv_EmptyEnvIgnored verifies that an empty OVERPASS_URL
// is treated like unset and falls back to the public default.
func TestOverpassBaseURLEnv_EmptyEnvIgnored(t *testing.T) {
	if err := os.Setenv("OVERPASS_URL", ""); err != nil {
		t.Fatalf("setenv: %v", err)
	}
	defer func() { _ = os.Unsetenv("OVERPASS_URL") }()
	if got := OverpassBaseURLEnv(); got != OverpassBaseURL {
		t.Errorf("OverpassBaseURLEnv() with empty env = %q; want %q (fallback)", got, OverpassBaseURL)
	}
}

// TestNominatimBaseURLEnv_Fallback verifies that when NOMINATIM_URL is unset,
// the helper returns the public default.
func TestNominatimBaseURLEnv_Fallback(t *testing.T) {
	_ = os.Unsetenv("NOMINATIM_URL")
	if got := NominatimBaseURLEnv(); got != NominatimBaseURL {
		t.Errorf("NominatimBaseURLEnv() without env = %q; want %q", got, NominatimBaseURL)
	}
}

// TestNominatimBaseURLEnv_EnvOverride verifies that NOMINATIM_URL is honored,
// including trailing-slash trimming.
func TestNominatimBaseURLEnv_EnvOverride(t *testing.T) {
	if err := os.Setenv("NOMINATIM_URL", "https://nominatim-mirror.local/"); err != nil {
		t.Fatalf("setenv: %v", err)
	}
	defer func() { _ = os.Unsetenv("NOMINATIM_URL") }()
	if got, want := NominatimBaseURLEnv(), "https://nominatim-mirror.local"; got != want {
		t.Errorf("NominatimBaseURLEnv() = %q; want %q (trailing slash trimmed)", got, want)
	}
}

// TestTileProviderURLEnv_Fallback verifies that when TILE_SERVER_URL is unset,
// the helper returns the public default (with {z}/{x}/{y} template).
func TestTileProviderURLEnv_Fallback(t *testing.T) {
	_ = os.Unsetenv("TILE_SERVER_URL")
	got := TileProviderURLEnv()
	if got != DefaultTileProviderURL {
		t.Errorf("TileProviderURLEnv() without env = %q; want %q", got, DefaultTileProviderURL)
	}
	// Verify template placeholders are present (standard Slippy Map convention)
	for _, tok := range []string{"{z}", "{x}", "{y}"} {
		if !strings.Contains(got, tok) {
			t.Errorf("TileProviderURLEnv() = %q; want template containing %q", got, tok)
		}
	}
}

// TestTileProviderURLEnv_EnvOverride verifies that TILE_SERVER_URL is honored
// (trailing slash NOT trimmed — the template is used as-is).
func TestTileProviderURLEnv_EnvOverride(t *testing.T) {
	custom := "https://tiles.example.com/{z}/{x}/{y}.png"
	if err := os.Setenv("TILE_SERVER_URL", custom); err != nil {
		t.Fatalf("setenv: %v", err)
	}
	defer func() { _ = os.Unsetenv("TILE_SERVER_URL") }()
	if got := TileProviderURLEnv(); got != custom {
		t.Errorf("TileProviderURLEnv() = %q; want %q", got, custom)
	}
}
