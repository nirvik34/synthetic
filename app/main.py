import os
import sys
import shutil
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from dotenv import load_dotenv
from app.models import AskRequest, AskResponse, IngestRequest, IngestResponse, HealthResponse, SourceItem
from app.ingestion import ingest_documents
from app.embeddings import build_vector_store, load_vector_store, get_embedding_model, get_chroma_client
from app.retrieval import retrieve, format_sources
from app.generation import generate_answer, generate_follow_ups, get_llm_pipeline, NOT_FOUND_RESPONSE

load_dotenv()

LLM_MODEL_NAME = os.getenv('LLM_MODEL_NAME', 'google/flan-t5-base')
EMBEDDING_MODEL_NAME = os.getenv('EMBEDDING_MODEL_NAME', 'all-MiniLM-L6-v2')
TOP_K = int(os.getenv('TOP_K', '10'))
SIMILARITY_THRESHOLD = float(os.getenv('SIMILARITY_THRESHOLD', '0.15'))
DOCS_DIR = os.getenv('DOCS_DIR', 'docs')
CHROMA_DB_DIR = os.getenv('CHROMA_DB_DIR', 'chroma_db')
CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', '500'))
CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', '50'))

logger.remove()
logger.add(sys.stderr, level='INFO', format='<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}')
logger.add('logs/app.log', rotation='10 MB', retention='7 days', level='DEBUG')
os.makedirs('logs', exist_ok=True)

app_state = {'collection': None, 'ready': False}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info('=== RAG Q&A Bot starting up ===')
    try:
        get_embedding_model(EMBEDDING_MODEL_NAME)
    except Exception as e:
        logger.warning(f'Could not preload embedding model: {e}')
    try:
        get_llm_pipeline(LLM_MODEL_NAME)
    except Exception as e:
        logger.warning(f'Could not preload LLM: {e}')
    try:
        app_state['collection'] = load_vector_store(CHROMA_DB_DIR)
        app_state['ready'] = True
        logger.success('Existing vector store loaded. API is ready.')
    except RuntimeError:
        logger.warning('No vector store found. POST /ingest to index documents first.')
    yield
    logger.info('=== RAG Q&A Bot shutting down ===')


app = FastAPI(title='Document Q&A Bot (RAG)', description='Answer questions from your documents using Retrieval-Augmented Generation. POST /ingest to index docs, then POST /ask to query.', version='1.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])


@app.get('/', response_class=HTMLResponse)
async def get_ui():
    """Serves the Document Q&A Dashboard."""
    ui_path = os.path.join(os.getcwd(), 'ui.html')
    if os.path.exists(ui_path):
        return FileResponse(ui_path)
    return HTMLResponse(content='<h1>DocuMind AI</h1><p>ui.html not found in root directory.</p>', status_code=404)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f'Unhandled exception on {request.url}: {exc}')
    return JSONResponse(status_code=500, content={'detail': 'An internal error occurred. Check server logs for details.'})


@app.get('/health', response_model=HealthResponse, tags=['System'])
async def health_check():
    collection = app_state.get('collection')
    chunk_count = 0
    store_status = 'not_initialized'
    if collection is not None:
        try:
            chunk_count = collection.count()
            store_status = 'ready'
        except Exception:
            store_status = 'not_initialized'
    return HealthResponse(status='ok' if app_state['ready'] else 'degraded', vector_store=store_status, chunk_count=chunk_count, model_loaded=True)


@app.post('/ingest', response_model=IngestResponse, tags=['Ingestion'])
async def ingest(request: IngestRequest = IngestRequest()):
    logger.info(f'Starting ingestion from: {request.docs_dir}')
    chunks = ingest_documents(docs_dir=request.docs_dir, chunk_size=request.chunk_size, overlap=request.chunk_overlap)
    if not chunks:
        raise HTTPException(status_code=400, detail=f"No documents found or all documents were empty in '{request.docs_dir}'. Add .txt, .md, or .pdf files to the docs/ folder.")
    try:
        collection = build_vector_store(chunks=chunks, embedding_model_name=EMBEDDING_MODEL_NAME, db_dir=CHROMA_DB_DIR)
        app_state['collection'] = collection
        app_state['ready'] = True
    except Exception as e:
        logger.error(f'Vector store build failed: {e}')
        raise HTTPException(status_code=500, detail=f'Failed to build vector store: {str(e)}')
    doc_names = set((c['doc_name'] for c in chunks))
    logger.success(f'Ingestion complete: {len(doc_names)} docs, {len(chunks)} chunks')
    return IngestResponse(status='success', message=f'Successfully indexed {len(doc_names)} document(s).', documents=len(doc_names), total_chunks=len(chunks))


@app.post('/upload-file', tags=['Ingestion'])
async def upload_file(file: UploadFile = File(...)):
    """Upload a single file to the docs directory for ingestion."""
    ALLOWED = {'.txt', '.md', '.pdf'}
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail=f'Unsupported file type: {ext}. Allowed: {ALLOWED}')
    docs_dir = os.getenv('DOCS_DIR', 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    dest = os.path.join(docs_dir, file.filename or 'upload')
    try:
        with open(dest, 'wb') as f:
            shutil.copyfileobj(file.file, f)
        size = os.path.getsize(dest)
        logger.info(f'File uploaded: {file.filename} ({size} bytes)')
        return {'filename': file.filename, 'size': size, 'status': 'uploaded'}
    except Exception as e:
        logger.error(f'File upload failed: {e}')
        raise HTTPException(status_code=500, detail=f'Upload failed: {str(e)}')


@app.post('/ask', response_model=AskResponse, tags=['Q&A'])
async def ask(request: AskRequest):
    if not app_state['ready'] or app_state['collection'] is None:
        raise HTTPException(status_code=503, detail='Vector store not initialized. POST /ingest to index your documents first.')
    logger.info(f"Question received: '{request.question}'")
    results, confidence = retrieve(query=request.question, collection=app_state['collection'], top_k=request.top_k or TOP_K, similarity_threshold=SIMILARITY_THRESHOLD, embedding_model_name=EMBEDDING_MODEL_NAME)

    # Build conversation context if provided
    conv_context = None
    if request.context:
        conv_context = [{'question': t.question, 'answer': t.answer} for t in request.context]

    answer = generate_answer(question=request.question, retrieved_chunks=results, model_name=LLM_MODEL_NAME, conversation_context=conv_context)
    sources = [SourceItem(document=s['document'], snippet=s['snippet'], score=s['score']) for s in format_sources(results)]

    # ── Hallucination guard ──────────────────────────────────────────────
    # 1. Direct checks
    hallucination_reason = None
    if not results:
        is_not_found = True
        hallucination_reason = "No relevant documents found"
    elif answer == NOT_FOUND_RESPONSE:
        is_not_found = True
        hallucination_reason = "LLM returned NOT_FOUND_RESPONSE"
    elif 'could not find' in answer.lower():
        is_not_found = True
        hallucination_reason = "LLM mentioned it could not find the answer"
    else:
        is_not_found = False

    # 2. Content-overlap check: do the query's key terms actually appear
    #    in any retrieved snippet? If not, the re-ranker gave a false positive.
    if not is_not_found and results:
        stopwords = {'what', 'is', 'the', 'a', 'an', 'of', 'in', 'on', 'and', 'or',
                      'to', 'for', 'this', 'that', 'are', 'was', 'were', 'be', 'been',
                      'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'can',
                      'could', 'should', 'may', 'might', 'how', 'who', 'where', 'when',
                      'why', 'which', 'with', 'from', 'about', 'me', 'my', 'i', 'you',
                      'your', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'give',
                      'there', 'here', 'all', 'any', 'some', 'no', 'not', 'but', 'summary',
                      'detailed', 'analysis', 'information', 'points', 'main', 'document',
                      'show', 'tell', 'explain', 'brief', 'review', 'about', 'provide', 
                      'more', 'details', 'find', 'get', 'list', 'please', 'help'}
        
        # Strip common punctuation from words
        raw_words = [w.strip('?.,!\"').lower() for w in request.question.split()]
        query_words = [w for w in raw_words if len(w) > 2 and w not in stopwords]
        
        if query_words:
            all_snippets = ' '.join(r.snippet.lower() for r in results)
            # Check if any query word appears in snippets OR matches a retrieved document name
            found_in_snippets = [w for w in query_words if w in all_snippets]
            
            # Check for document name match — also check partial word matches
            # e.g. "policy" should match document name "company_policies.txt"
            found_in_filenames = []
            mentions_filename = False
            all_doc_names = ' '.join(r.document.lower().replace('_', ' ').replace('.', ' ') for r in results)
            for w in query_words:
                if w in all_doc_names:
                    found_in_filenames.append(w)
                    mentions_filename = True
            
            hits = len(set(found_in_snippets + found_in_filenames))
            overlap_ratio = hits / len(query_words)
            
            logger.debug(f'Overlap check: {hits}/{len(query_words)} words found ({overlap_ratio:.0%}), words={query_words}')
            
            # If overlap is very low, block it.
            # Be much more lenient if a filename was explicitly mentioned (meta-query)
            if mentions_filename:
                threshold = 0.10
            else:
                threshold = 0.20 if confidence != 'low' else 0.25
                
            if overlap_ratio < threshold:
                is_not_found = True
                hallucination_reason = f"Low overlap ratio ({overlap_ratio:.0%}) with query terms {query_words}"
        else:
            # If no key terms (e.g. "tell me more"), allow if confidence is not low
            if confidence == 'low':
                is_not_found = True
                hallucination_reason = "No key terms in query and low confidence retrieval"

    if is_not_found:
        logger.info(f'Answer blocked by Hallucination Guard: {hallucination_reason or "Reason unknown"} | confidence={confidence}')
        answer = NOT_FOUND_RESPONSE
        confidence = 'low'
        sources = []
        follow_ups = []
        logger.info(f'Answer blocked by hallucination guard | confidence={confidence}')
    else:
        # Generate follow-up suggestions only for valid answers
        follow_ups = generate_follow_ups(question=request.question, answer=answer, sources=results, model_name=LLM_MODEL_NAME)

    logger.info(f'Answer generated | confidence={confidence} | sources={len(sources)} | follow_ups={len(follow_ups)}')
    return AskResponse(answer=answer, sources=sources, confidence=confidence, question=request.question, follow_ups=follow_ups)


@app.get('/documents', tags=['Information'])
async def list_documents():
    """Returns a list of unique document names currently indexed in the vector store."""
    if not app_state['ready'] or app_state['collection'] is None:
        return {'documents': [], 'count': 0}
    try:
        # Get all metadatas to extract unique document names
        results = app_state['collection'].get(include=['metadatas'])
        metadatas = results.get('metadatas', [])
        # Extract unique doc_names
        doc_names = sorted(list(set((m.get('doc_name') for m in metadatas if m and m.get('doc_name')))))
        return {'documents': doc_names, 'count': len(doc_names)}
    except Exception as e:
        logger.error(f'Failed to list documents: {e}')
        return {'documents': [], 'count': 0}


@app.get('/document/{filename}', tags=['Information'])
async def get_document_content(filename: str):
    """Returns the content of a specific document."""
    docs_dir = os.getenv('DOCS_DIR', 'docs')
    safe_name = os.path.basename(filename)
    file_path = os.path.join(docs_dir, safe_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found.")
    
    try:
        # For simplicity, we assume text-based files. For PDFs, a real app would extract text.
        # But for this RAG bot, let's just try to read it.
        if file_path.endswith('.pdf'):
            return {"content": "[PDF Content - Text extraction required for full view]", "filename": safe_name}
            
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        return {"content": content, "filename": safe_name}
    except Exception as e:
        logger.error(f"Failed to read document {filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read document: {str(e)}")