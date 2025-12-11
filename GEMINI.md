# SkyFilter AI

## Project Overview
**SkyFilter AI** is a self-hosted, modular AT Protocol Labeler Engine designed for Bluesky. It empowers users to define custom, high-precision content filters using Large Language Models (LLMs) and Semantic Embeddings. Unlike simple keyword blocking, SkyFilter offers context-aware filtering (e.g., distinguishing between "football" the sport and "football" the ball) and supports multimodal analysis (images).

The engine operates on a "Funnel" architecture to optimize performance and cost:
1.  **Ingestion:** Listens to the Bluesky "Jetstream" (a lightweight firehose).
2.  **Layer 1 (The Sieve):** Rapidly filters posts using fast Keyword matches and/or Vector Embeddings (local `all-MiniLM-L6-v2`) to identify potential candidates.
3.  **Layer 2 (The Judge):** Sends candidate posts (text + images) to an LLM provider (Ollama or OpenAI) for deep semantic analysis based on a user-defined prompt.
4.  **Action:** Emits an AT Protocol label if the LLM confirms a match.

## Building and Running

### Prerequisites
*   Node.js (v18+ recommended)
*   An LLM provider (e.g., a local running [Ollama](https://ollama.com/) instance or an OpenAI API key)

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Configuration
1.  Copy the sample configuration file:
    ```bash
    cp config.sample.yaml config.yaml
    ```
2.  Edit `config.yaml` to define your service handle, LLM provider settings, and custom filters.
    *   **Filters:** Define triggers (keywords/embeddings), the LLM prompt, and whether to analyze images.
    *   **LLM:** Select your model (e.g., `phi3` for text, `qwen3-vl` for vision) and base URL.

### Build
Compile the TypeScript source code:
```bash
npm run build
```

### Run
Start the engine:
```bash
npm start
```
*   **Dev mode:** `npm run dev` (uses `ts-node` for direct execution).

## Development Conventions

*   **Language:** TypeScript.
*   **Style:** Standard TypeScript coding conventions.
*   **Architecture:**
    *   `src/index.ts`: Entry point.
    *   `src/config/`: Configuration loading and validation (Zod schemas).
    *   `src/ingestion/`: Firehose connection and event handling (`@skyware/jetstream`).
    *   `src/analysis/`: Core logic for Pre-filtering, LLM interaction (`OllamaProvider`, `OpenAIProvider`), and Embeddings (`@xenova/transformers`).
*   **Filtering Logic:**
    *   **Pre-Filter:** Uses Regex word boundaries (`\b`) for strict keyword matching to reduce false positives.
    *   **Embeddings:** Computes cosine similarity between post text and defined trigger phrases.
    *   **LLM:** Constructs a prompt with the post content (and images converted to base64) and expects a YES/NO response.
*   **Git:** `config.yaml` is git-ignored to protect user secrets and local settings. Use `config.sample.yaml` for template updates.
