// Package tools: polygon_tools.go
// MCP tool polygon_from_admin — devuelve el polígono GeoJSON de un área administrativa OSM (distrito, provincia, departamento, país) vía Overpass.
// Fase 2 del PLAN letxipu-osm (acción 3.13).
package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"

	"github.com/NERVsystems/osmmcp/pkg/osm"
)

// PolygonFromAdminTool define el schema MCP de la herramienta polygon_from_admin.
// Parámetros:
//   - name (string, REQUIRED): nombre del área administrativa, ej. "Miraflores", "Lima", "Perú".
//   - admin_level (int, REQUIRED 1-11): nivel administrativo OSM (2=país, 4=estado, 6=departamento, 8=provincia, 9=distrito).
//   - lang (string, opcional, default "es"): idioma preferido para normalizar el nombre del área devuelto (metadata).
func PolygonFromAdminTool() mcp.Tool {
	return mcp.NewTool("polygon_from_admin",
		mcp.WithDescription("Fetch the administrative boundary polygon (GeoJSON Polygon/MultiPolygon) of a named OSM administrative area via Overpass. Parameters: name (string, REQUIRED), admin_level (int 1-11, REQUIRED; 2=country, 4=state, 6=region, 8=province, 9=district, 10=neighbourhood), lang (string ISO 639-1, optional default 'es' metadata-only)."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Administrative area name in OSM, e.g. \"Miraflores\", \"Lima\", \"Peru\".")),
		mcp.WithNumber("admin_level", mcp.Required(), mcp.Min(1), mcp.Max(11), mcp.Description("OSM admin_level tag (2=country, 4=state, 6=region, 8=province, 9=district, 10=neighbourhood).")),
		mcp.WithString("lang", mcp.DefaultString("es"), mcp.Description("ISO 639-1 language code for any localized metadata (does not affect Overpass response; Overpass returns native name:* tags directly).")),
	)
}

// PolygonFromAdminOutput estructura la salida GeoJSON FeatureCollection devuelta al cliente MCP.
// Incluye: tipo, features (1 Feature con Polygon o MultiPolygon), propiedades con admin_level/name/wikidata.
type PolygonFromAdminOutput struct {
	Type       string           `json:"type"` // siempre "FeatureCollection"
	Features   []GeoJSONFeature `json:"features"`
	Query      string           `json:"query_overpass"` // cadena Overpass QL ejecutada (transparencia)
	AdminLevel int              `json:"admin_level"`
	Name       string           `json:"name"`
	Lang       string           `json:"lang"`
	Count      int              `json:"feature_count"`
}

type GeoJSONFeature struct {
	Type       string          `json:"type"` // siempre "Feature"
	Geometry   GeoJSONGeometry `json:"geometry"`
	Properties map[string]any  `json:"properties"`
}

type GeoJSONGeometry struct {
	Type        string          `json:"type"` // "Polygon" o "MultiPolygon"
	Coordinates json.RawMessage `json:"coordinates"`
}

// polygonFromAdminInput estructura los parámetros de entrada (decodeable desde req.Params.Arguments via JSON marshal/unmarshal, patrón usado en geo_tools.go).
type polygonFromAdminInput struct {
	Name       string `json:"name"`
	AdminLevel int    `json:"admin_level"`
	Lang       string `json:"lang,omitempty"`
}

// HandlePolygonFromAdmin ejecuta la consulta Overpass y construye la FeatureCollection GeoJSON.
//
// Query Overpass:
//
//	[out:json][timeout:25];
//	area[name="<escaped>"]["admin_level"="<lvl>"]->.a;
//	.a out geom;
//
// Devuelve relación(es) con su geometría (ways con nodos inline). Convertimos a GeoJSON Polygon/MultiPolygon.
func HandlePolygonFromAdmin(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	logger := slog.Default().With("tool", "polygon_from_admin")

	var input polygonFromAdminInput
	inputJSON, err := json.Marshal(req.Params.Arguments)
	if err != nil {
		logger.Error("failed to marshal input", "error", err)
		return ErrorResponse("Invalid input format"), nil
	}
	if err := json.Unmarshal(inputJSON, &input); err != nil {
		logger.Error("failed to parse input", "error", err)
		return ErrorResponse("Invalid input format"), nil
	}
	if strings.TrimSpace(input.Name) == "" {
		return ErrorResponse("Missing or invalid 'name' parameter (non-empty string expected)"), nil
	}
	if input.AdminLevel < 1 || input.AdminLevel > 11 {
		return ErrorResponse(fmt.Sprintf("admin_level out of range (1-11), got %d", input.AdminLevel)), nil
	}
	lang := "es"
	if strings.TrimSpace(input.Lang) != "" {
		lang = LangOrDefault(input.Lang, "es")
	}

	// Construir consulta Overpass QL con escape mínimo:
	//   área con name + admin_level → out geom devuelve cada relación como un conjunto de ways con nodos
	escapedName := strings.ReplaceAll(strings.ReplaceAll(input.Name, `\`, `\\`), `"`, `\"`)
	overpassQuery := fmt.Sprintf(
		`[out:json][timeout:25];area[name="%s"]["admin_level"="%d"]->.a;.a out geom;`,
		escapedName, input.AdminLevel,
	)

	// rate limit
	if err := osm.WaitForService(ctx, osm.ServiceOverpass); err != nil {
		return ErrorWithGuidance(NewAPIError("Overpass", http.StatusTooManyRequests, "Rate limit exceeded", GuidanceOverpassRateLimit)), nil
	}

	reqURL, err := url.Parse(osm.OverpassBaseURLEnv())
	if err != nil {
		return ErrorResponse("Internal server error parsing Overpass URL"), nil
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL.String(),
		strings.NewReader("data="+url.QueryEscape(overpassQuery)))
	if err != nil {
		return ErrorResponse("Failed to create Overpass request"), nil
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.Header.Set("User-Agent", osm.GetUserAgent())

	client := osm.GetClient(ctx)
	resp, err := client.Do(httpReq)
	if err != nil {
		return ErrorResponse(OverpassNoResponde), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		errMsg := strings.TrimSpace(string(bodyBytes))
		if errMsg == "" {
			errMsg = fmt.Sprintf("Overpass API returned status %d", resp.StatusCode)
		} else {
			errMsg = fmt.Sprintf("Overpass API returned status %d: %s", resp.StatusCode, errMsg)
		}
		return ErrorWithGuidance(NewAPIError("Overpass", resp.StatusCode, errMsg, "")), nil
	}

	// Decodificar respuesta Overpass. Relación con geom viene como array de elements type=way/nodo
	// con members[] o con geometry[] (inline). Para polygon usamos los elementos type=way con geometry[] cerrada.
	var opResp struct {
		Elements []struct {
			Type string            `json:"type"` // "relation" | "way" | "node"
			ID   int64             `json:"id"`
			Tags map[string]string `json:"tags,omitempty"`
			// Way inline geometry:
			Geometry []struct {
				Lat float64 `json:"lat"`
				Lon float64 `json:"lon"`
			} `json:"geometry,omitempty"`
			// Relation members (en modo `out geom` los nodes no vienen aquí, vienen como type=way con geometry[])
			Members []struct {
				Type string `json:"type"`
				Ref  int64  `json:"ref"`
				Role string `json:"role"`
			} `json:"members,omitempty"`
			Bounds *struct {
				MinLat float64 `json:"minlat"`
				MinLon float64 `json:"minlon"`
				MaxLat float64 `json:"maxlat"`
				MaxLon float64 `json:"maxlon"`
			} `json:"bounds,omitempty"`
		} `json:"elements"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&opResp); err != nil {
		return ErrorResponse("Failed to parse Overpass API response"), nil
	}

	// Recolectar ways cerrados como Polygon rings.
	// polygons es []Polygon; cada Polygon = []ring (1 exterior + N holes); cada ring = [][]{lon,lat}.
	polygons := make([][][]float64, 0, 4) // MultiPolygon = []Polygon; aquí guardaremos N Polygon wollen.
	relTags := map[string]string{}
	for _, el := range opResp.Elements {
		if el.Type == "relation" && len(el.Tags) > 0 {
			for k, v := range el.Tags {
				relTags[k] = v
			}
		}
		if el.Type == "way" && len(el.Geometry) >= 4 {
			// Anillo exterior: cada punto es [lon, lat] en GeoJSON.
			ring := make([][]float64, 0, len(el.Geometry))
			for _, pt := range el.Geometry {
				ring = append(ring, []float64{pt.Lon, pt.Lat})
			}
			// Verificar cierre: último == primero
			if len(ring) >= 2 {
				first := ring[0]
				last := ring[len(ring)-1]
				if first[0] != last[0] || first[1] != last[1] {
					ring = append(ring, []float64{first[0], first[1]})
				}
			}
			// Polygon = [exterior_ring, hole1, hole2, ...]; aquí ring solo es la exterior. Polygon = ring ([][]float64).
			polygons = append(polygons, ring)
		}
	}

	if len(polygons) == 0 {
		return ErrorResponse(fmt.Sprintf("No closed way geometry returned by Overpass for name=%q admin_level=%d (área posiblemente no mapeada o admin_level no coincide)", input.Name, input.AdminLevel)), nil
	}

	// Construir GeoJSON geometry: si solo 1 polígono → Polygon, si más → MultiPolygon.
	var geom GeoJSONGeometry
	props := map[string]any{
		"admin_level": input.AdminLevel,
	}
	// Tomar nombre localizado según lang; fallback a name genérico, fallback a entrada del usuario.
	for _, k := range []string{"name:" + lang, "name", "name:en", "name:es"} {
		if v, ok := relTags[k]; ok && v != "" {
			props["name"] = v
			break
		}
	}
	if _, ok := props["name"]; !ok {
		props["name"] = input.Name
	}
	if wd, ok := relTags["wikidata"]; ok {
		props["wikidata"] = wd
	}
	if _, ok := relTags["ISO3166-1"]; ok {
		props["iso3166_1"] = relTags["ISO3166-1"]
	}
	if _, ok := relTags["ISO3166-2"]; ok {
		props["iso3166_2"] = relTags["ISO3166-2"]
	}

	if len(polygons) == 1 {
		geom.Type = "Polygon"
		coords, _ := json.Marshal(polygons[0]) // [][]float64 = 1 Polygon (exterior + holes)
		geom.Coordinates = coords
	} else {
		geom.Type = "MultiPolygon"
		coords, _ := json.Marshal(polygons) // [][][]float64 = N Polygons
		geom.Coordinates = coords
	}

	feat := GeoJSONFeature{
		Type:       "Feature",
		Geometry:   geom,
		Properties: props,
	}

	out := PolygonFromAdminOutput{
		Type:       "FeatureCollection",
		Features:   []GeoJSONFeature{feat},
		Query:      overpassQuery,
		AdminLevel: input.AdminLevel,
		Name:       fmt.Sprintf("%v", props["name"]),
		Lang:       lang,
		Count:      1,
	}
	body, _ := json.MarshalIndent(out, "", "  ")
	return mcp.NewToolResultText(string(body)), nil
}
