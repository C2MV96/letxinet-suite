---
title: LetXipu Agent V12
emoji: "🎓"
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# LetXipu Agent V12

Interfaz de investigaciÃ³n acadÃ©mica para LetXipu Search MCP V11. El backend usa
`LETXIPU_MCP_URL` para conectarse al servicio MCP; en Hugging Face debe apuntar a:

`https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp`

La variable no contiene un secreto y se configura como variable del Space. Las claves
opcionales de modelos (Gemini, Mistral o MCP) deben configurarse como secretos del Space.

## Funciones

- CatÃ¡logo de fuentes sincronizado desde `list_sources` de LetXipu V11.
- SelecciÃ³n manual de fuentes con parÃ¡metro `sources: [...]` copiable.
- BÃºsqueda, PDFs y herramientas MCP mediante el backend del agente.
- Fallback de catÃ¡logo local si el MCP remoto no estÃ¡ disponible.
