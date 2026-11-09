---
name: word-style-customizer
description: Use for creating custom paragraph styles (bold/italic/size/color/font combinations) and reformatting footnote numbering font + format. Ideal for branded documents where you need consistent corporate styling, accessibility-compliant font sizing, color-coded sections, contractual clause formatting.
trigger_keywords: custom style, font name size color, branding word doc, footnote font, accessibility docx, corporate styling
---

# SKILL: word-style-customizer (solo-Word S9E-5)

## Proven Chain (2026-08-08)

```
word.create_custom_style(filename="<doc.docx>",
                         style_name="<name>",
                         bold=true|false, italic=true|false,
                         font_size=<int points>,
                         font_name="<family>",
                         color="<named | #hex>",
                         base_style="<optional existing style>")
  ↓ style registered in docx.style_part
word.customize_footnote_style(filename="<doc.docx>",
                              numbering_format="i, ii, iii",
                              start_number=1,
                              font_name="Calibri",
                              font_size=9)
  ↓ footnotes reformat retroactively
```

## Validated Output (2026-08-08)

**S9E-5 demo on S9E1-template-generator.docx:**

### Style 1: "LetXinet Body Emphasis"
- bold=true, italic=true, font_size=13, color=blue, font_name=Georgia
- Result: "Style 'LetXinet Body Emphasis' created successfully"
- Use case: brand-emphasized callout text

### Style 2: "LetXinet Annotation"
- bold=false, italic=true, font_size=11, color=darkRed, font_name=Trebuchet MS
- Result: "Style 'LetXinet Annotation' created successfully"
- Use case: editorial / reviewer comments

### Footnote customization
- numbering_format="i, ii, iii" (Roman lowercase)
- font_name=Calibri, font_size=9
- Result: "Footnote style and numbering customized"

## Color value syntax

| Format | Example | Valid in |
|--------|---------|----------|
| Named | "red", "blue", "darkRed" | color param |
| Hex | "#FF0000", "#1F4E79" | color param |
| RGB | "255,0,0" | not supported |

## Common font pairings

| Body | Heading | Notes |
|------|---------|-------|
| Calibri | Calibri Light | Default Office modern |
| Georgia | Georgia | Editorial serif |
| Cambria | Cambria | Academic serif |
| Tahoma | Verdana | UI sans-serif |
| Trebuchet MS | Trebuchet MS | Web-style sans |
| Courier New | Courier New | Code/contract fixed |

## Base style chaining

```
create_custom_style(style_name="MyCustom", base_style="Heading 1", bold=true, color="blue")
→ inherits Heading 1 (large size + bold) + adds blue override
```

## When to use

- Brand book compliance (corporate colors + fonts)
- Accessibility WCAG large-print version (18pt+)
- Color-coded section (red=danger, green=ok)
- Contractual clause style (italic underlined)
- Reviewer comment annotation style
- Cover letter signature style (script-like italic)
- Press release boilerplate italic
- Footnote retroactive font change

## Gotchas

1. **Style registration global** in docx.part — applies to all paragraphs assigned
2. **Apply style to paragraph** by setting paragraph.style = "<style_name>" (not this tool directly)
3. **Font fallback** if font_name not installed locally (Word substitutes)
4. **Named colors** limited to Word's named palette: black/blue/cyan/green/magenta/red/yellow/white/darkBlue/darkCyan/darkGreen/darkMagenta/darkRed/darkYellow/darkGray/lightGray/...
5. **font_size points** integer; compose em (12pt) vs italic emphasis (13pt+1)
6. **base_style chaining** powerful — chain "Normal" → "Body Text" → "My Style"

## Anti-pattern

No usar este skill si:
- Necesitas inline styling (use format_text with start_pos / end_pos)
- Necesitas single paragraph style (use add_paragraph with style="Heading 1" param)
- Necesitas Tailwind-CSS-like styling (not supported)

## Metrics

- Tools used: 3 (create_custom_style x2 + customize_footnote_style)
- Time: ~3s S9E-5 end-to-end
- Output: 2 custom styles + footnote reformat validated
