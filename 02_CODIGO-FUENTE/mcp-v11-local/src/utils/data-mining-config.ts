/**
 * Data Mining Utilities (subset)
 * Only the functions needed by search providers
 */

export function generateRecordId(url: string, title: string): string {
    const input = `${url}|${title}`.toLowerCase();
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `rec_${Math.abs(hash).toString(36)}`;
}

export function getCurrentTimestamp(): string {
    return new Date().toISOString();
}
