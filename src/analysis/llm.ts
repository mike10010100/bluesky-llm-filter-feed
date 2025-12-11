import { Config } from '../config';
import { Ollama } from 'ollama';
import axios from 'axios';

export interface LLMResult {
  isMatch: boolean;
  confidence?: number;
  reasoning?: string;
}

export interface LLMProvider {
  analyzePost(text: string, systemPrompt: string, imageUrls?: string[]): Promise<LLMResult>;
}

export class OllamaProvider implements LLMProvider {
  private client: Ollama;
  private model: string;

  constructor(host: string, model: string) {
    this.client = new Ollama({ host });
    this.model = model;
  }

  async analyzePost(text: string, systemPrompt: string, imageUrls: string[] = []): Promise<LLMResult> {
    try {
      // Basic text-only implementation for Phase 1
      // For multimodal, we would add 'images' field to the message
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Post Content:\n"${text}"\n\nIs this post a match?` }
      ];

      const response = await this.client.chat({
        model: this.model,
        messages: messages,
        stream: false,
      });

      const content = response.message.content.trim().toUpperCase();
      const isMatch = content.includes('YES');

      return {
        isMatch,
        reasoning: content
      };
    } catch (error) {
      console.error('Ollama analysis failed:', error);
      return { isMatch: false }; // Fail open (don't label if unsure)
    }
  }
}

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(apiKey: string, model: string, baseURL: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = baseURL;
  }

  async analyzePost(text: string, systemPrompt: string, imageUrls: string[] = []): Promise<LLMResult> {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Post Content:\n"${text}"\n\nIs this post a match?` }
          ],
          temperature: 0,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content.trim().toUpperCase();
      const isMatch = content.includes('YES');

      return { isMatch, reasoning: content };

    } catch (error) {
      console.error('OpenAI analysis failed:', error);
      return { isMatch: false };
    }
  }
}

export function createLLMProvider(config: Config): LLMProvider {
  const providerType = config.service.provider;

  if (providerType === 'ollama') {
    return new OllamaProvider(config.llm.base_url || 'http://localhost:11434', config.llm.model);
  } else if (providerType === 'openai') {
    if (!config.llm.api_key) {
      throw new Error("OpenAI API key is required in config.llm.api_key");
    }
    return new OpenAIProvider(config.llm.api_key, config.llm.model, config.llm.base_url);
  } else {
    throw new Error(`Unsupported provider: ${providerType}`);
  }
}
