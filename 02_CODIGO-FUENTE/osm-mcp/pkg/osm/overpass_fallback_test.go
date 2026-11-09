package osm

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestOverpassFallback_UsesMirrorWhenPrimaryFails checks that a 504 from the
// primary server makes the request go to the first mirror, query included.
func TestOverpassFallback_UsesMirrorWhenPrimaryFails(t *testing.T) {
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusGatewayTimeout)
	}))
	defer primary.Close()
	var gotQuery string
	mirror := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query().Get("data")
		_, _ = io.WriteString(w, `{"elements":[]}`)
	}))
	defer mirror.Close()

	t.Setenv("OVERPASS_URL", primary.URL+"/api/interpreter")
	t.Setenv("OVERPASS_FALLBACK_URLS", mirror.URL+"/api/interpreter")

	client := &http.Client{Transport: &overpassFallbackTransport{base: http.DefaultTransport}}
	resp, err := client.Get(primary.URL + "/api/interpreter?data=" + "%5Bout%3Ajson%5D%3B")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK || !strings.Contains(string(body), "elements") {
		t.Fatalf("expected mirror response, got %d %q", resp.StatusCode, body)
	}
	if gotQuery != "[out:json];" {
		t.Fatalf("mirror received query %q", gotQuery)
	}
}

// TestOverpassFallback_OtherHostsUntouched checks that non-Overpass requests
// are not retried.
func TestOverpassFallback_OtherHostsUntouched(t *testing.T) {
	calls := 0
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer other.Close()
	t.Setenv("OVERPASS_URL", "https://overpass.invalid/api/interpreter")
	t.Setenv("OVERPASS_FALLBACK_URLS", other.URL)

	client := &http.Client{Transport: &overpassFallbackTransport{base: http.DefaultTransport}}
	resp, err := client.Get(other.URL)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	resp.Body.Close()
	if calls != 1 || resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected one untouched call, got %d calls and status %d", calls, resp.StatusCode)
	}
}

// TestOverpassFallbackURLsEnv covers the default list, a custom list and "none".
func TestOverpassFallbackURLsEnv(t *testing.T) {
	t.Setenv("OVERPASS_FALLBACK_URLS", "")
	if got := OverpassFallbackURLsEnv(); len(got) != len(DefaultOverpassFallbackURLs) {
		t.Fatalf("default list = %v", got)
	}
	t.Setenv("OVERPASS_FALLBACK_URLS", " https://a.example/api/ , https://b.example ")
	if got := OverpassFallbackURLsEnv(); len(got) != 2 || got[0] != "https://a.example/api" || got[1] != "https://b.example" {
		t.Fatalf("custom list = %v", got)
	}
	t.Setenv("OVERPASS_FALLBACK_URLS", "none")
	if got := OverpassFallbackURLsEnv(); got != nil {
		t.Fatalf("none = %v", got)
	}
}
