package tools

import (
	"context"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"

	"github.com/NERVsystems/osmmcp/pkg/geo"
)

func TestHandleFilterTags(t *testing.T) {
	tests := []struct {
		name           string
		elements       []OSMElement
		tags           map[string][]string
		expectError    bool
		expectedCount  int
		expectedResult []string // Expected element IDs in result
	}{
		{
			name: "Filter by single tag",
			elements: []OSMElement{
				{
					ID: "1",
					Tags: map[string]string{
						"amenity": "restaurant",
						"cuisine": "italian",
					},
				},
				{
					ID: "2",
					Tags: map[string]string{
						"amenity": "cafe",
					},
				},
				{
					ID: "3",
					Tags: map[string]string{
						"shop": "bakery",
					},
				},
			},
			tags: map[string][]string{
				"amenity": {"restaurant", "cafe"},
			},
			expectError:    false,
			expectedCount:  2,
			expectedResult: []string{"1", "2"},
		},
		{
			name: "Filter by multiple tags",
			elements: []OSMElement{
				{
					ID: "1",
					Tags: map[string]string{
						"amenity": "restaurant",
						"cuisine": "italian",
					},
				},
				{
					ID: "2",
					Tags: map[string]string{
						"amenity": "restaurant",
						"cuisine": "chinese",
					},
				},
				{
					ID: "3",
					Tags: map[string]string{
						"amenity": "cafe",
					},
				},
			},
			tags: map[string][]string{
				"amenity": {"restaurant"},
				"cuisine": {"italian"},
			},
			expectError:    false,
			expectedCount:  1,
			expectedResult: []string{"1"},
		},
		{
			name: "Wildcard tag filter",
			elements: []OSMElement{
				{
					ID: "1",
					Tags: map[string]string{
						"amenity": "restaurant",
						"cuisine": "italian",
					},
				},
				{
					ID: "2",
					Tags: map[string]string{
						"amenity": "restaurant",
						"cuisine": "chinese",
					},
				},
				{
					ID: "3",
					Tags: map[string]string{
						"amenity": "cafe",
					},
				},
			},
			tags: map[string][]string{
				"amenity": {"restaurant"},
				"cuisine": {"*"}, // Any cuisine value
			},
			expectError:    false,
			expectedCount:  2,
			expectedResult: []string{"1", "2"},
		},
		{
			name: "No matching elements",
			elements: []OSMElement{
				{
					ID: "1",
					Tags: map[string]string{
						"amenity": "restaurant",
					},
				},
			},
			tags: map[string][]string{
				"shop": {"bakery"},
			},
			expectError:    false,
			expectedCount:  0,
			expectedResult: []string{},
		},
		{
			name:          "Empty elements array",
			elements:      []OSMElement{},
			tags:          map[string][]string{"amenity": {"restaurant"}},
			expectError:   true,
			expectedCount: 0,
		},
		{
			name: "Empty tags",
			elements: []OSMElement{
				{
					ID: "1",
					Tags: map[string]string{
						"amenity": "restaurant",
					},
				},
			},
			tags:          map[string][]string{},
			expectError:   true,
			expectedCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test request
			req := mcp.CallToolRequest{
				Params: mcp.CallToolParams{
					Name: "filter_tags",
					Arguments: map[string]any{
						"elements": tt.elements,
						"tags":     tt.tags,
					},
				},
			}

			// Call handler
			result, err := HandleFilterTags(context.Background(), req)

			// Check for unexpected errors
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// For expected error case
			if tt.expectError {
				AssertErrorResult(t, result, "Expected error result, but got success")
				return
			}

			// Should not be an error result
			AssertSuccessResult(t, result, "Expected success result, but got error")

			// Unmarshal result
			var output FilterTagsOutput
			if err := ParseResultJSON(result, &output); err != nil {
				t.Fatalf("Failed to unmarshal result: %v", err)
			}

			// Check element count
			if len(output.Elements) != tt.expectedCount {
				t.Errorf("Expected %d elements, got %d", tt.expectedCount, len(output.Elements))
			}

			// Check that the expected elements are present
			foundIDs := make(map[string]bool)
			for _, element := range output.Elements {
				foundIDs[element.ID] = true
			}

			for _, expectedID := range tt.expectedResult {
				if !foundIDs[expectedID] {
					t.Errorf("Expected element with ID %s not found in result", expectedID)
				}
			}
		})
	}
}

func TestHandleSortByDistance(t *testing.T) {
	tests := []struct {
		name          string
		elements      []OSMElement
		ref           geo.Location
		expectError   bool
		expectedOrder []string // Expected order of element IDs after sorting
	}{
		{
			name: "Sort elements by distance",
			elements: []OSMElement{
				{
					ID: "1",
					Location: &geo.Location{
						Latitude:  40.7128,
						Longitude: -74.0060, // New York
					},
				},
				{
					ID: "2",
					Location: &geo.Location{
						Latitude:  34.0522,
						Longitude: -118.2437, // Los Angeles
					},
				},
				{
					ID: "3",
					Location: &geo.Location{
						Latitude:  41.8781,
						Longitude: -87.6298, // Chicago
					},
				},
			},
			ref: geo.Location{
				Latitude:  38.9072,
				Longitude: -77.0369, // Washington DC
			},
			expectError:   false,
			expectedOrder: []string{"1", "3", "2"}, // Order from closest to farthest from DC
		},
		{
			name:          "Empty elements array",
			elements:      []OSMElement{},
			ref:           geo.Location{Latitude: 38.9072, Longitude: -77.0369},
			expectError:   true,
			expectedOrder: []string{},
		},
		{
			name: "Elements with center points",
			elements: []OSMElement{
				{
					ID:   "1",
					Type: "way",
					Center: &geo.Location{
						Latitude:  40.7128,
						Longitude: -74.0060, // New York
					},
				},
				{
					ID:   "2",
					Type: "way",
					Center: &geo.Location{
						Latitude:  34.0522,
						Longitude: -118.2437, // Los Angeles
					},
				},
			},
			ref: geo.Location{
				Latitude:  38.9072,
				Longitude: -77.0369, // Washington DC
			},
			expectError:   false,
			expectedOrder: []string{"1", "2"},
		},
		{
			name: "Invalid reference point",
			elements: []OSMElement{
				{
					ID: "1",
					Location: &geo.Location{
						Latitude:  40.7128,
						Longitude: -74.0060,
					},
				},
			},
			ref: geo.Location{
				Latitude:  91.0, // Invalid latitude
				Longitude: -77.0369,
			},
			expectError:   true,
			expectedOrder: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test request
			req := mcp.CallToolRequest{
				Params: mcp.CallToolParams{
					Name: "sort_by_distance",
					Arguments: map[string]any{
						"elements": tt.elements,
						"ref":      tt.ref,
					},
				},
			}

			// Call handler
			result, err := HandleSortByDistance(context.Background(), req)

			// Check for unexpected errors
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// For expected error case
			if tt.expectError {
				AssertErrorResult(t, result, "Expected error result, but got success")
				return
			}

			// Should not be an error result
			AssertSuccessResult(t, result, "Expected success result, but got error")

			// Unmarshal result
			var output SortByDistanceOutput
			if err := ParseResultJSON(result, &output); err != nil {
				t.Fatalf("Failed to unmarshal result: %v", err)
			}

			// Check element count
			if len(output.Elements) != len(tt.expectedOrder) {
				t.Errorf("Expected %d elements, got %d", len(tt.expectedOrder), len(output.Elements))
				return
			}

			// Check that the order matches expected
			for i, expectedID := range tt.expectedOrder {
				if i >= len(output.Elements) {
					break
				}
				actualID := output.Elements[i].ID
				if actualID != expectedID {
					t.Errorf("Expected element at position %d to have ID %s, got %s", i, expectedID, actualID)
				}
			}

		// Verify that distances are in ascending order
		for i := 1; i < len(output.Elements); i++ {
			if output.Elements[i-1].Distance > output.Elements[i].Distance {
				t.Errorf("Elements not sorted by distance: %f > %f",
					output.Elements[i-1].Distance, output.Elements[i].Distance)
			}
		}
		})
	}
}

// TestHandleSortByDistance_PreservesName is the regression anchor for the
// "missing name" bug: OSMElement previously had no Name field, so the JSON
// decoder silently dropped the name provided by the caller. The output must
// preserve it.
func TestHandleSortByDistance_PreservesName(t *testing.T) {
	elements := []OSMElement{
		{
			ID:   "1",
			Name: "Central Park",
			Location: &geo.Location{
				Latitude:  40.7829,
				Longitude: -73.9654,
			},
		},
		{
			ID:   "2",
			Name: "Times Square",
			Location: &geo.Location{
				Latitude:  40.7580,
				Longitude: -73.9855,
			},
		},
	}
	ref := geo.Location{Latitude: 40.7580, Longitude: -73.9855}

	req := mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name: "sort_by_distance",
			Arguments: map[string]any{
				"elements": elements,
				"ref":      ref,
			},
		},
	}

	result, err := HandleSortByDistance(context.Background(), req)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	AssertSuccessResult(t, result, "Expected success, got error")

	var output SortByDistanceOutput
	if err := ParseResultJSON(result, &output); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if len(output.Elements) != 2 {
		t.Fatalf("Expected 2 elements, got %d", len(output.Elements))
	}
	for _, el := range output.Elements {
		if el.Name == "" {
			t.Errorf("Element %q lost its Name during sort; want non-empty", el.ID)
		}
	}
	// Times Square is at the ref point so it must be first.
	if output.Elements[0].ID != "2" {
		t.Errorf("Expected element with ID=2 first (coincides with ref), got %q", output.Elements[0].ID)
	}
	if output.Elements[0].Name != "Times Square" {
		t.Errorf("Expected first element Name=Times Square, got %q", output.Elements[0].Name)
	}
}

// TestHandleSortByDistance_FlatLatLonAndError is the regression anchor for the
// silent-no-op bug: when elements used flat {lat,lon} instead of nested
// {location:{latitude,longitude}} the previous code skipped them (continue),
// left distance=0, and the sort was a no-op — with no error to the caller.
// The fix accepts flat lat/lon as a fallback AND returns an explicit error
// when no coordinate form is present at all.
func TestHandleSortByDistance_FlatLatLonAndError(t *testing.T) {
	t.Run("flat lat/lon sorts the elements", func(t *testing.T) {
		elements := []OSMElement{
			{ID: "far", Lat: 41.0, Lon: -74.5},
			{ID: "near", Lat: 40.7580, Lon: -73.9855}, // same as ref → distance 0
		}
		ref := geo.Location{Latitude: 40.7580, Longitude: -73.9855}

		req := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sort_by_distance",
				Arguments: map[string]any{
					"elements": elements,
					"ref":      ref,
				},
			},
		}
		result, err := HandleSortByDistance(context.Background(), req)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		AssertSuccessResult(t, result, "Expected success, got error")

		var output SortByDistanceOutput
		if err := ParseResultJSON(result, &output); err != nil {
			t.Fatalf("Failed to unmarshal: %v", err)
		}
		if len(output.Elements) != 2 {
			t.Fatalf("Expected 2 elements, got %d", len(output.Elements))
		}
		if output.Elements[0].ID != "near" {
			t.Errorf("Expected near element first, got %q (distances: %v, %v)",
				output.Elements[0].ID,
				output.Elements[0].Distance, output.Elements[1].Distance)
		}
	})

	t.Run("no coordinates returns explicit error", func(t *testing.T) {
		elements := []OSMElement{
			{ID: "no-loc", Type: "node"},
		}
		ref := geo.Location{Latitude: 40.0, Longitude: -74.0}

		req := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sort_by_distance",
				Arguments: map[string]any{
					"elements": elements,
					"ref":      ref,
				},
			},
		}
		result, err := HandleSortByDistance(context.Background(), req)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		AssertErrorResult(t, result, "Expected error result for element with no coordinates, got success")
	})
}

func TestHandleOSMQueryBBox_ErrorHandling(t *testing.T) {
	tests := []struct {
		name        string
		bbox        map[string]float64
		tags        map[string]string
		expectError bool
		description string
	}{
		{
			name: "Invalid bounding box - minLat >= maxLat",
			bbox: map[string]float64{
				"minLat": 50.0,
				"minLon": -1.0,
				"maxLat": 40.0, // Invalid: minLat >= maxLat
				"maxLon": 1.0,
			},
			tags: map[string]string{
				"amenity": "restaurant",
			},
			expectError: true,
			description: "Should reject invalid bounding box with minLat >= maxLat",
		},
		{
			name: "Invalid bounding box - minLon >= maxLon",
			bbox: map[string]float64{
				"minLat": 40.0,
				"minLon": 1.0,
				"maxLat": 50.0,
				"maxLon": -1.0, // Invalid: minLon >= maxLon
			},
			tags: map[string]string{
				"amenity": "restaurant",
			},
			expectError: true,
			description: "Should reject invalid bounding box with minLon >= maxLon",
		},
		{
			name: "Invalid coordinates - latitude out of range",
			bbox: map[string]float64{
				"minLat": -100.0, // Invalid latitude
				"minLon": -1.0,
				"maxLat": 50.0,
				"maxLon": 1.0,
			},
			tags: map[string]string{
				"amenity": "restaurant",
			},
			expectError: true,
			description: "Should reject invalid latitude coordinates",
		},
		{
			name: "Invalid coordinates - longitude out of range",
			bbox: map[string]float64{
				"minLat": 40.0,
				"minLon": -200.0, // Invalid longitude
				"maxLat": 50.0,
				"maxLon": 1.0,
			},
			tags: map[string]string{
				"amenity": "restaurant",
			},
			expectError: true,
			description: "Should reject invalid longitude coordinates",
		},
		{
			name: "Empty tags",
			bbox: map[string]float64{
				"minLat": 40.0,
				"minLon": -1.0,
				"maxLat": 50.0,
				"maxLon": 1.0,
			},
			tags:        map[string]string{},
			expectError: true,
			description: "Should reject empty tags",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test request
			req := mcp.CallToolRequest{
				Params: mcp.CallToolParams{
					Name: "osm_query_bbox",
					Arguments: map[string]any{
						"bbox": tt.bbox,
						"tags": tt.tags,
					},
				},
			}

			// Call handler
			result, err := HandleOSMQueryBBox(context.Background(), req)

			// Check for unexpected errors
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// For expected error case
			if tt.expectError {
				AssertErrorResult(t, result, tt.description)
				// Verify the error message contains useful information
				if result.Content != nil && len(result.Content) > 0 {
					if text, ok := result.Content[0].(mcp.TextContent); ok {
						errorText := text.Text
						// Check that the error message is not generic
						if errorText == "Overpass API error: 400" {
							t.Errorf("Error message is too generic: %s", errorText)
						}
						// Check that the error message contains helpful guidance
						if len(errorText) < 10 {
							t.Errorf("Error message is too short to be helpful: %s", errorText)
						}
					}
				}
				return
			}

			// Should not be an error result
			AssertSuccessResult(t, result, tt.description)
		})
	}
}
