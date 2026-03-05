"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchHealth } from "../lib/api";
import type { HistoryEntry } from "../lib/types";

interface DocumentPanelProps {
    onSummarize: (q: string) => void;
    historyLog: HistoryEntry[];
    refreshKey: number;
    documents: string[];
    docCount: number;
    isOpen?: boolean;
    onToggle?: () => void;
    activeDocument?: string | null;
    selectedDocName?: string | null;
    selectedDocContent?: string | null;
    onViewDoc?: (docName: string | null) => void;
}

export default function DocumentPanel({
    onSummarize,
    historyLog,
    refreshKey,
    documents,
    docCount,
    isOpen: externalOpen,
    onToggle,
    activeDocument,
    selectedDocName,
    selectedDocContent,
    onViewDoc,
}: DocumentPanelProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const toggle = onToggle || (() => setInternalOpen(!internalOpen));

    const [chunkCount, setChunkCount] = useState(0);

    const loadHealth = useCallback(async () => {
        try {
            const health = await fetchHealth();
            setChunkCount(health.chunk_count || 0);
        } catch {
            console.error("Failed to load panel health stats");
        }
    }, []);

    useEffect(() => {
        loadHealth();
    }, [loadHealth, refreshKey]);

    const getDocIcon = (doc: string) => {
        if (doc.endsWith(".pdf")) return "description";
        if (doc.endsWith(".md")) return "article";
        return "draft";
    };

    // Session stats
    const totalQueries = historyLog.length;
    const highCount = historyLog.filter(
        (h) => h.data.confidence === "high"
    ).length;
    const accuracy =
        totalQueries > 0 ? Math.round((highCount / totalQueries) * 100) : 0;
    const lastQuery =
        historyLog.length > 0 ? historyLog[historyLog.length - 1].q : "—";

    return (
        <>
            <button
                onClick={toggle}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-40 w-6 h-16 bg-[#0a0a0a] hover:bg-[#111111] border border-[#262626] border-r-0 rounded-l-xl flex items-center justify-center transition-all cursor-pointer group"
                style={{ right: open ? "320px" : "0px", transition: "right 300ms ease" }}
                title={open ? "Close panel" : "Document Report"}
            >
                <span className="text-[#525252] text-xs font-bold group-hover:text-white transition-colors">
                    {open ? "»" : "«"}
                </span>
            </button>

            <aside
                className="fixed top-0 right-0 h-full w-80 bg-[#0a0a0a] border-l border-[#262626] flex flex-col z-30 shadow-none pointer-events-auto"
                style={{
                    transform: open ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 300ms ease",
                }}
            >
                <div className="px-6 py-10 border-b border-[#262626]">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-bold text-[13px] tracking-brutal uppercase text-white">
                            REPORT
                        </h2>
                        <button
                            onClick={toggle}
                            className="p-1 hover:bg-white/5 rounded-full text-[#525252] hover:text-white transition-colors cursor-pointer"
                        >
                            <span className="material-symbols-rounded text-lg">close</span>
                        </button>
                    </div>
                    <p className="text-[11px] text-[#8a8a8a] font-bold uppercase tracking-widest">
                        {docCount} DOCS INDEXED · {chunkCount} CHUNKS
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10 custom-scrollbar">
                    {selectedDocContent ? (
                        <div className="space-y-10 animate-in fade-in slide-in-from-right duration-300">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 bg-[#111111] p-3 border border-[#262626] rounded-xl">
                                    <span className="material-symbols-rounded text-base text-white opacity-50">
                                        {selectedDocName ? getDocIcon(selectedDocName) : "draft"}
                                    </span>
                                    <span className="text-[12px] text-white truncate flex-1 font-bold uppercase tracking-widest">
                                        {selectedDocName}
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-brutal">
                                        AI DOCUMENT SUMMARY
                                    </p>
                                    <div className="bg-[#050505] border border-[#262626] rounded-xl p-6 min-h-[400px] shadow-inner">
                                        <div className="text-[14px] text-white/90 leading-relaxed whitespace-pre-wrap font-sans">
                                            {selectedDocContent}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => onViewDoc?.(null)}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all cursor-pointer rounded-xl"
                            >
                                <span className="material-symbols-rounded text-base">arrow_back</span>
                                BACK TO INDEX
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <p className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-brutal">
                                    INDEXED FILES
                                </p>
                                {documents.map((doc) => (
                                    <div
                                        key={doc}
                                        className={`p-4 bg-[#111111] border ${activeDocument === doc ? "border-white" : "border-[#262626]"} hover:border-[#404040] transition-all rounded-xl relative overflow-hidden group/item`}
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="material-symbols-rounded text-base text-white opacity-50">
                                                {getDocIcon(doc)}
                                            </span>
                                            <span className="text-[12px] text-white truncate flex-1 font-bold uppercase tracking-widest">
                                                {doc}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onViewDoc?.(doc)}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-white bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all cursor-pointer rounded-lg shadow-lg shadow-white/5"
                                            >
                                                SUMMARY
                                            </button>
                                            <button
                                                onClick={() =>
                                                    onSummarize(
                                                        `Detailed analysis of ${doc}`
                                                    )
                                                }
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#262626] bg-transparent text-[10px] text-[#d4d4d4] font-bold uppercase tracking-widest hover:border-white hover:text-white transition-all cursor-pointer rounded-lg"
                                            >
                                                ANALYZE
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <p className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-brutal">
                                    SESSION STATS
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { val: docCount, label: "DOCUMENTS" },
                                        { val: chunkCount.toLocaleString(), label: "CHUNKS" },
                                        { val: totalQueries, label: "QUERIES" },
                                        { val: `${accuracy}%`, label: "ACCURACY" },
                                    ].map((stat) => (
                                        <div key={stat.label} className="p-4 bg-[#111111] border border-[#262626] rounded-xl">
                                            <p className="text-base font-bold text-white mb-1">{stat.val}</p>
                                            <p className="text-[10px] text-[#8a8a8a] font-bold uppercase tracking-widest">
                                                {stat.label}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {totalQueries > 0 && (
                                    <div className="p-4 bg-[#111111] border border-[#262626] rounded-xl">
                                        <p className="text-[10px] text-[#8a8a8a] font-bold uppercase tracking-widest mb-2">
                                            LAST QUERY
                                        </p>
                                        <p className="text-[12px] text-white leading-relaxed tracking-widest font-light line-clamp-3">
                                            {lastQuery}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}
