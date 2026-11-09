# Configurar Claude Code, Claude Desktop y OpenCode (LetXinet Suite 1.1.2)

El instalador de la Suite ya lo hace al terminar, con la casilla «Configurar Claude Code, Claude Desktop y OpenCode». Para hacerlo otra vez o cambiar de modo, ejecuta `configurar-clientes.cmd`.

## Modos

| Modo | Servidores que se configuran | Para qué |
|---|---|---|
| `separados` (por defecto) | `letxinet-v11` (búsqueda académica y PDF) y `letxinet-osm` (mapas), más `letxinet-markitdown` y `letxinet-jobs` | Uso normal: cada cliente carga solo las herramientas que necesita |
| `juntos` | `letxinet-ambos` (V11 y OSM en un solo servidor), más `letxinet-markitdown` y `letxinet-jobs` | Clientes que prefieren un único servidor |
| `ambos` | Los dos estilos a la vez | Pruebas |

Ejemplo: `configurar-clientes.cmd --modo juntos --clientes claude-desktop`.

## Qué hace
- **Claude Code** (`~\.claude.json`): V11 y OSM por HTTP; los demás por stdio. Fija `MCP_TOOL_TIMEOUT=300000` y copia las skills a `~\.claude\skills`.
- **Claude Desktop** (`%APPDATA%\Claude\claude_desktop_config.json`): solo admite stdio, así que V11 y OSM pasan por el puente `bin\mcp\letxinet-mcp-bridge.cjs`.
  - Reemplaza el puente del Addon (`letxinet-gateway`), que dependía del Desktop abierto y tardaba unos 30 s por llamada. Si quieres conservarlo, usa `--mantener-addon`.
  - Corrige `latex-mcp-local` cuando apuntaba a `D:\`.
- **OpenCode** (`~\.config\opencode\opencode.json`, y también `%APPDATA%\OpenCode\opencode.json` si existe):
  - Usa el formato V1 en OpenCode 1.x y V2 (`mcp.servers`) en OpenCode 2 o superior.
  - Quita las entradas antiguas que apuntaban a `D:\OTROS` o al puerto 3000.
  - Instala las 62 skills de OpenCode. OpenCode también lee `~\.claude\skills`.
- **Respaldos y alcance:** respalda cada archivo antes de cambiarlo (`.bak-letxinet-FECHA`) y no toca servidores de otras aplicaciones.

## Puentes que instala la Suite (`C:\Program Files\LetXinet Suite\bin\mcp\`)
- `letxinet-mcp-bridge.cjs`: V11 y OSM directo a los servicios, sin depender de la app Desktop. Con `LETXINET_SELECCION=ambos|v11|osm`.
- `letxinet-jobs-bridge.cjs`: tareas largas en segundo plano (`gateway_call`, `gateway_poll`) por el gateway del Desktop (43123). `letxipu_local_call` va directo a V11.

La carpeta `obsoleto-1.1.1` guarda las configuraciones anteriores, que apuntaban a `D:\OTROS` y al puerto 3000. No las uses.
