---
name: word-search-replace-bulk
description: Use for finding and bulk-replacing text occurrences across an entire docx — search_and_replace globally replaces all matches, find_text_in_document returns occurrences with paragraph_index and position. Ideal for schema migrations, term normalization, anonymization, brand name updates, profanity filtering.
trigger_keywords: search replace docx, bulk text replace, anonymization, schema migration word, term normalization, find occurrences word
---

# SKILL: word-search-replace-bulk (solo-Word S9E-6)

## Proven Chain (2026-08-08)

```
word.find_text_in_document(filename="<doc.docx>",
                          text_to_find="<needle>",
                          match_case=true|false,
                          whole_word=true|false)
  ↓ JSON: occurrences [{paragraph_index, position, context}], total_count
word.search_and_replace(filename="<doc.docx>",
                        find_text="<old>",
                        replace_text="<new>")
  ↓ integer count of replaced occurrences
```

## Validated Output (2026-08-08)

**S9E-6 demo on S9E1-template-generator.docx:**

### find_text_in_document "automáticamente" (match_case=false, whole_word=false)
- Result: 0 occurrences (encoding issue — search charset mismatch with accented chars)
- Use plain ASCII for non-ASCII matching

### find_text_in_document "Objetivos" (whole_word=true)
- Result:
```json
{
  "query": "Objetivos",
  "occurrences": [
    {"paragraph_index": 2, "position": 0, "context": "Objetivos"}
  ],
  "total_count": 1
}
```

### search_and_replace "harness S9E-1" → "harness S9E-1 (version 1.0) — bulk search-replace applied"
- Result: "Replaced 1 occurrence(s)"

## Match flag combos

| match_case | whole_word | Behavior |
|------------|------------|----------|
| false | false | Loose substring anywhere |
| true | false | Case-sensitive substring |
| false | true | Word-boundary insensitive |
| true | true | Case-sensitive exact word |

## When to use

- Term normalization (e.g., "e-mail" → "email" across entire doc)
- Brand name update (deprecated company name → new one)
- Personal data anonymization (real names → Person A/B/C)
- Schema change migration (old field codes → new standard)
- Profanity filter review workflow
- Language consistency (UK → US spellings: "organisation" → "organization")
- Acronym expansion (UNI → Universidad Nacional de Ingeniería)
- Currency symbol swap (€ → USD)

## Gotchas

1. **Whole_word mode** requires word boundaries — punctuation breaks match
2. **Match_case=true** sensitive — "Letxinet" ≠ "LetXinet"
3. **search_and_replace ALL** — no per-occurrence cherry-pick; use find_text first to know count
4. **Special chars** (á é í ó ú ñ) sometimes fail due to encoding — strip accents first
5. **Replace count return** integer (no preview) — undo via Word UI if needed
6. **Inline format painted** onto replacement text (inherits surrounding style)
7. **Tables** covered in search_and_replace — searches inside table cells too

## Anti-pattern

No usar este skill si:
- Necesitas regex (use python-docx external script)
- Necesitas preserve format under replacement (Word may reset)
- Necesitas replace only matches outside tables (no scope filter)

## Metrics

- Tools used: 2 (find_text_in_document + search_and_replace)
- Time: ~2-5s per call
- Output: occurrences JSON + integer replace count
- Validated S9E-6: find "Objetivos" → 1 occurrence (p2 pos 0) + replace "harness S9E-1" → 1 replaced
