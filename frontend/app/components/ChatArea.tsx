"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import type { ChatMessage } from "../lib/types";

function esc(s: string): string {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
}

/** Transform [1], [2] etc. in the answer into styled superscript footnotes */
function renderWithFootnotes(text: string): string {
    const escaped = esc(text);
    return escaped.replace(
        /\[(\d+)\]/g,
        '<sup class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[8px] font-bold ml-0.5 cursor-pointer hover:bg-primary/40 transition-colors align-super">$1</sup>'
    );
}

/** Highlight query terms in a snippet */
function highlightSnippet(snippet: string, query: string): string {
    if (!query) return esc(snippet);
    const escaped = esc(snippet);
    const words = query
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (words.length === 0) return escaped;
    const regex = new RegExp(`(${words.join("|")})`, "gi");
    return escaped.replace(
        regex,
        '<mark class="bg-primary/25 text-primary px-0.5 rounded-sm">$1</mark>'
    );
}

interface SourcesDropdownProps {
    sources: { document: string; snippet: string; score: number }[];
    query?: string;
}

function SourcesDropdown({ sources, query }: SourcesDropdownProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-t border-white/5 mt-2">
            <button
                onClick={() => setOpen(!open)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors group text-left outline-none cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-base text-primary/50 group-hover:text-primary transition-colors">
                        description
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                        Sources ({sources.length})
                    </span>
                </div>
                <span className="material-symbols-rounded text-slate-500 group-hover:text-primary transition-colors">
                    {open ? "expand_less" : "expand_more"}
                </span>
            </button>
            {open && (
                <div className="px-6 pb-6 pt-2 space-y-2">
                    <div className="grid grid-cols-1 gap-2">
                        {sources.map((s, i) => (
                            <div
                                key={i}
                                className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group/card"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="text-[10px] text-primary font-mono truncate">
                                            {s.document}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {/* Score bar */}
                                        <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${s.score > 0.7
                                                        ? "bg-primary"
                                                        : s.score > 0.4
                                                            ? "bg-yellow-400"
                                                            : "bg-red-400"
                                                    }`}
                                                style={{ width: `${Math.min(s.score * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/60 font-mono">
                                            {(s.score * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                                <p
                                    className="text-[11px] text-slate-400 leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: highlightSnippet(s.snippet, query || ""),
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

interface FollowUpChipsProps {
    suggestions: string[];
    onSelect: (q: string) => void;
}

function FollowUpChips({ suggestions, onSelect }: FollowUpChipsProps) {
    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mt-3 ml-1">
            {suggestions.map((q, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(q)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] text-slate-400 hover:bg-primary/[0.08] hover:border-primary/25 hover:text-primary transition-all cursor-pointer group"
                >
                    <span className="material-symbols-rounded text-sm opacity-50 group-hover:opacity-100 transition-opacity">
                        arrow_forward
                    </span>
                    {q}
                </button>
            ))}
        </div>
    );
}

interface ChatAreaProps {
    messages: ChatMessage[];
    onFollowUp: (q: string) => void;
}

export default function ChatArea({ messages, onFollowUp }: ChatAreaProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Find the last bot message's question for highlighting
    const lastQuery = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].type === "user") return messages[i].text || "";
        }
        return "";
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-8 py-8 space-y-8 z-10 relative custom-scrollbar"
            >
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 glow">
                        <span className="material-symbols-rounded text-primary text-5xl">
                            neurology
                        </span>
                    </div>
                    <h2 className="text-3xl font-display font-bold mb-4 tracking-tight">
                        How can I help you today?
                    </h2>
                    <p className="text-slate-500 text-sm max-w-md leading-relaxed mb-12">
                        Upload documents to index them into the local vector store. I&apos;ll
                        provide precise answers with verified citations and zero
                        hallucination.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                        {[
                            {
                                icon: "auto_awesome",
                                title: "Summarize",
                                desc: "Extract key insights from long PDF/text reports.",
                            },
                            {
                                icon: "gavel",
                                title: "Analyze",
                                desc: "Detect risk factors and governing law in contracts.",
                            },
                            {
                                icon: "security",
                                title: "Secure",
                                desc: "100% local processing. No data ever leaves this machine.",
                            },
                        ].map((card) => (
                            <div
                                key={card.title}
                                className="p-6 rounded-2xl bg-white/5 border border-white/5 glass-card text-left hover:border-primary/20 transition-all"
                            >
                                <span className="material-symbols-rounded text-primary mb-3 bg-primary/10 p-2 rounded-xl inline-block">
                                    {card.icon}
                                </span>
                                <p className="font-bold text-sm mb-1 text-slate-200">
                                    {card.title}
                                </p>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    {card.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-8 py-8 space-y-8 z-10 relative custom-scrollbar"
        >
            {messages.map((msg, msgIdx) => {
                if (msg.type === "user") {
                    return (
                        <div key={msg.id} className="flex justify-end fade-up">
                            <div
                                className="max-w-xl px-6 py-4 rounded-3xl rounded-tr-sm bg-primary/10 border border-primary/20 text-sm text-slate-100 shadow-lg"
                                dangerouslySetInnerHTML={{ __html: esc(msg.text || "") }}
                            />
                        </div>
                    );
                }

                if (msg.type === "thinking") {
                    return (
                        <div key={msg.id} className="flex items-center gap-4 fade-up">
                            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                                <span className="material-symbols-rounded text-primary text-xl">
                                    neurology
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 px-6 py-4 bg-white/5 border border-white/5 rounded-3xl rounded-tl-sm glass">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary dot1" />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary dot2" />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary dot3" />
                            </div>
                        </div>
                    );
                }

                if (msg.type === "error") {
                    return (
                        <div key={msg.id} className="flex gap-4 fade-up">
                            <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center shrink-0">
                                <span className="material-symbols-rounded text-red-400">
                                    error
                                </span>
                            </div>
                            <div className="px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-3xl rounded-tl-sm text-xs text-red-300 font-mono max-w-lg shadow-lg">
                                {esc(msg.text || "")}
                            </div>
                        </div>
                    );
                }

                if (msg.type === "bot" && msg.data) {
                    const isNF = msg.data.answer
                        .toLowerCase()
                        .includes("could not find");

                    // Find the user question for this bot response (previous user message)
                    let queryForHighlight = lastQuery;
                    for (let j = msgIdx - 1; j >= 0; j--) {
                        if (messages[j].type === "user") {
                            queryForHighlight = messages[j].text || "";
                            break;
                        }
                    }

                    const isLastBot =
                        msgIdx ===
                        messages.length - 1 ||
                        !messages.slice(msgIdx + 1).some((m) => m.type === "bot");

                    return (
                        <div key={msg.id} className="flex gap-4 fade-up items-start">
                            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 mt-6 shadow-lg shadow-primary/10">
                                <span className="material-symbols-rounded text-primary text-xl">
                                    neurology
                                </span>
                            </div>
                            <div className="flex-1 max-w-3xl">
                                <div className="flex items-center gap-3 mb-2 ml-1">
                                    <span className="text-xs font-bold text-slate-400">
                                        DocuMind AI
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-tighter badge-${msg.data.confidence}`}
                                    >
                                        {msg.data.confidence.toUpperCase()}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-mono ml-auto">
                                        {msg.ms}ms
                                    </span>
                                </div>
                                <div className="bg-white/5 border border-white/5 rounded-3xl rounded-tl-sm overflow-hidden glass shadow-2xl">
                                    <div
                                        className={`px-6 py-5 text-sm leading-relaxed ${isNF ? "text-slate-500 italic" : "text-slate-200"
                                            }`}
                                        dangerouslySetInnerHTML={{
                                            __html: renderWithFootnotes(msg.data.answer),
                                        }}
                                    />
                                    {msg.data.sources && msg.data.sources.length > 0 && (
                                        <SourcesDropdown
                                            sources={msg.data.sources}
                                            query={queryForHighlight}
                                        />
                                    )}
                                </div>

                                {/* Follow-up suggestions — only on the last bot message */}
                                {isLastBot && msg.data.follow_ups && (
                                    <FollowUpChips
                                        suggestions={msg.data.follow_ups}
                                        onSelect={onFollowUp}
                                    />
                                )}
                            </div>
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
}
