import { Jetstream } from "@skyware/jetstream";
import { LabelerServer } from "@skyware/labeler";
import { Config } from "../config";
import { createLLMProvider, LLMProvider } from "../analysis/llm";
import { PreFilter } from "../analysis/prefilter";
import { EmbeddingManager } from "../analysis/embedding";
import { BoundedQueue } from "../utils/queue";

export class FirehoseProcessor {
  private config: Config;
  private jetstream: Jetstream;
  private llm: LLMProvider;
  private embeddingManager: EmbeddingManager;
  private labelerServer?: LabelerServer;
  private queue: BoundedQueue;

  constructor(config: Config, labelerServer?: LabelerServer) {
    this.config = config;
    this.llm = createLLMProvider(config);
    this.embeddingManager = EmbeddingManager.getInstance();
    
    // Initialize Queue from Config
    const queueLimit = config.performance?.queue_limit || 50;
    const concurrency = config.performance?.concurrency || 3;
    console.log(`Initializing Queue: Limit=${queueLimit}, Concurrency=${concurrency}`);
    this.queue = new BoundedQueue(queueLimit, concurrency); 
    
    this.jetstream = new Jetstream({
      wantedCollections: ["app.bsky.feed.post"],
    });
    if (labelerServer) {
        this.labelerServer = labelerServer;
    }
  }

  async start() {
    console.log("Initializing Embedding Manager...");
    await this.embeddingManager.init(this.config.filters);

    console.log("Starting Jetstream ingestion...");
    
    this.jetstream.onCreate("app.bsky.feed.post", async (event) => {
      const post = event.commit.record as any;
      const text = post.text;
      const cid = event.commit.cid;
      const uri = `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`;

      // Iterate through all configured filters
      for (const filter of this.config.filters) {
        let keywordMatch = false;
        let embeddingMatch = false;
        let embeddingScore = 0;
        let triggerReason = "";

        // 1. Evaluate Keywords
        if (filter.match_mode !== 'embedding') { // Skip if mode is strictly embedding
            keywordMatch = PreFilter.shouldScan(text, filter);
        }

        // 2. Evaluate Embeddings
        const shouldRunEmbedding = 
            (filter.match_mode === 'embedding' || filter.match_mode === 'all') ||
            (filter.match_mode === 'any' && filter.embeddings?.enabled && (!keywordMatch || filter.embeddings.force_check));

        if (shouldRunEmbedding && filter.embeddings?.enabled) {
            const result = await this.embeddingManager.checkSimilarity(text, filter);
            embeddingMatch = result.isMatch;
            embeddingScore = result.score;
            
            if (filter.embeddings.force_check && keywordMatch && !embeddingMatch) {
                 console.log(`[DEBUG] ${filter.id}: Keyword matched, but semantic score low (${embeddingScore.toFixed(2)})`);
            }
        }

        // 3. Decide based on Match Mode
        let passedSieve = false;

        switch (filter.match_mode) {
            case 'keyword':
                passedSieve = keywordMatch;
                if (passedSieve) triggerReason = "Keyword Match";
                break;
            case 'embedding':
                passedSieve = embeddingMatch;
                if (passedSieve) triggerReason = `Semantic Match (${embeddingScore.toFixed(2)})`;
                break;
            case 'all': // AND
                passedSieve = keywordMatch && embeddingMatch;
                if (passedSieve) triggerReason = `Keyword + Semantic Match (${embeddingScore.toFixed(2)})`;
                break;
            case 'any': // OR (Default)
            default:
                passedSieve = keywordMatch || embeddingMatch;
                if (keywordMatch && embeddingMatch) triggerReason = `Keyword + Semantic Match (${embeddingScore.toFixed(2)})`;
                else if (keywordMatch) triggerReason = "Keyword Match";
                else if (embeddingMatch) triggerReason = `Semantic Match (${embeddingScore.toFixed(2)})`;
                break;
        }

        if (!passedSieve) {
          continue;
        }

        console.log(`[PRE-FILTER MATCH] Filter: ${filter.id} | Reason: ${triggerReason} | Post: "${text.substring(0, 50)}"...`);

        // 4. Stage 2: LLM Verification (Queued)
        const task = async () => {
            // Check for images if needed (inside the task)
            const imageUrls: string[] = [];
            if (filter.llm.look_at_images && post.embed && post.embed.$type === 'app.bsky.embed.images') {
                // @ts-ignore
                post.embed.images.forEach((img: any) => {
                    if (img.image && img.image.ref && img.image.ref.$link) {
                        const link = img.image.ref.$link;
                        const url = `https://cdn.bsky.app/img/feed_fullsize/plain/${event.did}/${link}@jpeg`;
                        imageUrls.push(url);
                    }
                });
            }

            const result = await this.llm.analyzePost(text, filter.llm.prompt, imageUrls);

            if (result.isMatch) {
                if (result.confidence !== undefined && result.confidence < filter.llm.confidence_threshold) {
                    console.log(`[LLM LOW CONFIDENCE] Filter: ${filter.id} | Score: ${result.confidence.toFixed(2)} < ${filter.llm.confidence_threshold} | Reason: ${result.reasoning}`);
                } else {
                    console.log(`
🚨 [LABEL MATCH] 🚨`);
                    console.log(`   Filter: ${filter.id}`);
                    console.log(`   Reason: ${result.reasoning}`);
                    console.log(`   URI: ${uri}`);
                    console.log(`   Text: ${text}\n`);
                    
                    this.emitLabel(uri, cid, filter.label_value);
                }
            } else {
                console.log(`[LLM REJECTED] Filter: ${filter.id} | Reason: ${result.reasoning} | Post: "${text.substring(0, 50)}"...`);
            }
        };

        const added = this.queue.add(task);
        if (!added) {
            console.warn(`[LOAD SHEDDING] Dropping post due to full queue (${this.queue.size} pending). Filter: ${filter.id}`);
        }
      }
    });

    this.jetstream.start();
  }

  private emitLabel(uri: string, cid: string, value: string) {
      if (this.labelerServer) {
        // Emit real AT Protocol label
        console.log(`[ACTION] Broadcasting Label: "${value}" for ${uri}`);
        this.labelerServer.createLabel({ uri, val: value, cid });
      } else {
        // Dry run mode
        console.log(`[DRY-RUN] Would have emitted label "${value}" for ${uri}`);
      }
  }
}