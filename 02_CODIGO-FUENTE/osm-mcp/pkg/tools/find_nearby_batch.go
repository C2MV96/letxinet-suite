// Package tools: find_nearby_batch.go
// MCP tool find_nearby_batch — ejecuta múltiples consultas find_nearby_places en paralelo controlado.
// Fase 2 del PLAN letxipu-osm (acción 3.15).
//
// Atajo: acepta un array de hasta 10 sub-queries {latitude, longitude, radius, category, limit, label}
// y devuelve resultados bulk etiquetados. Útil para analyze_neighborhood que hoy llama 4-6 veces
// a find_nearby_places → reduce viajes a 1 batch.
package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

const FindNearbyBatchMaxQueries = 10
const FindNearbyBatchConcurrency = 3

// FindNearbyBatchTool define el schema MCP de la herramienta find_nearby_batch.
func FindNearbyBatchTool() mcp.Tool {
	return mcp.NewTool("find_nearby_batch",
		mcp.WithDescription("Bulk find_nearby_places: acepta hasta 10 sub-queries {latitude, longitude, radius, category, limit, label} y devuelve resultados bulk en paralelo (concurrencia 3). Respeta rate-limits Overpass. Útil para analyze_neighborhood y casos similares."),
		mcp.WithArray("queries",
			mcp.Required(),
			mcp.Description("Array de sub-consultas. Cada elemento: {latitude (float), longitude (float), radius (int metros, opcional default 1000), category (string), limit (int default 10), label (string opcional para identificar el resultado)}. Máximo 10 consultas."),
		),
	)
}

// nearbyBatchQueryItem estructura cada sub-consulta.
type nearbyBatchQueryItem struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Radius    int     `json:"radius,omitempty"`
	Category  string  `json:"category"`
	Limit     int     `json:"limit,omitempty"`
	Label     string  `json:"label,omitempty"`
}

// nearbyBatchResultItem resultado para cada sub-consulta.
type nearbyBatchResultItem struct {
	Label    string          `json:"label,omitempty"`
	Query    nearbyBatchQueryItem `json:"query"`
	Ok       bool            `json:"ok"`
	Error    string          `json:"error,omitempty"`
	Raw      json.RawMessage `json:"result,omitempty"`
	Duration int64           `json:"duration_ms,omitempty"`
}

// nearbyBatchOutput estructura final devuelta al cliente MCP.
type nearbyBatchOutput struct {
	Total     int                      `json:"total"`
	OK        int                      `json:"ok"`
	Failed    int                      `json:"failed"`
	Results   []nearbyBatchResultItem  `json:"results"`
	Took      int64                    `json:"took_ms"`
}

// nearbyBatchInput estructura los parámetros de entrada (decodeable desde req.Params.Arguments via JSON marshal/unmarshal).
type nearbyBatchInput struct {
	Queries []nearbyBatchQueryItem `json:"queries"`
}

// HandleFindNearbyBatch ejecuta sub-consultas en paralelo controlado con semáforo + sync.WaitGroup.
func HandleFindNearbyBatch(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	inputJSON, err := json.Marshal(req.Params.Arguments)
	if err != nil {
		return ErrorResponse("Invalid input format (marshalling failed)"), nil
	}
	var input nearbyBatchInput
	if err := json.Unmarshal(inputJSON, &input); err != nil {
		return ErrorResponse("Failed to parse 'queries' array (expected array of {latitude, longitude, category, ...})"), nil
	}
	queries := input.Queries
	if len(queries) == 0 {
		return ErrorResponse("'queries' array is empty"), nil
	}
	if len(queries) > FindNearbyBatchMaxQueries {
		return ErrorResponse(fmt.Sprintf("Too many queries: maximum %d allowed (got %d)", FindNearbyBatchMaxQueries, len(queries))), nil
	}

	// Semáforo manual (cap concurrency=3) + sync.WaitGroup para采集 resultados.
	// Usamos un semaphore buffered channel en lugar de errgroup para no añadir dep extra.
	sem := make(chan struct{}, FindNearbyBatchConcurrency)
	wg := sync.WaitGroup{}
	results := make([]nearbyBatchResultItem, len(queries))
	startTotal := nowUnixMilli()

	for i, q := range queries {
		wg.Add(1)
		go func(idx int, query nearbyBatchQueryItem) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			start := nowUnixMilli()
			item := nearbyBatchResultItem{
				Label: query.Label,
				Query: query,
			}

			// Default values if not provided.
			radius := query.Radius
			if radius <= 0 {
				radius = 1000
			}
			limit := query.Limit
			if limit <= 0 {
				limit = 10
			}

			// Reuse HandleFindNearbyPlaces building internal CallToolRequest.
			subReq := mcp.CallToolRequest{
				Params: mcp.CallToolParams{
					Name: "find_nearby_places",
					Arguments: map[string]any{
						"latitude":  query.Latitude,
						"longitude": query.Longitude,
						"radius":    radius,
						"category":  query.Category,
						"limit":     limit,
					},
				},
			}

			subResult, subErr := HandleFindNearbyPlaces(ctx, subReq)
			item.Duration = nowUnixMilli() - start

			if subErr != nil {
				item.Ok = false
				item.Error = subErr.Error()
			} else if IsErrorResult(subResult) {
				item.Ok = false
				// Extract text content if present.
				if subResult.Content != nil && len(subResult.Content) > 0 {
					if txt, ok := subResult.Content[0].(mcp.TextContent); ok {
						item.Error = txt.Text
					} else {
						b, _ := json.Marshal(subResult.Content)
						item.Error = string(b)
					}
				}
			} else {
				item.Ok = true
				// Extract text content as RawMessage.
				if subResult.Content != nil && len(subResult.Content) > 0 {
					if txt, ok := subResult.Content[0].(mcp.TextContent); ok {
						item.Raw = json.RawMessage(txt.Text)
					}
				}
			}
			results[idx] = item
		}(i, q)
	}
	wg.Wait()

	out := nearbyBatchOutput{
		Total:   len(queries),
		Results: results,
		Took:    nowUnixMilli() - startTotal,
	}
	for _, r := range results {
		if r.Ok {
			out.OK++
		} else {
			out.Failed++
		}
	}
	body, _ := json.MarshalIndent(out, "", "  ")
	return mcp.NewToolResultText(string(body)), nil
}

// nowUnixMilli devuelve epoch milliseconds.
func nowUnixMilli() int64 {
	return time.Now().UnixMilli()
}
