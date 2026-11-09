FROM golang:1.24-alpine AS builder

RUN apk add --no-cache ca-certificates git
WORKDIR /src
COPY . .
RUN mkdir -p /out && go build -ldflags="-s -w" -o /out/osmmcp ./cmd/osmmcp

FROM alpine:3.20

RUN apk add --no-cache ca-certificates
COPY --from=builder /out/osmmcp /usr/local/bin/osmmcp

ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "osmmcp --enable-http --http-only --http-addr :${PORT:-7860} --nominatim-rps 1 --nominatim-burst 1 --overpass-rps 0.5 --overpass-burst 1 --osrm-rps 1 --osrm-burst 1 --user-agent \"LetXipu-OSM-MCP/1.0 (https://huggingface.co/spaces/C2MV/letxipu-osm-mcp)\""]
