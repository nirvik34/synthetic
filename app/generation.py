import os
from typing import List, Optional
from transformers import pipeline, Pipeline
from loguru import logger
from app.retrieval import RetrievalResult
NOT_FOUND_RESPONSE = "I could not find this in the provided documents. Can you share the relevant document? I'd be happy to help then."
MAX_CONTEXT_CHARS = 2000
_llm_pipeline: Optional[Pipeline] = None

def get_llm_pipeline(model_name: str='google/flan-t5-base') -> Pipeline:
    global _llm_pipeline
    if _llm_pipeline is None:
        logger.info(f'Loading local LLM: {model_name} (this may take a minute on first run)...')
        _llm_pipeline = pipeline('text2text-generation', model=model_name, device_map='auto' if os.getenv('USE_GPU', 'false').lower() == 'true' else 'cpu')
        logger.success('LLM pipeline ready.')
    return _llm_pipeline

def build_prompt(question: str, retrieved_chunks: List[RetrievalResult]) -> str:
    context_parts = []
    current_chars = 0
    for res in retrieved_chunks:
        if current_chars + len(res.snippet) > MAX_CONTEXT_CHARS:
            break
        context_parts.append(f'Source: {res.document}\n{res.snippet}')
        current_chars += len(res.snippet)
    context_text = '\n\n'.join(context_parts)
    is_legal = any((kw in res.document.lower() for res in retrieved_chunks for kw in ['cuad', 'contract', 'agreement', 'legal']))
    if is_legal:
        instructions = "You are a legal assistant. Answer the question using ONLY the provided legal context. If you find clauses that contradict each other or contain nullifying conditions, explicitly note this in your answer. Never infer legal obligations not stated in the text. If the answer is not in the context, say 'I don't know'."
    else:
        instructions = "You are a helpful assistant. Answer the question using ONLY the provided context. If the answer is not in the context, say 'I don't know'."
    prompt = f'{instructions}\n\nCONTEXT:\n{context_text}\n\nQUESTION: {question}\n\nANSWER:'
    return prompt

def generate_answer(question: str, retrieved_chunks: List[RetrievalResult], model_name: str='google/flan-t5-base') -> str:
    if not retrieved_chunks:
        logger.info(f"No documents retrieved for question: '{question}'")
        return NOT_FOUND_RESPONSE
    prompt = build_prompt(question, retrieved_chunks)
    try:
        pipe = get_llm_pipeline(model_name)
        results = pipe(prompt, max_new_tokens=150, temperature=0.3, do_sample=True, top_p=0.9, repetition_penalty=1.1)
        generated_text = results[0]['generated_text'].strip()
        if not generated_text or "i don't know" in generated_text.lower():
            logger.warning(f"LLM could not find answer for: '{question}'")
            return NOT_FOUND_RESPONSE
        return generated_text
    except Exception as e:
        logger.error(f'Generation failed: {e}')
        return f'Sorry, I encountered an internal error: {str(e)}'