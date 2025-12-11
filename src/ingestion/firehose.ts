import { Jetstream } from "@skyware/jetstream";
import { LabelerServer } from "@skyware/labeler";
import { Config } from "../config";
import { createLLMProvider, LLMProvider } from "../analysis/llm";
import { PreFilter } from "../analysis/prefilter";
import { EmbeddingManager } from "../analysis/embedding";

export class FirehoseProcessor {
  private config: Config;
  private jetstream: Jetstream;
  private llm: LLMProvider;
  private embeddingManager: EmbeddingManager;
  private labelerServer?: LabelerServer;

  constructor(config: Config, labelerServer?: LabelerServer) {
    this.config = config;
    this.llm = createLLMProvider(config);
    this.embeddingManager = EmbeddingManager.getInstance();
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
        // Run if:
        // - Mode is 'embedding' OR 'all' (Always run)
        // - Mode is 'any' AND (keyword didn't match OR force_check is on)
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

        // 2. Stage 2: LLM Verification (Slow/Costly)
        // Check for images if needed
        const imageUrls: string[] = [];
        if (post.embed && post.embed.$type === 'app.bsky.embed.images') {
             // @ts-ignore
             post.embed.images.forEach((img: any) => {
                 if (img.image && img.image.ref && img.image.ref.$link) {
                     const link = img.image.ref.$link;
                     // Construct public CDN URL (Note: this is for public data)
                     const url = `https://cdn.bsky.app/img/feed_fullsize/plain/${event.did}/${link}@jpeg`;
                     imageUrls.push(url);
                 }
             });
        }

        const result = await this.llm.analyzePost(text, filter.prompt, imageUrls);

        if (result.isMatch) {
            console.log(`
🚨 [LABEL MATCH] 🚨`);
            console.log(`   Filter: ${filter.id}`);
            console.log(`   Reason: ${result.reasoning}`);
            console.log(`   URI: ${uri}`);
            console.log(`   Text: ${text}\n`);
            
            this.emitLabel(uri, cid, filter.label_value);
        } else {
            console.log(`[LLM REJECTED] Filter: ${filter.id} | Reason: ${result.reasoning} | Post: "${text.substring(0, 50)}..."`);
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
