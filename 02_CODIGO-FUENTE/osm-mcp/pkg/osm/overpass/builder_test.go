package overpass

import (
	"strings"
	"testing"
)

// TestQuery_Build_TableDriven exercises every TagCondition / spatial branch
// and asserts the exact rendered query string. These are the regression
// anchors for the OR-vs-AND fix that previously produced
// "[amenity=restaurant][amenity=cafe]..." (an impossible AND).
func TestQuery_Build_TableDriven(t *testing.T) {
	cases := []struct {
		name     string
		query    *Query
		expected string
	}{
		{
			name: "node + bbox + one tag simple",
			query: NewQuery().
				AddNode(BBox(1, 2, 3, 4), Tag("amenity", "cafe")),
			expected: "[out:json][timeout:25];(node(1.000000,2.000000,3.000000,4.000000)[amenity=cafe];);out body;>;out center;",
		},
		{
			name: "node + around + six amenity values => regex OR not AND",
			query: NewQuery().
				AddNode(
					Around(-9.07, -78.59, 5000),
					Tag("amenity", "restaurant", "cafe", "fast_food", "bar", "pub", "food_court"),
				),
			// Regression anchor for the bug that produced
			//   [amenity=restaurant][amenity=cafe][amenity=fast_food]...
			expected: `[out:json][timeout:25];(node(around:5000.0,-9.070000,-78.590000)[amenity~"restaurant|cafe|fast_food|bar|pub|food_court"];);out body;>;out center;`,
		},
		{
			name: "existence-only single key",
			query: NewQuery().
				AddNode(Around(40.71, -74.0, 1000), AnyTag("amenity")),
			expected: "[out:json][timeout:25];(node(around:1000.0,40.710000,-74.000000)[amenity];);out body;>;out center;",
		},
		{
			name: "existence-only via Tag(key) with no values",
			query: NewQuery().
				AddNode(Around(40.71, -74.0, 1000), Tag("shop")),
			expected: "[out:json][timeout:25];(node(around:1000.0,40.710000,-74.000000)[shop];);out body;>;out center;",
		},
		{
			name: "wildcard star collapses to existence-only",
			query: NewQuery().
				AddNode(BBox(0, 0, 1, 1), Tag("amenity", "*")),
			expected: "[out:json][timeout:25];(node(0.000000,0.000000,1.000000,1.000000)[amenity];);out body;>;out center;",
		},
		{
			name: "exclude single value",
			query: NewQuery().
				AddNode(BBox(0, 0, 1, 1), NotTag("amenity", "parking")),
			expected: "[out:json][timeout:25];(node(0.000000,0.000000,1.000000,1.000000)[amenity!=parking];);out body;>;out center;",
		},
		{
			name: "exclude multiple values => regex negation",
			query: NewQuery().
				AddNode(BBox(0, 0, 1, 1), NotTag("amenity", "parking", "services")),
			expected: `[out:json][timeout:25];(node(0.000000,0.000000,1.000000,1.000000)[amenity!~"parking|services"];);out body;>;out center;`,
		},
		{
			name: "exclude existence-only",
			query: NewQuery().
				AddNode(BBox(0, 0, 1, 1), NotTag("amenity")),
			expected: "[out:json][timeout:25];(node(0.000000,0.000000,1.000000,1.000000)[!amenity];);out body;>;out center;",
		},
		{
			name: "AND of multi-value (same key) AND existence (different key) within one sub-query",
			query: NewQuery().
				AddNode(BBox(0, 0, 1, 1),
					Tag("leisure", "park", "garden"),
					AnyTag("name"),
				),
			expected: `[out:json][timeout:25];(node(0.000000,0.000000,1.000000,1.000000)[leisure~"park|garden"][name];);out body;>;out center;`,
		},
		{
			name: "output=geom suffix",
			query: NewQuery().
				WithOutput("geom").
				AddWay(BBox(0, 0, 1, 1), Tag("highway", "bus_stop")),
			expected: "[out:json][timeout:25];(way(0.000000,0.000000,1.000000,1.000000)[highway=bus_stop];);out geom;>;out center;",
		},
		{
			name: "AddAll expands to 3 element types sharing spatial+tags",
			query: NewQuery().
				AddAll(BBox(0, 0, 1, 1), Tag("amenity", "restaurant")),
			expected: "[out:json][timeout:25];(node(0.000000,0.000000,1.000000,1.000000)[amenity=restaurant];way(0.000000,0.000000,1.000000,1.000000)[amenity=restaurant];relation(0.000000,0.000000,1.000000,1.000000)[amenity=restaurant];);out body;>;out center;",
		},
		{
			name: "OR across distinct tag groups via separate sub-queries (explore_area style)",
			query: NewQuery().
				AddAll(Around(1, 2, 500), AnyTag("amenity")).
				AddAll(Around(1, 2, 500), AnyTag("shop")).
				AddAll(Around(1, 2, 500), AnyTag("tourism")),
			expected: `[out:json][timeout:25];(node(around:500.0,1.000000,2.000000)[amenity];way(around:500.0,1.000000,2.000000)[amenity];relation(around:500.0,1.000000,2.000000)[amenity];node(around:500.0,1.000000,2.000000)[shop];way(around:500.0,1.000000,2.000000)[shop];relation(around:500.0,1.000000,2.000000)[shop];node(around:500.0,1.000000,2.000000)[tourism];way(around:500.0,1.000000,2.000000)[tourism];relation(around:500.0,1.000000,2.000000)[tourism];);out body;>;out center;`,
		},
		{
			name: "custom timeout",
			query: NewQuery().
				WithTimeout(60).
				AddNode(BBox(-1, -2, 1, 2)),
			expected: "[out:json][timeout:60];(node(-1.000000,-2.000000,1.000000,2.000000););out body;>;out center;",
		},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			got := c.query.Build()
			if got != c.expected {
				t.Fatalf("unexpected query:\n got: %s\nwant: %s", got, c.expected)
			}
		})
	}
}

// TestQuery_Regression_NoAndCollapse extends the table-driven case with the
// exact shape historically broken: a single amenity key with multiple values
// must NEVER produce repeated single-value filters, which Overpass interprets
// as an impossible AND on the same key.
func TestQuery_Regression_NoAndCollapse(t *testing.T) {
	q := NewQuery().
		AddNode(
			Around(-9.07, -78.59, 5000),
			Tag("amenity", "restaurant", "cafe", "fast_food", "bar", "pub", "food_court"),
		)
	got := q.Build()

	if strings.Contains(got, "[amenity=restaurant]") {
		t.Fatalf("query collapsed OR into AND (saw [amenity=restaurant] literal): %s", got)
	}
	if strings.Contains(got, "][amenity=") {
		t.Fatalf("query contains repeated single-value [amenity=...] filters (AND-of-same-key): %s", got)
	}
	if !strings.Contains(got, `[amenity~"restaurant|cafe|fast_food|bar|pub|food_court"]`) {
		t.Fatalf("query is missing the expected regex OR filter: %s", got)
	}
}
