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
*   **Label Name:** `soccer-hate`
*   **Description:** "Hides all positive references to Soccer/Football."
*   **Detection Strategy:**
    *   *Keywords:* (Fastest) "goal", "offside".
    *   *Embeddings:* (Smarter) Vector similarity to "professional soccer match" concept.
    *   *LLM Prompt:* (Most Accurate) "Is this post discussing Association Football?"
*   **Multimodal:** Option to send attached images to Vision models (GPT-4o / LlaVa).

### 4.2. The "Funnel" Architecture (Cost/Speed Optimization)
1.  **Ingestion:** Jetstream (Firehose).
2.  **Layer 1: Fast Match (The Sieve):**
    *   Checks Regex/Keywords.
    *   *Optional:* Checks Vector Embeddings (Local `all-MiniLM` via Transformers.js or Ollama).
    *   *Goal:* Eliminate 99% of irrelevant posts instantly.
3.  **Layer 2: Intelligence (The Judge):**
    *   If Layer 1 is triggered, send context (Post Text + Image URLs) to the LLM Provider.
    *   LLM Providers: **Ollama** (Local), **OpenAI** (Cloud), **Anthropic**.
4.  **Layer 3: Action:**
    *   If LLM confirms, sign and emit the Label via AT Protocol.

### 4.3. Image Support
*   If a post has images and triggers Layer 1 (or the user forces "Scan All Images"), the image is fetched.
*   Sent to a Vision-capable model (gpt-4o, llava, moondream).

## 5. Technical Architecture
*   **Core:** TypeScript (Node.js).
*   **Protocol:** `@atproto/api`, `@skyware/jetstream`.
*   **AI Abstraction Layer:**
    *   `LLMProvider` interface (generateText, generateVision).
    *   `EmbeddingProvider` interface (generateVector).
*   **Storage:**
    *   SQLite (storing cursor, cache of post CIDs to avoid re-processing, and potentially user subscriptions if we go multi-tenant later).

## 6. Configuration Example (`config.yaml`)
```yaml
service:
  handle: "my-filter.bsky.social"
  provider: "ollama" # or 'openai'

filters:
  - id: "soccer"
    label: "content:soccer"
    description: "Matches soccer content"
    trigger_words: ["soccer", "football", "messi", "fifa"]
    prompt: "Is this text about the sport of soccer? Answer YES/NO."
    look_at_images: true
```

## 7. Roadmap
*   **Phase 1:** Core Engine. Hardcoded "Soccer" rule. Jetstream -> Keyword -> OpenAI.
*   **Phase 2:** Abstraction. Add Ollama support. Move rules to `config.yaml`.
*   **Phase 3:** Vision. Add image fetching and LlaVa support.
*   **Phase 4:** Embeddings. Add vector pre-filtering to reduce false negatives.
