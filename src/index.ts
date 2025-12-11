import { loadConfig } from "./config";
import { FirehoseProcessor } from "./ingestion/firehose";
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("Initializing SkyFilter AI Engine...");
  
  // 1. Load Configuration
  const config = loadConfig('config.yaml');
  console.log(`Loaded ${config.filters.length} filters.`);
  console.log(`Provider: ${config.service.provider}`);
  console.log(`LLM Model: ${config.llm.model}`);

  // 2. Start Processor
  const processor = new FirehoseProcessor(config);
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
