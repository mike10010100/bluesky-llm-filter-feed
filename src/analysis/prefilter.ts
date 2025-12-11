import { FilterConfig } from '../config';

export class PreFilter {
  /**
   * Fast "Sieve" - checks if the post contains any trigger words.
   * This saves money/compute by avoiding LLM calls for obviously irrelevant posts.
   */
  static shouldScan(text: string, filter: FilterConfig): boolean {
    const lowerText = text.toLowerCase();
    
    // Check keyword triggers
    return filter.trigger_words.some(word => lowerText.includes(word.toLowerCase()));
  }

  // Future: Add Embedding check here
  // static async shouldScanEmbeddings(text: string, filter: FilterConfig): Promise<boolean> { ... }
}
