# Architecture — Synthetic RAG System

This document is the canonical technical reference for the system. It covers the end-to-end data flows, module responsibilities, model selection reasoning, and every design decision.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Module Responsibilities](#module-responsibilities)
- [Ingestion Pipeline](#ingestion-pipeline)
- [Retrieval & Generation Pipeline](#retrieval--generation-pipeline)
- [Hallucination Guard Detail](#hallucination-guard-detail)
- [Model Selection](#model-selection)
- [Data Schemas](#data-schemas)
- [Engineering Decisions](#engineering-decisions)

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT                                 │
│         Next.js Chat UI  /  curl  /  any HTTP client            │
└───────────────────┬────────────────────────┬────────────────────┘
                    │  POST /ask             │  POST /ingest
                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI  (app/main.py)                      │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  /health │  │ /ingest  │  │    /ask     │  │/documents  │  │
│  └──────────┘  └────┬─────┘  └──────┬──────┘  └────────────┘  │
└───────────────────────────────────────────────────────────────── │
                       │               │
          ┌────────────┘               └──────────────────────┐
          ▼                                                    ▼
┌──────────────────────┐                         ┌────────────────────────┐
│   INGESTION LAYER    │                         │   RETRIEVAL LAYER      │
│   app/ingestion.py   │                         │   app/retrieval.py     │
│                      │                         │                        │
│  load_txt / load_pdf │                         │  embed_query()         │
│  clean_text()        │                         │  ChromaDB .query()     │
│  chunk_text()        │                         │  cross-encoder rerank  │
│  chunk_legal_text()  │                         │  compute_confidence()  │
└──────────┬───────────┘                         └──────────┬─────────────┘
           │                                                │
           ▼                                                ▼
┌──────────────────────┐                         ┌────────────────────────┐
│   EMBEDDING LAYER    │                         │   GENERATION LAYER     │
│   app/embeddings.py  │                         │   app/generation.py    │
│                      │                         │                        │
│  SentenceTransformer │                         │  build_prompt()        │
│  CrossEncoder        │                         │  generate_answer()     │
│  ChromaDB (build/    │                         │  generate_follow_ups() │
│           load)      │                         │  NOT_FOUND_RESPONSE    │
└──────────┬───────────┘                         └────────────────────────┘
           │
           ▼
┌──────────────────────┐
│   VECTOR STORE       │
│   ChromaDB           │
│   (chroma_db/ dir)   │
│   cosine space HNSW  │
└──────────────────────┘
```

---

## Module Responsibilities

### `app/main.py` — API Gateway & Orchestrator

**Owns:** startup, routing, application state, hallucination guard

- Manages `app_state` dict (`collection`, `ready` flag) shared across requests
- `lifespan` context manager: pre-loads embedding model + LLM + ChromaDB on startup
- `/ingest` — calls `ingest_documents()` → `build_vector_store()` → stores collection in `app_state`
- `/ask` — calls `retrieve()` → `generate_answer()` → **Hallucination Guard** → `generate_follow_ups()`
- `/upload-file` — saves uploaded file to `docs/` directory (does not auto-ingest)
- **Hallucination Guard** lives entirely inside this file (see detailed section below)
- Global exception handler returns `500` JSON on any unhandled error

---

### `app/ingestion.py` — Document Loader & Chunker

**Owns:** reading files, cleaning text, splitting into chunks

#### File Loaders

| Loader | File Types | Method |
|---|---|---|
| `load_txt(filepath)` | `.txt`, `.md` | `Path.read_text(encoding='utf-8', errors='ignore')` |
| `load_pdf(filepath)` | `.pdf` | `fitz.open()` → `page.get_text('dict')` — extracts blocks/lines/spans |

The PDF loader uses `dict` mode (not raw text) to preserve block structure and avoid merged lines.

#### Text Cleaner — `clean_text(text)`

```
1. Strip non-printable / non-Latin Unicode characters (keep \t \n \r and printable ASCII + extended Latin)
2. Collapse multiple spaces → single space
3. Collapse 3+ consecutive newlines → double newline
```

#### Standard Chunker — `chunk_text(text, doc_name, chunk_size=500, overlap=50)`

Sliding window over character offsets:
- Tries to break at the last `.` in the window (sentence boundary)
- Falls back to last `\n` (paragraph boundary)
- Falls back to hard cut at `chunk_size`
- Next chunk starts at `end - overlap` to preserve cross-boundary context
- Produces chunk IDs: `{doc_name}__std_{index}`

#### Legal Chunker — `chunk_legal_text(text, doc_name, chunk_size=1000, overlap=100)`

Uses regex to split on legal section markers:
```
ARTICLE / SECTION / ITEM + Roman numerals or numbers
Numbered sub-sections like "3.1.2 Termination"
WHEREAS / NOW THEREFORE / IN WITNESS WHEREOF
```

Flow:
1. Regex split → preamble + marker/content pairs
2. Preamble stored as `{doc_name}__preamble` (capped at 2000 chars)
3. Each section stored as `{doc_name}__section_{n}`
4. Oversized sections (> `chunk_size * 2`) further sub-chunked with `chunk_text()`
5. Falls back to `chunk_text()` if regex finds no markers

**Trigger condition:** `cuad`, `contract`, `agreement`, `policy`, or `legal` in filename → `chunk_legal_text()`. Everything else → `chunk_text()`.

---

### `app/embeddings.py` — Models & Vector Store

**Owns:** model singletons, ChromaDB lifecycle, batch embedding

All three heavy objects are **module-level singletons** loaded once and reused:

| Singleton | Variable | Model |
|---|---|---|
| Bi-Encoder | `_embedding_model` | `sentence-transformers/all-MiniLM-L6-v2` |
| Cross-Encoder | `_rerank_model` | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| ChromaDB client | `_chroma_client` | `chromadb.PersistentClient(path=chroma_db/)` |

#### `build_vector_store(chunks, embedding_model_name, db_dir)`

1. Deletes any existing ChromaDB collection named `rag_documents`
2. Creates fresh collection with `hnsw:space = cosine`
3. Embeds chunks in **batches of 64** using `model.encode()`
4. Adds each batch: `collection.add(ids, embeddings, documents, metadatas)`
5. Metadata stored per chunk: `{doc_name, char_start, char_end}`

#### `embed_query(query, model_name)`

Single query → `model.encode([query])[0].tolist()` — returns a `List[float]`

---

### `app/retrieval.py` — Search & Re-Ranking

**Owns:** two-stage retrieval, hybrid scoring, confidence computation

#### `retrieve(query, collection, top_k, similarity_threshold, embedding_model_name)`

**Stage 1 — Bi-Encoder Search**

```python
candidate_k = max(top_k * 2, 10)   # always fetch at least 10 candidates
query_vector = embed_query(query)
results = collection.query(query_embeddings=[query_vector], n_results=candidate_k)
```

Distance → similarity conversion:
```
sim_score = max(0.0, 1.0 - (distance / 2.0))
```
Candidates with `sim_score < similarity_threshold` (default `0.15`) are discarded.

**Metadata filter:** before querying, the system scans all indexed `doc_name` metadata values. If any document name (or its base name, if >4 chars) is explicitly mentioned in the query string, a `where={"doc_name": matched_name}` filter is applied to ChromaDB — scoping the entire search to that document only.

**Stage 2 — Cross-Encoder Re-Ranking**

```python
pairs = [[query, chunk.snippet] for chunk in candidates]
logits = reranker.predict(pairs)
cross_scores = 1.0 / (1.0 + exp(-logits))   # sigmoid → 0..1
```

Guard rail: if `max(cross_scores) < 0.01` → cross-encoder is unreliable → skip hybrid, keep bi-encoder scores only.

Otherwise, apply **50/50 hybrid blend**:
```
final_score = 0.5 × bi_encoder_score + 0.5 × cross_encoder_score
```

Sort descending by `final_score`, keep `top_k`.

**Confidence levels** (`compute_confidence`):

```
high   → max_score ≥ 0.50  AND  avg_score ≥ 0.25
medium → max_score ≥ 0.30  AND  avg_score ≥ 0.12
low    → everything else
```

#### `format_sources(results)`

Trims each snippet to 200 characters, returns list of `{document, snippet, score}` dicts.

---

### `app/generation.py` — Prompt Builder & LLM

**Owns:** prompt assembly, LLM inference, fallback logic, follow-up generation

#### `build_prompt(question, retrieved_chunks, conversation_context)`

Context assembly:
1. Iterates top-K chunks, appends formatted as `[N] Source: filename\nsnippet`
2. Stops adding chunks once cumulative characters exceed **`MAX_CONTEXT_CHARS = 2000`**
3. Prepends up to **last 3 conversation turns** as `Previous Q: ... / Previous A: ...`

Persona detection:
- **Legal** — any retrieved chunk's document name contains `cuad`, `contract`, `agreement`, `legal`
- **Meta/summary request** — question contains `summary`, `details`, `tell me about`, `show me`

Legal prompt instruction:
> *"You are a professional legal assistant. Answer comprehensively using ONLY the provided legal context. Write in full sentences. Reference source numbers like [1], [2]. If not in context, say 'I could not find an answer in the provided documents.'"*

General prompt instruction:
> *"You are a helpful and informative assistant. Answer thoroughly using ONLY the provided context. Reference source numbers like [1], [2]. If not in context, say 'I could not find an answer in the provided documents.'"*

Final prompt structure:
```
{instructions}

Previous Q: {turn[-3].question}
Previous A: {turn[-3].answer}
...

CONTEXT:
[1] Source: filename
    chunk text...

[2] Source: filename
    chunk text...

QUESTION: {question}

ANSWER:
```

#### `generate_answer(question, retrieved_chunks, model_name, conversation_context)`

LLM inference parameters:
```python
pipe(prompt, max_new_tokens=256, temperature=0.3, do_sample=True, top_p=0.9, repetition_penalty=1.2)
```

Post-generation checks (in order):

| Check | Condition | Action |
|---|---|---|
| Empty output | `len(generated_text) < 10` | Return `NOT_FOUND_RESPONSE` |
| All-lowercase unknown | `"i don't know"` or `"not in context"` in output | Return fallback snippet |
| Bare citation | Output is exactly `[N]` | Extract raw snippet from chunk index N |
| Fallback snippet | Chunks exist but LLM failed to synthesize | Return `"I couldn't synthesize a full answer, but here is what I found in {doc}: ...{chunk[:400]}..."` |
| Hard fallback | No chunks AND generation failed | Return `NOT_FOUND_RESPONSE` |

**`NOT_FOUND_RESPONSE` constant:**
> *"I could not find this in the provided documents. Can you share the relevant document? I'd be happy to help then."*

#### `generate_follow_ups(question, answer, sources, model_name)`

Only called when the answer passes the hallucination guard. Uses flan-t5 to generate 3 follow-up questions (`max_new_tokens=100`, `temperature=0.7`). Filters output lines to those ending in `?` and longer than 10 chars. Falls back to `generate_default_follow_ups()` if LLM output is malformed.

`generate_default_follow_ups()` produces domain-specific defaults:
- CUAD/contract → obligations, indemnification, governing law
- Policy/privacy → data collection, user rights, data retention
- General → more details, key takeaways, related documents

---

### `app/models.py` — Pydantic Schemas

Defines all request/response contracts validated at API boundaries:

| Schema | Direction | Key Fields |
|---|---|---|
| `AskRequest` | Input | `question` (3–1000 chars), `top_k` (1–20), `context: List[ConversationTurn]` |
| `AskResponse` | Output | `answer`, `sources`, `confidence`, `question`, `follow_ups` |
| `IngestRequest` | Input | `docs_dir`, `chunk_size` (100–2000), `chunk_overlap` (0–200) |
| `IngestResponse` | Output | `status`, `message`, `documents`, `total_chunks` |
| `SourceItem` | Nested | `document`, `snippet`, `score` |
| `HealthResponse` | Output | `status`, `vector_store`, `chunk_count`, `model_loaded` |
| `ConversationTurn` | Nested | `question`, `answer` |

---

## Ingestion Pipeline

```
docs/ directory
     │
     ├── .pdf  ──► load_pdf()   ──► fitz dict-mode block extraction
     ├── .txt  ──► load_txt()   ──► UTF-8 read
     └── .md   ──► load_txt()   ──► UTF-8 read
                                        │
                                        ▼
                                  clean_text()
                              (strip non-printable,
                               collapse whitespace/newlines)
                                        │
                          ┌─────────────┴──────────────┐
                          │ is_legal?                  │
                     (cuad/contract/                   │
                      agreement/policy              standard
                      in filename)                  document
                          │                            │
                          ▼                            ▼
                   chunk_legal_text()          chunk_text()
                   (regex section split)       (sliding window
                   chunk_size=1000             chunk_size=500
                   overlap=100)               overlap=50)
                          │                            │
                          └─────────────┬──────────────┘
                                        ▼
                               List[Chunk] dicts
                        {chunk_id, doc_name, text,
                         char_start, char_end}
                                        │
                                        ▼
                            build_vector_store()
                        embed in batches of 64
                        using all-MiniLM-L6-v2
                                        │
                                        ▼
                              ChromaDB collection
                         (cosine HNSW, persistent)
```

---

## Retrieval & Generation Pipeline

```
POST /ask  {question, top_k, context}
     │
     ▼
retrieve(query, collection, top_k, threshold)
     │
     ├─ embed_query()  → 384-dim vector (all-MiniLM-L6-v2)
     │
     ├─ Metadata filter check
     │    └─ If doc name mentioned in query → where={"doc_name": X}
     │
     ├─ ChromaDB cosine search → top-(top_k×2) candidates
     │    └─ Convert distance to similarity: 1 - dist/2
     │    └─ Filter below similarity_threshold (0.15)
     │
     ├─ Cross-Encoder rerank (ms-marco-MiniLM-L-6-v2)
     │    ├─ Predict logits for [query, chunk] pairs
     │    ├─ Sigmoid → probability scores
     │    ├─ Guard: if max < 0.01 → skip, use bi-encoder only
     │    └─ Hybrid: 0.5×bi + 0.5×cross → sort → top-K
     │
     └─ compute_confidence() → "high" / "medium" / "low"
          │
          ▼
     generate_answer(question, chunks, model, context)
          │
          ├─ build_prompt()
          │    ├─ Detect legal vs general → set persona instructions
          │    ├─ Inject last 3 conversation turns
          │    └─ Assemble [N] Source: ... context blocks (max 2000 chars)
          │
          ├─ flan-t5-base inference
          │    (max_new_tokens=256, temp=0.3, rep_penalty=1.2)
          │
          └─ Post-generation checks
               ├─ Empty → NOT_FOUND_RESPONSE
               ├─ "i don't know" → fallback snippet
               └─ Bare [N] → extract raw chunk text
                    │
                    ▼
               Hallucination Guard (app/main.py)
                    │
                    ├─ Check 1: no retrieved chunks → block
                    ├─ Check 2: answer == NOT_FOUND_RESPONSE → block
                    ├─ Check 3: "could not find" in answer → block
                    └─ Check 4: content-overlap ratio
                         ├─ Tokenize query, strip stopwords
                         ├─ Count key terms in all retrieved snippets + doc names
                         ├─ If overlap < 20% (or 5% if doc name mentioned) → block
                         └─ If block → answer = NOT_FOUND_RESPONSE
                                        confidence = "low"
                                        sources = []
                              If pass → generate_follow_ups()
                                   │
                                   ▼
                              AskResponse {answer, sources,
                              confidence, question, follow_ups}
```

---

## Hallucination Guard Detail

The guard in `app/main.py` is the **last line of defense** before an answer leaves the system. It runs after both retrieval and generation.

### Why it exists

The Cross-Encoder can produce "false positives" — chunks that score well semantically but are irrelevant to the actual information need. The content-overlap check catches these by verifying that the query's **key terms** actually appear in the retrieved text.

### Stopword list

The guard strips 60+ stopwords before computing key terms, including: `what, is, the, a, an, of, in, to, for, summary, details, analysis, information, show, tell, explain, give, provide, more, find, get, list, please, help...`

### Overlap threshold logic

```python
query_words = [non-stopword tokens > 2 chars]
hits = count(words that appear in snippets OR doc names)
overlap_ratio = hits / len(query_words)

if mentions_filename:
    threshold = 0.05   # very lenient — the doc was explicitly targeted
elif confidence != 'low':
    threshold = 0.20   # 20% of key terms must match
else:
    threshold = 0.25   # lower confidence → stricter threshold
```

### When all checks pass

```python
answer = generated_text
confidence = "high" / "medium" / "low"    (from retrieval)
sources = [top-K chunks with scores]
follow_ups = generate_follow_ups(...)     (3 suggested questions)
```

### When any check fires

```python
answer = NOT_FOUND_RESPONSE
# → "I could not find this in the provided documents.
#    Can you share the relevant document? I'd be happy to help then."
confidence = "low"
sources = []
follow_ups = []
```

---

## Model Selection

| Model | Role | Size | Reasoning |
|---|---|---|---|
| `all-MiniLM-L6-v2` | Bi-Encoder (embeddings + query) | ~80 MB | Fast inference, 384-dim dense vectors, strong semantic matching for initial recall. Best speed/quality trade-off for CPU |
| `ms-marco-MiniLM-L-6-v2` | Cross-Encoder (re-ranker) | ~80 MB | Trained specifically on MS-MARCO passage ranking — high precision for query-passage relevance scoring |
| `google/flan-t5-base` | Seq2Seq LLM (answer generation) | ~250 MB | Instruction-tuned for reading comprehension tasks. Excellent zero-shot performance with short prompts. CPU-efficient. Does not hallucinate as aggressively as decoder-only models |

**Why not a larger LLM?** The system is designed to run on standard developer hardware (no GPU). flan-t5-base generates coherent, grounded answers from provided context within seconds on CPU. The hallucination guard compensates for any quality gaps.

**Why two retrieval models?** The bi-encoder is fast but imprecise (dot-product approximation). The cross-encoder is slow but highly accurate (full attention over query+passage). Using bi-encoder for recall (top-20) and cross-encoder for precision (top-K) gives the best of both worlds.

---

## Data Schemas

### ChromaDB Metadata per Chunk

```json
{
  "doc_name": "cuad_contract_0.txt",
  "char_start": "1204",
  "char_end": "2156"
}
```

### RetrievalResult (internal dataclass)

```python
@dataclass
class RetrievalResult:
    chunk_id: str       # e.g. "cuad_contract_0.txt__section_3"
    document: str       # filename
    snippet: str        # chunk text
    score: float        # hybrid similarity score 0..1
    char_start: int     # byte offset in original document
    char_end: int       # byte offset in original document
```

---

## Engineering Decisions

### CPU-only by default
`device_map='cpu'` unless `USE_GPU=true`. Models are small enough that CPU inference is viable for a dev/demo environment and ensures zero GPU dependency.

### Singleton model loading
All heavy models (`_embedding_model`, `_rerank_model`, `_llm_pipeline`) are module-level singletons. They are loaded once at startup and reused across all requests, avoiding repeated multi-second load times.

### Persistent ChromaDB
The vector store writes to disk (`chroma_db/` directory). If the API restarts, `load_vector_store()` picks up the existing collection instantly — no need to re-ingest.

### Sliding window with sentence-boundary snapping
`chunk_text()` prefers to break at `.` (sentence end) or `\n` (paragraph) rather than hard character cuts. This ensures chunks contain complete thoughts, improving retrieval coherence.

### Oversized legal sections are sub-chunked
`chunk_legal_text()` uses regex sections as primary boundaries but if a section exceeds `chunk_size * 2` characters, it applies `chunk_text()` recursively. This handles legal contracts where a single clause can span thousands of characters.

### Hybrid 50/50 re-ranking blend
A pure cross-encoder score can be unstable when training distribution differs from the document domain. The 50/50 blend with bi-encoder scores acts as a regularizer. The near-zero guard (`max_cross < 0.01`) further protects against degenerate cross-encoder outputs.

### Content-overlap guard with lenient filename mode
When a user explicitly names a document (e.g., "what does company_policies say about X"), the overlap threshold drops to 5%. This supports meta-queries about entire documents where the key terms may not literally appear in the retrieved snippets.