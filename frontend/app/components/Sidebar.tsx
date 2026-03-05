"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchHealth, fetchDocuments, postIngest } from "../lib/api";

interface SidebarProps {
    onSetQuestion: (q: string) => void;
}

export default function Sidebar({ onSetQuestion }: SidebarProps) {
    const [statusOnline, setStatusOnline] = useState(false);
    const [statusText, setStatusText] = useState("checking...");
    const [chunkCount, setChunkCount] = useState(0);
    const [documents, setDocuments] = useState<string[]>([]);
    const [docCount, setDocCount] = useState(0);
    const [ingesting, setIngesting] = useState(false);
    const [toastMsg, setToastMsg] = useState<{
        msg: string;
        type: "success" | "warn" | "error";
    } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const checkHealth = useCallback(async () => {
        try {
            const d = await fetchHealth();
            setStatusOnline(true);
            setStatusText("API Online");
            setChunkCount(d.chunk_count || 0);
            loadDocuments();
        } catch {
            setStatusOnline(false);
            setStatusText("API Offline");
            setChunkCount(0);
        }
    }, []);

    const loadDocuments = async () => {
        try {
            const d = await fetchDocuments();
            if (d.documents && d.documents.length > 0) {
                setDocuments(d.documents);
                setDocCount(d.count);
            } else {
                setDocuments([]);
                setDocCount(0);
            }
        } catch {
            console.error("Failed to load documents");
        }
    };

    const ingestDocs = async () => {
        setIngesting(true);
        try {
            const d = await postIngest();
            showToast(
                `✓ Indexed ${d.documents} docs / ${d.total_chunks} chunks`,
                "success"
            );
            checkHealth();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Ingest failed", "error");
        } finally {
            setIngesting(false);
        }
    };

    const showToast = (msg: string, type: "success" | "warn" | "error") => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 4000);
    };

    useEffect(() => {
        checkHealth();
        const iv = setInterval(checkHealth, 30000);
        return () => clearInterval(iv);
    }, [checkHealth]);

    const getDocIcon = (doc: string) => {
        if (doc.endsWith(".pdf")) return "description";
        if (doc.endsWith(".md")) return "article";
        return "draft";
    };
    const getDocColor = (doc: string) => {
        if (doc.endsWith(".pdf")) return "text-red-400";
        if (doc.endsWith(".md")) return "text-blue-400";
        return "text-slate-400";
    };

    const presets = [
        {
            section: "⚖ Legal Presets (CUAD)",
            items: [
                {
                    tag: "DOC",
                    tagClass: "tag-legal",
                    label: "Parties involved",
                    q: "Who are the parties in this services agreement?",
                },
                {
                    tag: "DOC",
                    tagClass: "tag-legal",
                    label: "Effective date",
                    q: "What is the effective date of the agreement?",
                },
                {
                    tag: "DOC",
                    tagClass: "tag-legal",
                    label: "Termination",
                    q: "What are the termination conditions?",
                },
            ],
        },
        {
            section: "🛡 Guard Tests",
            items: [
                {
                    tag: "SAFE",
                    tagClass: "tag-guard",
                    label: "Mars population",
                    q: "What is the population of Mars?",
                },
                {
                    tag: "SAFE",
                    tagClass: "tag-guard",
                    label: "Salary info",
                    q: "What is the CEO salary?",
                },
            ],
        },
    ];

    const filterMatch = (text: string) =>
        !searchQuery || text.toLowerCase().includes(searchQuery.toLowerCase());

    return (
        <>
            <aside className="w-80 flex-shrink-0 bg-sidebar-dark border-r border-white/5 flex flex-col p-4 overflow-hidden">
                {/* Logo */}
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                            <span className="material-symbols-rounded text-black text-xl">
                                bubble_chart
                            </span>
                        </div>
                        <div>
                            <h1 className="font-display font-bold text-lg leading-none tracking-tight">
                                DocuMind AI
                            </h1>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <div
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusOnline ? "bg-primary" : "bg-red-500"
                                        }`}
                                    style={{
                                        boxShadow: statusOnline
                                            ? "0 0 8px #4ade80"
                                            : "0 0 8px #ef4444",
                                    }}
                                />
                                <p
                                    className={`text-[9px] font-mono uppercase tracking-tighter ${statusOnline ? "text-primary" : "text-slate-500"
                                        }`}
                                >
                                    {statusText}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 transition-colors">
                        <span className="material-symbols-rounded text-xl">
                            side_navigation
                        </span>
                    </button>
                </div>

                {/* Search */}
                <div className="relative mx-1 mb-6">
                    <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
                        search
                    </span>
                    <input
                        className="w-full bg-white/5 border border-white/5 focus:border-primary/40 focus:ring-0 rounded-xl pl-10 py-2.5 text-xs placeholder-slate-600 text-slate-300 transition-all outline-none"
                        placeholder="Search sidebar..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-0.5 custom-scrollbar">
                    {/* Indexed Documents */}
                    {documents.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between px-2 mb-3">
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                    📚 Indexed Documents
                                </span>
                                <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    {docCount}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {documents
                                    .filter((doc) => filterMatch(doc))
                                    .map((doc) => (
                                        <button
                                            key={doc}
                                            onClick={() =>
                                                onSetQuestion(`Give me a summary of ${doc}`)
                                            }
                                            className="preset-btn group"
                                        >
                                            <span
                                                className={`material-symbols-rounded text-base ${getDocColor(
                                                    doc
                                                )} shrink-0 opacity-70 group-hover:opacity-100`}
                                            >
                                                {getDocIcon(doc)}
                                            </span>
                                            <span className="truncate flex-1">{doc}</span>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Presets */}
                    {presets.map((group) => (
                        <div key={group.section}>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2 mb-3">
                                {group.section}
                            </p>
                            <div className="space-y-0.5">
                                {group.items
                                    .filter((item) => filterMatch(item.label))
                                    .map((item) => (
                                        <button
                                            key={item.q}
                                            onClick={() => onSetQuestion(item.q)}
                                            className="preset-btn"
                                        >
                                            <span className={`tag ${item.tagClass}`}>
                                                {item.tag}
                                            </span>
                                            {item.label}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-rounded text-primary text-sm">
                                database
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                                {chunkCount.toLocaleString()} chunks
                            </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600">v1.0.0</span>
                    </div>
                    <button
                        onClick={ingestDocs}
                        disabled={ingesting}
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20 cursor-pointer"
                    >
                        {ingesting ? (
                            <>
                                <span className="material-symbols-rounded spin-icon">
                                    sync
                                </span>
                                Ingesting...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-rounded">cloud_upload</span>
                                Ingest Documents
                            </>
                        )}
                    </button>
                </div>
            </aside>

            {/* Toast */}
            {toastMsg && (
                <div
                    className={`fixed bottom-10 right-24 z-50 px-6 py-3 rounded-2xl text-xs font-mono border fade-up shadow-2xl backdrop-blur-md ${toastMsg.type === "success"
                            ? "bg-emerald-900 border-emerald-500/30 text-emerald-100"
                            : toastMsg.type === "warn"
                                ? "bg-yellow-900 border-yellow-500/30 text-yellow-100"
                                : "bg-red-900 border-red-500/30 text-red-100"
                        }`}
                >
                    {toastMsg.msg}
                </div>
            )}
        </>
    );
}
