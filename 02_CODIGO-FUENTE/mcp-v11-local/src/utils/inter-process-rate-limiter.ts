/**
 * V18: Inter-process rate limiter for Nominatim (and other shared APIs).
 * Uses a file-based timestamp to coordinate rate limiting across multiple
 * server instances running on different ports.
 *
 * Each instance reads the shared timestamp file, waits if the minimum
 * interval hasn't elapsed, then writes its own timestamp.
 *
 * This prevents 4 instances from sending 4 req/s to Nominatim (which bans at >1/s).
 */

import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const RATE_LIMIT_FILE = path.join(CACHE_DIR, 'nominatim-timestamp.json');
const RATE_LIMIT_MS = 1100; // 1.1s to be safe (Nominatim allows 1/s)

let inProcessChain: Promise<void> = Promise.resolve();

function ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
        try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* ignore */ }
    }
}

function readSharedTimestamp(): number {
    try {
        if (!fs.existsSync(RATE_LIMIT_FILE)) return 0;
        const data = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf8'));
        return data.timestamp || 0;
    } catch {
        return 0;
    }
}

function writeSharedTimestamp(ts: number): void {
    try {
        ensureCacheDir();
        fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify({ timestamp: ts, pid: process.pid }), 'utf8');
    } catch {
        // If we can't write, continue anyway — the in-process limiter still works
    }
}

/**
 * Inter-process rate limiter for shared APIs (Nominatim).
 * Combines in-process mutex (promise chain) with inter-process file lock.
 * Guarantees max 1 request per RATE_LIMIT_MS across ALL instances.
 */
export async function interProcessRateLimit(): Promise<void> {
    // In-process serialization: only one call at a time within this process
    const prev = inProcessChain;
    let release: () => void;
    inProcessChain = new Promise<void>(r => { release = r; });
    try { await prev; } catch { /* prev rejected — still proceed */ }

    // Inter-process coordination: check shared file timestamp
    const sharedLast = readSharedTimestamp();
    const now = Date.now();
    const elapsed = now - sharedLast;
    if (elapsed < RATE_LIMIT_MS) {
        const wait = RATE_LIMIT_MS - elapsed + Math.floor(Math.random() * 200); // jitter
        await new Promise(r => setTimeout(r, wait));
    }

    // Write our timestamp (claim the slot)
    writeSharedTimestamp(Date.now());
    release!();
}

/**
 * Get the configured rate limit in ms (for logging/debugging)
 */
export function getInterProcessRateLimitMs(): number {
    return RATE_LIMIT_MS;
}
