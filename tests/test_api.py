import os
import sys
import json
import tempfile
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
sys.path.insert(0, str(Path(__file__).parent.parent))
from fastapi.testclient import TestClient
SAMPLE_DOC_CONTENT = "\nRefund Policy\n\nCustomers are eligible for a full refund within 30 days of purchase.\nThe product must be returned in its original condition and packaging.\nRefunds are processed within 5-7 business days after we receive the item.\n\nLogin Issues\n\nIf you cannot log in to your account, please reset your password using the\n'Forgot Password' link on the login page. If the issue persists, contact\nour support team at support@example.com.\n\nShipping Policy\n\nStandard shipping takes 5-7 business days.\nExpress shipping takes 1-2 business days and costs an additional $15.\nAll orders over $50 qualify for free standard shipping.\n"
SAMPLE_DOC_2 = '\nData Privacy Policy\n\nWe collect only the data necessary to provide our services.\nUser data is never sold to third parties.\nYou can request deletion of your data at any time by contacting privacy@example.com.\nAll data is encrypted at rest and in transit using AES-256 encryption.\n'

@pytest.fixture(scope='session')
def temp_docs_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        docs_dir = Path(tmpdir) / 'docs'
        docs_dir.mkdir()
        (docs_dir / 'policies.txt').write_text(SAMPLE_DOC_CONTENT)
        (docs_dir / 'privacy.txt').write_text(SAMPLE_DOC_2)
        yield str(docs_dir)

@pytest.fixture(scope='session')
def test_client(temp_docs_dir):
    mock_pipeline = MagicMock()
    mock_pipeline.return_value = [{'generated_text': 'Customers get a full refund within 30 days.'}]
    import numpy as np

    def mock_encode(texts, show_progress_bar=False):
        import hashlib
        results = []
        for text in texts:
            seed_hash = hashlib.sha256(text.encode()).hexdigest()
            seed = int(seed_hash[:8], 16)
            rng = np.random.default_rng(seed=seed)
            results.append(rng.standard_normal(384).astype('float32'))
        return np.array(results)
    mock_model = MagicMock()
    mock_model.encode = mock_encode
    with patch('app.embeddings._embedding_model', mock_model), patch('app.generation._llm_pipeline', mock_pipeline):
        os.environ['DOCS_DIR'] = temp_docs_dir
        os.environ['CHROMA_DB_DIR'] = tempfile.mkdtemp()
        from app.main import app
        client = TestClient(app, raise_server_exceptions=False)
        yield client

class TestIngestion:

    def test_load_txt_file(self, temp_docs_dir):
        from app.ingestion import load_txt
        path = Path(temp_docs_dir) / 'policies.txt'
        text = load_txt(path)
        assert 'refund' in text.lower()
        assert len(text) > 100

    def test_clean_text_removes_extra_whitespace(self):
        from app.ingestion import clean_text
        dirty = 'Hello   world\n\n\n\nThis   is  a   test.'
        cleaned = clean_text(dirty)
        assert '   ' not in cleaned
        assert '\n\n\n' not in cleaned

    def test_chunk_text_produces_chunks(self):
        from app.ingestion import chunk_text
        long_text = 'This is a sentence. ' * 200
        chunks = chunk_text(long_text, doc_name='test.txt', chunk_size=500, overlap=50)
        assert len(chunks) > 1
        assert all(('text' in c for c in chunks))
        assert all(('doc_name' in c for c in chunks))
        assert all(('chunk_id' in c for c in chunks))

    def test_chunk_text_respects_chunk_size(self):
        from app.ingestion import chunk_text
        text = 'Word ' * 1000
        chunks = chunk_text(text, doc_name='test.txt', chunk_size=300, overlap=30)
        for chunk in chunks:
            assert len(chunk['text']) <= 300 * 1.2, f'Chunk too large: {len(chunk['text'])}'

    def test_chunk_text_overlap_preserves_context(self):
        from app.ingestion import chunk_text
        text = 'Alpha Beta Gamma Delta Epsilon ' * 100
        chunks = chunk_text(text, doc_name='test.txt', chunk_size=200, overlap=50)
        if len(chunks) >= 2:
            end_of_first = chunks[0]['text'][-30:]
            start_of_second = chunks[1]['text'][:50]
            words_first = set(end_of_first.split())
            words_second = set(start_of_second.split())
            assert len(words_first & words_second) > 0

    def test_chunk_text_empty_input(self):
        from app.ingestion import chunk_text
        chunks = chunk_text('', doc_name='empty.txt')
        assert chunks == []

    def test_ingest_documents_from_dir(self, temp_docs_dir):
        from app.ingestion import ingest_documents
        chunks = ingest_documents(docs_dir=temp_docs_dir, chunk_size=300, overlap=30)
        assert len(chunks) > 0
        doc_names = {c['doc_name'] for c in chunks}
        assert 'policies.txt' in doc_names
        assert 'privacy.txt' in doc_names

    def test_ingest_nonexistent_dir(self):
        from app.ingestion import ingest_documents
        chunks = ingest_documents(docs_dir='/nonexistent/path/that/does/not/exist')
        assert chunks == []

    def test_chunk_ids_are_unique(self):
        from app.ingestion import chunk_text
        text = 'Sentence number one. ' * 300
        chunks = chunk_text(text, doc_name='test.txt', chunk_size=200, overlap=20)
        ids = [c['chunk_id'] for c in chunks]
        assert len(ids) == len(set(ids)), 'Duplicate chunk IDs found!'

class TestConfidenceScoring:

    def test_high_confidence(self):
        from app.retrieval import compute_confidence, RetrievalResult
        results = [RetrievalResult('id1', 'doc.txt', 'text', 0.82, 0, 100)]
        assert compute_confidence(results) == 'high'

    def test_medium_confidence(self):
        from app.retrieval import compute_confidence, RetrievalResult
        results = [RetrievalResult('id1', 'doc.txt', 'text', 0.52, 0, 100)]
        assert compute_confidence(results) == 'medium'

    def test_low_confidence(self):
        from app.retrieval import compute_confidence, RetrievalResult
        results = [RetrievalResult('id1', 'doc.txt', 'text', 0.33, 0, 100)]
        assert compute_confidence(results) == 'low'

    def test_empty_results_returns_low(self):
        from app.retrieval import compute_confidence
        assert compute_confidence([]) == 'low'

class TestPromptBuilder:

    def test_prompt_contains_question(self):
        from app.generation import build_prompt
        from app.retrieval import RetrievalResult
        chunks = [RetrievalResult('id1', 'doc.txt', 'Refunds take 30 days.', 0.9, 0, 50)]
        prompt = build_prompt('What is the refund period?', chunks)
        assert 'What is the refund period?' in prompt

    def test_prompt_contains_context(self):
        from app.generation import build_prompt
        from app.retrieval import RetrievalResult
        chunks = [RetrievalResult('id1', 'policy.txt', 'Refunds take 30 days.', 0.9, 0, 50)]
        prompt = build_prompt('Refund?', chunks)
        assert 'Refunds take 30 days.' in prompt

    def test_prompt_includes_source_doc_name(self):
        from app.generation import build_prompt
        from app.retrieval import RetrievalResult
        chunks = [RetrievalResult('id1', 'policy.pdf', 'Some policy text.', 0.9, 0, 50)]
        prompt = build_prompt('Any question?', chunks)
        assert 'policy.pdf' in prompt

    def test_prompt_respects_context_cap(self):
        from app.generation import build_prompt, MAX_CONTEXT_CHARS
        from app.retrieval import RetrievalResult
        large_chunks = [RetrievalResult(f'id{i}', 'big.txt', 'x ' * 300, 0.9, 0, 600) for i in range(20)]
        prompt = build_prompt('Question?', large_chunks)
        assert len(prompt) < MAX_CONTEXT_CHARS + 500

class TestNotFoundResponse:

    def test_not_found_on_empty_chunks(self):
        from app.generation import generate_answer, NOT_FOUND_RESPONSE
        answer = generate_answer('Any question?', retrieved_chunks=[])
        assert answer == NOT_FOUND_RESPONSE

    def test_not_found_message_exact_text(self):
        from app.generation import NOT_FOUND_RESPONSE
        assert 'I could not find this in the provided documents' in NOT_FOUND_RESPONSE
        assert 'Can you share the relevant document?' in NOT_FOUND_RESPONSE

class TestSourceFormatter:

    def test_format_sources_structure(self):
        from app.retrieval import format_sources, RetrievalResult
        results = [RetrievalResult('id1', 'policy.pdf', 'A ' * 200, 0.85, 0, 400), RetrievalResult('id2', 'faq.txt', 'B ' * 50, 0.7, 0, 100)]
        sources = format_sources(results)
        assert len(sources) == 2
        for s in sources:
            assert 'document' in s
            assert 'snippet' in s
            assert 'score' in s

    def test_format_sources_truncates_snippet(self):
        from app.retrieval import format_sources, RetrievalResult
        long_text = 'word ' * 200
        results = [RetrievalResult('id1', 'doc.txt', long_text, 0.8, 0, 1000)]
        sources = format_sources(results)
        assert sources[0]['snippet'].endswith('...')
        assert len(sources[0]['snippet']) <= 203

class TestHealthEndpoint:

    def test_health_returns_200(self, test_client):
        response = test_client.get('/health')
        assert response.status_code == 200

    def test_health_response_schema(self, test_client):
        response = test_client.get('/health')
        data = response.json()
        assert 'status' in data
        assert 'vector_store' in data
        assert 'chunk_count' in data
        assert 'model_loaded' in data

    def test_health_status_values_valid(self, test_client):
        response = test_client.get('/health')
        data = response.json()
        assert data['status'] in ('ok', 'degraded')
        assert data['vector_store'] in ('ready', 'not_initialized')

class TestIngestEndpoint:

    def test_ingest_success(self, test_client, temp_docs_dir):
        response = test_client.post('/ingest', json={'docs_dir': temp_docs_dir})
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['documents'] >= 1
        assert data['total_chunks'] >= 1

    def test_ingest_response_schema(self, test_client, temp_docs_dir):
        response = test_client.post('/ingest', json={'docs_dir': temp_docs_dir})
        data = response.json()
        assert 'status' in data
        assert 'message' in data
        assert 'documents' in data
        assert 'total_chunks' in data

    def test_ingest_empty_directory(self, test_client):
        with tempfile.TemporaryDirectory() as empty_dir:
            response = test_client.post('/ingest', json={'docs_dir': empty_dir})
            assert response.status_code == 400

    def test_ingest_nonexistent_directory(self, test_client):
        response = test_client.post('/ingest', json={'docs_dir': '/no/such/dir'})
        assert response.status_code == 400

    def test_ingest_custom_chunk_size(self, test_client, temp_docs_dir):
        response = test_client.post('/ingest', json={'docs_dir': temp_docs_dir, 'chunk_size': 300, 'chunk_overlap': 30})
        assert response.status_code == 200

    def test_ingest_invalid_chunk_size(self, test_client, temp_docs_dir):
        response = test_client.post('/ingest', json={'docs_dir': temp_docs_dir, 'chunk_size': 10})
        assert response.status_code == 422

class TestAskEndpoint:

    @pytest.fixture(autouse=True)
    def ensure_ingested(self, test_client, temp_docs_dir):
        test_client.post('/ingest', json={'docs_dir': temp_docs_dir})

    def test_ask_returns_200(self, test_client):
        response = test_client.post('/ask', json={'question': 'What is the refund policy?'})
        assert response.status_code == 200

    def test_ask_response_schema(self, test_client):
        response = test_client.post('/ask', json={'question': 'What is the refund policy?'})
        data = response.json()
        assert 'answer' in data
        assert 'sources' in data
        assert 'confidence' in data
        assert 'question' in data

    def test_ask_confidence_valid_values(self, test_client):
        response = test_client.post('/ask', json={'question': 'What is the refund policy?'})
        data = response.json()
        assert data['confidence'] in ('high', 'medium', 'low')

    def test_ask_echoes_question(self, test_client):
        question = 'What is the refund policy?'
        response = test_client.post('/ask', json={'question': question})
        data = response.json()
        assert data['question'] == question

    def test_ask_sources_have_required_fields(self, test_client):
        response = test_client.post('/ask', json={'question': 'What is the refund policy?'})
        data = response.json()
        for source in data.get('sources', []):
            assert 'document' in source
            assert 'snippet' in source
            assert 'score' in source
            assert 0.0 <= source['score'] <= 1.0

    def test_ask_unknown_question_returns_not_found(self, test_client):
        response = test_client.post('/ask', json={'question': 'What is the quantum theory of gravity as defined by Einstein in 1952?'})
        data = response.json()
        not_found_triggered = data['confidence'] == 'low' or len(data['sources']) == 0 or 'could not find' in data['answer'].lower()
        assert not_found_triggered

    def test_ask_answer_is_not_empty(self, test_client):
        response = test_client.post('/ask', json={'question': 'What is the refund policy?'})
        data = response.json()
        assert data['answer'].strip() != ''

    def test_ask_custom_top_k(self, test_client):
        response = test_client.post('/ask', json={'question': 'What is the refund policy?', 'top_k': 3})
        assert response.status_code == 200
        data = response.json()
        assert len(data['sources']) <= 3

    def test_ask_top_k_out_of_range(self, test_client):
        response = test_client.post('/ask', json={'question': 'Test?', 'top_k': 100})
        assert response.status_code == 422

class TestEdgeCases:

    def test_ask_empty_question(self, test_client):
        response = test_client.post('/ask', json={'question': ''})
        assert response.status_code == 422

    def test_ask_whitespace_only_question(self, test_client):
        response = test_client.post('/ask', json={'question': '   '})
        assert response.status_code == 422

    def test_ask_very_long_question(self, test_client, temp_docs_dir):
        test_client.post('/ingest', json={'docs_dir': temp_docs_dir})
        response = test_client.post('/ask', json={'question': 'A' * 1001})
        assert response.status_code == 422

    def test_ask_missing_question_field(self, test_client):
        response = test_client.post('/ask', json={})
        assert response.status_code == 422

    def test_ask_invalid_json(self, test_client):
        response = test_client.post('/ask', content='not valid json', headers={'Content-Type': 'application/json'})
        assert response.status_code == 422

    def test_ask_before_ingest_returns_503(self, test_client):
        from app import main as app_module
        original = app_module.app_state.copy()
        app_module.app_state['ready'] = False
        app_module.app_state['collection'] = None
        response = test_client.post('/ask', json={'question': 'Test?'})
        app_module.app_state.update(original)
        assert response.status_code == 503

    def test_ask_special_characters_in_question(self, test_client, temp_docs_dir):
        test_client.post('/ingest', json={'docs_dir': temp_docs_dir})
        response = test_client.post('/ask', json={'question': 'What is the policy? (specifically: refund & return!)'})
        assert response.status_code == 200

    def test_ask_unicode_question(self, test_client, temp_docs_dir):
        test_client.post('/ingest', json={'docs_dir': temp_docs_dir})
        response = test_client.post('/ask', json={'question': 'What is the politique de remboursement?'})
        assert response.status_code == 200

class TestHallucinationPrevention:

    @pytest.fixture(autouse=True)
    def ensure_ingested(self, test_client, temp_docs_dir):
        test_client.post('/ingest', json={'docs_dir': temp_docs_dir})

    def test_sources_are_real_documents(self, test_client, temp_docs_dir):
        real_files = {f.name for f in Path(temp_docs_dir).iterdir() if f.is_file()}
        response = test_client.post('/ask', json={'question': 'What is the refund policy?'})
        data = response.json()
        for source in data.get('sources', []):
            assert source['document'] in real_files, f"Source '{source['document']}' was not in actual docs directory — possible hallucinated citation!"

    def test_not_found_has_no_sources(self, test_client):
        response = test_client.post('/ask', json={'question': 'Explain the entire history of the Byzantine Empire in detail.'})
        data = response.json()
        if 'could not find' in data['answer'].lower():
            assert data['sources'] == [], 'Sources must be empty when answer is not found!'

    def test_score_is_between_0_and_1(self, test_client):
        response = test_client.post('/ask', json={'question': 'What is the refund policy?'})
        data = response.json()
        for source in data.get('sources', []):
            assert 0.0 <= source['score'] <= 1.0, f'Invalid score: {source['score']}'