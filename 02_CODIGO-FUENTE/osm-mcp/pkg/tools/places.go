// Package tools provides the OpenStreetMap MCP tools implementations.
package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"

	"github.com/NERVsystems/osmmcp/pkg/core"
	"github.com/NERVsystems/osmmcp/pkg/osm"
	"github.com/NERVsystems/osmmcp/pkg/osm/overpass"
)

// FindNearbyPlacesTool returns a tool definition for finding nearby places
func FindNearbyPlacesTool() mcp.Tool {
	return mcp.NewTool("find_nearby_places",
		mcp.WithDescription("Find points of interest near a specific location"),
		mcp.WithNumber("latitude",
			mcp.Required(),
			mcp.Description("The latitude coordinate of the center point"),
		),
		mcp.WithNumber("longitude",
			mcp.Required(),
			mcp.Description("The longitude coordinate of the center point"),
		),
		mcp.WithNumber("radius",
			mcp.Description("Search radius in meters (max 50000)"),
			mcp.DefaultNumber(1000),
		),
		mcp.WithString("category",
			mcp.Description("Optional category filter (e.g., restaurant, hotel, park)"),
			mcp.DefaultString(""),
		),
		mcp.WithNumber("limit",
			mcp.Description("Maximum number of results to return"),
			mcp.DefaultNumber(10),
		),
	)
}

// HandleFindNearbyPlaces implements finding nearby places functionality
func HandleFindNearbyPlaces(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	logger := slog.Default().With("tool", "find_nearby_places")

	// Use the common validator for OSM parameters
	lat, lon, radius, limit, errResult, err := ValidateOSMParameters(req, "find_nearby_places", logger)
	if err != nil {
		return errResult, nil
	}

	// Parse additional parameters
	category := mcp.ParseString(req, "category", "")

	if category == "" {
		logger.Error("missing category parameter")
		return NewGeocodeDetailedError(
			"MISSING_CATEGORY",
			"Missing required category parameter",
			"",
			"The category parameter is required and specifies the type of places to find",
			"Example categories: restaurant, cafe, park, museum, school, hospital",
		), nil
	}

	// Map generic categories to OSM tags
	osmTags := mapCategoryToOSMTags(category)

	// Build the Overpass query string
	overpassQuery := buildFindNearbyPlacesQuery(lat, lon, radius, osmTags)

	// Try the POI cache before reserving a rate-limit token or issuing HTTP.
	// The cache key is the SHA256 of the rendered query, so concurrent callers
	// asking the same category+location+radius share a slot and only one
	// request reaches Overpass.
	poiKey := osm.POICacheKey(overpassQuery)
	if cached, ok := osm.TryPOICache(poiKey); ok {
		logger.Info("poi cache hit", "category", category)
		return mcp.NewToolResultText(string(cached)), nil
	}

	// Wait for the Overpass rate limiter before issuing the HTTP request. The
	// legacy handler went straight at core.WithRetryFactory + osm.GetClient
	// (a raw client that does not honor waitForRateLimit), which produced
	// intermittent HTTP 429 under concurrency.
	if err := osm.WaitForService(ctx, osm.ServiceOverpass); err != nil {
		logger.Error("overpass rate limit wait failed", "error", err)
		return core.ServiceError("Overpass", http.StatusTooManyRequests,
			"Rate limit exceeded, retry shortly").ToMCPResult(), nil
	}

	// Create the request
	reqURL, err := url.Parse(osm.OverpassBaseURLEnv())
	if err != nil {
		logger.Error("failed to parse URL", "error", err)
		return core.NewError("INTERNAL_ERROR", "Internal server error").ToMCPResult(), nil
	}

	// Create a request factory for retry support
	factory := func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, reqURL.String(),
			strings.NewReader("data="+url.QueryEscape(overpassQuery)))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("User-Agent", osm.UserAgent)
		return req, nil
	}

	// Execute request with retry
	client := osm.GetClient(ctx)
	resp, err := core.WithRetryFactory(ctx, factory, client, core.DefaultRetryOptions)

	if err != nil {
		logger.Error("failed to execute request", "error", err)
		return core.ServiceError("Overpass", http.StatusServiceUnavailable,
			"Failed to communicate with places service").ToMCPResult(), nil
	}
	defer resp.Body.Close()

	// Process response
	if resp.StatusCode != http.StatusOK {
		logger.Error("places service returned error", "status", resp.StatusCode)
		return core.ServiceError("Overpass", resp.StatusCode,
			fmt.Sprintf("Places service error: %d", resp.StatusCode)).ToMCPResult(), nil
	}

	// Parse response
	var overpassResp struct {
		Elements []struct {
			ID     int     `json:"id"`
			Type   string  `json:"type"`
			Lat    float64 `json:"lat"`
			Lon    float64 `json:"lon"`
			Center *struct {
				Lat float64 `json:"lat"`
				Lon float64 `json:"lon"`
			} `json:"center,omitempty"`
			Tags map[string]string `json:"tags"`
		} `json:"elements"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&overpassResp); err != nil {
		logger.Error("failed to decode response", "error", err)
		return core.NewError("PARSE_ERROR", "Failed to parse places response").ToMCPResult(), nil
	}

	// Convert to Place objects and calculate distances
	places := make([]Place, 0)
	for _, element := range overpassResp.Elements {
		// Determine coordinates based on element type
		var elLat, elLon float64
		if element.Type == "node" {
			elLat = element.Lat
			elLon = element.Lon
		} else if element.Center != nil {
			// Ways and relations use center coordinates
			elLat = element.Center.Lat
			elLon = element.Center.Lon
		} else {
			// Skip elements without coordinates
			continue
		}

		// Skip elements without tags
		if element.Tags == nil {
			continue
		}

		// Skip elements without a name (unless we can generate one)
		name := element.Tags["name"]
		if name == "" {
			if element.Tags["amenity"] != "" {
				name = strings.Title(element.Tags["amenity"])
			} else if element.Tags["shop"] != "" {
				name = strings.Title(element.Tags["shop"])
			} else if element.Tags["tourism"] != "" {
				name = strings.Title(element.Tags["tourism"])
			} else if element.Tags["leisure"] != "" {
				name = strings.Title(element.Tags["leisure"])
			} else {
				continue
			}
		}

		// Calculate distance
		distance := osm.HaversineDistance(
			lat, lon,
			elLat, elLon,
		)

		// Determine place category
		categories := []string{}
		if element.Tags["amenity"] != "" {
			categories = append(categories, element.Tags["amenity"])
		}
		if element.Tags["shop"] != "" {
			categories = append(categories, "shop:"+element.Tags["shop"])
		}
		if element.Tags["tourism"] != "" {
			categories = append(categories, "tourism:"+element.Tags["tourism"])
		}
		if element.Tags["leisure"] != "" {
			categories = append(categories, "leisure:"+element.Tags["leisure"])
		}

		// Create place object
		place := Place{
			ID:   strconv.Itoa(element.ID),
			Name: name,
			Location: Location{
				Latitude:  elLat,
				Longitude: elLon,
			},
			Categories: categories,
			Distance:   distance,
		}

		places = append(places, place)
	}

	// Sort places by distance (closest first)
	sort.Slice(places, func(i, j int) bool {
		return places[i].Distance < places[j].Distance
	})

	// Limit results
	if len(places) > limit {
		places = places[:limit]
	}

	// Create output
	output := struct {
		Places []Place `json:"places"`
	}{
		Places: places,
	}

	// Return result
	resultBytes, err := json.Marshal(output)
	if err != nil {
		logger.Error("failed to marshal result", "error", err)
		return core.NewError("INTERNAL_ERROR", "Failed to generate result").ToMCPResult(), nil
	}

	// Cache the marshalled payload so the next identical query returns from
	// cache and never touches Overpass.
	osm.StorePOI(poiKey, resultBytes)

	return mcp.NewToolResultText(string(resultBytes)), nil
}

// mapCategoryToOSMTags maps generic category names to OSM tag combinations
func mapCategoryToOSMTags(category string) map[string][]string {
	// Convert to lowercase for case-insensitive matching
	category = strings.ToLower(category)

	// Common category mappings
	switch category {
	case "restaurant", "restaurants", "dining":
		return map[string][]string{
			"amenity": {"restaurant", "cafe", "fast_food", "bar", "pub", "food_court"},
		}
	case "park", "parks", "recreation":
		return map[string][]string{
			"leisure": {"park", "garden", "playground", "nature_reserve"},
			"landuse": {"recreation_ground", "park", "greenfield"},
			"natural": {"wood", "grassland", "meadow"},
		}
	case "hotel", "hotels", "lodging", "accommodation":
		return map[string][]string{
			"tourism": {"hotel", "hostel", "guest_house", "motel", "apartment", "resort"},
		}
	case "school", "schools", "education":
		return map[string][]string{
			"amenity": {"school", "kindergarten", "university", "college", "language_school", "music_school", "driving_school"},
		}
	case "bank", "banks", "atm", "atms", "finance":
		return map[string][]string{
			"amenity": {"bank", "atm", "bureau_de_change", "money_transfer"},
		}
	case "shop", "shops", "store", "stores", "shopping":
		return map[string][]string{
			"shop": {"*"}, // Match any shop type
		}
	case "cafe", "cafes", "coffee", "tea":
		return map[string][]string{
			"amenity": {"cafe", "ice_cream"},
			"shop":    {"coffee", "tea"},
		}
	case "hospital", "hospitals", "medical", "healthcare":
		return map[string][]string{
			"amenity": {"hospital", "clinic", "doctors", "dentist", "pharmacy", "healthcare"},
		}
	case "pharmacy", "pharmacies", "drugstore", "chemist":
		return map[string][]string{
			"amenity": {"pharmacy"},
			"shop":    {"chemist", "drugstore", "medical_supply"},
		}
	case "supermarket", "grocery", "market", "food_shop":
		return map[string][]string{
			"shop": {"supermarket", "convenience", "grocery", "greengrocer", "butcher", "bakery", "deli"},
		}
	case "museum", "museums", "gallery", "galleries", "art":
		return map[string][]string{
			"tourism": {"museum", "gallery", "artwork"},
			"amenity": {"arts_centre"},
		}
	case "attraction", "attractions", "tourist", "tourism", "sightseeing":
		return map[string][]string{
			"tourism": {"attraction", "viewpoint", "information", "museum", "gallery", "theme_park", "zoo"},
		}
	case "transport", "transportation", "transit", "bus", "train", "station":
		return map[string][]string{
			"public_transport": {"station", "stop_position", "platform"},
			"railway":          {"station", "halt", "tram_stop", "subway_entrance"},
			"amenity":          {"bus_station", "ferry_terminal", "taxi"},
			"highway":          {"bus_stop"},
		}
	default:
		// Split the category by spaces to handle multi-word categories
		parts := strings.Fields(category)
		if len(parts) > 1 {
			// Try matching a more specific multi-word category
			compound := strings.Join(parts, "_")
			return map[string][]string{
				"amenity":  {compound, category},
				"shop":     {compound, category},
				"tourism":  {compound, category},
				"leisure":  {compound, category},
				"natural":  {compound, category},
				"historic": {compound, category},
			}
		}

		// For unknown categories, try multiple tag combinations
		return map[string][]string{
			"amenity":  {category},
			"shop":     {category},
			"tourism":  {category},
			"leisure":  {category},
			"natural":  {category},
			"historic": {category},
		}
	}
}

// sortPlacesByDistance sorts places by distance (closest first)
func sortPlacesByDistance(places []Place) {
	// Replace bubble sort with sort.Slice for better performance
	sort.Slice(places, func(i, j int) bool {
		return places[i].Distance < places[j].Distance
	})
}

// buildFindNearbyPlacesQuery renders the Overpass query for a find_nearby_places
// request given the resolved coordinates, radius, and the OSM tag mapping produced
// by mapCategoryToOSMTags. It is a pure function (no I/O) so tests can assert the
// exact string without hitting the network. This is the regression anchor for
// the OR-vs-AND bug: a single key with multiple values MUST emit a regex OR
// ("[amenity~\"a|b|c\"]"), never a conjunction of single-value filters.
//
// When a category maps to multiple distinct keys (e.g. cafe -> amenity + shop),
// each key MUST become its own AddAll call so the builder emits independent
// node/way/relation sub-queries. The union "()" block in Build() applies OR
// semantics across sub-queries. Passing all keys to a single AddAll would AND
// them inside each sub-query (impossible in practice — no OSM element has both
// amenity=cafe AND shop=coffee), yielding zero results.
func buildFindNearbyPlacesQuery(lat, lon, radius float64, osmTags map[string][]string) string {
	q := overpass.NewQuery().WithTimeout(25)
	spatial := overpass.Around(lat, lon, radius)

	// Deterministic key order so the rendered string is stable across runs.
	// One AddAll per key -> OR across keys (via the union block in Build()).
	// Multiple values per key collapse to one TagCondition rendered as a
	// regex OR instead of an impossible AND on the same key.
	keys := make([]string, 0, len(osmTags))
	for k := range osmTags {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		q.AddAll(spatial, overpass.Tag(k, osmTags[k]...))
	}

	q.WithOutput("center")
	return q.Build()
}

// SearchCategoryTool returns a tool definition for searching places by category
func SearchCategoryTool() mcp.Tool {
	return mcp.NewTool("search_category",
		mcp.WithDescription("Find places of a specific category within a bounding box"),
		mcp.WithString("category",
			mcp.Required(),
			mcp.Description("Category to search for (e.g., restaurant, hotel, park)"),
		),
		mcp.WithNumber("north_lat",
			mcp.Required(),
			mcp.Description("Northern boundary latitude"),
		),
		mcp.WithNumber("south_lat",
			mcp.Required(),
			mcp.Description("Southern boundary latitude"),
		),
		mcp.WithNumber("east_lon",
			mcp.Required(),
			mcp.Description("Eastern boundary longitude"),
		),
		mcp.WithNumber("west_lon",
			mcp.Required(),
			mcp.Description("Western boundary longitude"),
		),
		mcp.WithNumber("limit",
			mcp.Description("Maximum number of results to return"),
			mcp.DefaultNumber(20),
		),
	)
}

// HandleSearchCategory implements category search functionality
func HandleSearchCategory(ctx context.Context, rawInput mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	logger := slog.Default().With("tool", "search_category")

	// Parse input parameters
	category := mcp.ParseString(rawInput, "category", "")
	northLat := mcp.ParseFloat64(rawInput, "north_lat", 0)
	southLat := mcp.ParseFloat64(rawInput, "south_lat", 0)
	eastLon := mcp.ParseFloat64(rawInput, "east_lon", 0)
	westLon := mcp.ParseFloat64(rawInput, "west_lon", 0)
	limit := int(mcp.ParseFloat64(rawInput, "limit", 20))

	// Basic validation
	if category == "" {
		return ErrorResponse("Category must not be empty"), nil
	}
	if northLat < southLat {
		return ErrorResponse("North latitude must be greater than south latitude"), nil
	}
	if northLat < -90 || northLat > 90 || southLat < -90 || southLat > 90 {
		return ErrorResponse("Latitude must be between -90 and 90"), nil
	}
	if eastLon < -180 || eastLon > 180 || westLon < -180 || westLon > 180 {
		return ErrorResponse("Longitude must be between -180 and 180"), nil
	}
	if limit <= 0 {
		limit = 20 // Default limit
	}
	if limit > 100 {
		limit = 100 // Max limit
	}

	// Map generic categories to OSM tags
	osmTags := mapCategoryToOSMTags(category)

	// Build the Overpass query with the unified builder. The legacy code
	// emitted node/way/relation sub-queries with one "[k=v]" per value, which
	// Overpass interpreted as an impossible AND across values of the same key.
	// The new builder collapses multiple values into a single regex OR per key.
	overpassQuery := buildSearchCategoryQuery(southLat, westLon, northLat, eastLon, osmTags)
	logger.Info("generated Overpass query", "query", overpassQuery)

	// Wait for Overpass rate limiting. This handler uses osm.DoRequest which
	// already honors the singleton limiter, but adding an explicit wait here
	// matches the pattern of osm_query_bbox and keeps behavior uniform across
	// all Overpass tools. It also makes the wait telemetry visible even when
	// the request factory is swapped.
	if err := osm.WaitForService(ctx, osm.ServiceOverpass); err != nil {
		logger.Error("overpass rate limit wait failed", "error", err)
		return ErrorWithGuidance(&APIError{
			Service:     "Overpass",
			StatusCode:  http.StatusTooManyRequests,
			Message:     "Rate limit exceeded",
			Recoverable: true,
			Guidance:    GuidanceOverpassRateLimit,
		}), nil
	}

	// Build request
	reqURL, err := url.Parse(osm.OverpassBaseURLEnv())
	if err != nil {
		logger.Error("failed to parse URL", "error", err)
		return ErrorResponse("Internal server error"), nil
	}

	// Make HTTP request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL.String(), strings.NewReader("data="+url.QueryEscape(overpassQuery)))
	if err != nil {
		logger.Error("failed to create request", "error", err)
		return ErrorResponse("Failed to create request"), nil
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", osm.GetUserAgent()) // Add User-Agent header

	// Execute request with rate limiting
	resp, err := osm.DoRequest(ctx, req)
	if err != nil {
		logger.Error("failed to execute request", "error", err)
		return ErrorResponse("Failed to communicate with places service"), nil
	}
	defer resp.Body.Close()

	// Process response
	if resp.StatusCode != http.StatusOK {
		logger.Error("places service returned error", "status", resp.StatusCode)
		return ErrorResponse(fmt.Sprintf("Places service error: %d", resp.StatusCode)), nil
	}

	// Parse response
	var overpassResp struct {
		Elements []struct {
			ID     int     `json:"id"`
			Type   string  `json:"type"`
			Lat    float64 `json:"lat,omitempty"`
			Lon    float64 `json:"lon,omitempty"`
			Center *struct {
				Lat float64 `json:"lat"`
				Lon float64 `json:"lon"`
			} `json:"center,omitempty"`
			Tags map[string]string `json:"tags,omitempty"`
		} `json:"elements"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&overpassResp); err != nil {
		logger.Error("failed to decode response", "error", err)
		return ErrorResponse("Failed to parse places response"), nil
	}

	// Log response size
	logger.Info("received elements from Overpass API", "count", len(overpassResp.Elements))

	// Convert to Place objects
	places := make([]Place, 0)
	for _, element := range overpassResp.Elements {
		// Determine coordinates based on element type
		var lat, lon float64
		if element.Type == "node" {
			lat = element.Lat
			lon = element.Lon
		} else if element.Center != nil {
			// Ways and relations use center coordinates
			lat = element.Center.Lat
			lon = element.Center.Lon
		} else {
			// Skip elements without coordinates
			continue
		}

		// Skip elements without tags
		if element.Tags == nil {
			continue
		}

		// Skip elements without a name (unless we want to include unnamed places)
		name := element.Tags["name"]
		if name == "" {
			// For unnamed elements, try to generate a descriptive name
			if element.Tags["amenity"] != "" {
				name = strings.Title(element.Tags["amenity"])
			} else if element.Tags["shop"] != "" {
				name = strings.Title(element.Tags["shop"])
			} else if element.Tags["tourism"] != "" {
				name = strings.Title(element.Tags["tourism"])
			} else if element.Tags["leisure"] != "" {
				name = strings.Title(element.Tags["leisure"])
			} else {
				// Skip elements without any meaningful naming possibility
				continue
			}
		}

		// Determine place category
		categories := []string{}
		if element.Tags["amenity"] != "" {
			categories = append(categories, element.Tags["amenity"])
		}
		if element.Tags["shop"] != "" {
			categories = append(categories, "shop:"+element.Tags["shop"])
		}
		if element.Tags["tourism"] != "" {
			categories = append(categories, "tourism:"+element.Tags["tourism"])
		}
		if element.Tags["leisure"] != "" {
			categories = append(categories, "leisure:"+element.Tags["leisure"])
		}

		// Create place object
		place := Place{
			ID:   strconv.Itoa(element.ID),
			Name: name,
			Location: Location{
				Latitude:  lat,
				Longitude: lon,
			},
			Categories: categories,
		}

		places = append(places, place)
	}

	// Limit results
	if len(places) > limit {
		places = places[:limit]
	}

	// Create output
	output := struct {
		Places []Place `json:"places"`
	}{
		Places: places,
	}

	// Return result
	resultBytes, err := json.Marshal(output)
	if err != nil {
		logger.Error("failed to marshal result", "error", err)
		return ErrorResponse("Failed to generate result"), nil
	}

	return mcp.NewToolResultText(string(resultBytes)), nil
}

// buildSearchCategoryQuery renders the Overpass query for a search_category
// request given the bounding box and the OSM tag mapping produced by
// mapCategoryToOSMTags. It is a pure function (no I/O) so tests can assert
// the exact string without hitting the network. Like
// buildFindNearbyPlacesQuery, a single key with multiple values collapses to
// one regex OR filter (never an impossible AND on the same key).
//
// When a category maps to multiple distinct keys, each key becomes its own
// AddAll call so the builder emits independent node/way/relation sub-queries
// and the union "()" block in Build() applies OR semantics across them.
//
// Output mode is "center" so ways/relations resolve their coordinates via the
// recursive ">;" tail.
func buildSearchCategoryQuery(southLat, westLon, northLat, eastLon float64, osmTags map[string][]string) string {
	q := overpass.NewQuery().
		WithTimeout(25).
		WithOutput("center")
	spatial := overpass.BBox(southLat, westLon, northLat, eastLon)

	// Deterministic order of keys so the rendered string is stable across runs.
	// One AddAll per key -> OR across keys (via the union block in Build()).
	keys := make([]string, 0, len(osmTags))
	for k := range osmTags {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		q.AddAll(spatial, overpass.Tag(k, osmTags[k]...))
	}
	return q.Build()
}
