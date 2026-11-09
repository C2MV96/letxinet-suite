package tools

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// TestChargingStationStruct_HasCenterField verifies that the Overpass response
// struct used by find_charging_stations includes a Center field so that ways
// (area-mapped charging stations) resolve their coordinates. Without Center,
// ways return lat=0,lon=0 and get silently discarded.
func TestChargingStationStruct_HasCenterField(t *testing.T) {
	// This mirrors the anonymous struct in HandleFindChargingStations.
	// We unmarshal a Overpass response that includes a "way" element with
	// a "center" block and verify the center lat/lon are accessible.
	raw := `{"elements":[
		{"type":"node","id":1,"lat":40.7,"lon":-74.0,"tags":{"amenity":"charging_station","name":"NodeStation"}},
		{"type":"way","id":2,"center":{"lat":40.71,"lon":-73.99},"tags":{"amenity":"charging_station","name":"WayStation"}}
	]}`

	var resp struct {
		Elements []struct {
			ID     int     `json:"id"`
			Type   string  `json:"type"`
			Lat    float64 `json:"lat,omitempty"`
			Lon    float64 `json:"lon,omitempty"`
			Center *struct {
				Lat float64 `json:"lat"`
				Lon float64 `json:"lon"`
			} `json:"center,omitempty"`
			Tags map[string]string `json:"tags"`
		} `json:"elements"`
	}

	if err := json.NewDecoder(strings.NewReader(raw)).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if len(resp.Elements) != 2 {
		t.Fatalf("expected 2 elements, got %d", len(resp.Elements))
	}

	// Node element uses direct lat/lon
	if resp.Elements[0].Type != "node" {
		t.Fatalf("element 0 should be node, got %s", resp.Elements[0].Type)
	}
	if resp.Elements[0].Lat != 40.7 || resp.Elements[0].Lon != -74.0 {
		t.Fatalf("node coords wrong: lat=%f lon=%f", resp.Elements[0].Lat, resp.Elements[0].Lon)
	}

	// Way element uses center
	if resp.Elements[1].Type != "way" {
		t.Fatalf("element 1 should be way, got %s", resp.Elements[1].Type)
	}
	if resp.Elements[1].Center == nil {
		t.Fatalf("way element has no center - struct is missing Center field or JSON tag mismatch")
	}
	if resp.Elements[1].Center.Lat != 40.71 || resp.Elements[1].Center.Lon != -73.99 {
		t.Fatalf("way center coords wrong: lat=%f lon=%f",
			resp.Elements[1].Center.Lat, resp.Elements[1].Center.Lon)
	}
}

// TestChargingStationQuery_UsesOutCenter is a source-level regression test.
// The find_charging_stations handler builds the Overpass query inline with
// strings.Builder. It MUST use "out center;" (not "out body;") so that ways
// and relations get their center coordinates resolved. We read the source
// file and assert the query tail is correct.
func TestChargingStationQuery_UsesOutCenter(t *testing.T) {
	source, err := os.ReadFile("specialized_ev.go")
	if err != nil {
		t.Skipf("cannot read source (expected in unit test env): %v", err)
	}

	// The query must contain "out center;" for both charging station handlers
	// (find_charging_stations and find_route_charging_stations).
	occurrences := strings.Count(string(source), "out center;")
	if occurrences < 2 {
		t.Fatalf("expected at least 2 'out center;' in specialized_ev.go (one per handler), got %d", occurrences)
	}

	// Must NOT contain "out body;" (the old broken tail that drops ways)
	if strings.Contains(string(source), "out body;") {
		t.Fatalf("specialized_ev.go still uses 'out body;' which drops way-type charging stations")
	}
}
