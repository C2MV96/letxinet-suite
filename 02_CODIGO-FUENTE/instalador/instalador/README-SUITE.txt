LetXinet Suite v1.1.0 - README (Dual Build)
===========================================

NOVEDADES v1.1.0:
  - LetXinet Desktop HF con server.cjs unificado (BUILD_VARIANT en runtime).
  - Nuevo layout Electron: resources\app\ (no app.asar.unpacked\).
  - secrets.json embebido en VariantA (3 IA provider keys + seed at first
    run a %APPDATA%\LetXipu-Desktop-HF\secrets.json).
  - 3 IA providers nuevos: Nebius, OpenRouter, DeepSeek.

CONTENIDO DE LA INSTALACION
---------------------------
La instalacion por defecto copia a:

  {progfiles}\LetXinet Suite\        (RAIZ)
  |__ bin\
  |   |__ start-osm-mcp.cmd            (launcher servicio OSM-MCP)
  |   |__ start-markitdown-api.cmd     (launcher servicio MarkItDown)
  |   |__ start-mcp-v11-local.cmd      (launcher servicio MCP-V11)
  |   |__ start-letxinet-desktop.cmd   (launcher App Electron)
  |   |__ suite-env-loader.cmd         (parser .env a vars CMD)
  |   |__ nssm.exe                     (NSSM 2.24 win64, gestion servicios)
  |__ OSM-MCP\
  |   |__ osmmcp.exe                   (binario Go 24 MB)
  |__ MarkItDown\API\
  |   |__ app.py                       (FastAPI server)
  |   |__ mcp-adapter\                 (markitdown-mcp.js)
  |   |__ python-runtime\              (Python 3.12 embed + pys)
  |__ MCP-V11-Local\
  |   |__ MCP-V11-Local.exe            (Node 22 pkg 93 MB)
  |   |__ dist\                        (TS compiled)
  |   |__ python\                      (spacy_server.py + modelos sm)
  |   |__ python-runtime\             (Python embed + site-packages)
  |   |__ .env                         (V11 env - variante A o B)
  |__ LetXinet-Desktop\                 (Electron win-unpacked aplanado)
  |   |__ LetXipu Desktop HF.exe
  |   |__ resources\
  |       |__ app\                       (NUEVO LAYOUT v1.1.0)
  |       |   |__ dist\server.cjs        (server unificado, sin --define)
  |       |   |__ electron\main.cjs      (con seedSecretsFromBundle())
  |       |   |__ package.json
  |       |__ secrets.json               (SOLO VariantA, 436 bytes, 3 IA keys)
  |__ register-services.cmd            (registra 3 servicios NSSM)
  |__ uninstall-services.cmd           (detiene y elimina 3 servicios)

  %PROGRAMDATA%\LetXinet Suite\
  |__ LetXinet-Suite.env               (PLANTILLA, editable, no se sobreescribe)
  |__ Logs\
      |__ osm-mcp.stdout.log
      |__ osm-mcp.stderr.log
      |__ markitdown-api.stdout.log
      |__ markitdown-api.stderr.log
      |__ mcp-v11-local.stdout.log
      |__ mcp-v11-local.stderr.log


SERVICIOS WINDOWS
-----------------
El instalador registra 3 servicios Windows (ServiceControlManager,
services.msc):

  Nombre servicio       | Display name                    | Puerto | Tipo
  --------------------- | ------------------------------- | ------ | ----
  LetXinetSuiteOSMMCP   | LetXinet Suite - OSM-MCP        | 7082   | AUTO_START
  LetXinetSuiteMarkitDown| LetXinet Suite - MarkItDown API| 7860   | AUTO_START
  LetXinetSuiteMCPV11   | LetXinet Suite - MCP-V11-Local  | 4003   | DELAYED

MCP-V11-Local arranca "delayed" para que MarkItDown este disponible cuando
V11 hace el probe de dependencia en el bootstrap.

Reinicio automatico: NSSM reinicia los 3 si crashean (AppExit Default Restart).

PLICATION GUI (no es servicio):
  LetXinet Desktop HF -> Electron app lanzada via atajo del escritorio o
  menu inicio. Lee DESKTOP_ENDPOINT_MODE del .env del Suite y enruta las
  llamadas MCP a los servicios locales del Suite o a los remotos HF.


CONFIGURACION
-------------
Editar (UTF-8):  %PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env

El archivo NO se sobreescribe al reinstalar/actualizar (flag onlyifdoesntexist
del instalador) -> tus pierdes personalizaciones al actualizar.

Variables mas relevantes:
  --- Puertos locales ---
  OSM_MCP_PORT=7082               OSM-MCP HTTP+SSE
  OSM_METRICS_PORT=19090         OSM-MCP Prometheus
  MARKITDOWN_API_PORT=7860       MarkItDown FastAPI
  MCP_V11_PORT=4003              MCP-V11 HTTP+SSE
  SPACY_PORT=4002                sidecar V11 interno
  DESKTOP_PORT=43123             Desktop HF electron

  --- Modo Endpoints desktop ---
  DESKTOP_ENDPOINT_MODE=auto     auto | local_only | remote_only | hf_only
                                 auto:   usa local primero, fallback remoto
                                 ...    ver server.ts parche P-1

  --- Endpoints remotos ---
  HF_ENDPOINT_URL=https://...
  LETXIPU_AI_AGENT_URL=https://...

  --- OSM ---
  NOMINATIM_URL=https://nominatim.openstreetmap.org
  OVERPASS_URL=https://overpass-api.de/api/interpreter
  OSM_USER_AGENT=LetXinet-Suite/1.0

  --- V11 PDF resolver ---
  SCIHUB_MIRRORS=...
  UNPAYWALL_BASE_URL=https://api.unpaywall.org
  UNPAYWALL_EMAIL=user@example.com
  DOI_RESOLVER_URL=https://doi.org

  --- IA tokens (variante A; variante B sin estos) ---
  HF_TOKEN=hf_xxx
  ANTHROPIC_TOKEN=...
  OPENAI_TOKEN=...

  --- Dual Build v1.1.0 ---
  BUILD_VARIANT=private     private (default) | public
                            private: URLs HF fallback activas, modo auto
                            public: sin URLs HF, solo local
  NEBIUS_API_KEY=           (solo plantilla; valor real en secrets.json)
  OPENROUTER_API_KEY=
  DEEPSEEK_API_KEY=

Despues de editar: reinicia los 3 servicios (services.msc -> restart) o
reinicia el equipo.


VARIANTS (Dual Build v1.1.0)
---------------------------
  VariantA (interno):  .env con tokens IA reales + secrets.json embebido en
                       LetXinet-Desktop\resources\ (3 IA provider keys:
                       Nebius, OpenRouter, DeepSeek).
                       PUBLICAR SOLO INTERNO. Al primer arranque el
                       seedSecretsFromBundle() los copya a userData.
  VariantB (publica):  .env sin tokens + SIN secrets.json en el bundle.
                       Distribucion publica. El usuario debe rellenar
                       secrets.json manualmente o editar ProgramData .env.
  Default: BUILD_VARIANT=private si no esta seteado en .env.


REQUISITOS
----------
  - Windows 10/11 x64 (por Electron 37 + Python 3.12 embed amd64)
  - 3 GB libres en disco (2 payload + 0.5 cache)
  - Privilegios de administrador (servicios NSSM)
  - Connectivity HTTPS a los endpoints remotos definidos en .env
    (los servicios son solo locales; pero sus upstreams salen a internet)


DESINSTALACION
--------------
Panel de control -> Desinstalar LetXinet Suite
o:  {app}\unins000.exe

El uninstaller detiene y elimina los 3 servicios PRIMERO, despues borra
los binarios. Los logs en %PROGRAMDATA% se conservan.


SOPORTE
-------
Issues y codigo fuente: https://github.com/C2MV/letxinet-suite
