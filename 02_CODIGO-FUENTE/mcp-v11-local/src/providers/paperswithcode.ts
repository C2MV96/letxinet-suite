import { fetchWithTimeout, sanitizeQueryForSearch } from './base';
import { PaperResult, SearchOptions } from '../types/search';
import { searchHuggingFacePapers } from './huggingface';

export async function searchPapersWithCode(
    query: string,
    options?: SearchOptions
): Promise<{ results: PaperResult[]; degraded?: boolean }> {
    console.warn('[PapersWithCode] API is dead (closed by Meta). Redirecting to Hugging Face Trending Papers.');
    return searchHuggingFacePapers(query, options);
}
