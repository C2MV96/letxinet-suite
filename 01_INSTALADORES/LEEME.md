# Instaladores

Los instaladores no se guardan en el repositorio porque pesan más de 500 MB. Se publican en la sección *Releases*:

- `LetXinet-Suite-1.1.6-VariantB-Setup.exe` y `LetXinet-Suite-1.1.6-VariantB-Setup-1.bin`. Deben ir juntos en la misma carpeta.
- `LetXinet-Addon-Bridges-v1.0.0.exe`, si usas Word o LaTeX desde Claude Desktop.

Comprueba los archivos con `HASHES-SHA256-v1.1.6-VariantB.txt`. En PowerShell:

```powershell
Get-FileHash .\LetXinet-Suite-1.1.6-VariantB-Setup.exe -Algorithm SHA256
```

Para generar el instalador desde el código, usa `02_CODIGO-FUENTE/recompilar-todo.cmd`.
