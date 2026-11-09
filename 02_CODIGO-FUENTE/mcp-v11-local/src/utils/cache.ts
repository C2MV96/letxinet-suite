/**
 * Persistent cache with TTL — V7 (Fase 4.1)
 *
 * Two-layer cache:
 *   1. In-memory Map (fast reads, lost on restart)
 *   2. JSON file on disk (persistent across restarts, 24h TTL by default)
 *
 * Strategy:
 *   - On getCached(): check memory first, then disk (lazy load from disk if needed)
 *   - On setCache(): write to memory + schedule async disk write (debounced)
 *   - On startup: load disk cache into memory lazily (only when first accessed)
 *
 * No external dependencies (no Redis, no SQLite). Uses native fs module.
 * Disk format: a single JSON file at .cache/search-cache.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface CacheEntry {
    data: any;
    expires: number;
}

const cache = new Map<string, CacheEntry>();

const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 5 * 60 * 1000;         // 5 minutes (in-memory short TTL)
const PERSISTENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (disk persistent TTL)

// ─── Disk persistence ──────────────────────────────────────────

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'search-cache.json');

let diskCacheLoaded = false;
let diskWritePending = false;
let diskWriteTimer: NodeJS.Timeout | null = null;

/** Ensure the cache directory exists */
function ensureCacheDir(): void {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
    } catch {
        // Silent: disk cache is best-effort
    }
}

/** Load the disk cache into memory (called lazily on first access) */
function loadDiskCache(): void {
    if (diskCacheLoaded) return;
    diskCacheLoaded = true;

    try {
        if (!fs.existsSync(CACHE_FILE)) return;
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        if (!raw || raw.length < 10) return;

        const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
        const now = Date.now();
        let loaded = 0;

        for (const [key, entry] of Object.entries(parsed)) {
            // Skip expired entries during load (garbage collection)
            if (entry.expires && now < entry.expires) {
                // Only load entries that fit in our max size
                if (cache.size < MAX_ENTRIES) {
                    cache.set(key, entry);
                    loaded++;
                }
            }
        }

        if (loaded > 0) {
            console.log(`[Cache] Loaded ${loaded} entries from disk cache`);
        }
    } catch (e: any) {
        // Silent: corrupt cache file is non-fatal, we'll just rebuild
        console.warn(`[Cache] Failed to load disk cache: ${e.message}`);
    }
}

/** Schedule a debounced write of the memory cache to disk */
function scheduleDiskWrite(): void {
    if (diskWriteTimer) {
        clearTimeout(diskWriteTimer);
    }
    // Debounce: wait 2 seconds after last write before flushing to disk
    diskWriteTimer = setTimeout(() => {
        diskWriteTimer = null;
        flushToDisk();
    }, 2000);
}

/** Write the current memory cache to disk (synchronous, best-effort) */
function flushToDisk(): void {
    try {
        ensureCacheDir();
        const now = Date.now();

        // Build a compact object of non-expired entries
        const toPersist: Record<string, CacheEntry> = {};
        for (const [key, entry] of cache) {
            if (now < entry.expires) {
                toPersist[key] = entry;
            }
        }

        const json = JSON.stringify(toPersist);
        fs.writeFileSync(CACHE_FILE, json, 'utf8');
    } catch (e: any) {
        // Silent: disk write failures are non-fatal
        console.warn(`[Cache] Disk write failed: ${e.message}`);
    }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get a cached value by key. Returns null if expired or not found.
 * Checks memory first, then lazily loads from disk on first access.
 */
export function getCached(key: string): any | null {
    // Lazy load disk cache on first access
    if (!diskCacheLoaded) {
        loadDiskCache();
    }

    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

/**
 * Set a value in cache with optional TTL.
 * Writes to memory immediately and schedules a debounced disk write.
 *
 * @param ttlMs Time-to-live in milliseconds. Default 5min (in-memory).
 *              For persistent cache use PERSISTENT_TTL_MS (24h).
 */
export function setCache(key: string, data: any, ttlMs: number = DEFAULT_TTL_MS): void {
    // Evict expired entries if cache is getting large
    if (cache.size >= MAX_ENTRIES) {
        const now = Date.now();
        for (const [k, v] of cache) {
            if (now > v.expires) cache.delete(k);
        }
        // If still too large, remove oldest 25%
        if (cache.size >= MAX_ENTRIES) {
            const entries = Array.from(cache.keys());
            const toRemove = Math.ceil(entries.length * 0.25);
            for (let i = 0; i < toRemove; i++) {
                cache.delete(entries[i]);
            }
        }
    }

    cache.set(key, { data, expires: Date.now() + ttlMs });

    // Schedule disk write (debounced) for persistent entries
    // Only persist entries with TTL > 1 hour (skip short-lived in-memory cache)
    if (ttlMs >= 60 * 60 * 1000) {
        scheduleDiskWrite();
    }
}

/**
 * Generate a deterministic cache key from tool name and arguments.
 */
export function cacheKey(tool: string, args: any): string {
    // Sort keys for deterministic serialization. Hide internal __-prefixed keys
    // (e.g. __timeouts, __batchCaps) injected by the Phase 6 dispatcher so they
    // don't fragment the cache space (otherwise read-key and write-key differ,
    // because the dispatcher sets them AFTER the read check on the same args).
    if (args && typeof args === 'object') {
        const clean: Record<string, any> = {};
        for (const k of Object.keys(args)) {
            if (!k.startsWith('__')) clean[k] = (args as any)[k];
        }
        const normalized = JSON.stringify(clean, Object.keys(clean).sort());
        return `${tool}:${normalized}`;
    }
    const normalized = JSON.stringify(args, Object.keys(args || {}).sort());
    return `${tool}:${normalized}`;
}

/**
 * Get cache statistics.
 */
export function cacheStats(): { size: number; maxEntries: number; defaultTtlMs: number; diskLoaded: boolean; diskFile: string } {
    return {
        size: cache.size,
        maxEntries: MAX_ENTRIES,
        defaultTtlMs: DEFAULT_TTL_MS,
        diskLoaded: diskCacheLoaded,
        diskFile: CACHE_FILE,
    };
}

/**
 * Force a synchronous flush of the cache to disk.
 * Useful before server shutdown.
 */
export function flushCacheToDisk(): void {
    if (diskWriteTimer) {
        clearTimeout(diskWriteTimer);
        diskWriteTimer = null;
    }
    flushToDisk();
}

/**
 * Clear all cached entries (memory + disk).
 */
export function clearCache(): void {
    cache.clear();
    try {
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
        }
    } catch {
        // Silent
    }
}

// Export the persistent TTL constant for use by callers
export { PERSISTENT_TTL_MS };

// Register a graceful shutdown handler to flush cache
process.on('SIGINT', () => {
    flushCacheToDisk();
    process.exit(0);
});
process.on('SIGTERM', () => {
    flushCacheToDisk();
    process.exit(0);
});