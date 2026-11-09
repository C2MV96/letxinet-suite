# LetXinet Suite 1.1.4 — Paquete completo (instalar, configurar, modificar)

Versión vigente: **Suite 1.1.4, Variante B** (sin claves, 08/11/2026) y **Addon Bridges 1.0.0**. El instalador se compiló con el código fuente de `02_CODIGO-FUENTE`.

> **Novedades de la 1.1.4** (detalle en `08_REPORTE…`, §3.14). Arreglan lo que falló al instalar en otra laptop:
> - **MarkItDown arranca en cualquier laptop.** El instalador ya incluye `msvcp140.dll` de Visual C++. Sin ese archivo, MarkItDown figuraba «Running» pero nunca respondía en el puerto 7860.
> - **LetXinet Desktop espera hasta 10 minutos a su backend** (antes eran 2) y muestra «Iniciando...». Así ya no sale «The desktop backend did not start in time» en laptops lentas ni la primera vez.
> - **Harness más claro:** revisa Visual C++ y cuánto espera el Desktop, no da un error confuso cuando MarkItDown no responde y marca Claude Code como aviso si no está instalado.
> - **Laptops que ya tienen la 1.1.3:** basta con `04_SCRIPTS-MANTENIMIENTO\arreglo-1.1.3\arreglar-letxinet.cmd`, o con instalar la 1.1.4 encima.
>
> **Novedades de la 1.1.3** (detalle en `08_REPORTE…`, §3.13, y en `06_INFORMES-Y-PRUEBAS`):
> - **`convert_document` vuelve a funcionar con URL.** Antes fallaba siempre que `MINERU_API_KEY` tuviera un valor, aunque fuera incompleto.
> - **V11 ya no se atasca** con muchas consultas de metadatos seguidas: los tiempos límite cubren todas las esperas.
> - **Búsqueda de tesis peruanas más pertinente:** RENATI, ALICIA y La Referencia descartan resultados que no tratan el tema de la consulta.
> - **Sci-Hub y WeLib desactivados** por riesgo legal: `download_pdf` usa solo fuentes abiertas.
> - **Ninguna herramienta lee direcciones internas** (127.0.0.1, red local, 169.254.169.254), escritas de ninguna forma.
> - **Otros arreglos:**
>   - `extract_tables` reconoce tablas;
>   - `fetch_metadata` avisa cuando un DOI no existe;
>   - `resolve_pdf` explica por qué un repositorio no entrega el PDF;
>   - el configurador rechaza modos inválidos.
> - **Pool de pruebas completas** con comparativo frente a IA: `04_SCRIPTS-MANTENIMIENTO\harness\pool\ejecutar-pool.cmd`.
>
> **Novedades de la 1.1.2** (detalle en `08_REPORTE…`, §3.12):
> - **Node.js LTS incluido:** el instalador lo instala solo si falta.
> - **Configuración automática** de Claude Code, Claude Desktop y OpenCode al terminar la instalación, en modo **separados** (V11 y OSM aparte) o **juntos** (un solo servidor).
> - **Puentes MCP nuevos:** V11 y OSM juntos sin depender de la app Desktop, y el puente de tareas largas corregido (antes apuntaba al puerto 3000, donde no había nada).
> - **Gateway del Desktop:** corregido el filtro de solo OSM.
> - **OSM:**
>   - pide un contacto para Nominatim;
>   - si Overpass falla, usa servidores espejo;
>   - los servicios solo escuchan en este equipo.
> - **Accesos en el menú Inicio:** «Configurar Claude Code, Claude Desktop y OpenCode» y «Probar LetXinet Suite».
>
> El paquete es para tu uso: no lo publiques sin revisarlo y rota las claves que llevaba la 1.1.0.

## Contenido
| Carpeta | Qué hay |
|---|---|
| `01_INSTALADORES` | `LetXinet-Suite-1.1.4-VariantB-Setup.exe` **más su `-1.bin`** (deben ir juntos en la misma carpeta), `LetXinet-Addon-Bridges-v1.0.0.exe` y los hashes SHA-256 |
| `02_CODIGO-FUENTE` | El código con el que se compiló el instalador, con los parches y sin claves. Incluye `recompilar-todo.cmd` y `LEEME-RECOMPILAR.md` |
| `03_CONFIG-CLAUDE-CODE-OPENCODE` | `configurar-clientes.cmd` (configura de nuevo los clientes o cambia de modo), `LEEME-CLIENTES.md`, skills, la plantilla de `LetXinet-Suite.env` y `LetXinet-Suite.env.ejemplo` (todas las variables, con las claves vacías para llenar) |
| `04_SCRIPTS-MANTENIMIENTO` | Arreglo para laptops con la 1.1.3 (`arreglo-1.1.3\arreglar-letxinet.cmd`), harness rápido (`harness\probar-letxinet.cmd`) y pool de pruebas completas con comparativo frente a IA (`harness\pool\ejecutar-pool.cmd`), además de `verificar-instalacion.ps1`, activar o desactivar spaCy y limpiar logs |
| `05_GUIA-MODIFICAR-COMPILAR-INSTALAR.md` | Guía técnica de cada componente |
| `06_INFORMES-Y-PRUEBAS` | Informes y logs de pruebas |
| `07_DOCUMENTACION-ORIGINAL` | Planes, línea de tiempo y documentación original del proyecto |
| `08_REPORTE-COMPLETO-DE-LO-SUCEDIDO.md` | Todo lo que se hizo, el estado y la seguridad |
| `09_PLAN-VERIFICACION-E-INSTALACION.docx` | Verificaciones, plan de instalación, pruebas y qué hacer si algo falla |

## Instalación en otra laptop (Windows 10/11 x64)
1. Copia el zip a la laptop y usa «Extraer todo». Necesitas unos 3 GB libres y permisos de administrador.
2. Ejecuta `01_INSTALADORES\LetXinet-Suite-1.1.4-VariantB-Setup.exe` como administrador, con el `.bin` en la misma carpeta.
   - Si falta Node.js, el instalador lo instala.
   - Te pedirá un correo opcional para OpenStreetMap.
   - Al final deja marcada la casilla para configurar Claude Code, Claude Desktop y OpenCode.
3. Ejecuta `01_INSTALADORES\LetXinet-Addon-Bridges-v1.0.0.exe` si usas Word o LaTeX desde Claude Desktop.
4. Carga tus claves. Usa la carpeta `mis-claves` si la tienes, o «Configurar API keys» del menú Inicio.
5. Reinicia Claude Code, Claude Desktop u OpenCode.
6. **Comprueba la instalación:** menú Inicio → «Probar LetXinet Suite». El informe queda en el Escritorio; si algo falla, pásaselo a Claude.

Si instalaste algún cliente de IA después de la Suite, o quieres cambiar de modo: menú Inicio → «Configurar Claude Code, Claude Desktop y OpenCode», o `03_CONFIG-CLAUDE-CODE-OPENCODE\configurar-clientes.cmd --modo juntos`.

**Claude Code y OpenCode no vienen en el paquete.** Se instalan desde sus sitios oficiales y necesitan internet. Claude Code en Windows también necesita Git for Windows.

Para **modificar y volver a empaquetar**: `02_CODIGO-FUENTE\recompilar-todo.cmd` (ver `02_CODIGO-FUENTE\LEEME-RECOMPILAR.md`).
