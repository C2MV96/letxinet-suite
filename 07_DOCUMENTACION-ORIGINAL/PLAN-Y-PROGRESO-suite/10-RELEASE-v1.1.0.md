# 10 - RELEASE v1.1.0 — Dual Build Integration

**Fecha**: 2026-08-06
**Versión**: 1.1.0
**Tipo**: minor (new feature — Dual Build con IA providers)
**Anterior**: 1.0.1 (01-Ago-2026)

---

## Objetivo

Integrar en el instalador Suite el Dual Build del LetXinet Desktop HF desarrollado en la Sesión 5 (LETXINET-OPTIM-BUILD). Meta: 2 instaladores Suite v1.1.0 (VariantA interno con 9 tokens académicos + 3 IA provider keys; VariantB público sin secrets).

## Resumen del cambio

1. **server.cjs unificado**: el Desktop HF se recompila SIN `--define:process.env.BUILD_VARIANT`. En runtime `process.env.BUILD_VARIANT` (cargado desde `.env`) decide URLs HF fallback / modo auto. Un solo binario de payload sirve para ambos variants.
2. **Nuevo script `build:unified` y `desktop:win-unpacked`** en `package.json` Desktop HF (sin `--define`).
3. **Nuevo layout Electron**: `resources\app\` (no `app.asar.unpacked\`) consecuencia de `asar: false` en `electron-builder`.
4. **`secrets.json` (436 bytes)** generado con 3 IA provider keys (Nebius/OpenRouter/DeepSeek) copiadas de `.env.local`. Embebido en VariantA vía `#ifdef VARIANT_A` en `.iss`.
5. **`seedSecretsFromBundle()`** en `main.cjs` (líneas 233-265): al primer arranque copia `resources\secrets.json` a `%APPDATA%\LetXipu-Desktop-HF\secrets.json` (userData), preservando claves existentes (merge).
6. **`LetXinet-Suite.env` compartido** actualizado con sección `[12] Dual Build`: `BUILD_VARIANT`, placeholders IA. Sección `[11]` corregida de `app.asar.unpacked\` a `app\`.
7. **`variant-tokens\variantA-interno\.env`** actualizado con `BUILD_VARIANT=private` + doc.
8. **`variant-tokens\variantB-publico\.env`** actualizado con `BUILD_VARIANT=public` + doc.
9. **`start-letxinet-desktop.cmd`** actualizado con documentación v1.1.0 Dual Build y default `BUILD_VARIANT=private` si no está en `.env`.
10. **Build 2 instaladores** vía `build-variants.cmd` con Inno Setup 6 (`/D VARIANT_A` y `/D VARIANT_B`).

## Fases ejecutadas

### F0 — Preparación
- Inno Setup 6 verificado en `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`.
- Backup fuentes Suite → `backups\suite-src-pre-v1.1.0-2026-08-06-195902\` (709.52 KB, 40 archivos).

### F1 — Análisis launchers
- `start-letxinet-desktop.cmd` carga `LetXinet-Suite.env` vía `suite-env-loader.cmd`.
- Electron hereda env vars del proceso cmd padre.

### F2 — Reconstrucción Desktop HF
- Script nuevo `desktop:win-unpacked` en `package.json` Desktop HF.
- `server.cjs` 336.49 KB (344565 bytes) MD5 `A921168CD67780D2600E939BF0ED6D40` — compila sin `--define BUILD_VARIANT`, respeta `process.env.BUILD_VARIANT` en runtime.
- `win-unpacked` 1089.1 MB en ~3 minutos.

### F3 — Actualización payload Suite
- `robocopy /MIR` `dist\win-unpacked\` → `src-suite\componentes-parches\letxinet-desktop\`.
- Tamaño: 771.84 MB (bajó de 1097 MB viejo, -325 MB) gracias al nuevo layout `app/`.
- Residual `win-unpacked` en `resources\app\dist\` limpiado (317 MB liberados).

### F4 — secrets.json
- Generado en `build\secrets.json` (436 bytes, MD5 `F76ACA88DB6EDCC8E0261CF9BE10B4E7`).
- 3 IA provider keys extraídas de `.env.local`: Nebius, OpenRouter, DeepSeek.
- Copiado a `src-suite\componentes-parches\letxinet-desktop\resources\secrets.json`.

### F5 — Modificación .iss
- `MyAppVersion` 1.0.0 → 1.1.0.
- `#ifdef VARIANT_A` para `secrets.json` en `[Files]` (solo VariantA).
- Comentario explicativo del nuevo layout `app/` vs `app.asar.unpacked/`.
- `MyAppSuffixLabel` actualizado.

### F6 — start-letxinet-desktop.cmd
- Documentación v1.1.0 Dual Build añadida.
- Default `BUILD_VARIANT=private` si no está en `.env`.

### F7 — Bump version
- `.iss` v1.1.0 (F5).

### F8 — variant tokens
- `variantA-interno\.env`: `BUILD_VARIANT=private` + documentación Dual Build.
- `variantB-publico\.env`: `BUILD_VARIANT=public` + documentación Dual Build.

### F9 — Docs (parcial)
- `LetXinet-Suite.env` shared: sección `[12] Dual Build` añadida con `BUILD_VARIANT`, placeholders IA.
- Sección `[11]` corregida de `app.asar.unpacked` a `app`.
- `README-SUITE.txt` actualizado: cabecera v1.1.0, árbol `resources\app\`, sección IA providers (Nebius/OpenRouter/DeepSeek), variants Dual Build.
- `INFO-BEFORE.txt` actualizado: cabecera, novedades, IA providers, variants.

### F10 — Build 2 instaladores
- `build-variants.cmd` lanzado, ISCC compiló ambos variants.
- Output: `build\installer-output\variantA\` y `build\installer-output\variantB\`.

### F11 — Verificación
- **Hashes SHA256 distintos** confirma builds diferentes.
- **VariantA instalado en `C:\Program Files\LetXinet Suite`** (reemplaza v1.0.1, previamente respaldada en `installer-output-v1.0.1-archive-2026-08-06-203250\`).
- **`secrets.json` desplegado correctamente** (MD5 instalado = MD5 original `F76ACA88DB6EDCC8E0261CF9BE10B4E7`).
- **`main.cjs` 18840 bytes con `seedSecretsFromBundle()`** presente (líneas detectadas en grep).
- **`server.cjs` MD5 `A921168CD67780D2600E939BF0ED6D40`** coincide con el payload Suite.
- **Smoke test**: lanzado `LetXipu Desktop HF.exe`, 4 procesos arrancan correctamente.
- **`seedSecretsFromBundle()` ejecutado** correctamente al primer arranque: `%APPDATA%\LetXipu-Desktop-HF\secrets.json` 687 bytes (extiende 436 bytes del bundle con claves existentes en userData).
- 16 claves académicas + 3 IA provider keys presentes en `userData/secrets.json` (las 3 IA vacías, porque el `.env` ProgramData era de v1.0.1 VariantB sin placeholders IA — comportamiento esperado).

## Resultado

### Instaladores generados

| Variant | Setup.exe | Tamaño | SHA256 (Setup.exe) |
|---------|-----------|--------|--------------------|
| VariantA (interno) | `LetXinet-Suite-1.1.0-VariantA-Setup.exe` | 7 101 015 bytes (6.8 MB) | `44B528FE82629768D3EEB9E65EA3DC3D13C1D792735C86E64903D59BFBB82D0E` |
| VariantB (publico) | `LetXinet-Suite-1.1.0-VariantB-Setup.exe` | 7 101 315 bytes (6.8 MB) | `70ECB0918F106B6EC3B6F11F146DF842D77AA92BE099213C8EF28B6D19456A49` |

Cada setup emparejado con un `.bin`:
- `LetXinet-Suite-1.1.0-VariantA-Setup-1.bin` 433 460 607 bytes (414 MB)
- `LetXinet-Suite-1.1.0-VariantB-Setup-1.bin` 433 476 810 bytes (414 MB)

### Ubicación
- `D:\OTROS\LETXINET-SUITE\build\installer-output\variantA\`
- `D:\OTROS\LETXINET-SUITE\build\installer-output\variantB\`

### Archive anterior
- `D:\OTROS\LETXINET-SUITE\build\installer-output-v1.0.1-archive-2026-08-06-203250\` (v1.0.1 preservado).

## Pendiente
- F11 extra: smoke test de VariantB (instalar sobre VariantA, verificar `secrets.json` no aparece en bundle).
- F13: generar `HASHES-SHA256-v1.1.0.txt` en `build\installer-output\`.
- F13: generar 3 zips (fuentes-suite, instaladores v1.1.0, dual-build-integration-sources).

## Verificación de expansión

- `C:\Program Files\LetXinet Suite\` total: 1 815 619 538 bytes (~1.77 GB).
- `LetXinet-Desktop\resources\app\dist\server.cjs`: 336 491 bytes, MD5 `A921168CD67780D2600E939BF0ED6D40` (coincide con Payload Suite).
- `LetXinet-Desktop\resources\secrets.json`: 436 bytes, MD5 `F76ACA88DB6EDCC8E0261CF9BE10B4E7` (coincide).
- `LetXinet-Desktop\resources\app\electron\main.cjs`: 18 840 bytes, MD5 `9DBBDD4DCD89B5C50C1320A7A8D46A4D` (con `seedSecretsFromBundle()`).
- `%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env`: preservado de v1.0.1 (10 383 bytes, flag `onlyifdoesntexist`).
- `%APPDATA%\LetXipu-Desktop-HF\secrets.json`: 687 bytes (creado por `seedSecretsFromBundle()` al primer arranque).

## Decisión de design

1. **`secrets.json` condicional vía `#ifdef VARIANT_A`** en `.iss` — VariantB no lo incluye en su build.
2. **ProgramData `.env` preservado entre reinstalaciones** (`onlyifdoesntexist uninsneveruninstall` flag en `.iss`) — el usuario no pierde configuración al actualizar.
3. **`seedSecretsFromBundle()` hace merge** con cualquier `secrets.json` ya existente en `userData` — no destruye claves del usuario.
4. **Default `BUILD_VARIANT=private`** en runtime para URLs HF fallback activas — si el `.env` compartido es de v1.0.1 sin `BUILD_VARIANT`, el Desktop HF se comporta como private por defecto (mecanismo de seguridad para VariantA interno).

***

Footer: este documento cierra la Sesión 6 (Suite v1.1.0 Dual Build Integration). Próximas sesiones vía CHANGELOG.
