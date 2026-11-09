# Linea de Tiempo de Artefactos - LetXinet Suite & Desktop HF

**Fecha generacion:** 2026-08-08
**Escanero completo de:** `D:\OTROS\`
**Total de carpetas analizadas:** 63

---

## 1. Resumen Ejecutivo

Se localizaron **~80 artefactos** (instaladores .exe, .bin, .zip, .7z fuentes) distribuidos en 5 areas principales de `D:\OTROS\`:

| # | Area | Ubicacion | Rol |
|---|------|-----------|-----|
| A | **OPTIM-BUILD** | `D:\OTROS\LETXINET-OPTIM-BUILD\` | Arena de build/optimizacion/profiling/backups/zips — corazon operativo |
| B | **DESKTOP-HF** | `D:\OTROS\LETXINET-DESKTOP-HF\` | Repo activo del Desktop HF (server.ts fuente, dist/ compilado) |
| C | **SUITE** | `D:\OTROS\LETXINET-SUITE\` | Repo Suite v1.1.0 (Inno Setup, src-suite, build/installer-output) |
| D | **VARIANTE-C** | `D:\OTROS\LETXINET-SUITE-VARIANTE-C\` | Linea paralela electron-builder v1.5.2-1.5.8 (Setup + Portable) |
| E | **EJECUTABLES+CODIGO ZIP** | `D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\` | Paquetes sueltos pre-Suite (Desktop HF + OSM-MCP + V11-Local setup) |
| F | **PRUEBAS + POOL-TESTS** | `D:\OTROS\PRUEBAS-LETXINET\`, `D:\OTROS\LETXINET-POOL-TESTS\` | Resultados de tests de fuentes (39 fuentes individuales) |

**Proyectos legados no Suite** (tambien en D:\OTROS): SEARCH-MCP V2-V9, letxipu-mcp-client, agent v2/v4/v11/v12, LATEX_COMPILER, MCP_CLIENTE_LATEX, OMNI-Office-Word, SUPER-MCP, GITHUB, NOTEBOOKLM, claude-code, TESIS_BIOTECNOLOGIA — detallados al final.

---

## 2. Linea de Tiempo Cronologica (Todas las versiones)

```
2026-03-14 ─ BACKUP-BETA-01                                    (legado, 4.8 MB)
2026-03-18 ─ LETXIPU-SEARCH-MCP, V2, ENCRIPTED                 (legado, 29.8 MB c/u)
2026-03-20 ─ letxipu-mcp-client, skills, MCP_CLIENTE_LATEX     (legado, 397-412 MB)
2026-03-20 ─ SUPER-MCP                                         (legado, 142 MB)
2026-03-21 ─ MCP_GOOGLE_DRIVE, compiler_latex, LATEX BACKUP    (legado)
2026-03-22 ─ LETXIPU_LATEX_COMPILER, MCP_CLIENTE_LATEX_V2      (legado)
2026-03-23 ─ LETXIPU_LATEX_COMPILER_V2                         (legado, 1.1 GB)
2026-03-31 ─ letxipu-agent, v2, v4, claude-code                (legado)
2026-04-01 ─ letxipu-agent-v2                                  (legado)
2026-04-11 ─ LETXIPU-SEARCH-MCP-V3                             (legado, 142.8 MB)
2026-04-16 ─ letxipu-agent-v11, v12                            (legado)
2026-05-16 ─ LETXIPU-BETA-SX-COPIA                            (legado, 1ra beta)
2026-05-24 ─ LETXIPU-BETA-SX-COPIA-2                           (legado)
2026-06-04 ─ LETXIPU-SEARCH-MCP-V5                             (legado)
2026-06-15 ─ LETXIPU-GRADIO                                    (legado)
2026-06-21 ─ LETXIPU-SEARCH-MCP-V6                             (legado)
2026-06-30 ─ LETXIPU-SEARCH-MCP-V7, V8                         (legado)
2026-07-06 ─ V10 start_server.bat                              (legado)
2026-07-07 ─ osmmcp-fork/osmmcp.exe (23.42 MB)                 (Go bin, fork)
2026-07-08 ─ V10 start_mcp_servers.bat                         (legado)
2026-07-10 ─ LETXIPU-CHROME-MCP-CLIENT                          (legado)
2026-07-16 ─ Suite source variant-tokens variantA/.env         (pre-Suite)
2026-07-23 ─ letxipu-osm-mcp/osmmcp.exe (23.55 MB)             (Go bin oficial)
2026-07-23 ─ LETXIPU-SEARCH-MCP-V10                            (legado)
2026-07-24 ─ start_v11.bat                                     (V11 nace)
2026-07-25 ─ LETXIPU-SEARCH-MCP_V11 (sin "-LOCAL")              (legado)
2026-07-25 ─ GITHUB/LETXINET-MCP-main.zip (12.45 MB)           (snapshot GitHub)
2026-07-26 ─ LETXINET-MCP-AGENT-GUI V2-main.zip (311.51 KB)    (GUI agent preview)
2026-07-26 ─ start-local.cmd                                   (V11 local)
2026-07-28 ─ install-deps.cjs source                           (pre Suite)
2026-07-29 ─ LETXIPU-SEARCH-MCP-V11-LOCAL nace                 (28 providers TS)
2026-07-29 ─ MCP-V11-Local-Portable.zip (165.23 MB)           (portable V11)
2026-07-30 ─ build-portable.cjs                                (packaging V11)
2026-07-30 ─ OSM-MCP-Setup 0.0.0.exe (11.98 MB)              (instalador OSM standalone)
2026-07-30 ─ Desktop HF Setup 0.0.0.exe (274.18 MB)           (instalador HF standalone)
2026-07-30 ─ LETXINET-DESKTOP-HF-codigo-fuente.zip (292.22 KB) (1er zip fuente)
2026-07-30 ─ letxipu-osm-mcp-src.zip (239.85 KB)              (zip fuente OSM)
2026-07-30 ─ start-markitdown-api.cmd                          (MCP MarkItDown)
2026-07-31 00:18 ─ MCP-V11-Local-Setup.iss                     (Inno setup V11)
2026-07-31 00:54 ─ MCP-V11-Local-Setup-A 0.0.0.exe (518 MB)    (V11 installer A)
2026-07-31 01:09 ─ MCP-V11-Local-Setup-B 0.0.0.exe (518 MB)   (V11 installer B)
2026-07-31 01:35 ─ LETXIPU-SEARCH-MCP-V11-LOCAL-codigo-fuente.zip (12.5 MB) (zip fuente V11)
2026-07-31 01:41 ─ INSTRUCCIONES-RECONSTRUIR.md                (docs)
2026-07-31 16:34 ─ osmmcp-patched.exe (23.55 MB)               (Go bin patched)
2026-07-31 16:53 ─ MCP-V11-Local.exe (93.75 MB)               (V11 portable single)
2026-07-31 19:04 ─ suite-env-loader.cmd, start-osm-mcp.cmd    (Suite scripts nacen)
2026-07-31 20:11 ─ variantB-build.log (1er build Suite)        (logs)
2026-07-31 20:38 ─ variantA-build.log                          (logs)
2026-07-31 22:19 ─ build-v2-all.log                           (logs build v2)
2026-07-31 23:27 ─ 00-PLAN-MAESTRO.md                         (plan Suite v1.1.0)
2026-08-01 09:23 ─ Suite 1.0.0-VariantB-Setup-1.bin (503.83 MB) (1er build Suite)
2026-08-01 09:23 ─ Suite 1.0.0-VariantB-Setup.exe (4.74 MB)
2026-08-01 10:20 ─ Suite 1.0.0-VariantA-Setup-1.bin (503.85 MB)
2026-08-01 10:20 ─ Suite 1.0.0-VariantA-Setup.exe (4.74 MB)
2026-08-01 10:21 ─ HASHES-SHA256-v1.0.1.txt                   (1er hash list)
2026-08-01 20:40 ─ ENV-UNIFICADO/.env-unificado.env            (env consolidation)
2026-08-02 22:43 ─ VARIANTE-C v1.5.2-Setup.exe (281 MB)        (linea C nace)
2026-08-02 23:49 ─ VARIANTE-C v1.5.3-Setup.exe + Portable.exe  (iteracion C)
2026-08-03 01:14 ─ VARIANTE-C v1.5.4-Setup.exe + Portable.exe  (iteracion C)
2026-08-03 02:11 ─ VARIANTE-C v1.5.5-Setup.exe + Portable.exe  (iteracion C)
2026-08-03 11:18 ─ VARIANTE-C v1.5.6-Setup.exe + Portable.exe  (iteracion C)
2026-08-03 12:07 ─ VARIANTE-C v1.5.7-Setup.exe + Portable.exe  (iteracion C)
2026-08-03 12:47 ─ VARIANTE-C v1.5.8-Setup.exe + Portable.exe  (final C)
2026-08-03 22:32 ─ PLAN-VARIANTE-C-FINAL-v1.5.8.md             (doc final C)
2026-08-06 09:13 ─ src-fase3 AgentChat.tsx (backups)           (optim CPU/RAM)
2026-08-06 12:33 ─ profiling/trace-cdp.mjs                     (profiling traces)
2026-08-06 13:38 ─ cpu-profile.cpuprofile                       (profiling CPU)
2026-08-06 15:53 ─ src-post-builddual-20260806-183000          (post dual build)
2026-08-06 17:07 ─ LetXipu Desktop HF Setup 0.0.0.exe (95.99 MB) (electron-builder publico)
2026-08-06 18:21 ─ LetXipu Desktop HF Pro Setup 0.0.0.exe (281 MB) (electron-builder privado)
2026-08-06 19:20 ─ FUENTES-DEV-COMPLETO.zip (243.73 KB)        (1er zip dev)
2026-08-06 19:22 ─ DUAL-BUILD-SOURCES.zip (101.98 KB)          (zip dual)
2026-08-06 19:26 ─ INSTALLERS-PUBLICO-PRIVADO.zip (747 MB)    (zip instaladores)
2026-08-06 19:30 ─ ZIP-HASHES.md                               (hashes sesion 5)
2026-08-06 22:14 ─ Suite INSTALLER-OUTPUT-v1.1.0 actualizado   (primer build v1.1.0)
2026-08-06 22:38 ─ sesion-6-suite-v1.1.0\instaladores-v1.1.0.zip (834.96 MB) (Sesion 6)
2026-08-06 22:41 ─ sesion-6-suite-v1.1.0\dual-build-integration-sources.zip (201 KB)
2026-08-06 22:42 ─ sesion-6-suite-v1.1.0\fuentes-suite-v1.1.0.zip (338 KB)
2026-08-06 22:44 ─ sesion-6-suite-v1.1.0\ZIPS-SESION-6-HASHES.md (6.32 KB)
2026-08-07 03:42 ─ fix-no-disponible/server.ts (343.81 KB)    (Bug 1: keys read-only)
2026-08-07 10:47 ─ fix-suffix-routing/server.ts (346.52 KB)   (Bug 2: :provider suffix)
2026-08-07 15:07 ─ fix-apikeys-sync/secrets.json               (Bug 3: keys synced)
2026-08-07 17:23 ─ fix-bug4-gemini-routing/server.ts.bak      (Bug 4: Gemini)
2026-08-07 17:27 ─ fix-bug4-gemini-routing/server.cjs          (352 KB final)
2026-08-07 21:00 ─ Suite v1.1.0 REGEN-2026-08-07 VariantA .bin (413.34 MB) (REGEN!)
2026-08-07 21:00 ─ Suite v1.1.0 REGEN VariantA .exe (6.77 MB)
2026-08-07 21:00 ─ Suite v1.1.0 REGEN VariantB .exe (6.77 MB)
2026-08-07 21:06 ─ Suite v1.1.0 REGEN VariantB .bin (202.63 MB)
2026-08-07 21:19 ─ fuentes-desktop-hf-v1.5.8-bugfix-v1.1.0.zip (540 KB)    (Sesion 7)
2026-08-07 23:51 ─ fuentes-suite-v1.1.0-regen-bugfix.zip (340 KB)
2026-08-07 23:57 ─ instaladores-v1.1.0-regen-bugfix-2026-08-07.zip (622 MB)
2026-08-08 00:24 ─ fuentes-mcps-3-osm-v11-markitdown.zip (37.54 MB)
2026-08-08 00:25 ─ ZIPS-SESION-7-HASHES.md                    (manifiesto final)
```

---

## 3. Artefactos Clave Actuales (LOS VALIDOS hoy)

### 3.1 Instaladores Suite v1.1.0 Regenerados (Sesion 7) — RECOMENDADO

Ubicacion: `D:\OTROS\LETXINET-SUITE\build\installer-output\`

| Archivo | Tamaño | SHA256 |
|---------|--------|--------|
| `variantA\LetXinet-Suite-1.1.0-VariantA-Setup.exe` | 6.77 MB | 6F10D579... |
| `variantA\LetXinet-Suite-1.1.0-VariantA-Setup-1.bin` | 413.34 MB | 314CB5DD... |
| `variantB\LetXinet-Suite-1.1.0-VariantB-Setup.exe` | 6.77 MB | D93753B1... |
| `variantB\LetXinet-Suite-1.1.0-VariantB-Setup-1.bin` | 202.63 MB | 7BD3FBC5... |
| `HASHES-SHA256-v1.1.0-regen-2026-08-07.txt` | 1.01 KB | — |

- Generados: 2026-08-07 21:00
- VariantA trae `secrets.json` embedido con las 9 API keys validas
- VariantB sin secrets (publico — operador configura)
- Backupeados en `D:\OTROS\LETXINET-OPTIM-BUILD\backups\regen-suite-v1.1.0\2026-08-07-235900\installer-output-prev\` (v1.1.0 pre-bugfix del 2026-08-06 21:01)

### 3.2 Zips Finales Sesion 7 (4 zips + manifiesto)

Ubicacion: `D:\OTROS\LETXINET-OPTIM-BUILD\zips\sesion-7-regen-v1.1.0-bugfix\`

| Archivo | Tamaño | SHA256 | Contenido |
|---------|--------|--------|-----------|
| `instaladores-v1.1.0-regen-bugfix-2026-08-07.zip` | 622.23 MB | EC4AFC4D... | 2 .exe + 2 .bin + HASHES + CHANGELOG + RELEASE + README-REGEN |
| `fuentes-desktop-hf-v1.5.8-bugfix-v1.1.0.zip` | 539.83 KB | 04FA14CB... | 98 archivos Desktop HF (server.ts Bug 1-4, src/, electron/, mcp-bridge/, skills/) |
| `fuentes-suite-v1.1.0-regen-bugfix.zip` | 339.43 KB | 0ECEFD86... | 38 archivos Suite (ISS, build-variants.cmd, READMEs, tokens A/B) |
| `fuentes-mcps-3-osm-v11-markitdown.zip` | 37.54 MB | 78E3E1E2... | Source 3 MCPs: mcp-osm (Go .go), mcp-v11-search (TS .ts 28 providers), mcp-markitdown (Python 3 archivos) |
| `ZIPS-SESION-7-HASHES.md` | 4.94 KB | — | Manifiesto |

**Total:** 660.64 MB

### 3.3 Server.cjs y secrets.json Vigentes

| Archivo | Ubicacion | MD5 | Tamaño |
|---------|-----------|-----|--------|
| `server.ts` fuente | `D:\OTROS\LETXINET-DESKTOP-HF\server.ts` | — | ~357 KB |
| `server.cjs` compilado | `D:\OTROS\LETXINET-DESKTOP-HF\dist\server.cjs` | D1818341231A4A93B1D9A45E4BF93846 | 352,546 bytes |
| `server.cjs` payload Suite | `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\letxinet-desktop\resources\app\dist\server.cjs` | D1818341231A4A93B1D9A45E4BF93846 | 352,546 bytes |
| `secrets.json` runtime | `%APPDATA%\letxipu-desktop-hf\secrets.json` | BBA418C39973B34129E02C03B878ABBA | 1,859 bytes |
| `secrets.json` payload Suite | `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\letxinet-desktop\resources\secrets.json` | BBA418C39973B34129E02C03B878ABBA | 1,859 bytes |

### 3.4 Binarios MCP Vigentes

| MCP | Ubicacion binario | Tamaño | Compilado |
|-----|-------------------|--------|-----------|
| OSM-MCP (Go) | `D:\OTROS\letxipu-osm-mcp\osmmcp.exe` | 23.55 MB | 2026-07-23 |
| OSM-MCP patched | `D:\OTROS\letxipu-osm-mcp\osmmcp-patched.exe` | 23.55 MB | 2026-07-31 16:34 |
| OSM-MCP fork | `D:\OTROS\osmmcp-fork\osmmcp.exe` | 23.42 MB | 2026-07-07 |
| V11-Local (TS) | dentro de Suite payload | — | 2026-08-01 |
| V11-Local standalone | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\MCP-V11-Local.exe` | 93.75 MB | 2026-07-31 16:53 |
| V11-Local Portable zip | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\MCP-V11-Local-Portable.zip` | 165.23 MB | 2026-07-29 23:07 |
| MarkItDown (Python) | `D:\OTROS\markitdown-api\` + `python-runtime/` en Suite payload | 223 MB runtime | — |

---

## 4. Artefactos Interesantes / Replicados / Orphaned

### 4.1 Duplicados / Obsoletos Identificados

| Artefacto | Version | Ubicacion | Estado |
|-----------|---------|-----------|--------|
| Suite v1.0.0 VariantA/B (503 MB .bin) | PRE-bugfix | `D:\OTROS\LETXINET-OPTIM-BUILD\backups\regen-suite-v1.1.0\2026-08-07-235900\installer-output-prev\variantA\, variantB\` | OBSOLETO — pre-Sesion 7 |
| Suite v1.1.0 VariantA/B (413+.202 MB) | pre-bugfix | backup regen (previos del 2026-08-06 21:01) | REEMPLAZADO por Sesion 7 |
| Suite v1.0.0 VariantA/B .bin (503 MB) | 1.0.0 | No existe en installer-output — solo backups | PERDIDO del installer-output activo |
| instaladores-v1.1.0.zip | Sesion 6 | `D:\OTROS\LETXINET-OPTIM-BUILD\zips\sesion-6-suite-v1.1.0\instaladores-v1.1.0.zip` (834 MB) | REEMPLAZADO por sesion-7 |
| LetXipu Desktop HF Setup 0.0.0.exe (274 MB) | pre-Suite | `D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\LetXipu Desktop HF Setup 0.0.0.exe` | OBSOLETO — pre-Suite |
| LetXipu Desktop HF Setup 0.0.0.exe (95.99 MB) | electron-builder publico | `D:\OTROS\LETXINET-OPTIM-BUILD\installers\public\LetXipu Desktop HF Setup 0.0.0.exe` | OBSOLETO — alternativa electron-builder |
| LetXipu Desktop HF Pro Setup 0.0.0.exe (281 MB) | electron-builder privado | `D:\OTROS\LETXINET-OPTIM-BUILD\installers\private\LetXipu Desktop HF Pro Setup 0.0.0.exe` | OBSOLETO — alternativa electron-builder |
| VARIANTE-C v1.5.2-v1.5.8 (7 iter × 2 = 14 .exe) | linea paralela C | `D:\OTROS\LETXINET-SUITE-VARIANTE-C\` | ORPHANED — linea paralela abandonada |
| MCP-V11-Setup-A/B 0.0.0.exe (518 MB c/u) | pre-Suite V11 | `D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\MCP-V11-Local-Setup-A 0.0.0.exe` + `-B` | OBSOLETO — instalador V11 standalone absorbido por Suite |
| osmmcp.exe (23.42 MB) | fork | `D:\OTROS\osmmcp-fork\osmmcp.exe` (2026-07-07) | POSIBLE DUPLICADO — vs osmmcp.exe (23.55 MB) en letxipu-osm-mcp |
| osmmcp-patched.exe | oficial patched | `D:\OTROS\letxipu-osm-mcp\osmmcp-patched.exe` (2026-07-31 16:34) | VALIDO — el que va en Suite |
| MCP-V11-Local.exe (93.75 MB) | portable single | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\MCP-V11-Local.exe` | VALIDO — alternativa portable |
| MCP-V11-Local-Portable.zip (165 MB) | portable zip | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\MCP-V11-Local-Portable.zip` | VALIDO — alternativa zip portable |
| GITHUB/LETXINET-MCP-main.zip (12.45 MB) | snapshot GitHub | `D:\OTROS\GITHUB\LETXINET-MCP-main.zip` | SNAPSHOT — posiblemente obsoleto |
| OSM-MCP-Setup 0.0.0.exe (11.98 MB) | instalador OSM standalone | `D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\OSM-MCP-Setup 0.0.0.exe` | OBSOLETO — absorbido por Suite |

### 4.2 Backups Historicos (referencia)

| Carpeta backup | Fecha | Rol |
|----------------|--------|-----|
| `backups\src-pre-builddual-20260806-154529\` | 2026-08-06 15:45 | Antes del dual build (fuentes Desktop HF) |
| `backups\src-post-builddual-20260806-183000\` | 2026-08-06 18:30 | Post dual build — estado dual (publico + privado) |
| `backups\suite-src-pre-v1.1.0-2026-08-06-195902\` | 2026-08-06 19:59 | Antes de Suite v1.1.0 (ISS, scripts, PLAN-Y-PROGRESO) |
| `backups\regen-suite-v1.1.0\2026-08-07-235900\` | 2026-08-07 23:59 | Antes de regenerar Suite v1.1.0 con Bug 1-4 fix |
| `backups\fix-no-disponible\2026-08-07-103150\` | 2026-08-07 10:31 | Antes del Bug 1 (variables sistema keys) |
| `backups\fix-suffix-routing\2026-08-07-121642\` | 2026-08-07 12:16 | Antes del Bug 2 (:provider suffix) |
| `backups\fix-apikeys-sync\2026-08-07-144500\` | 2026-08-07 14:45 | Antes del Bug 3 (sync API keys) |
| `backups\fix-bug4-gemini-routing\2026-08-07-224500\` | 2026-08-07 22:45 | Antes del Bug 4 (Gemini routing) |
| `backups\suite-env\` | 2026-07-31 | LetXinet-Suite.env backups (spacy, localmcpport) |
| `backups\mcp-v11-local\` | 2026-07-29 al 31 | server.js + start-mcp-local.cmd backups (spacy-disabler) |
| `backups\standalone-fase1\, fase2\, fase3\` | 2026-08-03 al 06 | Standalone bundle HTML/JS/CSS (pre electron-builder) |
| `backups\standalone-bundle\, standalone-pre-builddual\, bundle-pre-exp\` | 2026-08-04 al 06 | Bundle JS/CSS backups experimentales |
| `backups\css-fase2-20260806-114128\` | 2026-08-06 11:41 | Patch CSS fase 2 |
| `backups\src-fase1\, fase2\, fase3\` | 2026-08-06 09:00-14:28 | Source antes de cada fase de optimizacion |

### 4.3 Logs y Traces de build

| Archivo | Ubicacion | Tamaño |
|---------|-----------|--------|
| `test-logs\variantB-build.log` | Suite\build\installer-output\ | 6.71 MB |
| `test-logs\variantA-build.log` | Suite\build\installer-output\ | 6.71 MB |
| `test-logs\install-test.log, install-test2.log, install-test3-v2.log` | Suite\build\installer-output\ | 10.42-10.45 MB c/u |
| `test-logs\uninstall-test.log, uninstall2.log, uninstall3.log` | Suite\build\installer-output\ | 4.45-4.48 MB c/u |
| `test-logs\register-manual.log` | Suite\build\installer-output\ | 5.1 KB |
| `test-logs\build-v2-all.log, build-v2-B.log` | Suite\build\installer-output\ | 6.71 MB c/u |
| `profiling\trace-events.json` | LETXINET-OPTIM-BUILD\ | 9.92 MB |
| `profiling\cpu-profile.cpuprofile` | LETXINET-OPTIM-BUILD\ | 362.81 KB |

### 4.4 Proyectos Legados No-Suite en D:\OTROS

Estos proyectos NO pertenecen al Suite actual pero ocupan espacio:

| Proyecto | Ubicacion | Tamaño | Comentario |
|----------|-----------|--------|------------|
| BACKUP-BETA-01 | D:\OTROS\BACKUP-BETA-01 | 4.8 MB | Backup beta original |
| LETXIPU-SEARCH-MCP (V1) | D:\OTROS\LETXIPU-SEARCH-MCP | 29.7 MB | MCP search original |
| LETXIPU-SEARCH-MCP-V2 | D:\OTROS\LETXIPU-SEARCH-MCP-V2 | 29.8 MB | MCP V2 |
| LETXIPU-SEARCH-ENCRIPTED | D:\OTROS\LETXIPU-SEARCH-ENCRIPTED | 29.9 MB | MCP encriptado |
| letxipu-mcp-client | D:\OTROS\letxipu-mcp-client | 397.2 MB | MCP client |
| letxipu-mcp-client-skills | D:\OTROS\letxipu-mcp-client-skills | 412.3 MB | MCP client con skills |
| MCP_CLIENTE_LATEX, V2, V3, V4 | D:\OTROS\MCP_CLIENTE_LATEX* | 50-734 MB | MCP cliente LaTex |
| SUPER-MCP | D:\OTROS\SUPER-MCP | 142.2 MB | Super MCP experimental |
| MCP_GOOGLE_DRIVE | D:\OTROS\MCP_GOOGLE_DRIVE | 151.6 MB | Google Drive MCP |
| compiler_latex / LETXIPU_LATEX_COMPILER, _V2 | D:\OTROS\compiler_latex, LETXIPU_LATEX_COMPILER* | 634-1098 MB | Compilador LaTeX legado |
| LETXIPU_LATEX_COMPILER_BACKUP, _BACKUP_2 | D:\OTROS\LETXIPU_LATEX_COMPILER_BACKUP* | 107.8 MB c/u | Backups compilador |
| letxipu-agent, v2, v4, v11, v12 | D:\OTROS\letxipu-agent* | 0.4 MB - 643.4 MB | Agentes legados |
| claude-code, claude-code-source | D:\OTROS\claude-code* | 45-117 MB | Claude code forks |
| LETXIPU-SEARCH-MCP-V3, V4, V5, V6, V7, V8, V9 | D:\OTROS\LETXIPU-SEARCH-MCP-V* | 142-1098 MB |versiones previas del MCP search |
| LETXIPU-BETA-SX-COPIA, -2, -3 | D:\OTROS\LETXIPU-BETA-SX-COPIA* | — | Betas SX (3 copias) |
| LETXIPU-CHROME-MCP-CLIENT | D:\OTROS\LETXIPU-CHROME-MCP-CLIENT | 28 archivos | Chrome MCP |
| LETXIPU-GRADIO | D:\OTROS\LETXIPU-GRADIO | 24 archivos | Gradio experimental |
| NOTEBOOKLM | D:\OTROS\NOTEBOOKLM | 41 archivos | NotebookLM |
| OMNI-Office-Word-MCP-Server | D:\OTROS\OMNI-Office-Word-MCP-Server | 12 archivos | Word MCP (presente en Suite) |
| osmmcp-fork | D:\OTROS\osmmcp-fork | 44 MB | Fork alternativo OSM |
| TESIS_BIOTECNOLOGIA | D:\OTROS\TESIS_BIOTECNOLOGIA | 2 archivos | Tesis biotecnologia |
| SKILLS | D:\OTROS\SKILLS | 1 archivo | Skills sueltas |
| MCPs BAT | D:\OTROS\MCPs BAT | 5 archivos | Scripts BAT MCPs |
| PROYECTO + SKILL | D:\OTROS\PROYECTO + SKILL | 2 archivos | Proyecto skill |
| LETXINET-MCP-AGENT-GUI | D:\OTROS\LETXINET-MCP-AGENT-GUI | 19 archivos | GUI MCP agent |

---

## 5. Plan de Reubicacion / Unificacion

### 5.1 Estructura objetivo propuesta

```
D:\LETXINET-ARCHIVE\                                    ← NUEVA carpeta raiz ordenada
├── 00-CURRENT/                                         ← Lo vigente hoy (Sesion 7 v1.1.0)
│   ├── instaladores/
│   │   ├── LetXinet-Suite-1.1.0-VariantA-Setup.exe     (6.77 MB)
│   │   ├── LetXinet-Suite-1.1.0-VariantA-Setup-1.bin   (413.34 MB)
│   │   ├── LetXinet-Suite-1.1.0-VariantB-Setup.exe    (6.77 MB)
│   │   ├── LetXinet-Suite-1.1.0-VariantB-Setup-1.bin   (202.63 MB)
│   │   └── HASHES-SHA256-v1.1.0-regen-2026-08-07.txt
│   ├── zips/
│   │   ├── instaladores-v1.1.0-regen-bugfix-2026-08-07.zip (622 MB)
│   │   ├── fuentes-desktop-hf-v1.5.8-bugfix-v1.1.0.zip    (540 KB)
│   │   ├── fuentes-suite-v1.1.0-regen-bugfix.zip          (340 KB)
│   │   ├── fuentes-mcps-3-osm-v11-markitdown.zip          (37.5 MB)
│   │   └── ZIPS-SESION-7-HASHES.md
│   ├── binarios-mcp/
│   │   ├── osmmcp-patched.exe                          (23.55 MB, 2026-07-31)
│   │   ├── MCP-V11-Local.exe                           (93.75 MB, 2026-07-31)
│   │   └── MCP-V11-Local-Portable.zip                 (165 MB, 2026-07-29)
│   └── MANIFIESTO-CURRENT-v1.1.0.md                   (este archivo, copia)
│
├── 01-SOURCES-ACTIVOS/                                 ← Repos activos para desarrollo
│   ├── LETXINET-DESKTOP-HF/                            (repo Desktop HF, server.ts fuente)
│   ├── LETXINET-SUITE/                                 (repo Suite, ISS, build-variants.cmd)
│   ├── LETXIPU-SEARCH-MCP-V11-LOCAL/                  (repo V11, 59 .ts source)
│   ├── letxipu-osm-mcp/                                (repo OSM MCP, .go source)
│   └── markitdown-api/                                 (repo MarkItDown, .py source)
│
├── 02-HISTORIAL-VERSIONES/                             ← Backups por version
│   ├── v1.0.0-2026-08-01/                              (primer Suite)
│   │   ├── instaladores/
│   │   └── docs/
│   ├── v1.0.1-2026-08-01/                              (hashes post-install fixes)
│   ├── v1.1.0-pre-bugfix-2026-08-06/                  (antes Bug 1-4)
│   │   ├── instaladores/                               (Los del backup regen)
│   │   └── docs/
│   ├── v1.5.2-a-v1.5.8-VARIANTE-C-2026-08-02-a-03/    (linea paralela C)
│   │   └── instaladores/                               (14 .exe Version C)
│   └── pre-Suite-2026-07-30-a-31/                      ( instaladores standalone)
│       ├── LetXipu Desktop HF Setup 0.0.0.exe         (274 MB)
│       ├── OSM-MCP-Setup 0.0.0.exe                    (12 MB)
│       ├── MCP-V11-Local-Setup-A 0.0.0.exe            (518 MB)
│       └── MCP-V11-Local-Setup-B 0.0.0.exe            (518 MB)
│
├── 03-PROFILING-Y-LOGS/                                ← Traces y logs de build
│   ├── profiling/                                      (trace-events.json, cpu-profile)
│   └── build-logs/                                     (variantA/B-build.log, install-test*.log)
│
├── 04-PRUEBAS-FUENTES/                                 ← Tests del pool 39 fuentes
│   ├── Informe-Fuentes-Individuales-2026-08-07.md
│   └── json/                                           (batch1-batch8 jsons)
│
├── 05-LEGADO-NO-SUITE/                                 ← Proyectos no-Suite (archivar)
│   ├── MCP-SEARCH-V1-V9/                              ( versiones V1-V9 del MCP search)
│   ├── MCP-CLIENT/                                      (letxipu-mcp-client + skills)
│   ├── MCP-LATEX/                                      (MCP_CLIENTE_LATEX V1-V4)
│   ├── LATEX-COMPILER/                                (compiler_latex, V2, backups)
│   ├── AGENTS-LEGADOS/                                (letxipu-agent, v2, v4, v11, v12)
│   ├── CLAUDE-CODE/                                    (claude-code + source)
│   ├── CHROME-MCP/                                     (LETXIPU-CHROME-MCP-CLIENT)
│   ├── GRADIO/                                         (LETXIPU-GRADIO)
│   ├── SUPER-MCP/                                      (SUPER-MCP experimental)
│   ├── GOOGLE-DRIVE-MCP/                              (MCP_GOOGLE_DRIVE)
│   ├── NOTEBOOKLM/                                     (NOTEBOOKLM)
│   ├── TESIS-BIOTECNOLOGIA/                            (TESIS_BIOTECNOLOGIA)
│   ├── GITHUB-SNAPSHOTS/                              (GITHUB/LETXINET-MCP-main.zip)
│   ├── SKILLS-SUELTAS/                                 (SKILLS, PROYECTO + SKILL, MCPs BAT)
│   ├── BETAS-SX/                                       (LETXIPU-BETA-SX-COPIA 1/2/3)
│   └── DESCARTADOS-EXTRAS/                             (Omni-Office-Word-standalone, osmmcp-fork)
│
└── README-ARCHIVE.md                                   (este archivo, indice maestro)
```

### 5.2 Acciones de Reubicacion (por prioridad)

**PRIORIDAD ALTA — Lo vigente primero (hacer ya):**

1. **Crear `D:\LETXINET-ARCHIVE\00-CURRENT\`** y copiar (NO mover — mantener rollback):
   - Los 4 instaladores Suite v1.1.0 VariantA/B + 2 .bin
   - Los 4 zips sesion-7-regen-v1.1.0-bugfix
   - Los 3 binarios MCP (osmmcp-patched.exe, MCP-V11-Local.exe, MCP-V11-Local-Portable.zip)
   - `MANIFIESTO-CURRENT-v1.1.0.md` con un resumen 1-pagina del estado actual

2. **Crear `D:\LETXINET-ARCHIVE\01-SOURCES-ACTIVOS\`** y crear **symlinks** (mklink /D) a:
   - `D:\OTROS\LETXINET-DESKTOP-HF`
   - `D:\OTROS\LETXINET-SUITE`
   - `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL`
   - `D:\OTROS\letxipu-osm-mcp`
   - `D:\OTROS\markitdown-api`
   
   Razon: los repos activos se quedan en `D:\OTROS\` para no romper rutas en `server.ts`, `build-variants.cmd`, etc. Symlinks dan vista unificada.

**PRIORIDAD MEDIA — Historial por versiones:**

3. **Crear `D:\LETXINET-ARCHIVE\02-HISTORIAL-VERSIONES\`**:
   - `v1.0.0-2026-08-01\` ← recuperar de backups regen-suite-v1.1.0\...prev (Solo si queremos conservar — actualmente estos backups estan en `D:\OTROS\LETXINET-OPTIM-BUILD\backups\regen-suite-v1.1.0\2026-08-07-235900\installer-output-prev\variantA\, variantB\`)
   - `v1.0.1-2026-08-01\` ← copiar `HASHES-SHA256-v1.0.1.txt`
   - `v1.1.0-pre-bugfix-2026-08-06\` ← copiar `installer-output-prev\` (1.04 GB)
   - `v1.5.2-a-v1.5.8-VARIANTE-C\` ← MOVER los 14 `.exe` desde `D:\OTROS\LETXINET-SUITE-VARIANTE-C\` (~4 GB)
   - `pre-Suite-2026-07-30-a-31\` ← MOVER desde `D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\` (~1.3 GB) + los `.zip` source de `CODIGO-FUENTE\`

**PRIORIDAD BAJA — Logs y Profiling:**

4. **Mover a `D:\LETXINET-ARCHIVE\03-PROFILING-Y-LOGS\`**:
   - `D:\OTROS\LETXINET-OPTIM-BUILD\profiling\` (mover completo, ~10 MB)
   - `D:\OTROS\LETXINET-SUITE\build\installer-output\test-logs\` (mover, ~60 MB)

5. **Mover a `D:\LETXINET-ARCHIVE\04-PRUEBAS-FUENTES\`**:
   - `D:\OTROS\PRUEBAS-LETXINET\` (entero)
   - `D:\OTROS\LETXINET-POOL-TESTS\` (entero)

**PRIORIDAD BAJA — Legado no-Suite (archivar con cuidado, ahorra ~20+ GB):**

6. **Mover a `D:\LETXINET-ARCHIVE\05-LEGADO-NO-SUITE\`** (carpetas que ya no se usan pero preservamos):
   - LETXIPU-SEARCH-MCP (V1), V2, ENCRIPTED (~90 MB)
   - LETXIPU-SEARCH-MCP-V3, V4, V5, V6, V7, V8, V9 (~1+ GB)
   - letxipu-mcp-client, letxipu-mcp-client-skills (~800 MB)
   - MCP_CLIENTE_LATEX V1, V2, V3, V4 (~1+ GB)
   - compiler_latex, LETXIPU_LATEX_COMPILER, _V2, _BACKUP, _BACKUP_2 (~2.5+ GB)
   - letxipu-agent, v2, v4, v11, v12 (~1.8 GB)
   - claude-code, claude-code-source (~160 MB)
   - LETXIPU-CHROME-MCP-CLIENT
   - LETXIPU-GRADIO
   - SUPER-MCP, MCP_GOOGLE_DRIVE (~300 MB)
   - NOTEBOOKLM, OMNI-Office-Word-MCP-Server (~200 MB)
   - LETXIPU-BETA-SX-COPIA 1/2/3
   - SKILLS, MCPs BAT, PROYECTO + SKILL, TESIS_BIOTECNOLOGIA
   - GITHUB (snapshot)
   - osmmcp-fork (fork alternativo)
   - BACKUP-BETA-01

**NO MOVER:**

- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\` (957 MB — **mantener donde esta** porque scripts de build pueden referenciarlo)
- `D:\OTROS\LETXINET-OPTIM-BUILD\zips\sesion-7-regen-v1.1.0-bugfix\` — sera copiado a `00-CURRENT\zips\`, mantener el original
- `D:\OTROS\ENV-UNIFICADO\` — mover a `04-PRUEBAS-FUENTES\env\` (testeado de keys)
- `D:\OTROS\LETXINET-SUITE-VARIANTE-C\` — los archivos fuente (`PLAN-VARIANTE-C-FINAL-v1.5.8.md`, `MOCKUP-VENTANA-*.md`, `ApiKeysConfig.tsx`, `App.tsx`, `server.ts`, `AgentChat.tsx`, etc.) son **valiosos como referencia**, pero los 14 instaladores `.exe` pueden archivoarse aparte en `02-HISTORIAL-VERSIONES\v1.5.2-a-v1.5.8-VARIANTE-C\instaladores\`

### 5.3 Estimacion de Ahorro de Espacio

Despues de ejecutar el plan:
- **D:\OTROS\** se reduciria de ~60+ GB virgen a solo los 5 repos activos (~3 GB: Desktop HF + Suite + V11-LOCAL + osm-mcp + markitdown-api)
- **D:\LETXINET-ARCHIVE\** tendria el archivo historico completo (~55-58 GB)
- **D:\OTROS\LETXINET-OPTIM-BUILD\backups\** se queda in-situ (957 MB) para no romper scripts

**Importante:** el disco D: tiene solo ~7.85 GB libres. Antes de mover masivamente, **liberar espacio borrando** los 14 .exe de VARIANTE-C (~4 GB) si no se quieren conservar — o solo conservar el v1.5.8 final (2 .exe, 562 MB).

### 5.4 Comandos Sugeridos (resumen para ejecucion)

```powershell
# Paso 1 — Crear estructura destino
New-Item -ItemType Directory -Path "D:\LETXINET-ARCHIVE\00-CURRENT\instaladores" -Force
New-Item -ItemType Directory -Path "D:\LETXINET-ARCHIVE\00-CURRENT\zips" -Force
New-Item -ItemType Directory -Path "D:\LETXINET-ARCHIVE\00-CURRENT\binarios-mcp" -Force
New-Item -ItemType Directory -Path "D:\LETXINET-ARCHIVE\01-SOURCES-ACTIVOS" -Force
New-Item -ItemType Directory -Path "D:\LETXINET-ARCHIVE\02-HISTORIAL-VERSIONES" -Force
New-Item -ItemType Directory -Path "D:\LETXINET-ARCHIVE\03-PROFILING-Y-LOGS" -Force
New-Item -ItemType Directory -Path "D:\LETXINET-ARCHIVE\04-PRUEBAS-FUENTES" -Force
New-Item -ItemType Directory -Path "D:\LETXINET-ARCHIVE\05-LEGADO-NO-SUITE" -Force

# Paso 2 — Copiar instaladores actuales a 00-CURRENT
robocopy "D:\OTROS\LETXINET-SUITE\build\installer-output\variantA" "D:\LETXINET-ARCHIVE\00-CURRENT\instaladores" *.exe *.bin /R:1 /W:1
robocopy "D:\OTROS\LETXINET-SUITE\build\installer-output\variantB" "D:\LETXINET-ARCHIVE\00-CURRENT\instaladores" *.exe *.bin /R:1 /W:1
Copy-Item "D:\OTROS\LETXINET-SUITE\build\installer-output\HASHES-SHA256-v1.1.0-regen-2026-08-07.txt" "D:\LETXINET-ARCHIVE\00-CURRENT\instaladores\"

# Paso 3 — Copiar zips Sesion 7 a 00-CURRENT
robocopy "D:\OTROS\LETXINET-OPTIM-BUILD\zips\sesion-7-regen-v1.1.0-bugfix" "D:\LETXINET-ARCHIVE\00-CURRENT\zips" /E /R:1 /W:1

# Paso 4 — Copiar binarios MCP
Copy-Item "D:\OTROS\letxipu-osm-mcp\osmmcp-patched.exe" "D:\LETXINET-ARCHIVE\00-CURRENT\binarios-mcp\"
Copy-Item "D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\MCP-V11-Local.exe" "D:\LETXINET-ARCHIVE\00-CURRENT\binarios-mcp\"
Copy-Item "D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\MCP-V11-Local-Portable.zip" "D:\LETXINET-ARCHIVE\00-CURRENT\binarios-mcp\"

# Paso 5 — Symlinks a repos activos (NO mover)
cmd /c mklink /D "D:\LETXINET-ARCHIVE\01-SOURCES-ACTIVOS\LETXINET-DESKTOP-HF" "D:\OTROS\LETXINET-DESKTOP-HF"
cmd /c mklink /D "D:\LETXINET-ARCHIVE\01-SOURCES-ACTIVOS\LETXINET-SUITE" "D:\OTROS\LETXINET-SUITE"
cmd /c mklink /D "D:\LETXINET-ARCHIVE\01-SOURCES-ACTIVOS\LETXIPU-SEARCH-MCP-V11-LOCAL" "D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL"
cmd /c mklink /D "D:\LETXINET-ARCHIVE\01-SOURCES-ACTIVOS\letxipu-osm-mcp" "D:\OTROS\letxipu-osm-mcp"
cmd /c mklink /D "D:\LETXINET-ARCHIVE\01-SOURCES-ACTIVOS\markitdown-api" "D:\OTROS\markitdown-api"

# Paso 6 onwards — mover historico y legado (ver seccion 5.2)
```

### 5.5 Notas Finales

- **MQ迟迟 smcp** (los 3 versiones binarias): el `osmmcp-patched.exe` (23.55 MB, 2026-07-31 16:34) es el que va en el Suite v1.1.0. El `osmmcp.exe` en letxipu-osm-mcp raiz (23.55 MB, 2026-07-23) probablemente sea el mismo pero sin parchear — los dos son IDs distintos. `osmmcp-fork\osmmcp.exe` (23.42 MB, 2026-07-07 — fork alternativo 109 KB mas pequenyo) pero mas antiguo y probablemente sin los features finales.
- **MCP-V11** tiene **3 versiones distintas**: la no-LOCAL (`LETXIPU-SEARCH-MCP-V11` del 2026-07-28), la LOCAL (`LETXIPU-SEARCH-MCP-V11-LOCAL` del 2026-07-29 con 28 providers), y la que va en Suite (precompilada dentro del installer del Suite en `packaging\dist\`). El repo activo es V11-LOCAL.
- **LETXINET-MCP-AGENT-GUI** — el zip `LETXINET-MCP-AGENT-GUI-V2-main.zip` (311 KB) es una V2 preview del agente — solo referencia.
- **Variante-C** vs **Suite v1.1.0**: son **dos lineas paralelas distintas**. La Variante-C usa electron-builder (Setup 281 MB + Portable 281 MB), itero v1.5.2 a v1.5.8 entre 2026-08-02 y 2026-08-03, y paro. La Suite v1.1.0 usa Inno Setup (.exe 6.77 MB + .bin 213-413 MB), empezo 2026-08-01 como v1.0.0 y llego a v1.1.0 regen el 2026-08-07. **La Suite Inno Setup es la linea ganadora** y la unica que sigue activa.

---

## 6. Indice Rapido - Donde encontrar cada cosa

| Quiero... | Voy a... |
|-----------|----------|
| Instalar Suite v1.1.0 hoy (con keys) | `D:\OTROS\LETXINET-SUITE\build\installer-output\variantA\LetXinet-Suite-1.1.0-VariantA-Setup.exe` |
| Instalar Suite v1.1.0 (sin keys, publico) | `D:\OTROS\LETXINET-SUITE\build\installer-output\variantB\LetXinet-Suite-1.1.0-VariantB-Setup.exe` |
| Distribuir 4 zips completos con todo | `D:\OTROS\LETXINET-OPTIM-BUILD\zips\sesion-7-regen-v1.1.0-bugfix\` |
| Ver/editar codigo fuente server.ts | `D:\OTROS\LETXINET-DESKTOP-HF\server.ts` |
| Ver/editar codigo fuente Suite ISS | `D:\OTROS\LETXINET-SUITE\src-suite\instalador\LetXinet-Suite.iss` |
| Ver/editar codigo fuente MCP V11 (28 providers) | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\src\providers\*.ts` |
| Ver/editar codigo fuente OSM MCP (Go) | `D:\OTROS\letxipu-osm-mcp\*.go` |
| Ver/editar codigo fuente MarkItDown (Python) | `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\markitdown-api\markitdown-payload\app.py` |
| Ver config runtime del Electron (secrets) | `%APPDATA%\letxipu-desktop-hf\secrets.json` |
| Ver backups antes de cada bug fix | `D:\OTROS\LETXINET-OPTIM-BUILD\backups\fix-*\` |
| Ver reporte completo del pool 39 fuentes 2026-08-07 | `D:\OTROS\PRUEBAS-LETXINET\fuentes-individuales\Informe-Fuentes-Individuales-2026-08-07.md` |
| Ver instaladores Suite v1.1.0 PRE-bugfix (historico) | `D:\OTROS\LETXINET-OPTIM-BUILD\backups\regen-suite-v1.1.0\2026-08-07-235900\installer-output-prev\variantA\, variantB\` |
| Ver instaladores Suite v1.0.0 (sesion 6) | `D:\OTROS\LETXINET-OPTIM-BUILD\zips\sesion-6-suite-v1.1.0\instaladores-v1.1.0.zip` (834 MB) |
| Ver instaladores de linea paralela Variante-C | `D:\OTROS\LETXINET-SUITE-VARIANTE-C\Letxinet-Suite-v1.5.*-VarianteC-Setup.exe` (14 .exe) |
| Ver instaladores PRE-Suite (Desktop HF + OSM + V11 standalone) | `D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\` |
| Ver profiling CPU/RAM traces | `D:\OTROS\LETXINET-OPTIM-BUILD\profiling\` (trace-events.json 9.92 MB, cpu-profile 363 KB) |
| Ver logs de build Suite | `D:\OTROS\LETXINET-SUITE\build\installer-output\test-logs\` |
| Ver informe completo (este archivo) | `D:\LETXINET-ARCHIVE\README-ARCHIVE.md` (despues de ejecutar el plan) o aqui mismo |

---

**Fin del documento.**

Generado el 2026-08-08 por opencode despues de escanear 63 carpetas de `D:\OTROS\`. Este documento debe moverse a `D:\LETXINET-ARCHIVE\README-ARCHIVE.md` una vez ejecutado el plan de reubicacion.
