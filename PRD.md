# Product Requirements Document (PRD): SkyFilter AI (Configurable Labeler Engine)

## 1. Executive Summary
**Project Name:** SkyFilter AI
**Type:** Self-Hosted AT Protocol Labeler Engine
**Goal:** Provide a personal or community-run engine that allows users to define custom, high-precision filters for Bluesky. Unlike simple mute words, this uses LLMs and Semantic Embeddings to understand context (e.g., distinguishing "I hate football" from a sports update) and can analyze images.

## 2. Problem Statement
*   **Keyword limits:** Muting "spider" doesn't block a picture of a tarantula. Muting "Python" hides coding tips when you only wanted to block snake photos.
*   **Rigid Providers:** Existing labelers block generic categories (Spam, NSFW). Users generally cannot create their own "I hate Soccer" or "No K-Pop" filters without coding their own bot from scratch.
*   **Cost vs. Accuracy:** Running an LLM on the entire firehose is prohibitively expensive/slow. We need a smart middle layer.

## 3. Proposed Solution: The "SkyFilter" Engine
A modular, configurable Node.js application that users can run (locally, on a VPS, or as a service).

### 3.1. User Stories
*   **As a User (Self-Host):** I want to edit a `config.yaml` to add a "No Spiders" rule. I want to use my local Ollama instance so it costs me $0.
*   **As a Community Manager:** I want to run a "No Crypto Scams" labeler for my friends, using OpenAI for high accuracy, and let them subscribe to my Labeler DID.

## 4. Key Features

### 4.1. Configurable Filters
Users define "Rules". Each rule has:
*   **Label Name:** `content:soccer`
*   **Description:** "Hides all positive references to Soccer/Football."
*   **Detection Strategy (Hybrid Sieve):**
    *   *Keywords:* Fast Regex match (with word boundaries).
    *   *Embeddings:* Vector similarity match (`all-MiniLM-L6-v2`) with configurable thresholds.
    *   *Match Mode:* Configurable logic (`any`, `all`, `keyword`, `embedding`) to combine the above.
*   **LLM Verification:**
    *   *Prompt:* User-defined system prompt.
    *   *Multimodal:* Option to send attached images to Vision models.
    *   *Confidence:* Configurable threshold for the LLM's certainty.

### 4.2. The "Funnel" Architecture
1.  **Ingestion:** Jetstream (Firehose).
2.  **Layer 1: Fast Match (The Sieve):**
    *   Checks Regex/Keywords and/or Embeddings.
    *   *Goal:* Eliminate 99% of irrelevant posts instantly.
3.  **Queueing:**
    *   Matched posts are pushed to a **Bounded Queue** with configurable concurrency.
    *   **Load Shedding:** If the queue is full, posts are dropped to protect the LLM server.
4.  **Layer 2: Intelligence (The Judge):**
    *   Queue workers send context (Post Text + Image URLs) to the LLM Provider.
    *   LLM Providers: **Ollama** (Local), **OpenAI** (Cloud).
    *   Response: Structured JSON `{ decision: "YES", confidence: 0.9 }`.
5.  **Layer 3: Action:**
    *   If LLM confirms, the **LabelerServer** emits a signed AT Protocol Label.

## 5. Technical Architecture
*   **Core:** TypeScript (Node.js).
*   **Protocol:** `@atproto/api`, `@skyware/jetstream`, `@skyware/labeler`.
*   **AI Abstraction Layer:**
    *   `LLMProvider`: Handles Ollama/OpenAI interactions, JSON parsing, and image download/encoding.
    *   `EmbeddingProvider`: Handles local vector generation via `@xenova/transformers`.
*   **Infrastructure:**
    *   `BoundedQueue`: Manages concurrency and backpressure.
    *   SQLite (`labels.db`): Managed by `@skyware/labeler` to store label history and sequence state.

## 6. Configuration Example (`config.yaml`)
```yaml
service:
  handle: "my-filter.bsky.social"
  did: "did:plc:..."
  signingKey: "..."
  provider: "ollama"

llm:
  model: "qwen3-vl"
  base_url: "http://127.0.0.1:11434"

performance:
  queue_limit: 50
  concurrency: 3

filters:
  - id: "soccer"
    label_value: "content:soccer"
    match_mode: "any"
    trigger_words: ["soccer", "football"]
    embeddings:
      enabled: true
      threshold: 0.35
      triggers: ["Professional football match"]
    llm:
      prompt: "Is this soccer? Answer YES or NO."
      look_at_images: true
      confidence_threshold: 0.8
```

## 7. Project Status
*   **Phase 1 (Core Engine):** ✅ Complete. Jetstream -> Keyword -> LLM.
*   **Phase 2 (Configurable):** ✅ Complete. `config.yaml` drives all logic.
*   **Phase 3 (Vision):** ✅ Complete. Support for multimodal models (Qwen3-VL, GPT-4o).
*   **Phase 4 (Embeddings):** ✅ Complete. `all-MiniLM-L6-v2` integration.
*   **Phase 5 (Performance):** ✅ Complete. Queue system and load shedding.
*   **Phase 6 (AT Protocol):** ✅ Complete. Full Labeler Server integration.