# ZIPS SESION 7 - Regen Suite v1.1.0 (post Bug 1-4)

**Fecha:** 2026-08-07 23:57 -05:00  
**Carpeta:** `D:\OTROS\LETXINET-OPTIM-BUILD\zips\sesion-7-regen-v1.1.0-bugfix\`

## Resumen

Regeneracion de instaladores Suite v1.1.0 despues de aplicar los fixes Bug 1-4 al `server.cjs` + actualizar `secrets.json` con todas las API keys validas. Incluye source code de los 2 repos + installers finales.

## Cambios clave en esta regeneracion

| Componente | Estado previo (sesion 6) | Estado actual (sesion 7) |
|------------|--------------------------|--------------------------|
| `server.cjs` MD5 | (desconocido, sin Bug 4) | `D1818341231A4A93B1D9A45E4BF93846` (352546 bytes) |
| `secrets.json` MD5 | `F76ACA88DB6EDCC8E0261CF9BE10B4E7` (436 bytes, keys faltantes) | `BBA418C39973B34129E02C03B878ABBA` (1859 bytes, 9 keys validas) |
| Bug 1 (Variables de Sistema) | No bloqueaba API keys LLM | `*_API_KEY` de LLM providers readOnly + reject HTTP 400 |
| Bug 2 (Sufijo `:provider`) | Routing incorrecto | `parseProviderSuffix` + `resolveProviderRouting` aplicados |
| Bug 3 (API keys invalidas) | sync 129 modelos en 10 grupos | sync **832 modelos** en **11 grupos** |
| Bug 4 (Gemini routing) | 404/401/sin texto | `models/` prefix stripped, sin `Authorization: Bearer` para Google, `:streamGenerateContent?alt=sse` |

## 4 Zips generados

| # | Nombre | Tamaño | Contenido |
|---|--------|--------|-----------|
| 1 | `instaladores-v1.1.0-regen-bugfix-2026-08-07.zip` | ~622 MB | VariantA (.exe 7.10 MB + .bin 433 MB) + VariantB (.exe 7.10 MB + .bin 212 MB) + HASHES-SHA256 + CHANGELOG + RELEASE + README-REGEN |
| 2 | `fuentes-desktop-hf-v1.5.8-bugfix-v1.1.0.zip` | ~540 KB | Codigo fuente Desktop HF (98 archivos: server.ts, src/, electron/, mcp-bridge/, skills/, scripts/, configs) — excluye node_modules/dist/build |
| 3 | `fuentes-suite-v1.1.0-regen-bugfix.zip` | ~340 KB | Codigo fuente Suite (38 archivos: build-variants.cmd, .iss, README-SUITE, INFO-BEFORE, CHANGELOG, RELEASE, scripts bin, register-services, shared-env, variant-tokens) |
| 4 | `fuentes-mcps-3-osm-v11-markitdown.zip` | ~37.5 MB | Codigo fuente 3 MCPs: mcp-osm (Go, 116 archivos .go), mcp-v11-search (TypeScript, 253 archivos con 28 providers academicos), mcp-markitdown (Python, 3 archivos: app.py + adapter + requirements.txt). Excluye python-runtime (223 MB) y bins precompilados |

## Instaladores embebidos en el zip 1 — SHA256

```
VariantA Setup (interno, con tokens academicos + 3 IA keys):
  6F10D5797E2839F0FD613D6E0483BCDF675D33E91791CC31FACC655AF1EBEBED  LetXinet-Suite-1.1.0-VariantA-Setup.exe        (7.10 MB)
  314CB5DDDC62BABC4C596BE5800BD344B1C024CE410FF586C5726968B7643B93  LetXinet-Suite-1.1.0-VariantA-Setup-1.bin      (433.42 MB)

VariantB Setup (publico, sin tokens — el operador mete sus keys via GUI):
  D93753B14DB2686AAE6007BF5D7A9D4A5078673C39E2A8D4F183968AAA5DD0B3  LetXinet-Suite-1.1.0-VariantB-Setup.exe        (7.10 MB)
  7BD3FBC5272C2B489255B7E5F22B579FC799C493C56C55884D4C69D1CA3EA072  LetXinet-Suite-1.1.0-VariantB-Setup-1.bin      (212.47 MB)
```

## Backup previo

`D:\OTROS\LETXINET-OPTIM-BUILD\backups\regen-suite-v1.1.0\2026-08-07-235900\`  
(39 archivos, 957 MB — incluye installer-output previo + ISS + payload server.cjs pre-sync + secrets.json previo de 436 bytes)

## Smoke test post-regeneracion

- `GET http://127.0.0.1:43123/api/health` -> HTTP 200 OK con frontend HTML cargado
- Backend en ejecucion tiene MD5 `D181834...` (igual al embebido en los instaladores)
- `/api/models/sync` responde con 832 modelos en 11 grupos (post Bug 3)
- Pool 2026-08-07: 30 sources operativas, 1 dead (`alicia`)

## Verificacion post-install (VariantA ya instalado de la sesion 6)

No se reinstal_o. La instalacion existente en `C:\Program Files\LetXinet Suite\` ya contiene el server.cjs correcto (MD5 D181834...). Si se desea reflashear con el secrets.json nuevo, ejecutar los instaladores `/VERYSILENT` sobre la existente (Inno soporta upgrades in-place).

## Logs / paths

- **Logs centralizados**: `%PROGRAMDATA%\LetXinet Suite\Logs\` (servicios NSSM) + `%APPDATA%\letxipu-desktop-hf\backend.log` (Desktop HF backend)
- **userData Electron**: `%APPDATA%\letxipu-desktop-hf\` (minusculas con guiones, sin espacios)
- **Instaladores en disco**: `D:\OTROS\LETXINET-SUITE\build\installer-output\variantA\` y `variantB\`
- **Skill actualizado**: `C:\Users\USER\.config\opencode\skills\letxinet-search-best-practices\SKILL.md` (22 KB, pool 2026-08-07: 9 revividas + 1 dead)

## Pool 2026-08-07 — Fuentes Gateway V11 (39 fuentes)

Reporte completo: `D:\OTROS\PRUEBAS-LETXINET\fuentes-individuales\Informe-Fuentes-Individuales-2026-08-07.md`

| Estado | Count | Detalle |
|--------|-------|---------|
| OPERATIVAS | 30 | Incluye 9 revividas (core, openalex, unam, anid, snrd, espana, costarica, uruguay, elsalvador) |
| EMPTY (funcional, 0 resultados) | 8 | redalyc, minciencias, conacyt, dblp, paperswithcode, openreview, huggingface |
| DEAD (timeout 90s) | 1 | `alicia` (Peru, Minedu infra caida) |

---

Generado el 2026-08-07 por opencode sesion 7.
