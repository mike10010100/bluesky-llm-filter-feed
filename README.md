# SkyFilter AI

**SkyFilter AI** is a self-hosted engine that allows you to filter your Bluesky experience using Local LLMs (Ollama) or Cloud APIs (OpenAI).

Unlike simple keyword blockers, SkyFilter understands context. It can tell the difference between "I hate soccer" and "I love soccer", or identify an image of a spider even if the text doesn't mention it.

## Features

*   **Semantic Filtering:** Uses LLMs to decide if a post matches your criteria.
*   **Cost Efficient:** Uses a 2-stage "Funnel" (Keywords/Embeddings -> LLM) to save money/compute.
*   **Privacy First:** Run it locally with Ollama. No data leaves your machine.
*   **Multimodal:** Can analyze images (requires a Vision model like `llava` or `gpt-4o`).

## Quick Start

### 1. Installation

```bash
git clone https://github.com/your-repo/skyfilter.git
cd skyfilter
npm install
npm run build
```

### 2. Configuration

Edit `config.yaml` to define your filters.

```yaml
service:
  provider: "ollama" # or "openai"

llm:
  model: "llama3" # Make sure you have this pulled in Ollama

filters:
  - id: "no-soccer"
    label_value: "content:soccer"
    trigger_words: ["soccer", "football", "fifa"]
    prompt: "Is this post discussing the sport of Association Football? Answer YES or NO."
    look_at_images: true
```

### 3. Run It

```bash
npm start
```

## Architecture

1.  **Ingestion:** Listens to the Bluesky "Jetstream" (Firehose).
2.  **Pre-Filter:** Checks posts against `trigger_words` to find candidates.
3.  **Analysis:** Sends candidates to the configured LLM Provider.
4.  **Action:** Logs the detection (Label emission coming in v2).

## Advanced: Using OpenAI

1.  Set `service.provider` to `openai`.
2.  Set `llm.model` to `gpt-4o-mini`.
3.  Set `llm.api_key` in your config (or use env var).
