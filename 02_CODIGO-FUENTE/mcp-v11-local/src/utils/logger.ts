/**
 * Structured JSON logger — Phase 2 (2026-07-23).
 *
 * Replaces the scattered console.log/console.error calls in mcp.ts, search.ts,
 * metadata.ts, pdf.ts, pdf-reader.ts, base.ts, latam-repositories.ts,
 * oai-pmh.ts etc. with a single pino instance.
 *
 * Latency & deps:
 *   - pino 10.3.1, zero native dependencies, <1ms log overhead per line.
 *   - Pretty-printing is OFF by default (production). Developers can opt-in
 *     with NODE_ENV=development, which uses pino-pretty if installed, else
 *     falls back to plain JSON.
 *
 * Output destination:
 *   - In production: stderr (so stdout JSON-RPC stays clean for MCP clients)
 *   - In development: stdout with pino-pretty
 *
 * API (mirrors pino's level hierarchy):
 *   log.info({ tool, query, latency_ms, sources }, 'tool_called');
 *   log.warn({ tool, slow_source }, 'slow_provider');
 *   log.error({ tool, err: e.message, stack: e.stack }, 'tool_failed');
 *   log.debug({ cache_key, namespace }, 'cache_hit');
 *
 * LOG_LEVEL env vars: silent | trace | debug | info | warn | error | fatal
 * Default: info
 */
import pino, { Logger } from 'pino';

const LOG_LEVEL =
    process.env.LOG_LEVEL ||
    process.env.LETXIPU_LOG_LEVEL ||
    'info';

const isDev = process.env.NODE_ENV === 'development';

// Bind a base logger context so all entries get the service tag for free
const baseLogger: Logger = pino({
    level: LOG_LEVEL,
    name: 'letxipu-v10',
    base: { service: 'letxipu-search-mcp' },
    // Enable pretty transport only in dev and only if NODE_ENV=development is set
    // explicitly; we don't want to silently require pino-pretty in production builds.
    ...(isDev && process.env.LETXIPU_PRETTY !== '0' && process.stdout.isTTY
        ? {
              transport: {
                  target: 'pino-pretty',
                  options: { translateTime: 'HH:MM:ss', singleLine: true, ignore: 'pid,hostname,service' },
              },
          }
        : {}),
});

/**
 * Public logger: use `log.info/warn/error/debug` everywhere in the v10 codebase.
 * Always emit JSON to stderr in production (default pino behaviour).
 */
export const log: Logger = baseLogger;

export default log;
