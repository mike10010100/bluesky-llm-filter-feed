import { loadConfig } from "./config";
import { FirehoseProcessor } from "./ingestion/firehose";
import { LabelerServer } from "@skyware/labeler";
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("Initializing SkyFilter AI Engine...");
  
  // 1. Load Configuration
  const config = loadConfig('config.yaml');
  console.log(`Loaded ${config.filters.length} filters.`);
  console.log(`Provider: ${config.service.provider}`);
  console.log(`LLM Model: ${config.llm.model}`);

  let labelerServer: LabelerServer | undefined;

  // 2. Initialize Labeler Server (if configured)
  if (config.service.did && config.service.signingKey) {
    console.log(`Starting Labeler Server for DID: ${config.service.did}`);
    labelerServer = new LabelerServer({
      did: config.service.did,
      signingKey: config.service.signingKey,
    });

    // Start the WebSocket/HTTP server
    // 4100 is a common port for labelers, or 3000
    labelerServer.start(4100, (err) => {
      if (err) console.error("Labeler Server failed to start:", err);
      else console.log("Labeler Server listening on port 4100");
    });
  } else {
    console.warn("⚠️  Missing 'did' or 'signingKey' in config. Running in DRY-RUN mode (no labels will be emitted).");
  }

  // 3. Start Processor
  const processor = new FirehoseProcessor(config, labelerServer);
  processor.start();
  
  // Keep alive
  process.on('SIGINT', () => {
    console.log("Shutting down...");
    process.exit(0);
  });
}

main().catch(err => {
  console.error("Fatal error:", err);
});
