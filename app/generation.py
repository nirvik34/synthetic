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

def build_prompt(question: str, retrieved_chunks: List[RetrievalResult], conversation_context: Optional[List[dict]] = None) -> str:
    context_parts = []
    current_chars = 0
    for i, res in enumerate(retrieved_chunks):
        if current_chars + len(res.snippet) > MAX_CONTEXT_CHARS:
            break
        context_parts.append(f'[{i+1}] Source: {res.document}\n{res.snippet}')
        current_chars += len(res.snippet)
    context_text = '\n\n'.join(context_parts)

    # Build conversation history string
    conv_history = ''
    if conversation_context:
        recent = conversation_context[-3:]  # last 3 turns max
        history_parts = []
        for turn in recent:
            history_parts.append(f"Previous Q: {turn['question']}\nPrevious A: {turn['answer']}")
        conv_history = '\n'.join(history_parts) + '\n\n'

    is_legal = any((kw in res.document.lower() for res in retrieved_chunks for kw in ['cuad', 'contract', 'agreement', 'legal']))
    if is_legal:
        instructions = "You are a legal assistant. Answer the question comprehensively using the provided legal context. Reference source numbers like [1], [2] when citing information. Look for specific conditions, notice periods, and clause numbers. If the question is about 'conditions', list all relevant triggers (e.g., convenience, breach, insolvency). If the answer is definitely not in the context, say 'I could not find an answer in the provided documents.'"
    else:
        instructions = "You are a helpful assistant. Answer the question using ONLY the provided context. Reference source numbers like [1], [2] when citing information. Be concise and informative. If the answer is not in the context, say 'I could not find an answer in the provided documents.'"
    prompt = f'{instructions}\n\n{conv_history}CONTEXT:\n{context_text}\n\nQUESTION: {question}\n\nANSWER:'
    return prompt

def generate_follow_ups(question: str, answer: str, sources: List[RetrievalResult], model_name: str = 'google/flan-t5-base') -> List[str]:
    """Generate 2-3 follow-up question suggestions based on the answer and sources."""
    if not sources or answer == NOT_FOUND_RESPONSE:
        return []

    doc_names = list(set(s.document for s in sources[:3]))
    source_topics = ' '.join(s.snippet[:100] for s in sources[:2])

    prompt = f"""Based on this Q&A, suggest 3 short follow-up questions the user might ask next.

Question: {question}
Answer: {answer}
Documents: {', '.join(doc_names)}
Context snippets: {source_topics[:300]}

Output exactly 3 follow-up questions, one per line. Be specific and concise:"""

    try:
        pipe = get_llm_pipeline(model_name)
        results = pipe(prompt, max_new_tokens=100, temperature=0.7, do_sample=True, top_p=0.9, repetition_penalty=1.2)
        text = results[0]['generated_text'].strip()
        # Parse lines into questions
        follow_ups = [line.strip().lstrip('0123456789.-) ') for line in text.split('\n') if line.strip()]
        # Filter out empty or too-short results
        follow_ups = [q for q in follow_ups if len(q) > 10 and q.endswith('?')][:3]

        # If LLM didn't produce good follow-ups, generate smart defaults
        if len(follow_ups) < 2:
            follow_ups = generate_default_follow_ups(question, doc_names)

        return follow_ups
    except Exception as e:
        logger.warning(f'Follow-up generation failed: {e}')
        return generate_default_follow_ups(question, doc_names)


def generate_default_follow_ups(question: str, doc_names: List[str]) -> List[str]:
    """Generate contextual default follow-up questions."""
    follow_ups = []
    q_lower = question.lower()

    if doc_names:
        primary_doc = doc_names[0]
        if 'contract' in primary_doc.lower() or 'cuad' in primary_doc.lower():
            follow_ups = [
                f"What are the key obligations in {primary_doc}?",
                "Are there any indemnification clauses?",
                "What is the governing law for this agreement?",
            ]
        elif 'policy' in primary_doc.lower() or 'privacy' in primary_doc.lower():
            follow_ups = [
                f"What data is collected according to {primary_doc}?",
                "What are the user rights mentioned?",
                "How is data retention handled?",
            ]
        else:
            follow_ups = [
                f"Can you provide more details from {primary_doc}?",
                "What are the key takeaways?",
                "Are there any related documents?",
            ]
    else:
        if 'summary' in q_lower:
            follow_ups = ["What are the key risks mentioned?", "Can you list the main parties involved?", "What are the important dates?"]
        elif 'parties' in q_lower or 'who' in q_lower:
            follow_ups = ["What are their respective obligations?", "What is the effective date?", "Are there any third parties mentioned?"]
        else:
            follow_ups = ["Can you elaborate on that?", "What are the related clauses?", "Are there any exceptions?"]

    return follow_ups[:3]


def generate_answer(question: str, retrieved_chunks: List[RetrievalResult], model_name: str='google/flan-t5-base', conversation_context: Optional[List[dict]] = None) -> str:
    if not retrieved_chunks:
        logger.info(f"No documents retrieved for question: '{question}'")
        return NOT_FOUND_RESPONSE
    prompt = build_prompt(question, retrieved_chunks, conversation_context)
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