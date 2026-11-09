// Package tools: lang param for Nominatim Accept-Language header.
//
// Phase 1 OSM (2026-07-23): add a `lang` parameter to the 6 geocoding-class
// tools so that Nominatim returns `display_name` in Spanish/English/etc.
// Default per-tool language may be overridden per-call by the MCP client.
//
// Background: the original repository always returned names in English
// ("Peru", "Lima Province") because Nominatim defaults to the local
// language of the feature (often English for international results)
// unless the client specifies `Accept-Language`. Nominatim doc:
// https://nominatim.org/release-docs/develop/api/Search/#language-parameter
//
// This file provides:
//   - ParseLang(raw): validates an ISO 639-1 code (es, en, pt, fr, de, ...),
//     normalises case, and falls back to "en" if invalid or empty.
//   - LangOrDefault(raw, fallback): same as ParseLang with explicit fallback.
//   - AcceptLanguageHeader(lang): builds the HTTP header value Nominatim wants
//     (single 2-letter code, e.g. "es"; "en" if empty).
//   - CacheKeyWithLang(base, lang): keys the LRU cache by (base, lang) tuple
//     so that "Lima" / lang="es" and "Lima" / lang="en" do not collide.
package tools

import (
	"strings"
)

// supportedLangs is a small whitelist of common Nominatim-compatible ISO 639-1 codes.
// Nominatim accepts any 2-letter code; we whitelist for predictability but fall
// through to any 2-letter lowercase code via ParseLang's lenient validator.
var supportedLangs = map[string]string{
	"es": "es", "en": "en", "pt": "pt", "fr": "fr", "de": "de",
	"it": "it", "nl": "nl", "ru": "ru", "ja": "ja", "zh": "zh",
	"ar": "ar", "ko": "ko", "sv": "sv", "pl": "pl", "tr": "tr",
}

// LangOrDefault returns a normalised 2-letter ISO 639-1 code. Returns `fallback`
// (or "en" if fallback empty) when raw is empty/invalid. Always lowercase.
//
// Lenient validator: accepts any 2-letter lowercase ASCII string. We also
// accept 5-char BCP-47 like "en-US", "pt-BR", "es-PE": the first 2 chars are
// returned. Anything else falls back to the default.
func LangOrDefault(raw, fallback string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if len(raw) == 2 && isLowerLetters(raw) {
		return raw
	}
	if len(raw) == 5 && raw[2] == '-' && isLowerLetters(raw[:2]) {
		return raw[:2]
	}
	if _, ok := supportedLangs[raw]; ok {
		return raw
	}
	return fallbackOrEN(fallback)
}

func isLowerLetters(s string) bool {
	for _, c := range s {
		if c < 'a' || c > 'z' {
			return false
		}
	}
	return true
}

func fallbackOrEN(fallback string) string {
	fallback = strings.ToLower(strings.TrimSpace(fallback))
	if fallback == "" {
		return "en"
	}
	return fallback
}

// AcceptLanguageHeader returns the value suitable for Nominatim `Accept-Language`
// HTTP header. Empty lang → "en" (Nominatim-safe default).
func AcceptLanguageHeader(lang string) string {
	return LangOrDefault(lang, "en")
}

// CacheKeyWithLang builds a cache key incorporating the language code so that
// the same query cached in Spanish is distinct from the same query in English.
// Example: CacheKeyWithLang("lima", "es") → "es|lima".
func CacheKeyWithLang(base, lang string) string {
	l := LangOrDefault(lang, "en")
	b := strings.ToLower(strings.TrimSpace(base))
	return l + "|" + b
}
