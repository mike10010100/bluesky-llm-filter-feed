import { FilterConfig } from '../config';

export class PreFilter {
  /**
   * Fast "Sieve" - checks if the post contains any trigger words.
   * This saves money/compute by avoiding LLM calls for obviously irrelevant posts.
   */
  static shouldScan(text: string, filter: FilterConfig): boolean {
    // Check keyword triggers using Regex Word Boundaries
    // \b ensures we match "soccer" but not "soccers" (unless desired) or "messi" inside "messing"
    return filter.trigger_words.some(word => {
      // Escape special regex characters in the keyword
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
      return regex.test(text);
    });
  }

  // Future: Add Embedding check here
  // static async shouldScanEmbeddings(text: string, filter: FilterConfig): Promise<boolean> { ... }
}
