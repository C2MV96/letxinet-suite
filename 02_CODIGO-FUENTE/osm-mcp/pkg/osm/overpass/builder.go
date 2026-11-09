// Package overpass provides a single, unified fluent builder for Overpass API
// queries. It replaces the two divergent builders that previously lived in
// pkg/core/overpass.go (broken OR-vs-AND handling) and pkg/osm/queries/templates.go
// (no around/multi-value support).
//
// Design goals:
//   - A TagCondition with multiple values MUST emit a regex OR
//     ("[key~\"a|b|c\"]"), never a conjunction of single-value filters.
//   - An empty Values slice (or a single "*") means existence-only ("[key]").
//   - Spatial filters may be a bounding box or an around:center:radius.
//   - Element types (node/way/relation) are explicit per query so callers
//     can choose precisely which types they want.
//   - Output ("body" / "center" / "geom") is configurable; "center" adds the
//     recursive ">;" and "out center;" tail needed for way/relation geometry.
package overpass

import (
	"fmt"
	"strings"

	"github.com/NERVsystems/osmmcp/pkg/geo"
)

// DefaultTimeout is the Overpass query timeout in seconds when unspecified.
const DefaultTimeout = 25

// SpatialType enumerates the supported spatial filter kinds.
type SpatialType string

const (
	SpatialBBox   SpatialType = "bbox"
	SpatialAround SpatialType = "around"
)

// SpatialFilter constrains a query geographically. Use BBox or Around to
// construct one; zero-value SpatialFilter is invalid.
type SpatialFilter struct {
	Type SpatialType

	// BBox fields (south, west, north, east)
	MinLat, MinLon, MaxLat, MaxLon float64

	// Around fields
	Lat, Lon, Radius float64
}

// BBox returns a bounding-box spatial filter.
func BBox(minLat, minLon, maxLat, maxLon float64) *SpatialFilter {
	return &SpatialFilter{
		Type:   SpatialBBox,
		MinLat: minLat, MinLon: minLon, MaxLat: maxLat, MaxLon: maxLon,
	}
}

// BBoxFromGeo returns a bounding-box spatial filter from a geo.BoundingBox.
func BBoxFromGeo(bb *geo.BoundingBox) *SpatialFilter {
	if bb == nil {
		return nil
	}
	return BBox(bb.MinLat, bb.MinLon, bb.MaxLat, bb.MaxLon)
}

// Around returns an around spatial filter (center + radius in meters).
func Around(lat, lon, radius float64) *SpatialFilter {
	return &SpatialFilter{
		Type:   SpatialAround,
		Lat:    lat,
		Lon:    lon,
		Radius: radius,
	}
}

// TagCondition expresses a tag filter on an element query.
//
// Empty Values (or Values containing only "*") means existence-only ("[key]"),
// never a literal match against empty string.
//
// A single non-wildcard value emits "[key=value]". Multiple values emit a
// regex OR: "[key~\"a|b|c\"]". This is the regex branch that the legacy
// pkg/core/overpass.go already implemented but never reached because callers
// invoked WithTag once per value.
type TagCondition struct {
	Key     string
	Values  []string
	Exclude bool
}

// Tag returns an inclusive tag condition with the given values.
// Calling Tag("amenity") with no values means existence-only ([amenity]).
// Calling Tag("amenity","restaurant","cafe") emits [amenity~"restaurant|cafe"].
func Tag(key string, values ...string) TagCondition {
	return TagCondition{Key: key, Values: values}
}

// AnyTag returns an existence-only tag condition ([key]). It is the explicit
// equivalent of Tag(key) with no values.
func AnyTag(key string) TagCondition {
	return TagCondition{Key: key}
}

// NotTag returns an excluding tag condition. With no values it emits [!key];
// with one value it emits [key!=value]; with multiple values it emits
// [key!~"a|b|c"].
func NotTag(key string, values ...string) TagCondition {
	return TagCondition{Key: key, Values: values, Exclude: true}
}

// ElementQuery is a single element (node/way/relation) sub-query inside the
// union block.
type ElementQuery struct {
	ElementType string // "node" | "way" | "relation"
	Spatial     *SpatialFilter
	Tags        []TagCondition
}

// Query is the top-level Overpass query being built.
type Query struct {
	Timeout      int
	OutputFormat string // "json" by default
	Output       string // "body" by default; "center" adds >;out center;
	Elements     []ElementQuery
}

// NewQuery returns a Query with sane defaults (json output, 25s timeout).
func NewQuery() *Query {
	return &Query{
		Timeout:      DefaultTimeout,
		OutputFormat: "json",
		Output:       "body",
		Elements:     nil,
	}
}

// WithTimeout sets the query timeout in seconds.
func (q *Query) WithTimeout(seconds int) *Query {
	q.Timeout = seconds
	return q
}

// WithOutput sets the output mode ("body", "center", "geom").
func (q *Query) WithOutput(out string) *Query {
	q.Output = out
	return q
}

// AddNode appends a node sub-query with the given spatial filter and tags.
func (q *Query) AddNode(sp *SpatialFilter, tags ...TagCondition) *Query {
	q.Elements = append(q.Elements, ElementQuery{ElementType: "node", Spatial: sp, Tags: tags})
	return q
}

// AddWay appends a way sub-query.
func (q *Query) AddWay(sp *SpatialFilter, tags ...TagCondition) *Query {
	q.Elements = append(q.Elements, ElementQuery{ElementType: "way", Spatial: sp, Tags: tags})
	return q
}

// AddRelation appends a relation sub-query.
func (q *Query) AddRelation(sp *SpatialFilter, tags ...TagCondition) *Query {
	q.Elements = append(q.Elements, ElementQuery{ElementType: "relation", Spatial: sp, Tags: tags})
	return q
}

// AddAll appends node+way+relation sub-queries that share the same spatial
// filter and the same set of tag conditions. This is a convenience for the
// common case of "match any element type with these tags in this area".
//
// Note: the tags here are AND'ed within each sub-query (i.e. a returned
// element must satisfy ALL TagConditions). To express an OR across tag groups
// (e.g. "any element with [amenity] OR [shop]"), add separate sub-queries per
// group via repeated AddAll / AddNode / AddWay / AddRelation calls; the union
// "()" block in Build() applies OR semantics across sub-queries.
func (q *Query) AddAll(sp *SpatialFilter, tags ...TagCondition) *Query {
	q.AddNode(sp, tags...)
	q.AddWay(sp, tags...)
	q.AddRelation(sp, tags...)
	return q
}

// spatialString renders the spatial filter portion (e.g. "(around:5000,...)"
// or "(1.0,2.0,3.0,4.0)").
func (s *SpatialFilter) spatialString() string {
	if s == nil {
		return ""
	}
	switch s.Type {
	case SpatialAround:
		return fmt.Sprintf("(around:%.1f,%.6f,%.6f)", s.Radius, s.Lat, s.Lon)
	case SpatialBBox:
		return fmt.Sprintf("(%.6f,%.6f,%.6f,%.6f)", s.MinLat, s.MinLon, s.MaxLat, s.MaxLon)
	default:
		return ""
	}
}

// tagString renders a single TagCondition.
func (t TagCondition) tagString() string {
	// Normalize wildcard "*" to existence-only.
	values := make([]string, 0, len(t.Values))
	for _, v := range t.Values {
		if v == "*" {
			continue
		}
		values = append(values, v)
	}

	// Existence-only when no concrete values remain after wildcard removal.
	if len(values) == 0 {
		if t.Exclude {
			return fmt.Sprintf("[!%s]", t.Key)
		}
		return fmt.Sprintf("[%s]", t.Key)
	}

	if len(values) == 1 {
		if t.Exclude {
			return fmt.Sprintf("[%s!=%s]", t.Key, values[0])
		}
		return fmt.Sprintf("[%s=%s]", t.Key, values[0])
	}

	joined := strings.Join(values, "|")
	if t.Exclude {
		return fmt.Sprintf("[%s!~\"%s\"]", t.Key, joined)
	}
	return fmt.Sprintf("[%s~\"%s\"]", t.Key, joined)
}

// elementString renders a single sub-query (e.g. "node(around:...)[amenity~\"...\"];").
func (e ElementQuery) elementString() string {
	var b strings.Builder
	b.WriteString(e.ElementType)
	b.WriteString(e.Spatial.spatialString())
	for _, t := range e.Tags {
		b.WriteString(t.tagString())
	}
	b.WriteString(";")
	return b.String()
}

// Build returns the complete Overpass query string.
func (q *Query) Build() string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("[out:%s][timeout:%d];", q.OutputFormat, q.Timeout))
	b.WriteString("(")
	for _, e := range q.Elements {
		b.WriteString(e.elementString())
	}
	b.WriteString(");out ")
	b.WriteString(q.Output)
	b.WriteString(";")
	// "out body;" alone returns ways/relations without their geometry; the
	// recursive ">;" + "out center;" tail requests member nodes so callers
	// can resolve coordinates for non-node elements. This matches the
	// contract the legacy builders exposed (they appended it whenever the
	// output format was json). Callers that want a raw "out body;" without
	// the recursive tail can set Output to "" — but every OSM POI handler
	// in this codebase needs resolved geometry, so the default keeps it.
	if q.Output == "body" || q.Output == "center" || q.Output == "geom" {
		b.WriteString(">;out center;")
	}
	return b.String()
}
