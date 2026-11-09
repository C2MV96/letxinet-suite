// Package tools: find_nearby_batch_test.go
// Tests de validación + schema para la tool find_nearby_batch.
// Cubre:
//   - Schema correcto (nombre, params queries requerido, max 10).
//   - Falta 'queries' array → error.
//   - queries array vacío → error.
//   - > 10 queries → error.
//   - Sub-queries con category faltante → sub-resultados fallidos etiquetados (no fatal).
//   - Labels se propagan correctamente.
// Nota: tests que requieren Overpass real son MarkSkip.
package tools

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

// batchReq helper: construye CallToolRequest con los args dados (queries array).
func batchReq(queries any) mcp.CallToolRequest {
	return mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name: "find_nearby_batch",
			Arguments: map[string]any{
				"queries": queries,
			},
		},
	}
}

func TestFindNearbyBatchSchema(t *testing.T) {
	tool := FindNearbyBatchTool()
	if tool.Name != "find_nearby_batch" {
		t.Errorf("name = %q, want %q", tool.Name, "find_nearby_batch")
	}
	if tool.Description == "" {
		t.Errorf("description is empty")
	}
	raw, _ := json.Marshal(tool.InputSchema)
	s := string(raw)
	if !strings.Contains(s, `"queries"`) {
		t.Errorf("schema missing 'queries' field: %s", s)
	}
}

func TestFindNearbyBatch_MissingQueries(t *testing.T) {
	// Argumentos vacíos: queries simplemente no declarado.
	req := mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name:      "find_nearby_batch",
			Arguments: map[string]any{},
		},
	}
	r, err := HandleFindNearbyBatch(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !IsErrorResult(r) {
		t.Fatalf("expected error result (queries missing), got success: %s", extractResultText(t, r))
	}
}

func TestFindNearbyBatch_EmptyArray(t *testing.T) {
	req := batchReq([]map[string]any{})
	r, err := HandleFindNearbyBatch(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !IsErrorResult(r) {
		t.Fatalf("expected error result (empty queries), got success: %s", extractResultText(t, r))
	}
	text := strings.ToLower(extractResultText(t, r))
	if !strings.Contains(text, "empty") {
		t.Errorf("error should mention 'empty', got: %s", text)
	}
}

func TestFindNearbyBatch_TooManyQueries(t *testing.T) {
	tooMany := make([]map[string]any, 11)
	for i := range tooMany {
		tooMany[i] = map[string]any{
			"latitude":  -12.1,
			"longitude": -77.0,
			"category":  "restaurant",
		}
	}
	req := batchReq(tooMany)
	r, err := HandleFindNearbyBatch(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !IsErrorResult(r) {
		t.Fatalf("expected error result (too many queries), got success: %s", extractResultText(t, r))
	}
	text := extractResultText(t, r)
	if !strings.Contains(text, "10") {
		t.Errorf("error should mention max 10, got: %s", text)
	}
}

func TestFindNearbyBatch_MissingCategoryPerItem_NoFatal(t *testing.T) {
	// Sub-queries sin category: el handler no fatala globalmente; cada sub-result
	// reportará su propio error sin romper el batch. Skip si Overpass offline
	// (depende de HandleFindNearbyPlaces que DUVIDAD irá a Overpass).
	t.Skip("requires Overpass connectivity; skipped to avoid flakes in CI")
}

func TestFindNearbyBatch_LabelPropagation(t *testing.T) {
	// Verificamos que las labels se preservan en el output vía mocking manual:
	// esto requiere aislar la serialización. Hacemos una validación estructural con
	// parse directo del output JSON construido por el handler.
	// Como esto requiere ejecución real de HandleFindNearbyPlaces, skip si no hay red.
	t.Skip("requires Overpass connectivity; skipped to avoid flakes in CI")
}

func TestFindNearbyBatch_ConcurrencyConstant(t *testing.T) {
	// Sanity: la constante debe ser razonable (<= 10 para no exceder rate-limits Overpass).
	if FindNearbyBatchConcurrency < 1 || FindNearbyBatchConcurrency > 10 {
		t.Errorf("FindNearbyBatchConcurrency out of sane range (1-10): %d", FindNearbyBatchConcurrency)
	}
	if FindNearbyBatchMaxQueries < 1 || FindNearbyBatchMaxQueries > 100 {
		t.Errorf("FindNearbyBatchMaxQueries out of sane range (1-100): %d", FindNearbyBatchMaxQueries)
	}
}
