package osm

import (
	"net/http"
	"net/url"
	"os"
	"strings"
)

// DefaultOverpassFallbackURLs are public Overpass mirrors tried, in order, when
// the primary Overpass server fails. LetXinet Suite: the public overpass-api.de
// instance is often overloaded, which made 10 of the 28 OSM tools fail at once.
var DefaultOverpassFallbackURLs = []string{
	"https://overpass.kumi.systems/api/interpreter",
	"https://overpass.private.coffee/api/interpreter",
}

// OverpassFallbackURLsEnv returns the mirror list, honoring the comma-separated
// OVERPASS_FALLBACK_URLS environment variable. Setting it to "none" disables
// the fallback entirely.
func OverpassFallbackURLsEnv() []string {
	raw := strings.TrimSpace(os.Getenv("OVERPASS_FALLBACK_URLS"))
	if strings.EqualFold(raw, "none") {
		return nil
	}
	if raw == "" {
		return DefaultOverpassFallbackURLs
	}
	var urls []string
	for _, u := range strings.Split(raw, ",") {
		if u = strings.TrimSpace(u); u != "" {
			urls = append(urls, strings.TrimRight(u, "/"))
		}
	}
	return urls
}

// overpassFallbackTransport retries requests aimed at the primary Overpass
// server against the mirrors when the primary returns a network error, 429 or
// a 5xx status. Requests to any other host pass through unchanged.
type overpassFallbackTransport struct {
	base http.RoundTripper
}

func (t *overpassFallbackTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	primary, err := url.Parse(OverpassBaseURLEnv())
	if err != nil || req.URL.Host != primary.Host {
		return t.base.RoundTrip(req)
	}

	resp, err := t.base.RoundTrip(req)
	if !overpassShouldRetry(resp, err) {
		return resp, err
	}

	for _, mirror := range OverpassFallbackURLsEnv() {
		m, perr := url.Parse(mirror)
		if perr != nil || m.Host == "" || m.Host == primary.Host {
			continue
		}
		retry, cerr := cloneForMirror(req, m)
		if cerr != nil {
			break
		}
		if resp != nil {
			_ = resp.Body.Close()
		}
		resp, err = t.base.RoundTrip(retry)
		if !overpassShouldRetry(resp, err) {
			return resp, err
		}
	}
	return resp, err
}

func overpassShouldRetry(resp *http.Response, err error) bool {
	if err != nil {
		return true
	}
	return resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500
}

// cloneForMirror copies the request onto the mirror's scheme, host and path,
// keeping the query string (Overpass queries usually travel as ?data=...).
func cloneForMirror(req *http.Request, mirror *url.URL) (*http.Request, error) {
	r := req.Clone(req.Context())
	u := *req.URL
	u.Scheme, u.Host, u.Path, u.RawPath = mirror.Scheme, mirror.Host, mirror.Path, ""
	r.URL = &u
	r.Host = mirror.Host
	if req.Body != nil && req.Body != http.NoBody {
		if req.GetBody == nil {
			return nil, http.ErrBodyNotAllowed
		}
		body, err := req.GetBody()
		if err != nil {
			return nil, err
		}
		r.Body = body
	}
	return r, nil
}
