import { z } from 'zod';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

// Define the Filter Schema
const FilterSchema = z.object({
  id: z.string(),
  label_value: z.string(),
  description: z.string(),
  trigger_words: z.array(z.string()).min(1), // Keyword "sieve"
  embeddings: z.object({
    enabled: z.boolean().default(false),
    threshold: z.number().min(0).max(1).default(0.5),
    triggers: z.array(z.string()).default([]),
  }).optional(),
  prompt: z.string(), // The LLM System Prompt
  look_at_images: z.boolean().default(false),
  confidence_threshold: z.number().min(0).max(1).default(0.8),
});

// Define the Main Config Schema
const ConfigSchema = z.object({
  service: z.object({
    handle: z.string(),
    did: z.string().optional(),
    provider: z.enum(['ollama', 'openai', 'anthropic']),
  }),
  llm: z.object({
    model: z.string(),
    base_url: z.string().optional(),
    api_key: z.string().optional(), // For OpenAI/Anthropic
  }),
  filters: z.array(FilterSchema),
});

export type Config = z.infer<typeof ConfigSchema>;
export type FilterConfig = z.infer<typeof FilterSchema>;

export function loadConfig(configPath: string = 'config.yaml'): Config {
  try {
    const fileContents = fs.readFileSync(path.resolve(configPath), 'utf8');
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
