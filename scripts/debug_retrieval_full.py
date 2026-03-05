import chromadb
from sentence_transformers import SentenceTransformer, CrossEncoder
import os
import numpy as np

COLLECTION_NAME = 'rag_documents'
CHROMA_DB_DIR = 'chroma_db'

def debug_retrieval(query):
    client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    collection = client.get_collection(COLLECTION_NAME)
    
    bi_model = SentenceTransformer('all-MiniLM-L6-v2')
    cross_model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
    
    query_vector = bi_model.encode([query])[0].tolist()
    
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=10,
        include=['documents', 'metadatas', 'distances']
    )
    
    print(f"Query: {query}")
    print("-" * 60)
    
    docs = results['documents'][0]
    metas = results['metadatas'][0]
    dists = results['distances'][0]
    
    # Re-rank
    pairs = [[query, doc] for doc in docs]
    logits = cross_model.predict(pairs)
    probs = 1.0 / (1.0 + np.exp(-logits))
    
    sorted_indices = np.argsort(probs)[::-1]
    
    for i in sorted_indices:
        prob = probs[i]
        sim = 1.0 - (dists[i] / 2.0)
        doc_name = metas[i]['doc_name']
        text = docs[i][:300].replace('\n', ' ')
        print(f"Doc: {doc_name}")
        print(f"  Bi-Sim: {sim:.4f} | Cross-Score: {prob:.4f}")
        print(f"  Snippet: {text}...")
        print()

if __name__ == "__main__":
    import sys
    q = "What are the termination conditions?"
    if len(sys.argv) > 1:
        q = " ".join(sys.argv[1:])
    debug_retrieval(q)
