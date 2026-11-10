package osm

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// DefaultOverpassFallbackURLs are public Overpass mirrors tried, in order, when
// the primary Overpass server fails. LetXinet Suite: the public overpass-api.de
// instance is often overloaded, which made 10 of the 28 OSM tools fail at once.
//
// LetXinet Suite 1.1.6: overpass.openstreetmap.fr goes first. On 10/11/2026 it
// was the only public server that answered from the test network (the other
// three timed out).
var DefaultOverpassFallbackURLs = []string{
	"https://overpass.openstreetmap.fr/api/interpreter",
	"https://overpass.kumi.systems/api/interpreter",
	"https://overpass.private.coffee/api/interpreter",
}

// Per-attempt limits (time until the response headers arrive). LetXinet Suite
// 1.1.6: before, the only limit was the client's 30 s total, and a primary
// server that never answered used all of it, so the mirrors were never tried.
const (
	overpassPrimaryAttempt = 10 * time.Second
	overpassMirrorAttempt  = 25 * time.Second
	overpassStickyFor      = 10 * time.Minute
)

// Last server that answered, so that a dead primary is not retried on every
// call. Forgotten after overpassStickyFor.
var (
	overpassStickyMu    sync.Mutex
	overpassStickyHost  string
	overpassStickyUntil time.Time
	// Set when every server failed: for overpassDownFor the same error is
	// returned without touching the network.
	overpassDownErr   error
	overpassDownUntil time.Time
)

const overpassDownFor = 45 * time.Second

// OverpassMirrorInUse returns the host of the mirror that answered last, or ""
// when requests are going to the primary server.
func OverpassMirrorInUse() string {
	overpassStickyMu.Lock()
	defer overpassStickyMu.Unlock()
	if time.Now().Before(overpassStickyUntil) {
		if primary, err := url.Parse(OverpassBaseURLEnv()); err == nil && primary.Host != overpassStickyHost {
			return overpassStickyHost
		}
	}
	return ""
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
	// The variable replaces the built-in list. LetXinet-Suite.env is kept across
	// upgrades, so the installer (actualizar-config.ps1) rewrites the list of an
	// older version there; otherwise a mirror added later is never reached.
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

// cancelOnClose releases the per-attempt context when the body is closed.
type cancelOnClose struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (c *cancelOnClose) Close() error {
	err := c.ReadCloser.Close()
	c.cancel()
	return err
}

// attempt sends req and gives up if the response headers have not arrived
// within limit. Once they arrive, the body can be read without that limit.
func (t *overpassFallbackTransport) attempt(req *http.Request, limit time.Duration) (*http.Response, error) {
	ctx, cancel := context.WithCancel(req.Context())
	timer := time.AfterFunc(limit, cancel)
	resp, err := t.base.RoundTrip(req.WithContext(ctx))
	timer.Stop()
	if err != nil {
		cancel()
		if req.Context().Err() == nil && ctx.Err() != nil {
			return nil, fmt.Errorf("%s did not answer in %s", req.URL.Host, limit)
		}
		return nil, err
	}
	resp.Body = &cancelOnClose{ReadCloser: resp.Body, cancel: cancel}
	return resp, nil
}

func (t *overpassFallbackTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	primary, err := url.Parse(OverpassBaseURLEnv())
	if err != nil || req.URL.Host != primary.Host {
		return t.base.RoundTrip(req)
	}

	// Candidate servers in order: the one that answered last (if recent), the
	// primary, then the mirrors.
	type server struct {
		u       *url.URL
		primary bool
	}
	servers := []server{{u: primary, primary: true}}
	for _, mirror := range OverpassFallbackURLsEnv() {
		m, perr := url.Parse(mirror)
		if perr != nil || m.Host == "" || m.Host == primary.Host {
			continue
		}
		servers = append(servers, server{u: m})
	}
	overpassStickyMu.Lock()
	sticky := ""
	if time.Now().Before(overpassStickyUntil) {
		sticky = overpassStickyHost
	}
	overpassStickyMu.Unlock()
	if sticky != "" && sticky != primary.Host {
		for i, s := range servers {
			if s.u.Host == sticky {
				servers = append([]server{s}, append(servers[:i:i], servers[i+1:]...)...)
				break
			}
		}
	}

	// If every server failed a moment ago, answer at once instead of spending
	// another minute per retry (the client retries each request 3 times).
	overpassStickyMu.Lock()
	downErr, downUntil := overpassDownErr, overpassDownUntil
	overpassStickyMu.Unlock()
	if downErr != nil && time.Now().Before(downUntil) {
		return nil, downErr
	}

	var resp *http.Response
	var tried []string
	for i, s := range servers {
		attemptReq := req
		if !s.primary {
			clone, cerr := cloneForMirror(req, s.u)
			if cerr != nil {
				break
			}
			attemptReq = clone
		}
		limit := overpassMirrorAttempt
		if s.primary && len(servers) > 1 {
			limit = overpassPrimaryAttempt
		}
		if resp != nil {
			_ = resp.Body.Close()
		}
		resp, err = t.attempt(attemptReq, limit)
		tried = append(tried, s.u.Host)
		if !overpassShouldRetry(resp, err) {
			if i > 0 || sticky != "" {
				overpassStickyMu.Lock()
				overpassStickyHost, overpassStickyUntil = s.u.Host, time.Now().Add(overpassStickyFor)
				overpassStickyMu.Unlock()
			}
			return resp, err
		}
		if req.Context().Err() != nil {
			break
		}
	}
	if err != nil {
		err = fmt.Errorf("Overpass no responde (servidores probados: %s): %w", strings.Join(tried, ", "), err)
		if req.Context().Err() == nil {
			overpassStickyMu.Lock()
			overpassDownErr, overpassDownUntil = err, time.Now().Add(overpassDownFor)
			overpassStickyMu.Unlock()
		}
		return nil, err
	}
	return resp, err
}

func overpassShouldRetry(resp *http.Response, err error) bool {
	if err != nil {
		return true
	}
	return resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusForbidden || resp.StatusCode >= 500
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
