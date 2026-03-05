from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator

class ConversationTurn(BaseModel):
    question: str
    answer: str

class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000, description='The question to answer from ingested documents.', examples=['What is the refund policy?'])
    top_k: Optional[int] = Field(default=5, ge=1, le=20, description='Number of document chunks to retrieve (1–20).')
    context: Optional[List[ConversationTurn]] = Field(default=None, description='Previous conversation turns for follow-up context.')

    @field_validator('question')
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Question must not be empty or whitespace.')
        return v.strip()

class IngestRequest(BaseModel):
    docs_dir: Optional[str] = Field(default='docs', description='Path to the folder containing documents to ingest.')
    chunk_size: Optional[int] = Field(default=500, ge=100, le=2000, description='Characters per chunk.')
    chunk_overlap: Optional[int] = Field(default=50, ge=0, le=200, description='Character overlap between consecutive chunks.')

class SourceItem(BaseModel):
    document: str = Field(..., description='Filename of the source document.')
    snippet: str = Field(..., description='Relevant text snippet from the document.')
    score: float = Field(..., description='Cosine similarity score (0–1).')

class AskResponse(BaseModel):
    answer: str = Field(..., description='Answer grounded in retrieved documents.')
    sources: List[SourceItem] = Field(..., description='Citations with document + snippet + score.')
    confidence: Literal['high', 'medium', 'low'] = Field(..., description='Confidence level based on retrieval scores.')
    question: str = Field(..., description='Echo of the original question.')
    follow_ups: List[str] = Field(default_factory=list, description='Suggested follow-up questions.')

class IngestResponse(BaseModel):
    status: Literal['success', 'error']
    message: str
    documents: int = Field(..., description='Number of documents processed.')
    total_chunks: int = Field(..., description='Total chunks indexed into vector store.')

class HealthResponse(BaseModel):
    status: Literal['ok', 'degraded']
    vector_store: Literal['ready', 'not_initialized']
    chunk_count: int
    model_loaded: bool