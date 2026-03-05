import os
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer, CrossEncoder
from tqdm import tqdm
from loguru import logger
from app.ingestion import Chunk
COLLECTION_NAME = 'rag_documents'
BATCH_SIZE = 64
_embedding_model: Optional[SentenceTransformer] = None

def get_embedding_model(model_name: str='all-MiniLM-L6-v2') -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        logger.info(f'Loading embedding model: {model_name}')
        _embedding_model = SentenceTransformer(model_name)
        logger.success('Embedding model loaded.')
    return _embedding_model
_rerank_model: Optional[CrossEncoder] = None

def get_rerank_model(model_name: str='cross-encoder/ms-marco-MiniLM-L-6-v2') -> CrossEncoder:
    global _rerank_model
    if _rerank_model is None:
        logger.info(f'Loading re-ranker model: {model_name}')
        _rerank_model = CrossEncoder(model_name)
        logger.success('Re-ranker model loaded.')
    return _rerank_model
_chroma_client: Optional[Any] = None

def get_chroma_client(db_dir: str='chroma_db') -> Any:
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(db_dir, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=db_dir)
        logger.info(f'ChromaDB initialized at: {db_dir}')
    return _chroma_client

def build_vector_store(chunks: List[Chunk], embedding_model_name: str='all-MiniLM-L6-v2', db_dir: str='chroma_db') -> chromadb.Collection:
    if not chunks:
        raise ValueError('No chunks provided. Run document ingestion first.')
    model = get_embedding_model(embedding_model_name)
    client = get_chroma_client(db_dir)
    try:
        client.delete_collection(COLLECTION_NAME)
        logger.info('Cleared existing ChromaDB collection.')
    except Exception:
        pass
    collection = client.create_collection(name=COLLECTION_NAME, metadata={'hnsw:space': 'cosine'})
    logger.info(f'Embedding {len(chunks)} chunks in batches of {BATCH_SIZE}...')
    for batch_start in tqdm(range(0, len(chunks), BATCH_SIZE), desc='Embedding'):
        batch = chunks[batch_start:batch_start + BATCH_SIZE]
        texts = [c['text'] for c in batch]
        ids = [c['chunk_id'] for c in batch]
        metadatas = [{'doc_name': c['doc_name'], 'char_start': str(c['char_start']), 'char_end': str(c['char_end'])} for c in batch]
        embeddings = model.encode(texts, show_progress_bar=False).tolist()
        collection.add(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
    logger.success(f'Vector store built: {len(chunks)} chunks indexed.')
    return collection

def load_vector_store(db_dir: str='chroma_db') -> chromadb.Collection:
    client = get_chroma_client(db_dir)
    try:
        collection = client.get_collection(COLLECTION_NAME)
        count = collection.count()
        logger.info(f'Loaded vector store: {count} chunks available.')
        return collection
    except Exception as e:
        raise RuntimeError(f'Vector store not found. POST /ingest to index your documents first. Details: {e}')

def embed_query(query: str, model_name: str='all-MiniLM-L6-v2') -> List[float]:
    model = get_embedding_model(model_name)
    vector = model.encode([query], show_progress_bar=False)[0].tolist()
    return vector