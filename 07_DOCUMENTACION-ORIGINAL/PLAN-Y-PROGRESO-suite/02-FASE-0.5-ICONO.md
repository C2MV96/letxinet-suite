# Fase 0.5 — Icono `.ico` desde `LETXIPU.svg`

**Fecha:** 2026-07-31
**Estado:** ✅ COMPLETADA

## Objetivo

Generar un único icono Windows `.ico` multi-resolución (16, 32, 48, 64, 128, 256 px)品味uido, con fondo oscuro `#0b0f1a`, desde el logo `D:\OTROS\LETXIPU.svg` (logo blanco sobre transparente, 560×544pt).

El icono debe servir tanto al instalador Inno Setup (`SetupIconFile=`) como al ejecutable Electron LetXinet Desktop (`build/icon.ico`).

## Investigación de herramientas

### Intentos descartados

| Herramienta | Por qué se descartó |
|-------------|--------------------|
| `cairosvg` (Python) | Requiere `libcairo-2.dll` nativa → no incluida en Windows por defecto |
| `pycairo` + `rlPyCairo` (reportlab) | Lo mismo: dependencia `libcairo-2.dll` ausente |
| `svglib` + `reportlab` | El SVG parsea OK pero reportlab pide `rlPyCairo` que a su vez pide cairo DLL |
| `ImageMagick` (`magick.exe`) | No instalado en el sistema |
| `Inkscape` portable | Funcionaría pero trae 200 MB de payloads extra; overkill |

### Solución adoptada

**`resvg`** (linebender/resvg) v0.47.0, binario Rust estático precompilado de 1.4 MB para win64.

- Repo: https://github.com/linebender/resvg
- Asset descargado: `resvg-win64.zip` (1.4 MB → 1.7 MB descomprimido)
- Ubicación: `D:\OTROS\LETXINET-SUITE\build\resvg\resvg.exe`
- Sin dependencias de DLL externas
- Soporta `--background` (clave para el fondo oscuro) y `-w/-h/-z` (resize)

Complementado con **Pillow 12.3.0** (Python 3.12 oficial) para encuadrar el PNG en canvas 512×512 cuadrado y empaquetar el `.ico` multi-resolución.

## Script generado

`D:\OTROS\LETXINET-SUITE\src-suite\instalador\build-icon.py` (código fuente del programa nuevo, reproducible).

### Pipeline

```
LETXIPU.svg (560×544pt)
    ↓ resvg -w 512 --background #0b0f1a
raw-512.png  (512×497 px, logo blanco sobre #0b0f1a, aspect natural ~1.03)
    ↓ Pillow: square_pad() pega en canvas 512×512 cuadrado, centrado, fondo #0b0f1a
icon-512.png (512×512 px, cuadrado) — master
    ↓ Pillow: resize 256×256 con LANCZOS
icon-256.png (256×256 px) — asset standalone para Electron
    ↓ Pillow: master_img.save(..., format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
icon.ico (multi-resolución, 107.6 KB) — para Inno Setup + electron-builder
```

## Detalles técnicos

### ¿Por qué fondo oscuro `#0b0f1a`?

- El logo `LETXIPU.svg` está formado por miles de `<path>` con `fill="#ffffff"` (blanco puro) sobre fondo transparente.
- Bandeja y taskbar de WindowsDrawn con fondos mayoritariamente claros: un icono blanco sobre transparente sería invisible.
- `#0b0f1a` es el color de fondo de marca LetXinet (azul-negro), garantizando contraste y reconocibilidad en cualquier contexto.

### ¿Por qué canvas cuadrado 512×512?

- El SVG original es 560×544pt → ratio 1.029.4 — casi cuadrado.
- resvg respeta aspect al renderizar con `-w` (no fuerza altura), resultando en PNG 512×497.
- ICO Windows exige entradas cuadradas. Sin corregir → Pillow mete 256×249 en lugar de 256×256 y Windows lo lista mal.
- Solución: `square_pad()` centra el PNG renderizado en canvas 512×512 con el mismo `#0b0f1a` → no afecta visibilidad del logo (diferencia de 8 px lateral o 15 px vertical imperceptible).

### API Pillow para `.ico` multi-resolución

```python
master_img.save(
    ICO_OUT,
    format="ICO",
    sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)],
)
```

`append_images` NO debe usarse junto con `sizes=` — Pillow 12 ignora las `append_images` en ese caso y solo redimensiona la imagen base internamente (effḱctivamente el comportamiento deseado, pero confuso).

## Validación binaria del ICO

Script de verificación lee el header del `.ico` con `struct.unpack`:

```
Type=1 ImageCount=6 (esperado 6)
sizes embebidos: [16, 32, 48, 64, 128, 256]
cuadrados: True
OK: las 6 resoluciones cuadradas están presentes
```

Cada directory entry (16 bytes después del header de 6 bytes) reporta `width == height`, confirmando estructura válida para Windows.

## Salidas finales

| Archivo | Tamaño | Uso |
|---------|--------|-----|
| `D:\OTROS\LETXINET-SUITE\build\icons\icon.ico` | 107.6 KB | Instalador Inno (`SetupIconFile`) + build Electron (`build/icon.ico`) |
| `D:\OTROS\LETXINET-SUITE\build\icons\icon-512.png` | 67.9 KB | Master de alta resolución (assets Linux/macOS, documentación) |
| `D:\OTROS\LETXINET-SUITE\build\icons\icon-256.png` | 71.7 KB | Asset standalone para Electron build |
| `D:\OTROS\LETXINET-SUITE\build\raw-512.png` | 48.7 KB | Intermedio; se conserva para reproducibilidad |

## Dependencias instaladas en esta fase

| Paquete | Versión | Propósito | Estado |
|---------|---------|----------|--------|
| `pillow` | 12.3.0 | Resize + ICO packaging + PNG I/O | ✅ |
| `svglib` | 2.0.2 | Intento previo (descartado por dependencia cairo) | inactivo |
| `reportlab` | 5.0.0 | Intento previo (descartado) | inactivo |
| `rlPyCairo` | 0.4.0 | Intento previo (descartado) | inactivo |
| `cairocffi` | 1.7.1 | Intento previo (DLL cairo ausente) | inactivo |
| `cairosvg` | 2.9.0 | Intento previo (DLL cairo ausente) | inactivo |

`pip install --no-cache-dir` en todos los casos para no presionar C: (libre 1.5 GB).

## Script reproducible por usuarios

`build-icon.py` está escrito para ser ejecutado standalone:

```powershell
python D:\OTROS\LETXINET-SUITE\src-suite\instalador\build-icon.py
```

Requisitos:
- `resvg.exe` en `D:\OTROS\LETXINET-SUITE\build\resvg\resvg.exe`
- Pillow en Python 3.12 (`pip install pillow`)
- `D:\OTROS\LETXIPU.svg` presente

Salida a `D:\OTROS\LETXINET-SUITE\build\icons\`.

## Decisión de diseño

El icono aplica **fondo opaco** `#0b0f1a` antes que transparencia. Alternativa descartada: dejar transparencia y dejar que el shell de Windows pinte el fondo. Razones para rechazar la alternativa:
- Fondo de taskbar varía (claro/oscuro) entre cuentas de usuario → el icono se ve distinto en cada PC
- En accesos directos en escritorio con fondo blanco, el logo blanco se hace invisible
- La consistencia visual de marca exige este fondo

## Próximos pasos

El icono se usará en:
- **Fase 1** (Parche P-1): copiar `icon.ico` a `D:\OTROS\LETXINET-DESKTOP-HF\build\icon.ico` para que `electron-builder --win dir` lo empaque en el ejecutableDesktop HF
- **Fase 4**: referenciarlo en `LetXinet-Suite.iss` con `SetupIconFile=icons\icon.ico` y `WizardImageFile=...`

## Archivos creados / modificados en esta fase

- `D:\OTROS\LETXINET-SUITE\src-suite\instalador\build-icon.py` (script de generación, 175 líneas)
- `D:\OTROS\LETXINET-SUITE\build\resvg\resvg.exe` (binario externalizado)
- `D:\OTROS\LETXINET-SUITE\build\resvg-win64.zip` (descarga, conservada para auditoría de origen)
- `D:\OTROS\LETXINET-SUITE\build\icons\icon.ico` (107.6 KB, multi-res 16-256 px, fondo `#0b0f1a`)
- `D:\OTROS\LETXINET-SUITE\build\icons\icon-512.png` (master 67.9 KB)
- `D:\OTROS\LETXINET-SUITE\build\icons\icon-256.png` (71.7 KB)
- `D:\OTROS\LETXINET-SUITE\build\raw-512.png` (intermedio)
- `D:\OTROS\LETXINET-SUITE\PLAN-Y-PROGRESO\02-FASE-0.5-ICONO.md` (este log)

## Estado de disco (fin Fase 0.5)

| Unidad | Libre |
|--------|-------|
| D: | ~4.28 GB (-30 MB por resvg + iconos) |
| C: | ~1.5 GB |

Margen suficiente para Fase 1 (Parches): no añaden volumetría, solo diffs de código fuente y recompilación local.

---
**Siguiente:** Fase 1 — Aplicación de 4 parches quirúrgicos (P-1 a P-4) y recompilación de los 3 componentes binarios.
