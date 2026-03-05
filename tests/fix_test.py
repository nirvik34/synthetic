from app.retrieval import retrieve, RetrievalResult
from app.embeddings import load_vector_store
import dataclasses

# See all fields on RetrievalResult
print("RetrievalResult fields:", [f.name for f in dataclasses.fields(RetrievalResult)])

collection = load_vector_store('chroma_db')
results, confidence = retrieve(
    query='What is the governing law of this agreement?',
    collection=collection,
    top_k=5,
    similarity_threshold=0.0,
)
print('Confidence:', confidence)
print('Results:', len(results))
for r in results:
    print(vars(r))
    print()