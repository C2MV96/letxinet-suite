// Package tools provides the OpenStreetMap MCP tools implementations.
package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"

	"github.com/NERVsystems/osmmcp/pkg/core"
	"github.com/NERVsystems/osmmcp/pkg/osm"
	"github.com/NERVsystems/osmmcp/pkg/osm/overpass"
)

// ExploreAreaTool returns a tool definition for exploring an area
func ExploreAreaTool() mcp.Tool {
	return mcp.NewTool("explore_area",
		mcp.WithDescription("Explore and describe an area based on its coordinates"),
		mcp.WithNumber("latitude",
			mcp.Required(),
			mcp.Description("The latitude coordinate of the area's center point"),
		),
		mcp.WithNumber("longitude",
			mcp.Required(),
			mcp.Description("The longitude coordinate of the area's center point"),
		),
		mcp.WithNumber("radius",
			mcp.Required(),
			mcp.Description("Search radius in meters (max 5000)"),
		),
	)
}

// AreaDescription represents a description of an area
type AreaDescription struct {
	Center       Location         `json:"center"`
	Radius       float64          `json:"radius"`
	Categories   map[string]int   `json:"categories"`
	PlaceCounts  map[string]int   `json:"place_counts"`
	KeyFeatures  []string         `json:"key_features"`
	TopPlaces    []Place          `json:"top_places"`
	Neighborhood NeighborhoodInfo `json:"neighborhood,omitempty"`
}

// NeighborhoodInfo contains information about a neighborhood
type NeighborhoodInfo struct {
	Name        string   `json:"name,omitempty"`
	Type        string   `json:"type,omitempty"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

// HandleExploreArea implements area exploration functionality
func HandleExploreArea(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	logger := slog.Default().With("tool", "explore_area")

	// Parse and validate coordinates
	latStr := mcp.ParseString(req, "latitude", "")
	lonStr := mcp.ParseString(req, "longitude", "")
	radiusStr := mcp.ParseString(req, "radius", "")

	if latStr == "" || lonStr == "" {
		logger.Error("missing required coordinates", "latitude", latStr, "longitude", lonStr)
		return NewGeocodeDetailedError(
			"MISSING_COORDINATES",
			"Missing required coordinates",
			"",
			"The explore_area tool requires both latitude and longitude parameters",
			"Example format: {\"latitude\": 40.7128, \"longitude\": -74.0060, \"radius\": 1000}",
		), nil
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		logger.Error("invalid latitude", "input", latStr, "error", err)
		return NewGeocodeDetailedError(
			"INVALID_LATITUDE",
			fmt.Sprintf("Invalid latitude value: %s", latStr),
			"",
			"Latitude must be a valid number between -90 and 90",
			"Example: 40.7128 (numeric, no quotes)",
		), nil
	}

	lon, err := strconv.ParseFloat(lonStr, 64)
	if err != nil {
		logger.Error("invalid longitude", "input", lonStr, "error", err)
		return NewGeocodeDetailedError(
			"INVALID_LONGITUDE",
			fmt.Sprintf("Invalid longitude value: %s", lonStr),
			"",
			"Longitude must be a valid number between -180 and 180",
			"Example: -74.0060 (numeric, no quotes)",
		), nil
	}

	if err := ValidateCoordinates(lat, lon); err != nil {
		logger.Error("coordinate validation failed", "error", err)
		return NewGeocodeDetailedError(
			"INVALID_COORDINATES",
			err.Error(),
			"",
			"Latitude must be between -90 and 90, longitude between -180 and 180",
		), nil
	}

	var radius float64 = 1000 // Default radius
	if radiusStr != "" {
		radius, err = strconv.ParseFloat(radiusStr, 64)
		if err != nil {
			logger.Error("invalid radius", "input", radiusStr, "error", err)
			return NewGeocodeDetailedError(
				"INVALID_RADIUS",
				fmt.Sprintf("Invalid radius value: %s", radiusStr),
				"",
				"Radius must be a valid positive number",
				"Example: 1000 (numeric, no quotes)",
			), nil
		}
	}

	if err := ValidateRadius(radius, 5000); err != nil {
		logger.Error("radius validation failed", "radius", radius, "error", err)
		return NewGeocodeDetailedError(
			"INVALID_RADIUS",
			err.Error(),
			"",
			"Radius must be positive and less than 5000 meters",
		), nil
	}

	// Build the Overpass query string. The legacy code here emitted
	// impossible-and contradictory filters (e.g. "[amenity=][leisure=]"
	// plus a duplicate "[leisure=park]"); buildExploreAreaQuery now issues
	// one OR-style sub-query per existence-only tag group so Overpass
	// returns any element matching any of them.
	overpassQuery := buildExploreAreaQuery(lat, lon, radius)

	// Try the POI cache before reserving a rate-limit token or issuing HTTP.
	poiKey := osm.POICacheKey(overpassQuery)
	if cached, ok := osm.TryPOICache(poiKey); ok {
		logger.Info("explore_area cache hit")
		return mcp.NewToolResultText(string(cached)), nil
	}

	// Wait for the Overpass rate limiter before issuing the HTTP request. The
	// legacy handler hit Overpass via core.WithRetryFactory + osm.GetClient (a
	// raw client that does not honor waitForRateLimit), which produced HTTP 429
	// under concurrent use. executeOverpassQuery below uses the same raw path,
	// so the wait must happen here on the caller side.
	if err := osm.WaitForService(ctx, osm.ServiceOverpass); err != nil {
		logger.Error("overpass rate limit wait failed", "error", err)
		return core.ServiceError("Overpass", http.StatusTooManyRequests,
			"Rate limit exceeded, retry shortly").ToMCPResult(), nil
	}

	// Execute the query
	elements, err := executeOverpassQuery(ctx, overpassQuery)
	if err != nil {
		logger.Error("failed to execute Overpass query", "error", err)
		return err.(*core.MCPError).ToMCPResult(), nil
	}

	// Process the data to generate area description
	categories := make(map[string]int)
	placeCounts := make(map[string]int)
	keyFeatures := make([]string, 0)
	topPlaces := make([]Place, 0)

	// Track neighborhood information
	neighborhood := NeighborhoodInfo{}

	// Process all elements
	for _, element := range elements {
		// Extract categories and count them
		if amenity, ok := element.Tags["amenity"]; ok {
			categories["amenity:"+amenity]++
			placeCounts["amenity"]++
		}
		if shop, ok := element.Tags["shop"]; ok {
			categories["shop:"+shop]++
			placeCounts["shop"]++
		}
		if tourism, ok := element.Tags["tourism"]; ok {
			categories["tourism:"+tourism]++
			placeCounts["tourism"]++
		}
		if leisure, ok := element.Tags["leisure"]; ok {
			categories["leisure:"+leisure]++
			placeCounts["leisure"]++
		}
		if natural, ok := element.Tags["natural"]; ok {
			categories["natural:"+natural]++
			placeCounts["natural"]++
		}

		// Look for neighborhood or district information
		if place, ok := element.Tags["place"]; ok {
			if place == "neighbourhood" || place == "suburb" || place == "quarter" || place == "district" {
				if name, ok := element.Tags["name"]; ok {
					// Only use the first neighborhood found for simplicity
					if neighborhood.Name == "" {
						neighborhood.Name = name
						neighborhood.Type = place
						// Try to get additional information
						if element.Tags["description"] != "" {
							neighborhood.Description = element.Tags["description"]
						}
						// Add any tags as features
						for k, v := range element.Tags {
							if k != "name" && k != "place" && k != "description" {
								neighborhood.Tags = append(neighborhood.Tags, fmt.Sprintf("%s=%s", k, v))
							}
						}
					}
				}
			}
		}

		// Add top places with high importance
		if element.Type == "node" && element.Tags["name"] != "" {
			// Consider parks, museums, important landmarks, etc.
			important := false
			if element.Tags["tourism"] == "museum" ||
				element.Tags["tourism"] == "attraction" ||
				element.Tags["amenity"] == "university" ||
				element.Tags["amenity"] == "hospital" ||
				element.Tags["leisure"] == "park" ||
				element.Tags["amenity"] == "theatre" ||
				element.Tags["amenity"] == "library" {
				important = true
			}

			if important {
				categories := []string{}
				for k, v := range element.Tags {
					if k != "name" && (k == "amenity" || k == "shop" || k == "tourism" || k == "leisure") {
						categories = append(categories, fmt.Sprintf("%s:%s", k, v))
					}
				}

				var lat, lon float64
				if element.Type == "node" {
					lat = element.Lat
					lon = element.Lon
				} else if element.Center != nil {
					lat = element.Center.Lat
					lon = element.Center.Lon
				}

				place := Place{
					ID:   fmt.Sprintf("%d", element.ID),
					Name: element.Tags["name"],
					Location: Location{
						Latitude:  lat,
						Longitude: lon,
					},
					Categories: categories,
				}

				topPlaces = append(topPlaces, place)
				if len(topPlaces) >= 10 {
					break
				}
			}
		}
	}

	// Determine key features
	if placeCounts["shop"] > 10 {
		keyFeatures = append(keyFeatures, "Commercial area with many shops")
	}
	if placeCounts["amenity"] > 10 {
		keyFeatures = append(keyFeatures, "Area with many amenities")
	}
	if placeCounts["tourism"] > 5 {
		keyFeatures = append(keyFeatures, "Tourist area")
	}
	if placeCounts["leisure"] > 5 || categories["leisure:park"] > 2 {
		keyFeatures = append(keyFeatures, "Recreational area with parks/leisure facilities")
	}
	if placeCounts["natural"] > 3 {
		keyFeatures = append(keyFeatures, "Area with natural features")
	}
	if categories["amenity:restaurant"] > 5 || categories["amenity:cafe"] > 5 {
		keyFeatures = append(keyFeatures, "Dining district with many restaurants/cafes")
	}
	if categories["amenity:school"] > 2 || categories["amenity:university"] > 0 {
		keyFeatures = append(keyFeatures, "Educational area")
	}
	if categories["amenity:hospital"] > 0 || categories["amenity:clinic"] > 2 {
		keyFeatures = append(keyFeatures, "Medical/healthcare area")
	}

	// If we have no key features, add a generic one
	if len(keyFeatures) == 0 {
		keyFeatures = append(keyFeatures, "Residential or low-density area")
	}

	// Create the area description
	areaDescription := AreaDescription{
		Center: Location{
			Latitude:  lat,
			Longitude: lon,
		},
		Radius:      radius,
		Categories:  categories,
		PlaceCounts: placeCounts,
		KeyFeatures: keyFeatures,
		TopPlaces:   topPlaces,
	}

	// Add neighborhood info if available
	if neighborhood.Name != "" {
		areaDescription.Neighborhood = neighborhood
	}

	// Create output
	output := struct {
		AreaDescription AreaDescription `json:"area_description"`
	}{
		AreaDescription: areaDescription,
	}

	// Return result
	resultBytes, err := json.Marshal(output)
	if err != nil {
		logger.Error("failed to marshal result", "error", err)
		return core.NewError(core.ErrInternalError, "Failed to generate result").ToMCPResult(), nil
	}

	osm.StorePOI(poiKey, resultBytes)

	return mcp.NewToolResultText(string(resultBytes)), nil
}

// executeOverpassQuery executes an Overpass API query and returns the elements
func executeOverpassQuery(ctx context.Context, query string) ([]osm.OverpassElement, error) {
	// Build request
	reqURL, err := url.Parse(osm.OverpassBaseURLEnv())
	if err != nil {
		return nil, core.NewError(core.ErrInternalError, "Internal server error")
	}

	// Create HTTP request factory for retries
	requestFactory := func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(
			ctx,
			http.MethodPost,
			reqURL.String(),
			strings.NewReader("data="+url.QueryEscape(query)),
		)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("User-Agent", osm.UserAgent)
		return req, nil
	}

	// Execute request with retries
	client := osm.GetClient(ctx)
	resp, err := core.WithRetryFactory(ctx, requestFactory, client, core.DefaultRetryOptions)
	if err != nil {
		return nil, core.ServiceError("Overpass", http.StatusServiceUnavailable, "Failed to communicate with OSM service")
	}
	defer resp.Body.Close()

	// Process response
	if resp.StatusCode != http.StatusOK {
		return nil, core.ServiceError("Overpass", resp.StatusCode, fmt.Sprintf("OSM service error: %d", resp.StatusCode))
	}

	// Parse response
	var overpassResp struct {
		Elements []osm.OverpassElement `json:"elements"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&overpassResp); err != nil {
		return nil, core.NewError(core.ErrParseError, "Failed to parse area data")
	}

	return overpassResp.Elements, nil
}

// buildExploreAreaQuery renders the Overpass query for an explore_area request.
// It is a pure function (no I/O) so tests can assert the exact string without
// hitting the network.
//
// The legacy implementation emitted contradictory/empty filters
//
//	WithTag("amenity", "")  -> [amenity=]
//	WithTag("leisure", "")  -> [leisure=]
//	WithTag("leisure","park") -> [leisure=park]   (AND of two [leisure] filters)
//
// which Overpass interpreted as an impossible AND on the same key with an empty
// literal value. This function instead emits one union sub-query per tag group
// so any element matching ANY group is returned:
//
//	node(around:r,lat,lon)[amenity]; way(around:r,lat,lon)[amenity];
//	relation(around:r,lat,lon)[amenity];
//	node(around:r,lat,lon)[shop]; way(around:r,lat,lon)[shop];
//	... (and so on for tourism, leisure, natural, place)
//	node(around:r,lat,lon)[leisure=park]; ...
//	node(around:r,lat,lon)[landuse=park]; ...
//
// All wrapped in a single "()" union, billed as one Overpass request.
func buildExploreAreaQuery(lat, lon, radius float64) string {
	q := overpass.NewQuery().WithTimeout(25)
	spatial := overpass.Around(lat, lon, radius)

	// Existence-only groups: any element with any of these tags counts toward
	// the area catalogue. Each group is added with AddAll (node+way+relation)
	// and lives as a separate sub-query inside the union "()".
	for _, tag := range []overpass.TagCondition{
		overpass.AnyTag("amenity"),
		overpass.AnyTag("shop"),
		overpass.AnyTag("tourism"),
		overpass.AnyTag("leisure"),
		overpass.AnyTag("natural"),
		overpass.AnyTag("place"),
	} {
		q.AddAll(spatial, tag)
	}

	// Specific value matches that historically were requested alongside the
	// existence filters. Kept as separate sub-queries (each a single
	// ElementQuery with one tag) so they don't AND against the existence
	// filters above.
	q.AddAll(spatial, overpass.Tag("leisure", "park"))
	q.AddAll(spatial, overpass.Tag("landuse", "park"))

	return q.Build()
}
