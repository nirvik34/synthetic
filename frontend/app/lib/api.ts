import type {
    HealthData,
    DocumentsData,
    AskResponse,
    IngestResponse,
    ConversationTurn,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchHealth(): Promise<HealthData> {
    const r = await fetch(`${API}/health`, {
        signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new Error("Health check failed");
    return r.json();
}

export async function fetchDocuments(): Promise<DocumentsData> {
    const r = await fetch(`${API}/documents`);
    if (!r.ok) throw new Error("Documents fetch failed");
    return r.json();
}

export async function postIngest(): Promise<IngestResponse> {
    const r = await fetch(`${API}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Ingest failed");
    return data;
}

export async function postAsk(
    question: string,
    topK: number,
    context?: ConversationTurn[]
): Promise<AskResponse> {
    const body: Record<string, unknown> = { question, top_k: topK };
    if (context && context.length > 0) {
        body.context = context;
    }
    const r = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Query failed");
    return data;
}

export async function uploadFile(
    file: File
): Promise<{ filename: string; size: number; status: string }> {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${API}/upload-file`, {
        method: "POST",
        body: fd,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Upload failed");
    return data;
}

export async function fetchDocumentContent(filename: string): Promise<{ content: string; filename: string }> {
    const r = await fetch(`${API}/document/${encodeURIComponent(filename)}`);
    if (!r.ok) throw new Error("Failed to fetch document content");
    return r.json();
}
