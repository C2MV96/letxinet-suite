// Package tools: osm_health MCP tool wrapper.
//
// Phase 1 OSM (2026-07-23): surface the existing pkg/monitoring/health HTTP
// `/health` endpoint as an MCP tool so that MCP clients (opencode, Claude
// Desktop, Cursor, etc.) can probe Nominatim/OSRM/Overpass directly via
// the MCP protocol without an HTTP sidecar.
//
// The MCP tool performs live probes against the 3 OSM backends with short
// timeouts so it returns a true "online RIGHT NOW" status (rather than the
// stateful, periodic-poll view that pkg/monitoring/health maintains).
//
// Output JSON shape:
//
//	{
//	  "status": "healthy" | "degraded" | "unhealthy",
//	  "nominatim": "ok" | "down" | "timeout",
//	  "osrm": "ok" | "down" | "timeout",
//	  "overpass": "ok" | "down" | "timeout",
//	  "latency_ms": { "nominatim": int, "osrm": int, "overpass": int },
//	  "uptime_seconds": int
//	}
package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/NERVsystems/osmmcp/pkg/osm"
	"github.com/mark3labs/mcp-go/mcp"
)

var osmHealthStart = time.Now()

// OSMHealthTool returns the tool definition for osm_health.
func OSMHealthTool() mcp.Tool {
	return mcp.NewTool("osm_health",
		mcp.WithDescription(`Check the OSM MCP service's connectivity to its three backends (Nominatim, OSRM, Overpass) and return aggregate health status.

Returns:
- status: "healthy" (all 3 up), "degraded" (some down), "unhealthy" (all down)
- nominatim/osrm/overpass: per-backend status ("ok", "down", "timeout")
- latency_ms: per-backend latency in milliseconds
- uptime_seconds: how long the OSM MCP server has been running

Use this for quick smoke tests before running geocoding/routing/POI tools. No parameters required.`),
	)
}

// OSMSingleProbeResult holds the probe outcome for one backend.
type OSMSingleProbeResult struct {
	Status    string `json:"status"`     // "ok" | "down" | "timeout"
	LatencyMs int64  `json:"latency_ms"` // milliseconds
}

// OSMHealthOutput is the JSON returned by the osm_health MCP tool.
type OSMHealthOutput struct {
	Status        string               `json:"status"`
	Nominatim     OSMSingleProbeResult `json:"nominatim"`
	OSRM          OSMSingleProbeResult `json:"osrm"`
	Overpass      OSMSingleProbeResult `json:"overpass"`
	LatencyMs     map[string]int64     `json:"latency_ms"`
	UptimeSeconds int64                `json:"uptime_seconds"`
}

// HandleOSMHealth implements the osm_health tool: performs 3 live HTTP probes
// in parallel (each with a short 3-second timeout) and returns the aggregate.
func HandleOSMHealth(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	// LetXinet Suite: reuse the canonical env-aware helpers from pkg/osm so the
	// health check uses the same endpoints the rest of the server uses. The
	// health probe pings the BASE host (Nominatim root, OSRM root, Overpass
	// root) rather than full endpoint paths to keep latency low.
	nominatimURL := osm.NominatimBaseURLEnv()
	osrmURL := os.Getenv("OSRM_URL")
	if osrmURL == "" {
		osrmURL = osm.ProfileBaseURL("car")
	}
	overpassURL := osm.OverpassBaseURLEnv()
	// Overpass full endpoint includes /api/interpreter; for the health probe
	// we want the host root. Strip the trailing path if present.
	if strings.HasPrefix(overpassURL, "https://overpass-api.de/api/interpreter") {
		overpassURL = "https://overpass-api.de"
	} else {
		overpassURL = strings.TrimRight(overpassURL, "/")
	}

	probeCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	// Probe 3 backends concurrently.
	var wg sync.WaitGroup
	wg.Add(3)

	var nominatim, osrm, overpass OSMSingleProbeResult
	probe := func(out *OSMSingleProbeResult, endpoint string) {
		defer wg.Done()
		start := time.Now()
		client := &http.Client{Timeout: 3 * time.Second}
		req, err := http.NewRequestWithContext(probeCtx, http.MethodGet, endpoint, nil)
		if err != nil {
			out.Status = "down"
			out.LatencyMs = time.Since(start).Milliseconds()
			return
		}
		req.Header.Set("User-Agent", osm.UserAgentEnv())
		resp, err := client.Do(req)
		out.LatencyMs = time.Since(start).Milliseconds()
		if err != nil {
			// Distinguish timeout vs other network errors
			if probeCtx.Err() != nil {
				out.Status = "timeout"
			} else {
				out.Status = "down"
			}
			return
		}
		defer resp.Body.Close()
		// Accept 2xx and 3xx as "ok". 4xx/5xx counts as down.
		if resp.StatusCode < 400 {
			out.Status = "ok"
		} else {
			out.Status = "down"
		}
	}

	// Nominatim /status endpoint: returns "OK" text when service is up.
	go probe(&nominatim, nominatimURL+"/status")
	// OSRM /status endpoint returns HTTP 200 with small JSON when up.
	go probe(&osrm, osrmURL+"/status")
	// Overpass root: returns HTML (HTTP 200) when up.
	go probe(&overpass, overpassURL+"/api/status")

	wg.Wait()

	// Aggregate status: healthy (all ok) | degraded (some ok) | unhealthy (none ok)
	okCount := 0
	for _, r := range []OSMSingleProbeResult{nominatim, osrm, overpass} {
		if r.Status == "ok" {
			okCount++
		}
	}
	status := "unhealthy"
	if okCount == 3 {
		status = "healthy"
	} else if okCount > 0 {
		status = "degraded"
	}

	output := OSMHealthOutput{
		Status:    status,
		Nominatim: nominatim,
		OSRM:      osrm,
		Overpass:  overpass,
		LatencyMs: map[string]int64{
			"nominatim": nominatim.LatencyMs,
			"osrm":      osrm.LatencyMs,
			"overpass":  overpass.LatencyMs,
		},
		UptimeSeconds: int64(time.Since(osmHealthStart).Seconds()),
	}

	resultBytes, err := json.Marshal(output)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to marshal health response: %v", err)), nil
	}
	return mcp.NewToolResultText(string(resultBytes)), nil
}
