from sentence_transformers import SentenceTransformer, CrossEncoder
from transformers import pipeline
import os
print('\n📦 Pre-downloading models for Docker image...')
print('→ Downloading all-MiniLM-L6-v2...')
SentenceTransformer('all-MiniLM-L6-v2')
print('→ Downloading cross-encoder/ms-marco-MiniLM-L-6-v2...')
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
print('→ Downloading google/flan-t5-base (this is large, please wait)...')
pipeline('text2text-generation', model='google/flan-t5-base')
print('\n✅ All models successfully cached.')