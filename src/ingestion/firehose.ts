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
        let shouldProcess = false;
        let triggerReason = "";

        // 1a. Stage 1: Keyword Check (Fastest)
        if (PreFilter.shouldScan(text, filter)) {
          shouldProcess = true;
          triggerReason = "Keyword Match";
        }

        // 1b. Stage 1: Embedding Check (Slower but Semantic)
        if (!shouldProcess && filter.embeddings?.enabled) {
           const { isMatch, score } = await this.embeddingManager.checkSimilarity(text, filter);
           if (isMatch) {
             shouldProcess = true;
             triggerReason = `Semantic Match (${score.toFixed(2)})`;
           }
        }

        if (!shouldProcess) {
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
