// Package osm provides utilities for working with OpenStreetMap data.
package osm

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/time/rate"

	"github.com/NERVsystems/osmmcp/pkg/tracing"
)

const (
	// DefaultUserAgent is the default User-Agent string
	DefaultUserAgent = "OSMMCP/0.1.0"
)

var (
	// Global HTTP client with connection pooling
	httpClient *http.Client

	// User agent string
	userAgent     string
	userAgentLock sync.RWMutex
)

// init initializes the global HTTP client and rate limiters
func init() {
	// Initialize HTTP client with connection pooling. Overpass requests fall back
	// to mirror servers when the primary one fails (see overpass_fallback.go).
	httpClient = &http.Client{
		Transport: &overpassFallbackTransport{base: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		}},
		Timeout: 30 * time.Second,
	}

	// Set default user agent
	SetUserAgent(DefaultUserAgent)
}

// SetUserAgent sets the User-Agent string
func SetUserAgent(ua string) {
	userAgentLock.Lock()
	defer userAgentLock.Unlock()
	userAgent = ua
}

// GetUserAgent returns the current User-Agent string
func GetUserAgent() string {
	userAgentLock.RLock()
	defer userAgentLock.RUnlock()
	return userAgent
}

// GetClient returns the global HTTP client
func GetClient(ctx context.Context) *http.Client {
	return httpClient
}

// hostFromURL extracts the host from a URL string
func hostFromURL(urlStr string) string {
	u, err := url.Parse(urlStr)
	if err != nil {
		return ""
	}
	return u.Host
}

// waitForRateLimit waits for the appropriate rate limiter based on the request URL.
// It delegates to the singleton GetRateLimiter() so that all callers
// (DoRequest, MonitoredDoRequest, WaitForService explicit calls) share one
// throttling source. Previously two divergent limiter sets lived in this file
// and in ratelimit.go, which let some handlers skip throttling entirely.
func waitForRateLimit(ctx context.Context, req *http.Request) error {
	host := hostFromURL(req.URL.String())

	var service string
	var limiter *rate.Limiter

	switch host {
	case hostFromURL(NominatimBaseURL):
		service = ServiceNominatim
		limiter = GetRateLimiter().Limiter(ServiceNominatim)
	case hostFromURL(OverpassBaseURL):
		service = ServiceOverpass
		limiter = GetRateLimiter().Limiter(ServiceOverpass)
	case hostFromURL(OSRMBaseURL):
		service = ServiceOSRM
		limiter = GetRateLimiter().Limiter(ServiceOSRM)
	default:
		return nil // No rate limiting for unknown hosts
	}

	if limiter == nil {
		return nil
	}

	// Allow() returns true when an event can proceed immediately (no wait).
	// When false, we must block on Wait() and record the wait telemetry.
	if limiter.Allow() {
		return nil
	}

	startWait := time.Now()

	tracing.AddEvent(ctx, "rate_limit_wait",
		trace.WithAttributes(
			attribute.String(tracing.AttrRateLimitService, service),
		),
	)

	if err := limiter.Wait(ctx); err != nil {
		return err
	}

	waitDuration := time.Since(startWait)
	tracing.SetAttributes(ctx,
		attribute.String(tracing.AttrRateLimitService, service),
		attribute.Int64(tracing.AttrRateLimitWaitMs, waitDuration.Milliseconds()),
	)

	return nil
}

// DoRequest performs an HTTP request with rate limiting
func DoRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	// Set User-Agent header
	req.Header.Set("User-Agent", GetUserAgent())

	// Wait for rate limit
	if err := waitForRateLimit(ctx, req); err != nil {
		return nil, err
	}

	// Perform request
	return httpClient.Do(req)
}

// NewRequestWithUserAgent creates a new HTTP request with proper User-Agent header
// This simplifies creating requests with the correct header throughout the codebase
func NewRequestWithUserAgent(ctx context.Context, method, url string, body interface{}) (*http.Request, error) {
	var req *http.Request
	var err error

	if body != nil {
		bodyReader, ok := body.(io.Reader)
		if !ok {
			return nil, fmt.Errorf("body must implement io.Reader")
		}
		req, err = http.NewRequestWithContext(ctx, method, url, bodyReader)
	} else {
		req, err = http.NewRequestWithContext(ctx, method, url, nil)
	}

	if err != nil {
		return nil, err
	}

	// Set required User-Agent for Nominatim's usage policy
	req.Header.Set("User-Agent", GetUserAgent())

	return req, nil
}

// Client represents an OSM API client
type Client struct {
	logger *slog.Logger
}

// NewOSMClient creates a new OSM API client
func NewOSMClient() *Client {
	return &Client{
		logger: slog.Default(),
	}
}

// SetLogger sets the logger for the client
func (c *Client) SetLogger(logger *slog.Logger) {
	c.logger = logger
}

// Health check functions for external services
// CheckNominatimHealth checks if Nominatim service is available
func CheckNominatimHealth() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Make a simple status request to Nominatim
	req, err := http.NewRequestWithContext(ctx, "GET", NominatimBaseURL+"/status", nil)
	if err != nil {
		return fmt.Errorf("failed to create nominatim health check request: %w", err)
	}

	resp, err := DoRequest(ctx, req)
	if err != nil {
		return fmt.Errorf("nominatim health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("nominatim health check returned status %d", resp.StatusCode)
	}

	return nil
}

// CheckOverpassHealth checks if Overpass API is available
func CheckOverpassHealth() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Make a simple status request to Overpass
	req, err := http.NewRequestWithContext(ctx, "GET", OverpassBaseURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create overpass health check request: %w", err)
	}

	// Add a simple query to check if the service is responsive
	req.URL.RawQuery = "data=[out:json];out meta;"

	resp, err := DoRequest(ctx, req)
	if err != nil {
		return fmt.Errorf("overpass health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("overpass health check returned status %d", resp.StatusCode)
	}

	return nil
}

// CheckOSRMHealth checks if OSRM service is available
func CheckOSRMHealth() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Make a simple status request to OSRM
	req, err := http.NewRequestWithContext(ctx, "GET", OSRMBaseURL+"/nearest/v1/driving/0,0", nil)
	if err != nil {
		return fmt.Errorf("failed to create osrm health check request: %w", err)
	}

	resp, err := DoRequest(ctx, req)
	if err != nil {
		return fmt.Errorf("osrm health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("osrm health check returned status %d", resp.StatusCode)
	}

	return nil
}
