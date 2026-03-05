from typing import List, Dict, Tuple, Any
from dataclasses import dataclass
import chromadb
import numpy as np
from loguru import logger
from app.embeddings import embed_query

@dataclass
class RetrievalResult:
    chunk_id: str
    document: str
    snippet: str
    score: float
    char_start: int
    char_end: int

def retrieve(query: str, collection: chromadb.Collection, top_k: int=5, similarity_threshold: float=0.3, embedding_model_name: str='all-MiniLM-L6-v2') -> Tuple[List[RetrievalResult], str]:
    query_vector = embed_query(query, model_name=embedding_model_name)
    candidate_k = max(top_k * 2, 10)
    results = collection.query(query_embeddings=[query_vector], n_results=candidate_k, include=['documents', 'metadatas', 'distances'])
    candidates: List[RetrievalResult] = []
    if not results or not results['ids']:
        return ([], 'low')
    ids = results['ids'][0]
    documents = results['documents'][0]
    metadatas = results['metadatas'][0]
    distances = results['distances'][0]
    for i in range(len(ids)):
        sim_score = max(0.0, 1.0 - (distances[i] / 2.0))
        if sim_score < similarity_threshold:
            continue
        candidates.append(RetrievalResult(chunk_id=ids[i], document=metadatas[i]['doc_name'], snippet=documents[i], score=sim_score, char_start=int(metadatas[i]['char_start']), char_end=int(metadatas[i]['char_end'])))
    if not candidates:
        return ([], 'low')
    try:
        from app.embeddings import get_rerank_model
        import numpy as np
        reranker = get_rerank_model()
        pairs = [[query, c.snippet] for c in candidates]
        logits = reranker.predict(pairs)
        cross_scores = 1.0 / (1.0 + np.exp(-logits))
        if np.isscalar(cross_scores):
            cross_scores = [cross_scores]
        
        # Check if the cross-encoder is actually producing useful scores.
        # If ALL scores are near-zero (< 0.01), the model isn't helping —
        # fall back to pure bi-encoder scores instead of letting zeros
        # destroy valid matches.
        max_cross = float(max(cross_scores))
        if max_cross < 0.01:
            logger.warning(f'Cross-encoder returned near-zero scores (max={max_cross:.6f}), using bi-encoder scores only.')
            # Keep original bi-encoder scores, no hybrid mixing
        else:
            for i, c in enumerate(candidates):
                # Hybrid scoring: 50% Bi-Encoder, 50% Cross-Encoder
                # Balanced blend prevents either model from dominating
                c.score = float(0.5 * c.score + 0.5 * cross_scores[i])
            
        candidates.sort(key=lambda x: x.score, reverse=True)
        retrieved = candidates[:top_k]
    except Exception as e:
        logger.warning(f'Re-ranking failed, falling back to similarity scores: {e}')
        candidates.sort(key=lambda x: x.score, reverse=True)
        retrieved = candidates[:top_k]
    confidence = compute_confidence(retrieved)
    return (retrieved, confidence)

def compute_confidence(results: List[RetrievalResult]) -> str:
    if not results:
        return 'low'
    max_score = max((r.score for r in results))
    avg_score = sum(r.score for r in results) / len(results)
    # Use both max and average to determine confidence
    # Thresholds calibrated for bi-encoder scores (0.0-1.0 cosine range)
    if max_score >= 0.50 and avg_score >= 0.25:
        return 'high'
    elif max_score >= 0.30 and avg_score >= 0.12:
        return 'medium'
    return 'low'

def format_sources(results: List[RetrievalResult]) -> List[Dict[str, Any]]:
    sources = []
    for r in results:
        snippet = r.snippet if len(r.snippet) <= 200 else r.snippet[:200].strip() + '...'
        sources.append({'document': r.document, 'snippet': snippet, 'score': round(r.score, 4)})
    return sources