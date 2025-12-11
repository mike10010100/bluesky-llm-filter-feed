import { z } from 'zod';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

// Define the Filter Schema
const FilterSchema = z.object({
  id: z.string(),
  label_value: z.string(),
  description: z.string(),
  match_mode: z.enum(['keyword', 'embedding', 'any', 'all']).default('any'), // Control how Sieve works
  trigger_words: z.array(z.string()).default([]), // Keyword "sieve"
  embeddings: z.object({
    enabled: z.boolean().default(false),
    force_check: z.boolean().default(false), // Force embedding check even if keyword matches (for debug/logging)
    threshold: z.number().min(0).max(1).default(0.5),
    triggers: z.array(z.string()).default([]),
  }).optional(),
  llm: z.object({
    prompt: z.string(), // The LLM System Prompt
    look_at_images: z.boolean().default(false),
    confidence_threshold: z.number().min(0).max(1).default(0.8),
  }),
});

// Define the Main Config Schema
const ConfigSchema = z.object({
  service: z.object({
    handle: z.string(),
    did: z.string().optional(),
    signingKey: z.string().optional(), // We'll warn if missing, but it's needed for real labeling
    provider: z.enum(['ollama', 'openai', 'anthropic']),
  }),
  llm: z.object({
    model: z.string(),
    base_url: z.string().optional(),
    api_key: z.string().optional(), // For OpenAI/Anthropic
  }),
  performance: z.object({
    queue_limit: z.number().min(1).default(50),
    concurrency: z.number().min(1).default(3),
  }).default({}),
  filters: z.array(FilterSchema),
});

export type Config = z.infer<typeof ConfigSchema>;
export type FilterConfig = z.infer<typeof FilterSchema>;

export function loadConfig(configPath: string = 'config.yaml'): Config {
  let finalConfigPath = configPath;
  if (!fs.existsSync(path.resolve(configPath))) {
    const samplePath = path.resolve('config.sample.yaml');
    if (fs.existsSync(samplePath)) {
      console.warn(`Configuration file not found at ${configPath}. Using ${samplePath} as a fallback.`);
      finalConfigPath = samplePath;
    } else {
      console.error(`Neither ${configPath} nor ${samplePath} found. Please create a config file.`);
      process.exit(1);
    }
  }

  try {
    const fileContents = fs.readFileSync(path.resolve(finalConfigPath), 'utf8');
    const parsed = yaml.parse(fileContents);
    return ConfigSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to load or validate configuration:");
    if (error instanceof z.ZodError) {
      console.error(error.issues);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}
