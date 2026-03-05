import os
import re
from pathlib import Path
from typing import List, Dict
import fitz
from loguru import logger
Chunk = Dict[str, str | int]

def load_txt(filepath: Path) -> str:
    try:
        return filepath.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        logger.error(f'Failed to read {filepath}: {e}')
        return ''

def load_pdf(filepath: Path) -> str:
    text_parts = []
    try:
        doc = fitz.open(str(filepath))
        for page in doc:
            blocks = page.get_text('dict').get('blocks', [])
            for b in blocks:
                if b['type'] == 0:
                    block_content = []
                    for line in b['lines']:
                        line_text = ''.join([span['text'] for span in line['spans']])
                        block_content.append(line_text)
                    block_text = ' '.join(block_content).strip()
                    if block_text:
                        text_parts.append(block_text)
            text_parts.append('\n--- PAGE BREAK ---\n')
        doc.close()
        logger.info(f'Loaded PDF: {filepath.name} ({len(doc)} pages)')
    except Exception as e:
        logger.error(f'Failed to parse PDF {filepath}: {e}')
    return '\n\n'.join(text_parts)

def clean_text(text: str) -> str:
    text = re.sub('[^\\x09\\x0A\\x0D\\x20-\\x7E\\u00A0-\\uFFFF]', ' ', text)
    text = re.sub(' {2,}', ' ', text)
    text = re.sub('\\n{3,}', '\n\n', text)
    return text.strip()

def chunk_text(text: str, doc_name: str, chunk_size: int=500, overlap: int=50) -> List[Chunk]:
    if not text.strip():
        logger.warning(f'Empty text for document: {doc_name}')
        return []
    chunks: List[Chunk] = []
    start = 0
    chunk_index = 0
    while start < len(text):
        end = start + chunk_size
        if end < len(text):
            boundary = text.rfind('.', start, end)
            if boundary == -1 or boundary < start + chunk_size // 2:
                boundary = text.rfind('\n', start, end)
            if boundary != -1 and boundary > start + chunk_size // 2:
                end = boundary + 1
        chunk_text_content = text[start:end].strip()
        if chunk_text_content:
            chunks.append({'chunk_id': f'{doc_name}__std_{chunk_index}', 'doc_name': doc_name, 'text': chunk_text_content, 'char_start': start, 'char_end': end})
            chunk_index += 1
        start = end - overlap
    logger.debug(f"Chunked (Standard) '{doc_name}' → {len(chunks)} chunks")
    return chunks

def chunk_legal_text(text: str, doc_name: str) -> List[Chunk]:
    raw_pattern = '^(?:ARTICLE\\s+[IVXLCDM]+|SECTION\\s+\\d+(?:\\.\\d+)?|[\\d]+\\.\\s+[A-Z\\s]+|WHEREAS|NOW\\s+THEREFORE)'
    pattern = re.compile(f'({raw_pattern})', re.MULTILINE)
    parts = pattern.split(text)
    chunks: List[Chunk] = []
    offset = 0
    if parts[0].strip():
        chunks.append({'chunk_id': f'{doc_name}__preamble', 'doc_name': doc_name, 'text': parts[0].strip(), 'char_start': 0, 'char_end': len(parts[0])})
    offset = len(parts[0])
    for i in range(1, len(parts), 2):
        marker = parts[i]
        content = parts[i + 1] if i + 1 < len(parts) else ''
        section_text = (marker + content).strip()
        if section_text:
            chunks.append({'chunk_id': f'{doc_name}__section_{i // 2 + 1}', 'doc_name': doc_name, 'text': section_text, 'char_start': offset, 'char_end': offset + len(marker) + len(content)})
        offset += len(marker) + len(content)
    logger.debug(f"Chunked (Legal) '{doc_name}' → {len(chunks)} sections")
    return chunks
SUPPORTED_EXTENSIONS = {'.txt', '.md', '.pdf'}

def ingest_documents(docs_dir: str='docs', chunk_size: int=500, overlap: int=50) -> List[Chunk]:
    docs_path = Path(docs_dir)
    if not docs_path.exists():
        logger.error(f'Documents directory not found: {docs_dir}')
        return []
    all_chunks: List[Chunk] = []
    files = [f for f in docs_path.rglob('*') if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS]
    if not files:
        logger.warning(f"No supported documents found in '{docs_dir}'")
        return []
    logger.info(f'Found {len(files)} document(s) to ingest')
    for filepath in files:
        logger.info(f'Processing: {filepath.name}')
        suffix = filepath.suffix.lower()
        if suffix == '.pdf':
            raw_text = load_pdf(filepath)
        else:
            raw_text = load_txt(filepath)
        if not raw_text.strip():
            logger.warning(f'Skipping empty document: {filepath.name}')
            continue
        cleaned = clean_text(raw_text)
        is_legal = any((kw in filepath.name.lower() for kw in ['cuad', 'contract', 'agreement', 'policy', 'legal']))
        if is_legal:
            chunks = chunk_legal_text(cleaned, filepath.name)
        else:
            chunks = chunk_text(text=cleaned, doc_name=filepath.name, chunk_size=chunk_size, overlap=overlap)
        all_chunks.extend(chunks)
    logger.success(f'Ingestion complete: {len(all_chunks)} total chunks from {len(files)} file(s)')
    return all_chunks