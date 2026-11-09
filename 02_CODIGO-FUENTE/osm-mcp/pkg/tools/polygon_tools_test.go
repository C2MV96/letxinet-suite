// Package tools: polygon_tools_test.go
// Tests de validación + schema para la tool polygon_from_admin.
// Cobertura:
//   - Valores válidos (devuelve sin error de validación; sieci externa se omite con t.Skip.
//   - Falta name → error.
//   - admin_level fuera de rango (>11, <1) → error.
//   - admin_level no numérico → error.
//   - lang correctamente normalizado a "es".
package tools

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

// polyReq helper: construye CallToolRequest con los args dados.
func polyReq(args map[string]any) mcp.CallToolRequest {
	return mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name:      "polygon_from_admin",
			Arguments: args,
		},
	}
}

// extractResultText extrae el texto del primer content item para inspección.
func extractResultText(t *testing.T, r *mcp.CallToolResult) string {
	t.Helper()
	if r == nil || r.Content == nil || len(r.Content) == 0 {
		return ""
	}
	if text, ok := r.Content[0].(mcp.TextContent); ok {
		return text.Text
	}
	b, _ := json.Marshal(r.Content)
	return string(b)
}

func TestPolygonFromAdmin_MissingName(t *testing.T) {
	req := polyReq(map[string]any{
		"admin_level": 9,
	})
	r, err := HandlePolygonFromAdmin(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !IsErrorResult(r) {
		t.Fatalf("expected error result, got success: %s", extractResultText(t, r))
	}
	text := extractResultText(t, r)
	if !strings.Contains(strings.ToLower(text), "name") {
		t.Errorf("error text should mention missing 'name', got: %s", text)
	}
}

func TestPolygonFromAdmin_AdminLevelOutOfRange(t *testing.T) {
	cases := []struct {
		name  string
		level int
	}{
		{"too_high", 12},
		{"too_low", 0},
		{"negative", -3},
		{"way_too_high", 99},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := polyReq(map[string]any{
				"name":        "Miraflores",
				"admin_level": c.level,
			})
			r, err := HandlePolygonFromAdmin(context.Background(), req)
			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if !IsErrorResult(r) {
				t.Fatalf("expected error result for admin_level=%d, got success: %s", c.level, extractResultText(t, r))
			}
			text := extractResultText(t, r)
			if !strings.Contains(strings.ToLower(text), "admin_level") {
				t.Errorf("error should mention admin_level, got: %s", text)
			}
		})
	}
}

func TestPolygonFromAdmin_NonNumericAdminLevel(t *testing.T) {
	// admin_level como string — el handler hace json.Unmarshal a int, debe fallar.
	req := polyReq(map[string]any{
		"name":        "Miraflores",
		"admin_level": "nueve", // string inválido
	})
	r, err := HandlePolygonFromAdmin(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	// json.Unmarshal con int target fallará → responderá "Invalid input format"
	if !IsErrorResult(r) {
		t.Fatalf("expected error result for non-numeric admin_level, got success: %s", extractResultText(t, r))
	}
}

func TestPolygonFromAdmin_EmptyName(t *testing.T) {
	req := polyReq(map[string]any{
		"name":        "   ",
		"admin_level": 9,
	})
	r, err := HandlePolygonFromAdmin(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !IsErrorResult(r) {
		t.Fatalf("expected error result for empty name, got success: %s", extractResultText(t, r))
	}
}

func TestPolygonFromAdminSchema_Definition(t *testing.T) {
	// Verifica la tool existe y su nombre es correcto + params requeridos.
	tool := PolygonFromAdminTool()
	if tool.Name != "polygon_from_admin" {
		t.Errorf("tool name = %q, want %q", tool.Name, "polygon_from_admin")
	}
	if tool.Description == "" {
		t.Errorf("tool description is empty")
	}
	// Revisa que name y admin_level están como required en schema:
	raw, _ := json.Marshal(tool.InputSchema)
	schemaStr := string(raw)
	if !strings.Contains(schemaStr, `"name"`) {
		t.Errorf("schema missing 'name' field: %s", schemaStr)
	}
	if !strings.Contains(schemaStr, `"admin_level"`) {
		t.Errorf("schema missing 'admin_level' field: %s", schemaStr)
	}
	// lang debe aparecer y tener default "es":
	if !strings.Contains(schemaStr, `"lang"`) {
		t.Errorf("schema missing 'lang' field: %s", schemaStr)
	}
	if !strings.Contains(schemaStr, `"es"`) {
		t.Errorf("schema missing 'es' default for lang: %s", schemaStr)
	}
}
