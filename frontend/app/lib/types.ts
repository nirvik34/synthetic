/* ── API & App Types ───────────────────────────────────────────── */

export interface HealthData {
    status: string;
    vector_store: string;
    chunk_count: number;
    model_loaded: boolean;
}

export interface DocumentsData {
    documents: string[];
    count: number;
}

export interface SourceItem {
    document: string;
    snippet: string;
    score: number;
}

export interface ConversationTurn {
    question: string;
    answer: string;
}

export interface AskResponse {
    answer: string;
    sources: SourceItem[];
    confidence: "high" | "medium" | "low";
    question: string;
    follow_ups: string[];
}

export interface IngestResponse {
    status: string;
    message: string;
    documents: number;
    total_chunks: number;
}

export interface ChatMessage {
    id: string;
    type: "user" | "bot" | "error" | "thinking";
    text?: string;
    data?: AskResponse;
    ms?: number;
}

export interface HistoryEntry {
    q: string;
    data: AskResponse;
    ms: number;
}
