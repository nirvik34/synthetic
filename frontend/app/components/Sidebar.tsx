"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchHealth, fetchDocuments, uploadFile, postIngest } from "../lib/api";

interface SelectedFile {
    file: File;
    status: "pending" | "uploading" | "done" | "error";
}

interface SidebarProps {
    onSetQuestion: (q: string) => void;
    onViewDoc?: (docName: string) => void;
    onDataChange?: () => void;
    history?: string[];
}

export default function Sidebar({ onSetQuestion, onViewDoc, onDataChange, history }: SidebarProps) {
    const [statusOnline, setStatusOnline] = useState(false);
    const [statusText, setStatusText] = useState("checking...");
    const [chunkCount, setChunkCount] = useState(0);
    const [documents, setDocuments] = useState<string[]>([]);
    const [docCount, setDocCount] = useState(0);
    const [toastMsg, setToastMsg] = useState<{
        msg: string;
        type: "success" | "warn" | "error";
    } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // File upload state
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (doc.endsWith(".pdf")) return "text-white opacity-80";
        if (doc.endsWith(".md")) return "text-white opacity-60";
        return "text-white opacity-40";
    };

    const filterMatch = (text: string) =>
        !searchQuery || text.toLowerCase().includes(searchQuery.toLowerCase());

    // ── File upload logic ─────────────────────────────────────────────────
    const ALLOWED_EXT = [".txt", ".md", ".pdf"];

    const addFiles = (files: FileList | File[]) => {
        const arr = Array.from(files).filter((f) => {
            const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
            return ALLOWED_EXT.includes(ext);
        });
        if (arr.length === 0) {
            showToast("ONLY .TXT, .MD, .PDF SUPPORTED", "warn");
            return;
        }
        setSelectedFiles((prev) => [
            ...prev,
            ...arr.map((file) => ({ file, status: "pending" as const })),
        ]);
    };

    const removeFile = (idx: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleUploadAndIndex = async () => {
        if (selectedFiles.length === 0) return;
        setIsUploading(true);
        setUploadProgress(0);

        let successCount = 0;
        const updated = [...selectedFiles];
        const totalFiles = updated.filter(f => f.status === "pending").length;
        let processedCount = 0;

        for (let i = 0; i < updated.length; i++) {
            if (updated[i].status !== "pending") continue;
            updated[i] = { ...updated[i], status: "uploading" };
            setSelectedFiles([...updated]);

            try {
                await uploadFile(updated[i].file);
                updated[i] = { ...updated[i], status: "done" };
                successCount++;
            } catch {
                updated[i] = { ...updated[i], status: "error" };
            }
            processedCount++;
            setUploadProgress(Math.round((processedCount / totalFiles) * 100));
            setSelectedFiles([...updated]);
        }

        if (successCount > 0) {
            try {
                await postIngest();
                showToast(
                    `✓ ${successCount} FILE${successCount > 1 ? "S" : ""} INDEXED`,
                    "success"
                );
                checkHealth();
                onDataChange?.();
                setTimeout(() => setSelectedFiles([]), 2000);
            } catch (e) {
                showToast(
                    e instanceof Error ? e.message : "INDEXING FAILED",
                    "error"
                );
            }
        } else {
            showToast("UPLOADS FAILED", "error");
        }

        setIsUploading(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    };

    return (
        <>
            <aside className="w-80 flex-shrink-0 bg-sidebar-dark border-r border-[#262626] flex flex-col p-6 overflow-hidden">
                {/* Logo */}
                <div className="flex items-center justify-between mb-10 px-1">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-white/5">
                            <span className="material-symbols-rounded text-black text-xl">
                                bubble_chart
                            </span>
                        </div>
                        <div>
                            <h1 className="font-display font-bold text-sm leading-none tracking-tight uppercase">
                                DocuMind AI
                            </h1>
                            <div className="flex items-center gap-1.5 mt-2">
                                <div
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusOnline ? "bg-white" : "bg-[#525252]"
                                        }`}
                                />
                                <p
                                    className={`text-[10px] font-mono uppercase tracking-widest ${statusOnline ? "text-white" : "text-[#a3a3a3]"
                                        }`}
                                >
                                    {statusText}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-8">
                    <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-[#525252] text-lg">
                        search
                    </span>
                    <input
                        className="w-full bg-white/5 border border-[#262626] focus:border-white/40 focus:ring-0 rounded-xl pl-10 py-2.5 text-[12px] placeholder-[#8a8a8a] text-white transition-all outline-none tracking-wide"
                        placeholder="Search..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar">
                    {/* Indexed Documents */}
                    <div>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <span className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-brutal">
                                Documents
                            </span>
                            <span className="bg-white/10 text-white px-2 py-0.5 rounded-md text-[11px] font-bold border border-white/10">
                                {docCount}
                            </span>
                        </div>
                        <div id="indexed-docs-list" className="space-y-1">
                            {documents.length > 0 ? (
                                documents
                                    .filter((doc) => filterMatch(doc))
                                    .map((doc) => (
                                        <button
                                            key={doc}
                                            onClick={() => onViewDoc?.(doc)}
                                            className="preset-btn group rounded-xl"
                                        >
                                            <span
                                                className={`material-symbols-rounded text-base ${getDocColor(
                                                    doc
                                                )} shrink-0 opacity-70 group-hover:opacity-100 transition-opacity`}
                                            >
                                                {getDocIcon(doc)}
                                            </span>
                                            <span className="truncate flex-1 tracking-wider text-[13px]">{doc}</span>
                                        </button>
                                    ))
                            ) : (
                                <p className="text-[12px] text-[#8a8a8a] text-center py-4 border border-[#262626] border-dashed rounded-xl">
                                    No documents indexed
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Chat History */}
                    <div id="history-section" className="mt-6">
                        <p className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-brutal mb-4 px-1">
                            Chat History
                        </p>
                        <div id="history-list" className="space-y-2">
                            {history && history.length > 0 ? (
                                history.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => onSetQuestion(q)}
                                        className="nav-btn group rounded-xl"
                                    >
                                        <span className="material-symbols-rounded text-base text-[#525252] group-hover:text-white transition-opacity">
                                            history
                                        </span>
                                        <span className="truncate flex-1 tracking-wider text-[13px]">{q}</span>
                                    </button>
                                ))
                            ) : (
                                <p className="text-[10px] text-[#525252] text-center py-4 border border-[#262626] border-dashed rounded-xl">
                                    No chat history
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Bottom: File Upload Zone ─────────────────────────────────── */}
                <div className="mt-auto pt-8 border-t border-[#262626] space-y-4">
                    <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-[#262626] bg-[#0A0A0A]">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-rounded text-white text-sm">
                                database
                            </span>
                            <span className="text-[11px] font-mono text-[#8a8a8a] tracking-widest">
                                {chunkCount.toLocaleString()} CHUNKS
                            </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#262626]">V1.0.0</span>
                    </div>

                    {/* Drop zone */}
                    <div
                        className={`relative border border-dashed transition-all cursor-pointer rounded-2xl overflow-hidden ${dragOver
                            ? "border-white bg-white/10"
                            : "border-[#262626] hover:border-white/20 hover:bg-white/5"
                            }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".txt,.md,.pdf"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files) addFiles(e.target.files);
                                e.target.value = "";
                            }}
                        />
                        <div className="flex flex-col items-center gap-2 py-7 px-3">
                            <span
                                className={`material-symbols-rounded text-2xl transition-colors ${dragOver ? "text-white" : "text-[#525252]"
                                    }`}
                            >
                                cloud_upload
                            </span>
                            <p className="text-[10px] text-[#525252] text-center leading-tight tracking-wide">
                                Drop files or{" "}
                                <span className="text-white font-bold underline underline-offset-4 decoration-[#525252]">browse</span>
                            </p>
                        </div>
                    </div>

                    {/* Selected file list */}
                    {selectedFiles.length > 0 && (
                        <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                            {selectedFiles.map((sf, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 px-3 py-2.5 border border-[#262626] bg-white/5 text-[9px] rounded-xl tracking-wide"
                                >
                                    <span
                                        className={`material-symbols-rounded text-sm ${sf.status === "done"
                                            ? "text-white"
                                            : sf.status === "error"
                                                ? "text-red-400"
                                                : sf.status === "uploading"
                                                    ? "text-white spin"
                                                    : "text-[#525252]"
                                            }`}
                                    >
                                        {sf.status === "done"
                                            ? "check_circle"
                                            : sf.status === "error"
                                                ? "error"
                                                : sf.status === "uploading"
                                                    ? "sync"
                                                    : "draft"}
                                    </span>
                                    <span className="flex-1 truncate text-white">
                                        {sf.file.name}
                                    </span>
                                    {sf.status === "pending" && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFile(i);
                                            }}
                                            className="text-[#8a8a8a] hover:text-white transition-colors cursor-pointer"
                                        >
                                            <span className="material-symbols-rounded text-sm">close</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleUploadAndIndex}
                        disabled={selectedFiles.length === 0 || isUploading}
                        className="w-full relative overflow-hidden flex items-center justify-center gap-2 brutal-btn py-4 disabled:opacity-40 cursor-pointer text-[13px] shadow-2xl shadow-white/5 rounded-2xl group"
                    >
                        {isUploading && (
                            <div
                                className="absolute left-0 top-0 h-full bg-black/10 transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        )}
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            {isUploading ? (
                                <>
                                    <span className="material-symbols-rounded spin">sync</span>
                                    {uploadProgress}% UPLOADING...
                                </>
                            ) : (
                                <>
                                    UPLOAD & INDEX
                                    {selectedFiles.length > 0 && (
                                        <span className="ml-1 opacity-50 bg-black/20 px-1.5 py-0.5 rounded-lg text-[10px] group-hover:bg-black/30">
                                            {selectedFiles.length}
                                        </span>
                                    )}
                                </>
                            )}
                        </span>
                    </button>
                </div>
            </aside>

            {/* Toast */}
            {toastMsg && (
                <div
                    className={`fixed bottom-10 right-24 z-50 px-6 py-3 border fade-up shadow-none uppercase tracking-widest text-[9px] rounded-xl ${toastMsg.type === "success"
                        ? "bg-white text-black border-white"
                        : "bg-black text-white border-[#262626]"
                        }`}
                >
                    {toastMsg.msg}
                </div>
            )}
        </>
    );
}
