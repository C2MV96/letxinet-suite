#!/usr/bin/env python3
"""
build-icon.py - Genera el icono Windows LetXinet Suite (.ico multi-resolucion)
              desde D:\\OTROS\\LETXIPU.svg usando resvg + Pillow.

USO:
    python build-icon.py

SALIDA:
    D:\\OTROS\\LETXINET-SUITE\\build\\icons\\icon.ico         (multi-res 16-256 px)
    D:\\OTROS\\LETXINET-SUITE\\build\\icons\\icon-256.png     (PNG standalone 256 px)
    D:\\OTROS\\LETXINET-SUITE\\build\\icons\\icon-512.png     (PNG standalone 512 px)

DEPENDENCIAS:
    - resvg.exe (ya descargado en D:\\OTROS\\LETXINET-SUITE\\build\\resvg\\resvg.exe)
    - Pillow   (pip install pillow)

ESTRATEGIA:
    1. resvg renderiza SVG a PNG 512x512 con background #0b0f1a (fondo oscuro)
       porque el logo LETXIPU es blanco y se vuelve invisible sobre fondo transparente
       o claro en la bandeja de Windows.
    2. Pillow redimensiona ese PNG 512 a las 6 resoluciones estandar ICO
       (16, 32, 48, 64, 128, 256) usando LANCZOS (alta calidad).
    3. Pillow Image.save(..., format='ICO', sizes=[...]) empaqueta todas
       las resoluciones en un unico .ico.
"""
import os
import subprocess
import sys
from pathlib import Path
from PIL import Image

# --- Configuracion de rutas ---------------------------------------------
SVG_SRC = Path(r"D:\OTROS\LETXIPU.svg")
BUILD_DIR = Path(r"D:\OTROS\LETXINET-SUITE\build")
RESVG = BUILD_DIR / "resvg" / "resvg.exe"
ICONS_DIR = BUILD_DIR / "icons"

# Fondo oscuro para visibilidad del logo blanco
BG_COLOR = "#0b0f1a"

# Resoluciones ICO estandar Windows (de menor a mayor)
ICO_SIZES = [16, 32, 48, 64, 128, 256]

# PNG base de alta calidad desde el que se redimensiona
PNG_MASTER = ICONS_DIR / "icon-512.png"
PNG_256 = ICONS_DIR / "icon-256.png"
ICO_OUT = ICONS_DIR / "icon.ico"


def run_resvg(width: int, out_path: Path) -> None:
    """Renderiza SVG a PNG con resvg: ancho fijo, background oscuro.
    El SVG LETXIPU tiene ratio 560:544 (casi cuadrado pero no exactamente),
    por lo que el PNG resultante sale con altura no cuadrada. Esto se
    cuadra en main() pegando el PNG dentro de un canvas 512x512 cuadrado.
    """
    if not RESVG.exists():
        sys.exit(f"ERROR: resvg.exe no encontrado en {RESVG}")
    if not SVG_SRC.exists():
        sys.exit(f"ERROR: SVG fuente no encontrado en {SVG_SRC}")
    cmd = [
        str(RESVG),
        "-w", str(width),
        "--background", BG_COLOR,
        str(SVG_SRC),
        str(out_path),
    ]
    print(f"  resvg -w {width} --background {BG_COLOR} -> {out_path.name}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"resvg fallo (rc={result.returncode}):\n{result.stderr}")
    if not out_path.exists():
        sys.exit(f"resvg no produjo {out_path}")


def square_pad(png_path: Path, canvas_size: int) -> Image.Image:
    """Pega el PNG renderizado en un canvas cuadrado canvas_size x canvas_size
    con fondo BG_COLOR, centrado. Garantiza que el ICO/Windows lo muestre
    correctamente sin deformaciones."""
    img = Image.open(png_path).convert("RGBA")
    bg_rgb = tuple(int(BG_COLOR[i:i+2], 16) for i in (1, 3, 5))
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg_rgb + (255,))
    # Calcular offset para centrar (logo siempre cabe porque aspect ~1.03).
    off_x = (canvas_size - img.size[0]) // 2
    off_y = (canvas_size - img.size[1]) // 2
    # alpha_composite respeta transparencia del PNG; al ser opaco, queda bien.
    canvas.alpha_composite(img, (off_x, off_y))
    return canvas


def main() -> None:
    print("=== build-icon.py: generando icono LetXinet Suite ===")
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    # 1) Render del SVG a PNG 512 de ancho con resvg (aspect natural).
    raw_512 = ICONS_DIR / "raw-512.png"
    if not raw_512.exists():
        print(f"[1/4] Render SVG -> PNG raw-512 con resvg")
        run_resvg(512, raw_512)
    else:
        print(f"[1/4] raw-512 ya existe: {raw_512}")

    # 2) Cuadrar el PNG dentro de canvas 512x512 con fondo oscuro y guardar master.
    print(f"[2/4] Cuadrar y guardar master 512x512 + PNG 256 standalone")
    master_img = square_pad(raw_512, canvas_size=512)
    master_img.save(PNG_MASTER, format="PNG")
    # PNG 256 desde master (LANCZOS)
    img_256 = master_img.resize((256, 256), Image.LANCZOS)
    img_256.save(PNG_256, format="PNG")

    # 3) Empaquetar .ico multi-resolucion con Pillow API: sizes= sin append_images.
    print(f"[3/4] Empaquetando .ico multi-resolucion {ICO_SIZES}")
    if master_img.size[0] < 256:
        sys.exit(f"ERROR: master PNG demasiado pequeno: {master_img.size}")
    print(f"  master size cuadrado: {master_img.size}")

    if ICO_OUT.exists():
        ICO_OUT.unlink()
    master_img.save(
        ICO_OUT,
        format="ICO",
        sizes=[(s, s) for s in ICO_SIZES],
    )
    ico_kb = ICO_OUT.stat().st_size / 1024
    print(f"  OK: {ICO_OUT.name} ({ico_kb:.1f} KB)")

    # 4) Verificacion binaria del ICO: leer el header para confirmar
    #    que cada resolucion fue embebida correctamente y es cuadrada.
    print(f"\n[4/4] Verificacion binaria del ICO")
    import struct
    ico_bytes = ICO_OUT.read_bytes()
    reserved, img_type, count = struct.unpack_from("<HHH", ico_bytes, 0)
    print(f"  Type={img_type} ImageCount={count} (esperado {len(ICO_SIZES)})")
    off = 6
    sizes_found = []
    square_ok = True
    for i in range(count):
        w, h, pal, rsv, planes, bpp, size, off_b = struct.unpack_from(
            "<BBBBHHII", ico_bytes, off
        )
        width = 256 if w == 0 else w
        height = 256 if h == 0 else h
        if width != height:
            square_ok = False
        sizes_found.append(width)
        off += 16
    sizes_found.sort()
    print(f"  sizes embebidos: {sizes_found}")
    print(f"  cuadrados: {square_ok}")
    if sizes_found == sorted(ICO_SIZES) and square_ok:
        print(f"  OK: las {len(ICO_SIZES)} resoluciones cuadradas estan presentes")
    else:
        print(f"  ERRO: faltan tamanos o no son cuadrados")

    print(f"\n--- Salidas ---")
    for p in [PNG_MASTER, PNG_256, ICO_OUT]:
        print(f"  {p.name}: {p.stat().st_size/1024:.1f} KB")


if __name__ == "__main__":
    main()
