# start_v11.bat
# Arranca letxipu-search-mcp V11 + su sidecar spaCy.
#
# Arranque V11.1 con fixes ALICIA (A1-A7) y nuevos puertos:
#   - V11 node: 4003  (anterior 4002)
#   - spaCy sidecar: 4203 (anterior 4202)
#
# IMPORTANTE: usar `set "VAR=VAL"` con comillas. La sintaxis `set VAR=VAL`
# deja un trailing-space en el env (conocido bug de cmd.exe), lo que rompe
# la interpolación `${process.env.PORT}` dentro de V11 (sale
# `http://localhost:4003 /health` con espacio). Bug original: A7.
#
# Idempotente: si el puerto ya está ocupado, no spawn.

@echo off
set "SPACY_PORT=4203"
set "PORT=4003"
set "PYTHONIOENCODING=utf-8"

cd /d "D:\OTROS\LETXIPU-SEARCH-MCP-V11"
node dist/server.js
