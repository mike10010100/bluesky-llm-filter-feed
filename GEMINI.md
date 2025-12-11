# SkyFilter AI

## Project Overview
**SkyFilter AI** is a self-hosted, modular AT Protocol Labeler Engine designed for Bluesky. It empowers users to define custom, high-precision content filters using Large Language Models (LLMs) and Semantic Embeddings. Unlike simple keyword blocking, SkyFilter offers context-aware filtering (e.g., distinguishing between "football" the sport and "football" the ball) and supports multimodal analysis (images).

The engine operates on a "Funnel" architecture to optimize performance and cost:
1.  **Ingestion:** Listens to the Bluesky "Jetstream" (a lightweight firehose).
2.  **Layer 1 (The Sieve):** Rapidly filters posts based on a configurable `match_mode` (keyword, embedding, any, all) using:
    *   Strict Keyword matches (`\bword\b`) for fast initial filtering.
    *   Semantic Vector Embeddings (local `all-MiniLM-L6-v2`) with configurable thresholds for conceptual matching.
3.  **Layer 2 (The Judge):** Sends candidate posts (text + images) to an LLM provider (Ollama or OpenAI) for deep semantic analysis. The LLM is prompted to return a JSON object with a `decision` ("YES" / "NO") and a `confidence` score.
4.  **Action:** Emits an AT Protocol label if the LLM confirms a match and the confidence score meets the `confidence_threshold`.

To prevent overwhelming the LLM provider, a **Bounded Queue** with configurable `concurrency` and `queue_limit` is implemented, which will shed load (drop messages) if the system falls behind.

## Building and Running

### Prerequisites
*   Node.js (v18+ recommended)
*   A Bluesky account configured as a Labeler (see setup instructions below).
*   An LLM provider:
    *   **Local Ollama:** [Ollama](https://ollama.com/) installed and running with a multimodal model (e.g., `qwen3-vl`) pulled.
    *   **OpenAI:** An OpenAI API key.

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the project:
    ```bash
    npm run build
    ```

### Labeler Account Setup (One-time)
1.  Create a **NEW** Bluesky account dedicated to your labeler (e.g., `@myfilter.bsky.social`). Do not use your main account.
2.  Run the `@skyware/labeler` setup command:
    ```bash
    npx @skyware/labeler setup
    ```
    Follow the prompts. This will output your **DID** (e.g., `did:plc:...`) and **Signing Key** (e.g., `K...`). **SAVE THESE SECURELY.**
3.  Define the labels your service will use (e.g., `content:politics`, `content:soccer`). Run this for each label you want to define:
    ```bash
    npx @skyware/labeler label add --name "content:politics" --description "Contains political content"
    # ... and so on for other labels
    ```

### Configuration
1.  Copy the sample configuration file:
    ```bash
    cp config.sample.yaml config.yaml
    ```
2.  Edit `config.yaml`:
    *   Under `service`: Fill in your `handle`, `did`, and `signingKey` obtained from the setup step.
    *   Under `llm`: Configure your chosen `model` and `base_url`/`api_key`.
    *   Under `performance`: Adjust `queue_limit` and `concurrency` for the LLM processing queue.
    *   Under `filters`: Define your custom filtering rules. Each filter includes:
        *   `id`: Unique identifier for the filter.
        *   `label_value`: The AT Protocol label to emit (e.g., `content:politics`).
        *   `description`: User-facing description.
        *   `match_mode`: How the pre-filter "sieve" operates (`keyword`, `embedding`, `any`, `all`).
        *   `trigger_words`: Keywords for the fast filter (uses word boundaries).
        *   `embeddings`: Configuration for semantic matching, including `threshold` and `triggers` (example phrases). `force_check: true` for debugging semantic scores even if keywords match.
        *   `llm`: LLM-specific settings for this filter:
            *   `prompt`: The system prompt for the LLM.
            *   `look_at_images`: Whether to send image data to the LLM.
            *   `confidence_threshold`: Minimum confidence from the LLM to emit a label.

### Run
Start the engine:
```bash
npm start
```

## Development Conventions

*   **Language:** TypeScript.
*   **Style:** Standard TypeScript coding conventions.
*   **Architecture:**
    *   `src/index.ts`: Entry point.
    *   `src/config/`: Configuration loading and validation (Zod schemas).
    *   `src/ingestion/`: Firehose connection and event handling (`@skyware/jetstream`), integrates `BoundedQueue`.
    *   `src/analysis/`: Core logic for Pre-filtering, LLM interaction (`OllamaProvider`, `OpenAIProvider`), and Embeddings (`@xenova/transformers`).
    *   `src/utils/queue.ts`: Implements the `BoundedQueue` for managing LLM request concurrency and load shedding.
*   **Filtering Logic:**
    *   **Pre-Filter (Sieve):** Configurable `match_mode` combines Regex word-boundary keyword checks with semantic embedding similarity (from `all-MiniLM-L6-v2`).
    *   **LLM (Judge):** Uses multimodal (e.g., Qwen3-VL) or text-only LLMs. Prompts for a JSON `{ decision: "YES"|"NO", confidence: 0.0-1.0 }` response. Applies `confidence_threshold`.
*   **Git:** `config.yaml` and runtime database files (`labels.db*`) are git-ignored to protect user secrets and local state. Use `config.sample.yaml` for template updates.