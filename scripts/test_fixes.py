
import sys
import os
sys.path.append(os.getcwd())

from app.embeddings import load_vector_store
from app.retrieval import retrieve
from loguru import logger

# Suppress logs for the test
logger.remove()

def test():
    try:
        collection = load_vector_store('chroma_db')
        query = "What is the refund policy?"
        print(f"Testing Query: '{query}'")
        
        results, confidence = retrieve(
            query=query, 
            collection=collection, 
            top_k=5, 
            similarity_threshold=0.15
        )
        
        print(f"Confidence: {confidence}")
        print(f"Results found: {len(results)}")
        for i, r in enumerate(results):
            print(f"[{i}] {r.document} (Score: {r.score:.4f})")
            print(f"    Snippet: {r.snippet[:100]}...")
            
        if not results:
            print("FAILURE: No results retrieved.")
        elif confidence == 'low' and results[0].score < 0.25:
            print("FAILURE: Scores too low.")
        else:
            print("SUCCESS: Retrieval is working with the fix!")
            
    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    test()
