# SkyFilter AI

**SkyFilter AI** is a self-hosted engine that allows you to filter your Bluesky experience using Local LLMs (Ollama) or Cloud APIs (OpenAI).

Unlike simple keyword blockers, SkyFilter understands context. It can tell the difference between "I hate soccer" and "I love soccer", or identify an image of a spider even if the text doesn't mention it.

## Features

*   **Semantic Filtering:** Uses LLMs to decide if a post matches your criteria.
*   **Cost Efficient:** Uses a 2-stage "Funnel" (Keywords/Embeddings -> LLM) to save money/compute.
*   **Privacy First:** Run it locally with Ollama. No data leaves your machine.
*   **Multimodal:** Can analyze images (requires a Vision model like `llava` or `gpt-4o`).
*   **Robust & Performant:** Includes load shedding, concurrent processing, and configurable pre-filters.

## Quick Start

### 1. Installation

```bash
git clone https://github.com/your-repo/skyfilter.git
cd skyfilter
npm install
npm run build
```

### 2. Labeler Setup

You need a dedicated Bluesky account to act as the labeler service.

```bash
npx @skyware/labeler setup
```
Follow the prompts to get your **DID** and **Signing Key**.

Then, define your labels:
```bash
npx @skyware/labeler label add --name "content:politics" --description "Contains political content"
```

### 3. Configuration

Copy and edit the config file:

```bash
cp config.sample.yaml config.yaml
```

Example `config.yaml`:

```yaml
service:
  handle: "my-labeler.bsky.social"
  did: "did:plc:..."
  signingKey: "..."
  provider: "ollama"

llm:
  model: "qwen3-vl" # Supports vision
  base_url: "http://127.0.0.1:11434"

performance:
  queue_limit: 50
  concurrency: 3

filters:
  - id: "politics"
    label_value: "content:politics"
    description: "Political content"
    match_mode: "any" # 'keyword', 'embedding', 'any', 'all'
    trigger_words: ["election", "vote"]
    embeddings:
      enabled: true
      threshold: 0.35
      triggers: ["discussion about elections"]
    llm:
      prompt: "Is this politics? Answer YES or NO."
      look_at_images: true
      confidence_threshold: 0.8
```

### 4. Run It

```bash
npm start
```

## Architecture

1.  **Ingestion:** Listens to the Bluesky "Jetstream" (Firehose).
2.  **Pre-Filter (The Sieve):** Checks posts against Keywords and/or Vector Embeddings to find candidates.
3.  **Analysis (The Judge):** Sends candidates to the configured LLM Provider.
4.  **Action:** Emits an AT Protocol Label if the LLM confirms.

## Advanced: Using OpenAI

1.  Set `service.provider` to `openai`.
2.  Set `llm.model` to `gpt-4o-mini` (or `gpt-4o` for vision).
3.  Set `llm.api_key` in your config (or use env var).