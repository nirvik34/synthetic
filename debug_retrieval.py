import chromadb
from sentence_transformers import SentenceTransformer
import os

COLLECTION_NAME = 'rag_documents'
CHROMA_DB_DIR = 'chroma_db'

def debug_retrieval(query):
    client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    collection = client.get_collection(COLLECTION_NAME)
    
    model = SentenceTransformer('all-MiniLM-L6-v2')
    query_vector = model.encode([query])[0].tolist()
    
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=5,
        include=['documents', 'metadatas', 'distances']
    )
    
    print(f"Query: {query}")
    print("-" * 40)
    for i in range(len(results['ids'][0])):
        dist = results['distances'][0][i]
        sim = 1.0 - (dist / 2.0)
        doc = results['metadatas'][0][i]['doc_name']
        text = results['documents'][0][i][:200].replace('\n', ' ')
        print(f"[{i}] Sim: {sim:.4f} | Doc: {doc}")
        print(f"    Snippet: {text}...")
        print()

if __name__ == "__main__":
    import sys
    q = "What are the termination conditions?"
    if len(sys.argv) > 1:
        q = " ".join(sys.argv[1:])
    debug_retrieval(q)
