package core

import (
	"math"
	"testing"
)

// TestGetTileInfo_CenterNotNWCorner is the regression anchor for the
// mislabeled-center bug. The previous implementation called
// TileToLatLon(x, int(y+0.5), zoom) — but TileToLatLon takes int, and
// int(y+0.5) truncates back to y, so center_lat/center_lon were identical to
// the NW corner (north_lat, west_lon). The fix computes the center inline with
// fractional tile coordinates (x+0.5, y+0.5), which must differ from the NW
// corner and lie strictly inside the tile bbox.
func TestGetTileInfo_CenterNotNWCorner(t *testing.T) {
	const zoom = 14
	const x, y = 9600, 12300

	info := GetTileInfo(x, y, zoom)

	if info.CenterLat == info.NorthLat {
		t.Fatalf("CenterLat == NorthLat (both %.6f): center was reusing the NW corner", info.CenterLat)
	}
	if info.CenterLon == info.WestLon {
		t.Fatalf("CenterLon == WestLon (both %.6f): center was reusing the NW corner", info.CenterLon)
	}
	// Center must lie strictly between north/south and west/east.
	if !(info.CenterLat > info.SouthLat && info.CenterLat < info.NorthLat) {
		t.Fatalf("CenterLat %.6f not strictly inside [%.6f, %.6f]",
			info.CenterLat, info.SouthLat, info.NorthLat)
	}
	if !(info.CenterLon > info.WestLon && info.CenterLon < info.EastLon) {
		t.Fatalf("CenterLon %.6f not strictly inside [%.6f, %.6f]",
			info.CenterLon, info.WestLon, info.EastLon)
	}
	// Sanity: the center should equal the explicit fractional-tile computation.
	n := math.Pow(2, float64(zoom))
	wantLon := (float64(x)+0.5)/n*360.0 - 180.0
	wantLatRad := math.Atan(math.Sinh(math.Pi * (1 - 2*(float64(y)+0.5)/n)))
	wantLat := wantLatRad * 180.0 / math.Pi
	if math.Abs(info.CenterLat-wantLat) > 1e-9 {
		t.Errorf("CenterLat = %.9f, want %.9f", info.CenterLat, wantLat)
	}
	if math.Abs(info.CenterLon-wantLon) > 1e-9 {
		t.Errorf("CenterLon = %.9f, want %.9f", info.CenterLon, wantLon)
	}
}
