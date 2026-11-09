# Fase 4 + Fase 5 — Codigo del Suite + Build de instaladores

Fecha: 2026-07-31
Duracion total: ~30 min (escritura codigo + 2 builds de 25-28 min c/u)

---

## Fase 4 — Codigo del Suite generado

### 4.1 Launchers `.cmd` (registrados en `instalador\bin\`)

| Archivo                              | Funcion                                          |
|------------------------------------|--------------------------------------------------|
| `suite-env-loader.cmd`              | Parser `LetXinet-Suite.env` -> vars CMD (idempotente, saltea `#` comments) |
| `start-osm-mcp.cmd`                 | Lanza `osmmcp.exe -enable-http -http-only -http-addr ":%OSM_MCP_PORT%" -monitoring-addr ":%OSM_METRICS_PORT%" -user-agent "%OSM_USER_AGENT%"` |
| `start-markitdown-api.cmd`          | Lanza `python-runtime\python.exe -m uvicorn app:app --host 127.0.0.1 --port %MARKITDOWN_API_PORT% --app-dir "%API_DIR%"` |
| `start-mcp-v11-local.cmd`           | Lanza `MCP-V11-Local.exe` con env PORT, SPACY_PORT, SPACY_CACHE_ROOT, MARKITDOWN_API_URL, etc. heredados de Suite.env |
| `start-letxinet-desktop.cmd`        | Lanza Electron app via `start ""` (no bloqueante). Hereda `DESKTOP_ENDPOINT_MODE` + `LETXIPU_*_URL` desde Suite.env |

Todos los launchers cargan `suite-env-loader.cmd` despues de calcular `INSTALL_DIR` y `SUITE_LOG_DIR`. Si `%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env` existe, lo prefieren (override post-install); en caso contrario usan `INSTALL_DIR\shared-env\LetXinet-Suite.env`.

### 4.2 Scripts NSSM

| Archivo                  | Funcion                                                                                                                           |
|------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| `register-services.cmd`  | Detiene y elimina servicios previos (idempotente), registra 3 nuevos via NSSM con logs en `%PROGRAMDATA%\LetXinet Suite\Logs\`, rotation 5 MB, restart on failure, auto-start (V11 delayed). Inicia los 3 tras 5s delay entre MarkItDown y V11. |
| `uninstall-services.cmd` | `taskkill LetXipu Desktop HF.exe` + stop+remove los 3 servicios en orden inverso (V11 -> MarkItDown -> OSM).                   |

### 4.3 `LetXinet-Suite.iss` (Inno Setup 6 script)

Tiene 7 secciones de `[Files]` agrupadas: suite bin, nssm, shared-env, OSM-MCP, MarkItDown API, MCP-V11-Local (+ .env variant A/B), letxinet-desktop, README. 

Servicios NSSM (`register-services.cmd`):
- `LetXinetSuiteOSMMCP`      (`%COMSPEC% /c start-osm-mcp.cmd`), AUTO_START, puerto 7082
- `LetXinetSuiteMarkitDown`  (`%COMSPEC% /c start-markitdown-api.cmd`), AUTO_START, puerto 7860
- `LetXinetSuiteMCPV11`      (`%COMSPEC% /c start-mcp-v11-local.cmd`), DELAYED_AUTO_START, puerto 4003

Log rotation: `AppRotateFiles 1, AppRotateOnline 1, AppRotateBytes 5242880` (5 MB).
Restart on failure: `AppExit Default Restart`.

LetXinet Desktop NO es servicio NSSM. Atajos en menu inicio y escritorio (`{commondesktop}`) invocan `start-letxinet-desktop.cmd`. AppVars `DESKTOP_ENDPOINT_MODE`, `LETXIPU_*_URL` propagadas desde Suite.env.

Decisiones clave del `.iss`:
- `DefaultDirName={commonpf}\LetXinet Suite` (Program Files; requiere admin)
- `Compression=lzma2/ultra64` + `SolidCompression=yes` + `LZMAUseSeparateProcess=yes` -> proceso ISCC en PID separado para RAM dedicada de LZMA
- `DiskSpanning=yes` + `DiskSliceSize=700000000` -> payload partido en archivos de ~700 MB (`Setup-1.bin`)
- `ArchitecturesInstallIn64BitMode=x64compatible` + `ArchitecturesAllowed=x64compatible`
- `PrivilegesRequired=admin` + `PrivilegesRequiredOverridesAllowed=dialog`
- `SetupIconFile=assets\icon.ico` (icono 107 KB, cuadrado con fondo #0b0f1a)
- Variante A y B coexistibles: `AppId` distinto por variante
- `LicenseFile=LICENSE.txt` + `InfoBeforeFile=INFO-BEFORE.txt` (informacion pre-install al operador)
- Shared-env con `Flags: onlyifdoesntexist uninsneveruninstall` -> el .env del Suite NO se sobreescribe al reinstalar; los logs NO se borran al desinstalar
- `RunOnceId: "StopServices"` en `[UninstallRun]` (semantica single-run)

### 4.4 Variantes A/B

| Carpeta                                 | Contenido                                       |
|----------------------------------------|-------------------------------------------------|
| `variant-tokens\variantA-interno\.env` | `.env` privado del V11 con todos los tokens reales (HF_TOKEN, MINERU_API_KEY, CORE_API_KEY, etc.) 2.2 KB |
| `variant-tokens\variantB-publico\.env`  | `.env` plantilla publica sin tokens (campos vacíos para que el usuario final pegue los suyos) |

El `.iss` usa `#ifdef VARIANT_A` / `#else` para elegir un `.env` u otro en el Source line.

### 4.5 `build-variants.cmd`

Driver de compilacion:
1. Verifica ISCC.exe en `%LOCALAPPDATA%\Programs\Inno Setup 6\`
2. `subst L: D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches` (truco para acortar paths > MAX_PATH 260; sin esto ISCC falla en archivos como `L:\letxinet-desktop\resources\app.asar.unpacked\dist\node_modules\@mistralai\mistralai\esm\models\operations\getchatcompletionfieldoptionscountsv1observabilitychatcompletionfieldsfieldnameoptionscountspost.d.ts.map` que originalmente era 265 chars)
3. Llama ISCC con `/DVARIANT_A /DPAYLOAD_ROOT="L:\"` o `/DVARIANT_B /DPAYLOAD_ROOT="L:\"`
4. `subst L: /d` al final (cleanup OK o err)

`PAYLOAD_ROOT` es un define ISPP (`#ifndef PAYLOAD_ROOT #define PAYLOAD_ROOT "..\componentes-parches" #endif`) que en runtime del ISCC se substituye en las 11 lineas `Source: "{#PAYLOAD_ROOT}\..."`. Permite alternar entre path relativo y path subst en drive L:.

---

## Fase 5 — Compilacion de los instaladores

### 5.1 Bug inicial — paths largos > MAX_PATH 260

Primer build (variante B) fallo después de procesar ~ milestones de `onnxruntime\tools\ort_format_model\ort_flatbuffers_py\fbs\__pycache__\RuntimeOptimizationRecordContainerEntry.cpython-312.pyc` con error "El sistema no puede encontrar la ruta especificada". Diagnostico: en `componentes-parches\` habia 15 archivos con path > 255 (todos en `letxinet-desktop\resources\app.asar.unpacked\dist\node_modules\@mistralai\mistralai\esm\models\operations\...`). El maximo era 265 chars.

Solucion: subst L: -> componentes-parches\, path maximo baja de 265 a 214.

### 5.2 Bug inicial II — comentarios `;` en `[Code]`

ISCC expects Pascal-style comments en `[Code]`: `//` o `{ }`. Yo habia usado `;` (estilo otras secciones ISCC). Error: `'BEGIN' expected` en la funcion `IsNssmAvailable`. Corregido con `//`.

### 5.3 Bug inicial III — falso "Build FALLIDO" en build-variants.cmd

Powershell + cmd `if errorlevel 1` se confunde si en la misma secuencia hay un `if /I "==B" goto`. Corregido con `set "ISCC_RC=%errorlevel%"` tras el ISCC + `if not "%ISCC_RC%"=="0"`. (Ambos builds ya habian terminado exitosamente; el falso fallo era solo de exit-code en el wrapper.)

### 5.4 Bugs menores corregidos

- `DefaultDirName={pf}\...` -> `{commonpf}\...` (ISCC 6.7+ renombrado)
- `IsAdminLoggedOn` -> `IsAdminInstallMode`
- Falta `RunOnceId` en `[UninstallRun]` -> añadido `RunOnceId: "StopServices"`

### 5.5 Resultado

| Variante | Setup.exe | Setup-1.bin  | Total  | Compresion | Duracion | SHA256 (exe)                                                   | SHA256 (bin)                                                   |
|---------|-----------|-------------|--------|------------|----------|----------------------------------------------------------------|----------------------------------------------------------------|
| A       | 4.74 MB   | 503.63 MB   | 508 MB | 4.0:1 (74.8%) | 25.7 min | DF4443C91D1FD27183B64844805262407DE83013B92E0E542CBDBE095A7F0DB5 | 76380B62A4DA62A19645F07D14B3A2CB1E5B17168D4EAA3B39EB8195BC57793B |
| B       | 4.74 MB   | 503.60 MB   | 508 MB | 4.0:1 (74.8%) | 27.8 min | F36806C0CF5B18BEB49746F2EE3479D697D3EBF6CB74EC8637B21AA64D142562 | (no mesure explicito) |

Comparacon: payload original total 2015 MB -> instalador final 508 MB. LZMA2 ultra64 con solid compression entrega ratio 4:1.

Los `Setup.exe` (4.74 MB) son el wizard Inno que, al ejecutarse, busca `Setup-1.bin` al lado (mismo directorio) y descomprime los 503 MB al destino. **Es necesario distribuir ambos archivos (.exe + .bin) juntos en el mismo directorio**.

### 5.6 Ubicacion de salida instaladores

```
D:\OTROS\LETXINET-SUITE\build\installer-output\
  |-- variantA\
  |   |-- LetXinet-Suite-1.0.0-VariantA-Setup.exe    4.74 MB
  |   |-- LetXinet-Suite-1.0.0-VariantA-Setup-1.bin  503.63 MB
  |-- variantB\
  |   |-- LetXinet-Suite-1.0.0-VariantB-Setup.exe    4.74 MB
  |   |-- LetXinet-Suite-1.0.0-VariantB-Setup-1.bin  503.60 MB
  |-- variantA-build.log                            6.71 MB (output stdout ISCC)
  |-- variantB-build.log                            6.71 MB (output stdout ISCC)
```

---

## Verificacion salud post-build

- OSM-MCP standalone smoke test (puerto 17082): CLI recibe `-user-agent "Suite-Test/1.0"`, log `[INFO] starting OpenStreetMap MCP server ... user_agent=Suite-Test/1.0` -> parche P-4 confirmado en runtime. HTTP GET / -> 200 OK.
- Launchers escritos leen `LetXinet-Suite.env` via `suite-env-loader.cmd` (verificado en Fase 3 previa) y propagan SUITE_LOG_DIR a %PROGRAMDATA%.
- build-variants.cmd: subst L: mapeado limpio + removido al final (no reinicio necesario).

---

## Pendiente

- Fase 6: Pruebas funcionales — instalar una variante, verificar servicios NSSM en services.msc, healthchecks HTTP a los 4 endpoints (@{ port=7082; port=7860; port=4003; port=43123 }), editar Suite.env y reiniciar, desinstalar limpio.
- Fase 7: Documentacion final (README, CHANGELOG, HASHES-SHA256.txt de los 4 artefactos).

---

## Artefactos generados en esta fase

- `src-suite\instalador\bin\start-letxinet-desktop.cmd` (nuevo)
- `src-suite\instalador\register-services.cmd` (nuevo)
- `src-suite\instalador\uninstall-services.cmd` (nuevo)
- `src-suite\instalador\LetXinet-Suite.iss` (nuevo; 236 lineas)
- `src-suite\instalador\assets\icon.ico` (107.6 KB, copiado de build\icons\)
- `src-suite\instalador\LICENSE.txt` (nuevo)
- `src-suite\instalador\INFO-BEFORE.txt` (nuevo)
- `src-suite\instalador\README-SUITE.txt` (nuevo)
- `src-suite\instalador\build-variants.cmd` (nuevo)
- `variant-tokens\variantA-interno\.env` (nuevo, 2.2 KB)
- `variant-tokens\variantB-publico\.env` (nuevo, plantilla sin tokens)
- `build\installer-output\variantA\LetXinet-Suite-1.0.0-VariantA-Setup.exe`   (4.74 MB)
- `build\installer-output\variantA\LetXinet-Suite-1.0.0-VariantA-Setup-1.bin` (503.63 MB)
- `build\installer-output\variantB\LetXinet-Suite-1.0.0-VariantB-Setup.exe`   (4.74 MB)
- `build\installer-output\variantB\LetXinet-Suite-1.0.0-VariantB-Setup-1.bin` (503.60 MB)

EOF.
