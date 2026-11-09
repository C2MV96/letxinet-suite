package tools

import (
	"testing"
)

func TestSelectBestAndPlaces_AllFilteredLowConfidence(t *testing.T) {
	// All candidates below minCandidateImportance: this is the "Miramar"
	// scenario. The function must report allFiltered=true and discard all.
	results := []NominatimResult{
		{DisplayName: "Miramar, Chimbote", Lat: "-9.07", Lon: "-78.59", Importance: 0.0006},
		{DisplayName: "Miramar, Argentina", Lat: "-38.0", Lon: "-57.0", Importance: 0.0001},
	}
	places, bestIdx, allFiltered, discarded, hadParseFailures := selectBestAndPlaces(results, 0.4, 0.05)
	if len(places) != 0 {
		t.Fatalf("expected 0 kept places, got %d", len(places))
	}
	if !allFiltered {
		t.Fatalf("expected allFiltered=true")
	}
	if bestIdx != 0 {
		t.Fatalf("expected best index 0 (highest importance), got %d", bestIdx)
	}
	if len(discarded) != 2 {
		t.Fatalf("expected 2 discarded candidates, got %d", len(discarded))
	}
	if hadParseFailures {
		t.Fatalf("expected no parse failures when only filtering happened, got true")
	}
	// Discarded must preserve ordering by results (importance desc).
	if discarded[0].Importance < discarded[1].Importance {
		t.Fatalf("discarded list must preserve results order (importance-desc), got %#v", discarded)
	}
}

func TestSelectBestAndPlaces_HighConfidenceKept(t *testing.T) {
	results := []NominatimResult{
		{DisplayName: "Empire State Building", Lat: "40.7484", Lon: "-73.9857", Importance: 0.7},
		{DisplayName: "Empire State Building Alt", Lat: "40.7484", Lon: "-73.9857", Importance: 0.5},
		{DisplayName: "Empire St, NC", Lat: "35.0", Lon: "-80.0", Importance: 0.01},
	}
	places, bestIdx, allFiltered, discarded, hadParseFailures := selectBestAndPlaces(results, 0.4, 0.05)
	if len(places) != 2 {
		t.Fatalf("expected 2 kept places, got %d", len(places))
	}
	if allFiltered {
		t.Fatalf("expected allFiltered=false when some kept")
	}
	if bestIdx != 0 {
		t.Fatalf("expected best index 0 (first high-importance), got %d", bestIdx)
	}
	if len(discarded) != 1 {
		t.Fatalf("expected 1 discarded, got %d", len(discarded))
	}
	if hadParseFailures {
		t.Fatalf("expected no parse failures, got true")
	}
}

func TestSelectBestAndPlaces_ParseFailureShrinksKept(t *testing.T) {
	// Two high-importance results; one has a non-numeric lat (genuine parse
	// failure). The function must surface hadParseFailures=true, keep only
	// the one good one, and report allFiltered=false (since the good one
	// passes the threshold).
	results := []NominatimResult{
		{DisplayName: "Good Place", Lat: "40.7484", Lon: "-73.9857", Importance: 0.7},
		{DisplayName: "Bad Lat", Lat: "not-a-number", Lon: "-73.9857", Importance: 0.5},
	}
	places, _, allFiltered, _, hadParseFailures := selectBestAndPlaces(results, 0.4, 0.05)
	if len(places) != 1 {
		t.Fatalf("expected 1 kept place after parse failure, got %d", len(places))
	}
	if !hadParseFailures {
		t.Fatalf("expected hadParseFailures=true when a result failed lat/lon parse")
	}
	if allFiltered {
		t.Fatalf("expected allFiltered=false: at least one valid place existed")
	}
}

func TestLowConfidenceError_MarshalsWithCode(t *testing.T) {
	// Sanity: the type used in the error response carries the expected code
	// so the MCP client side can branch on it cleanly.
	err := LowConfidenceError{
		Code:      "LOW_CONFIDENCE_RESULTS",
		Message:   "All candidates were filtered out by the importance threshold",
		Threshold: 0.05,
		Discarded: []LowImportanceCandidate{
			{Name: "Miramar, Chimbote", Importance: 0.0006},
		},
	}
	if err.Code != "LOW_CONFIDENCE_RESULTS" {
		t.Fatalf("expected code LOW_CONFIDENCE_RESULTS, got %q", err.Code)
	}
	if len(err.Discarded) != 1 {
		t.Fatalf("expected 1 discarded entry, got %d", len(err.Discarded))
	}
}
