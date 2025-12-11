import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { FilterConfig } from '../config';

/**
 * Calculates Cosine Similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dotProduct += valA * valB;
    magnitudeA += valA * valA;
    magnitudeB += valB * valB;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

export class EmbeddingManager {
  private static instance: EmbeddingManager;
  private pipe: FeatureExtractionPipeline | null = null;
  private filterEmbeddings: Map<string, number[][]> = new Map(); // filterId -> array of trigger vectors

  private constructor() {}

  static getInstance(): EmbeddingManager {
    if (!EmbeddingManager.instance) {
      EmbeddingManager.instance = new EmbeddingManager();
    }
    return EmbeddingManager.instance;
  }

  async init(filters: FilterConfig[]) {
    console.log("Loading Embedding Model (all-MiniLM-L6-v2)... this may take a moment.");
    // This downloads the model (~90MB) on first run and caches it
    this.pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    console.log("Pre-calculating filter trigger embeddings...");
    for (const filter of filters) {
      if (filter.embeddings?.enabled && filter.embeddings.triggers.length > 0) {
        const vectors: number[][] = [];
        for (const triggerText of filter.embeddings.triggers) {
          const vec = await this.generateEmbedding(triggerText);
          if (vec) vectors.push(vec);
        }
        this.filterEmbeddings.set(filter.id, vectors);
      }
    }
    console.log("Embeddings ready.");
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.pipe) return null;
    try {
      const output = await this.pipe(text, { pooling: 'mean', normalize: true });
      // output is a Tensor. .data is the typed array. Array.from converts it.
      return Array.from(output.data);
    } catch (err) {
      console.error("Embedding generation failed:", err);
      return null;
    }
  }

  /**
   * Checks if the post text is semantically similar to any of the filter's triggers.
   */
  async checkSimilarity(text: string, filter: FilterConfig): Promise<{ isMatch: boolean; score: number }> {
    if (!filter.embeddings?.enabled || !this.filterEmbeddings.has(filter.id)) {
      return { isMatch: false, score: 0 };
    }

    const postVector = await this.generateEmbedding(text);
    if (!postVector) return { isMatch: false, score: 0 };

    const triggerVectors = this.filterEmbeddings.get(filter.id) || [];
    let maxScore = 0;

    for (const triggerVec of triggerVectors) {
      const score = cosineSimilarity(postVector, triggerVec);
      if (score > maxScore) maxScore = score;
    }

    return {
      isMatch: maxScore >= (filter.embeddings.threshold || 0.5),
      score: maxScore
    };
  }
}
