# ZIP-HASHES.md - Hashes MD5 y SHA256 de los zips generados (Sesion 5, 6-Ago-2026)

## Resumen

| Zip | Tamaño | Entradas | MD5 | SHA256 |
|---|---|---|---|---|
| `FUENTES-DEV-COMPLETO.zip` | 243.73 KB | 38 | `76C36BEC07204EE4B4E86A2A8EC63D68` | `5635A0BADF58A027D23A4586D5BBE11273AD93C0CABC37736214DC211FE635BA` |
| `DUAL-BUILD-SOURCES.zip` | 101.98 KB | 9 | `65FC13EE568AA9FC3CB992A8CDC24A73` | `6AA1EE823F13E0A72DE86084EAC2024862789428F8D7930F9689AED370C45072` |
| `INSTALLERS-PUBLICO-PRIVADO.zip` | 747.37 MB | 7 | `85A325FE3C9BA2A671E2321D44668684` | `DCC4A20E633B41EE74A1141586C0FFD3E1577F10CDDFA401FE406659C5402E4C` |

Ubicacion: `D:\OTROS\LETXINET-OPTIM-BUILD\zips\`

## 1. `FUENTES-DEV-COMPLETO.zip` (243.73 KB, 38 entries)

**Contenido**: fuentes completos del repo dev `D:\OTROS\LETXINET-DESKTOP-HF\`
excluyendo `node_modules/`, `dist/`, `build/`, `.git/` y `.env.local`.

Ideal para: distribuir el codigo publicable (sin secrets). Permite a un
tercero clonar el proyecto, ejecutar `npm install`, y luego regenerar los
instaladores con `npm run desktop:dist:public` (el privado requiere `.env.local`
con API keys que el operador debe conseguir aparte).

### Estructura interna del zip:

```
FUENTES-DEV-COMPLETO.zip
  +-- electron\
  |     +-- main.cjs                                  (18840 bytes)
  +-- scripts\
  |     +-- apply-variant.cjs                          (5237 bytes)
  |     +-- copy-deps.cjs                             (2207 bytes)
  |     +-- install-deps.cjs                          (1283 bytes)
  +-- src\
  |     +-- App.tsx                                   (30478 bytes, con 4 useCallback fase 3)
  |     +-- index.css                                 (5583 bytes, con override persistente)
  |     +-- main.tsx                                  (1143 bytes)
  |     +-- types.ts                                  (1452 bytes)
  |     +-- components\
  |     |     +-- ActiveToolsList.tsx                  (16966 bytes)
  |     |     +-- AgentChat.tsx                        (178286 bytes, sin limpiar imports muertos)
  |     |     +-- ApiKeysConfig.tsx                    (19347 bytes)
  |     |     +-- ChatSidebar.tsx                      (11190 bytes)
  |     |     +-- ConsolePlayground.tsx                (38743 bytes)
  |     |     +-- ProvidersSyncPanel.tsx               (17645 bytes)
  |     |     +-- RightNavRail.tsx                     (4794 bytes)
  |     |     +-- SkillsGallery.tsx                    (17638 bytes)
  |     |     +-- SourcesCatalog.tsx                   (28325 bytes)
  |     |     +-- SystemVariablesConfig.tsx           (32957 bytes)
  |     |     +-- ThemeToggle.tsx                     (1360 bytes)
  |     |     +-- TokenFooter.tsx                     (2221 bytes)
  |     +-- lib\
  |           +-- chats-store.ts                      (5887 bytes)
  |           +-- custom-models.ts                    (3247 bytes)
  |           +-- custom-providers.ts                 (2372 bytes)
  |           +-- i18n.ts                             (98363 bytes)
  |           +-- providers-catalog.ts                (9250 bytes)
  |           +-- tokenUsage.ts                       (2057 bytes)
  |           +-- toolTranslations.ts                 (20762 bytes)
  |           +-- models\
  |                 +-- sync.ts                       (4257 bytes)
  |                 +-- types.ts                      (2277 bytes)
  +-- .env                                            (10544 bytes, limpio)
  +-- .env.example                                    (384 bytes)
  +-- .gitignore                                      (~50 bytes)
  +-- electron-builder.private.json                   (99 bytes)
  +-- index.html                                      (~300 bytes)
  +-- package.json                                    (3114 bytes)
  +-- server.ts                                       (349701 bytes)
  +-- tsconfig.json                                   (~500 bytes)
  +-- vite.config.ts                                  (~700 bytes)
```

**Notas**:
- `.env.local` NO esta incluido (contiene API keys reales del operador).
- `node_modules/` NO esta incluido (recuperable con `npm install`).
- `dist/` NO esta incluido (recuperable con `npm run build`).
- `build/icon.ico` NO esta incluido (necesario para `electron-builder` - se debe
  recuperar del repo original o crear uno nuevo de 256x256 ICO).

## 2. `DUAL-BUILD-SOURCES.zip` (101.98 KB, 9 entries)

**Contenido**: unicamente los archivos modificados o creados en la Sesion 5
del dual build. Pensado para aplicar sobre un repositorio dev preexistente
(como parche incremental).

Ideal para: enviar a un compañero operador que ya tiene el repo y solo quiere
los cambios de la Sesion 5 para activar el dual build.

### Estructura interna del zip:

```
DUAL-BUILD-SOURCES.zip
  +-- electron\
  |     +-- main.cjs                                  (18840 bytes, con seedSecretsFromBundle)
  +-- scripts\
  |     +-- apply-variant.cjs                        (5237 bytes, NUEVO)
  +-- src\
  |     +-- index.css                                (5583 bytes, override persistente)
  +-- .env                                            (10544 bytes, limpio de API keys reales)
  +-- .env.example                                    (384 bytes, INCLUIDO para referencia)
  +-- electron-builder.private.json                   (99 bytes, NUEVO)
  +-- package.json                                    (3114 bytes, con nuevos scripts)
  +-- README-DUAL-BUILD.md                            (2456 bytes, explicacion)
  +-- server.ts                                       (349701 bytes, con setIfPresent, BUILD_VARIANT, SecretsShape extendido)
```

### Como aplicar `DUAL-BUILD-SOURCES.zip` sobre un repo dev limpio

1. Descomprimir el zip sobre la raiz del repo (sobreescribir archivos existentes).
2. Crear manualmente `.env.local` con las API keys reales del operador:
   ```
   NEBIUS_API_KEY=v1.CmQKH...
   OPENROUTER_API_KEY=sk-or-v1-0...
   DEEPSEEK_API_KEY=sk-bfdafe7...
   ```
   (Este archivo NO se incluye en el zip porque contiene secrets.)
3. Asegurarse de que `cross-env` esta instalado:
   ```powershell
   npm install --save-dev cross-env
   ```
4. Verificar lint:
   ```powershell
   npm run lint  # tsc --noEmit, debe dar 0 errores
   ```
5. Generar instaladores:
   ```powershell
   # Limpieza previa
   Remove-Item dist\win-unpacked -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item dist\LetXipu*0.0.0*.exe* -Force -ErrorAction SilentlyContinue

   # Publico (sin API keys)
   npm run desktop:dist:public

   # Privado (con API keys embebidas)
   npm run desktop:dist:private

   # WORKAROUND: si el privado se genera SIN secrets.json embebido (bug
   # conocido con --prepackaged), ejecutar:
   Copy-Item build\secrets.json dist\win-unpacked\resources\secrets.json -Force
   npx electron-builder --win nsis portable --prepackaged dist\win-unpacked `
     --config.appId="com.c2mv.letxipu.desktophf.private" `
     --config.productName="LetXipu Desktop HF Pro" `
     --config.win.signAndEditExecutable=false
   ```

## 3. `INSTALLERS-PUBLICO-PRIVADO.zip` (747.37 MB, 7 entries)

**Contenido**: los 4 instaladores `.exe` + 3 blockmaps + 1 README.

Ideal para: distribuir directamente a usuarios finales. NO contiene codigo
fuente, solo instaladores listos para ejecutar en Windows x64.

### Estructura interna del zip:

```
INSTALLERS-PUBLICO-PRIVADO.zip
  +-- public\
  |     +-- LetXipu Desktop HF Setup 0.0.0.exe        (100655992 bytes ~95.99 MB, NSIS)
  |     +-- LetXipu Desktop HF 0.0.0.exe              (100338902 bytes ~95.69 MB, portable)
  |     +-- LetXipu Desktop HF Setup 0.0.0.exe.blockmap (100724 bytes ~0.10 MB)
  +-- private\
  |     +-- LetXipu Desktop HF Pro Setup 0.0.0.exe   (294688800 bytes ~281.04 MB, NSIS)
  |     +-- LetXipu Desktop HF Pro 0.0.0.exe         (294371640 bytes ~280.73 MB, portable)
  |     +-- LetXipu Desktop HF Pro Setup 0.0.0.exe.blockmap (294277 bytes ~0.28 MB)
  +-- README-INSTALLERS.md                            (3230 bytes)
```

### Hashes MD5 de los instaladores individuales

#### Publico

| Archivo | Tamaño | MD5 |
|---|---|---|
| `LetXipu Desktop HF Setup 0.0.0.exe` | 95.99 MB | `3DDA3F0CA66DCB67A8A699D36F373723` |
| `LetXipu Desktop HF 0.0.0.exe` | 95.69 MB | `BA50BFD02D4507246ACF77ADF37AC64B` |

#### Privado

| Archivo | Tamaño | MD5 |
|---|---|---|
| `LetXipu Desktop HF Pro Setup 0.0.0.exe` | 281.04 MB | `654BB099356D6B4D0B0CDC831F6EE8DC` |
| `LetXipu Desktop HF Pro 0.0.0.exe` | 280.73 MB | `8663846955FF0F38C7DA82B4265B4722` |

### appId Electron de cada instalador

- Publico: `com.c2mv.letxipu.desktophf.public`
  - Instala en `%LOCALAPPDATA%\Programs\LetXipu Desktop HF\`
  - userData en `%APPDATA%\LetXipu Desktop HF\`

- Privado: `com.c2mv.letxipu.desktophf.private`
  - Instala en `%LOCALAPPDATA%\Programs\LetXipu Desktop HF Pro\`
  - userData en `%APPDATA%\LetXipu Desktop HF Pro\`

Ambos appId coexisten en el mismo Windows sin colision.

### Verificacion anti-alucinacion (inspeccion con 7-Zip)

Confirmado via `7z.exe l` tras extraer el setup NSIS a temp y listar `app-64.7z`:

**Public Setup** (`LetXipu Desktop HF Setup 0.0.0.exe`)
- `app-64.7z` = 293923199 bytes
- `resources\secrets.json` = **AUSENTE** (correcto, no leak de API keys)

**Privado Setup** (`LetXipu Desktop HF Pro Setup 0.0.0.exe`)
- `app-64.7z` = 293923539 bytes (340 bytes mas que publico, justo por secrets.json)
- `resources\secrets.json` = **PRESENTE** 418 bytes (355 comprimidos)
  con las 3 API keys (Nebius, OpenRouter, DeepSeek)

### Notas sobre firma digital

Los instaladores NO estan firmados digitalmente con certificado code-signing
(configurado `signAndEditExecutable=false` en `package.json` build.win, y
override via CLI para builds manual). Esto se debe a que el operador no tenia
un certificado EV/standard en la Sesion 5.

**Implicacion para el usuario final**: Windows SmartScreen puede mostrar
"Windows protegio tu PC" al ejecutar el instalador. El usuario debe hacer:
1. Click en "Mas informacion"
2. Click en "Ejecutar de todas formas"

Esto se debe a la ausencia de reputacion y firma digital. Para evitarlo en
distribucion masiva, se necesita obtener un certificado code-signing de
Sectigo/DigiCert (~$200-400/año) y configurar:

```jsonc
"build": {
  "win": {
    "signAndEditExecutable": true,
    "certificateFile": "build/cert.pfx",
    "certificatePassword": "..."  // mejor via env: CSC_KEY_PASSWORD
  }
}
```

## Verificacion de integridad de los 3 zips

PowerShell:

```powershell
$zips = @(
  "D:\OTROS\LETXINET-OPTIM-BUILD\zips\FUENTES-DEV-COMPLETO.zip",
  "D:\OTROS\LETXINET-OPTIM-BUILD\zips\DUAL-BUILD-SOURCES.zip",
  "D:\OTROS\LETXINET-OPTIM-BUILD\zips\INSTALLERS-PUBLICO-PRIVADO.zip"
)
foreach ($z in $zips) {
  $hash = (Get-FileHash $z -Algorithm MD5).Hash
  Write-Output ("{0,-50} {1}" -f (Split-Path $z -Leaf), $hash)
}
```

Salida esperada (verificada 19:27 del 6-Ago-2026):

```
FUENTES-DEV-COMPLETO.zip                  76C36BEC07204EE4B4E86A2A8EC63D68
DUAL-BUILD-SOURCES.zip                    65FC13EE568AA9FC3CB992A8CDC24A73
INSTALLERS-PUBLICO-PRIVADO.zip            85A325FE3C9BA2A671E2321D44668684
```

## Tabla de equivalencias para distribucion

| Audiencia | Zip a enviar | Tamaño | Notas |
|---|---|---|---|
| Usuario final no tecnico (publico) | `INSTALLERS-PUBLICO-PRIVADO.zip` (carpeta `public/` unicamente) | 192 MB | Solo el Setup publico + portable publico |
| Operador trusted distribucion privada | `INSTALLERS-PUBLICO-PRIVADO.zip` (carpeta `private/` unicamente) | 562 MB | Solo el Setup privado + portable privado |
| Programador que quiere estudiar el codigo | `FUENTES-DEV-COMPLETO.zip` | 244 KB | Sin secrets, ejecutable con `npm install` |
| Operador con repo existente (parche Sesion 5) | `DUAL-BUILD-SOURCES.zip` | 102 KB | Aplicar sobre repo dev preexistente |
| Toda la documentacion (no incluida en zips) | `D:\OTROS\LETXINET-OPTIM-BUILD\docs\*.md` (4 archivos) | ~70 KB | BULDES-PUBLICO-PRIVADO + CAMBIOS-APLICADOS + SOURCES-DUAL-BUILD + ZIP-HASHES |
