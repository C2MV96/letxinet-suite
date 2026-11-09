// Package osm provides utilities for working with OpenStreetMap data.
package osm

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const (
	// Service names for rate limiting
	ServiceNominatim = "nominatim"
	ServiceOverpass  = "overpass"
	ServiceOSRM      = "osrm"
)

// RateLimiter manages rate limiting for different OpenStreetMap API services
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
}

var (
	// globalRateLimiter is the singleton rate limiter instance
	globalRateLimiter *RateLimiter

	// rateLimiterOnce ensures we only create the rate limiter once
	rateLimiterOnce sync.Once
)

// GetRateLimiter returns the global rate limiter instance
func GetRateLimiter() *RateLimiter {
	rateLimiterOnce.Do(func() {
		// Initialize the global rate limiter with service-specific limits
		// according to OSM API usage policies
		limiters := make(map[string]*rate.Limiter)

		// Nominatim: 1 request per second
		// https://operations.osmfoundation.org/policies/nominatim/
		limiters[ServiceNominatim] = rate.NewLimiter(rate.Every(1*time.Second), 1)

		// Overpass: 2 requests per minute with bursts of up to 2 requests
		// https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
		limiters[ServiceOverpass] = rate.NewLimiter(rate.Every(30*time.Second), 2)

		// OSRM: 100 requests per minute (to be safe and avoid abuse)
		limiters[ServiceOSRM] = rate.NewLimiter(rate.Every(600*time.Millisecond), 5)

		globalRateLimiter = &RateLimiter{
			limiters: limiters,
		}
	})

	return globalRateLimiter
}

// Wait blocks until the rate limit for the specified service allows an event
// or the context is canceled.
func (rl *RateLimiter) Wait(ctx context.Context, service string) error {
	rl.mu.RLock()
	limiter, exists := rl.limiters[service]
	rl.mu.RUnlock()

	if !exists {
		return fmt.Errorf("no rate limiter defined for service: %s", service)
	}

	// Wait for rate limiter or context cancellation
	err := limiter.Wait(ctx)
	if err != nil {
		slog.Debug("rate limiter wait error", "service", service, "error", err)
		return err
	}

	return nil
}

// Limiter returns the underlying *rate.Limiter for a service, or nil if not
// configured. Callers use the returned limiter for Wait() / Allow() calls and
// for tests that need to swap in tighter limits.
func (rl *RateLimiter) Limiter(service string) *rate.Limiter {
	rl.mu.RLock()
	defer rl.mu.RUnlock()
	return rl.limiters[service]
}

// WaitForService is a convenience function to wait for a service's rate limit
// using the global rate limiter
func WaitForService(ctx context.Context, service string) error {
	return GetRateLimiter().Wait(ctx, service)
}

// ServiceLimit describes a single service's limiter settings.
type ServiceLimit struct {
	Limiter *rate.Limiter
	Service string
}

// UpdateNominatimRateLimits replaces the Nominatim limiter on the singleton.
// This preserves the public API previously exposed by client.go so that
// cmd/osmmcp/main.go keeps working unchanged.
func UpdateNominatimRateLimits(rps float64, burst int) {
	updateServiceLimit(ServiceNominatim, rate.Limit(rps), burst)
}

// UpdateOverpassRateLimits replaces the Overpass limiter on the singleton.
func UpdateOverpassRateLimits(rps float64, burst int) {
	updateServiceLimit(ServiceOverpass, rate.Limit(rps), burst)
}

// UpdateOSRMRateLimits replaces the OSRM limiter on the singleton.
func UpdateOSRMRateLimits(rps float64, burst int) {
	updateServiceLimit(ServiceOSRM, rate.Limit(rps), burst)
}

// updateServiceLimit swaps a service's limiter under a write lock. The singleton
// is initialized lazily via GetRateLimiter, so we call it first to guarantee
// the map exists.
func updateServiceLimit(service string, rps rate.Limit, burst int) {
	rl := GetRateLimiter()
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.limiters[service] = rate.NewLimiter(rps, burst)
}
