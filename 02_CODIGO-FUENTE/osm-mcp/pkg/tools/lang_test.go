// Package tools: tests for lang param helper.
//
// Phase 1 OSM (2026-07-23):
//   - LangOrDefault normalises ISO 639-1 codes case-insensitive
//   - LangOrDefault accepts BCP-47 (en-US, pt-BR, es-PE)
//   - LangOrDefault falls back to "en" when input is empty or invalid
//   - CacheKeyWithLang produces distinct keys for same query in different langs
package tools

import "testing"

func TestLangOrDefault(t *testing.T) {
	cases := []struct {
		in       string
		fallback string
		want     string
	}{
		{"", "en", "en"},         // empty → fallback en
		{"", "", "en"},           // empty + empty fallback → en (builtin default)
		{"es", "en", "es"},       // valid lowercased pass-through
		{"EN", "en", "en"},       // uppercase → normalised to lowercase
		{"ES", "es", "es"},       // uppercase → normalised
		{"pt", "en", "pt"},       // Brazilian Portuguese code pass-through
		{"fr", "", "fr"},         // French valid
		{"de", "", "de"},         // German valid
		{"ja", "", "ja"},         // Japanese valid
		{"zh", "", "zh"},         // Chinese valid
		{"en-US", "en", "en"},    // BCP-47 en-US → en
		{"PT-BR", "en", "pt"},    // BCP-47 PT-BR → pt
		{"es-PE", "en", "es"},    // BCP-47 es-PE → es
		{"fr-FR", "en", "fr"},    // BCP-47 fr-FR → fr
		{"xyz", "en", "en"},      // 3 letters → invalid → fallback
		{"e", "en", "en"},        // 1 letter → invalid → fallback
		{"123", "en", "en"},      // digits → invalid → fallback
		{"deutsch", "en", "en"},  // German word, not ISO code → invalid → fallback
		{"12", "en", "en"},       // 2 chars but not letters → invalid → fallback
		{"a-", "en", "en"},       // malformed BCP-47 → invalid → fallback
		{"x-", "en", "en"},       // malformed BCP-47 single letter + dash
		{"unquoted", "en", "en"}, // long string → invalid → fallback
	}
	for _, c := range cases {
		got := LangOrDefault(c.in, c.fallback)
		if got != c.want {
			t.Errorf("LangOrDefault(%q, %q) = %q; want %q", c.in, c.fallback, got, c.want)
		}
	}
}

func TestAcceptLanguageHeader(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"", "en"},
		{"es", "es"},
		{"EN", "en"},
		{"pt", "pt"},
		{"xyz", "en"},
		{"en-US", "en"},
	}
	for _, c := range cases {
		got := AcceptLanguageHeader(c.in)
		if got != c.want {
			t.Errorf("AcceptLanguageHeader(%q) = %q; want %q", c.in, got, c.want)
		}
	}
}

func TestCacheKeyWithLangDistinct(t *testing.T) {
	// Same query in two different languages SHOULD produce distinct cache keys
	// so the LRU cache stores and serves both variants separately.
	keyEs := CacheKeyWithLang("lima", "es")
	keyEn := CacheKeyWithLang("lima", "en")
	keyPt := CacheKeyWithLang("lima", "pt")
	if keyEs == keyEn {
		t.Errorf("lima/es and lima/en collide: both = %q", keyEs)
	}
	if keyEs == keyPt {
		t.Errorf("lima/es and lima/pt collide: both = %q", keyEs)
	}
	if keyEn == keyPt {
		t.Errorf("lima/en and lima/pt collide: both = %q", keyEn)
	}
}

func TestCacheKeyWithLangNormalised(t *testing.T) {
	// "Lima" (mixed case) and "lima" (lowercase) in Spanish should produce the same key.
	// Same for empty/invalid lang: should fallback to en and match an explicit "en".
	k1 := CacheKeyWithLang("Lima", "es")
	k2 := CacheKeyWithLang("lima", "ES")
	if k1 != k2 {
		t.Errorf("expected normalised key equality; got %q vs %q", k1, k2)
	}
	k3 := CacheKeyWithLang("lima", "")
	k4 := CacheKeyWithLang("lima", "en")
	if k3 != k4 {
		t.Errorf("empty lang should fallback to en: %q vs %q", k3, k4)
	}
	k5 := CacheKeyWithLang("lima", "INVALID")
	if k5 != k4 {
		t.Errorf("invalid lang should fallback to en: %q vs %q", k5, k4)
	}
}

func TestCacheKeyWithLangFormat(t *testing.T) {
	// Key should be of form "<lang>|<base_lower>" (pipe separator).
	k := CacheKeyWithLang("Lima", "es")
	want := "es|lima"
	if k != want {
		t.Errorf("expected %q, got %q", want, k)
	}
}
