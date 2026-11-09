FROM node:20-slim
WORKDIR /app

# Install Python 3 + pip
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Python deps: spaCy + pymupdf4llm for document extraction (NO model download here \u2014 models are kept in HF bucket mounted at runtime)
COPY src/python/requirements.txt /app/src/python/requirements.txt
RUN python3 -m pip install --break-system-packages -r /app/src/python/requirements.txt

# Keep NLP available after a Space restart; do not download it at request time.
RUN python3 -m pip install --break-system-packages \
    https://github.com/explosion/spacy-models/releases/download/es_core_news_md-3.8.0/es_core_news_md-3.8.0-py3-none-any.whl

# Cache dir (writable by any user) \u2014 HF bucket mounts here
RUN mkdir -p /app/spacy-cache && chmod -R 777 /app/spacy-cache

# Node dependencies
COPY package*.json ./
RUN npm ci 2>/dev/null || npm install

COPY . .
RUN npm run build

RUN chmod +x /app/src/python/start.sh

ENV PORT=7860
ENV NODE_ENV=production
ENV LETXINET_BIND_HOST=0.0.0.0
ENV SPACY_PYTHON=python3
ENV SPACY_CACHE_ROOT=/app/spacy-cache

EXPOSE 7860

# HEALTHCHECK — probe /health every 5min (3 failed probes = unhealthy).
# curl no está en node:20-slim, usamos node con fetch (sin dependencias extra).
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:7860/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["bash", "/app/src/python/start.sh"]
