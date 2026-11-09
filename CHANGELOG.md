# Cambios

Las versiones anteriores a la 1.1.2 están en `07_DOCUMENTACION-ORIGINAL/PLAN-Y-PROGRESO-suite/CHANGELOG.md`. El detalle de cada versión está en `08_REPORTE-COMPLETO-DE-LO-SUCEDIDO.md`.

## Sin publicar

- `04_SCRIPTS-MANTENIMIENTO/arreglo-2-markitdown`: MarkItDown en procesadores sin SSE4.2. Cambia numpy 2.5.1 por 2.3.5 y guarda el original. Probado sobre una copia del runtime; falta probarlo en una laptop con procesador antiguo.

## 1.1.4 (08/11/2026)

- **MarkItDown arranca sin Visual C++.** El instalador incluye `msvcp140.dll` dentro de los dos Python embebidos. Sin ese archivo, MarkItDown figuraba «Running» pero nunca respondía en el puerto 7860.
- **LetXinet Desktop espera hasta 10 minutos a su backend** (antes eran 2) y muestra «Iniciando...». El tiempo se cambia con `LETXIPU_BACKEND_TIMEOUT_MS`.
- **Harness:** revisa Visual C++ y cuánto espera el Desktop, no da un error confuso cuando MarkItDown no responde y marca Claude Code como aviso si no está instalado.
- **Arreglo para laptops con la 1.1.3:** `04_SCRIPTS-MANTENIMIENTO/arreglo-1.1.3`.

## 1.1.3

- `convert_document` vuelve a funcionar con URL.
- V11 ya no se atasca con muchas consultas de metadatos seguidas.
- Búsqueda de tesis peruanas más pertinente en RENATI, ALICIA y La Referencia.
- Sci-Hub y WeLib desactivados: `download_pdf` usa solo fuentes abiertas.
- Ninguna herramienta lee direcciones internas (127.0.0.1, red local, 169.254.169.254).
- Arreglos en `extract_tables`, `fetch_metadata`, `resolve_pdf` y el configurador.
- Pool de pruebas completas con comparativo frente a IA.

## 1.1.2

- Node.js LTS incluido: el instalador lo instala solo si falta.
- Configuración automática de Claude Code, Claude Desktop y OpenCode, en modo separados o juntos.
- Puentes MCP nuevos y puente de tareas largas corregido.
- OSM: contacto para Nominatim, servidores espejo de Overpass y servicios solo en este equipo.
- Accesos en el menú Inicio: «Configurar Claude Code, Claude Desktop y OpenCode» y «Probar LetXinet Suite».
