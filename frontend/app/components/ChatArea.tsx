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

/** Transform [1], [2] etc. in the answer into styled monochrome footnotes */
function renderWithFootnotes(text: string): string {
    const escaped = esc(text);
    return escaped.replace(
        /\[(\d+)\]/g,
        '<sup class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-black text-[10px] font-bold ml-1 cursor-pointer align-super" data-citation="$1">$1</sup>'
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
        '<mark class="bg-white text-black px-0.5">$1</mark>'
    );
}

interface SourcesDropdownProps {
    sources: { document: string; snippet: string; score: number }[];
    query?: string;
}

function SourcesDropdown({ sources, query }: SourcesDropdownProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-t border-[#262626] mt-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors group text-left outline-none cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    <span className="material-symbols-rounded text-lg text-[#525252] group-hover:text-white transition-colors">
                        description
                    </span>
                    <span className="text-[11px] text-[#8a8a8a] font-bold uppercase tracking-brutal group-hover:text-white transition-colors">
                        Sources [{sources.length}]
                    </span>
                </div>
                <span className="material-symbols-rounded text-white">
                    {open ? "expand_less" : "expand_more"}
                </span>
            </button>
            {open && (
                <div className="px-6 pb-6 pt-2 space-y-4">
                    <div className="space-y-2">
                        {sources.map((s, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-xl bg-[#111111] border border-[#262626] hover:border-[#404040] transition-all"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-black text-[9px] font-bold shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="text-[10px] text-white font-bold uppercase tracking-widest truncate">
                                            {s.document}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-20 h-1 bg-[#262626]">
                                            <div
                                                className="h-full bg-white transition-all"
                                                style={{ width: `${Math.min(s.score * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-mono text-[#525252]">
                                            {Math.round(s.score * 100)}%
                                        </span>
                                    </div>
                                </div>
                                <p
                                    className="text-[13px] text-[#d4d4d4] leading-relaxed font-light"
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
        <div className="flex flex-wrap gap-2 mt-4 ml-1">
            {suggestions.map((q, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(q)}
                    className="px-3 py-2 border border-[#262626] bg-[#111111] text-[11px] text-[#d4d4d4] hover:text-white hover:border-white transition-all cursor-pointer uppercase tracking-widest rounded-full"
                >
                    {q}
                </button>
            ))}
        </div>
    );
}

interface ChatAreaProps {
    messages: ChatMessage[];
    onFollowUp: (q: string) => void;
    onCitationClick?: (index: number, msgId: string) => void;
}

export default function ChatArea({ messages, onFollowUp, onCitationClick }: ChatAreaProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleChatClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "SUP" && target.hasAttribute("data-citation")) {
            const index = parseInt(target.getAttribute("data-citation") || "0", 10);
            const bubble = target.closest("[data-msg-id]");
            if (bubble) {
                const msgId = bubble.getAttribute("data-msg-id") || "";
                onCitationClick?.(index, msgId);
            }
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

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
                className="flex-1 overflow-y-auto px-8 py-8 z-10 relative custom-scrollbar bg-transparent"
            >
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <h2 className="text-5xl font-extrabold mb-8 tracking-tighter text-white drop-shadow-2xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        How can I help you today?
                    </h2>
                    <p className="text-[#8a8a8a] text-[12px] max-w-sm leading-relaxed mb-12 uppercase tracking-widest font-bold">
                        Upload documents to index. Precise answers. Verified citations. Zero hallucination.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
                        {[
                            {
                                icon: "auto_awesome",
                                title: "Summarize",
                                desc: "Extract key insights from long reports.",
                            },
                            {
                                icon: "gavel",
                                title: "Analyze",
                                desc: "Detect risk factors in legal contracts.",
                            },
                            {
                                icon: "security",
                                title: "Secure",
                                desc: "100% local processing. No data leaves.",
                            },
                        ].map((card) => (
                            <div
                                key={card.title}
                                className="p-6 border border-[#262626] bg-[#111111] text-left hover:border-white transition-all rounded-2xl"
                            >
                                <span className="material-symbols-rounded text-white mb-4 block">
                                    {card.icon}
                                </span>
                                <p className="font-bold text-[12px] mb-2 text-white uppercase tracking-widest">
                                    {card.title}
                                </p>
                                <p className="text-[11px] text-[#8a8a8a] leading-relaxed uppercase tracking-widest">
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
            id="chat-area"
            ref={scrollRef}
            onClick={handleChatClick}
            className="flex-1 overflow-y-auto px-8 py-10 space-y-12 z-10 relative custom-scrollbar bg-transparent"
        >
            {messages.map((msg, msgIdx) => {
                if (msg.type === "user") {
                    return (
                        <div key={msg.id} className="flex justify-end fade-up">
                            <div
                                className="max-w-xl px-6 py-4 border border-white bg-[#111111] text-[14px] font-light text-white leading-relaxed rounded-2xl rounded-tr-none"
                                dangerouslySetInnerHTML={{ __html: esc(msg.text || "") }}
                            />
                        </div>
                    );
                }

                if (msg.type === "thinking") {
                    return (
                        <div key={msg.id} className="flex items-start gap-5 fade-up">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shrink-0">
                                <span className="material-symbols-rounded text-black text-lg">
                                    neurology
                                </span>
                            </div>
                            <div className="flex items-center gap-2 px-6 py-4 bg-[#0A0A0A] border border-[#262626] rounded-2xl">
                                <span className="w-1 h-1 bg-white dot1" />
                                <span className="w-1 h-1 bg-white dot2" />
                                <span className="w-1 h-1 bg-white dot3" />
                            </div>
                        </div>
                    );
                }

                if (msg.type === "error") {
                    return (
                        <div key={msg.id} className="flex gap-5 fade-up">
                            <div className="w-8 h-8 bg-[#262626] rounded-full flex items-center justify-center shrink-0">
                                <span className="material-symbols-rounded text-white text-lg">
                                    error
                                </span>
                            </div>
                            <div className="px-6 py-4 bg-[#111111] border border-[#262626] text-[12px] text-[#d4d4d4] font-mono tracking-widest uppercase shadow-none rounded-2xl">
                                {esc(msg.text || "")}
                            </div>
                        </div>
                    );
                }

                if (msg.type === "bot" && msg.data) {
                    const isNF = msg.data.answer.toLowerCase().includes("could not find");

                    let queryForHighlight = lastQuery;
                    for (let j = msgIdx - 1; j >= 0; j--) {
                        if (messages[j].type === "user") {
                            queryForHighlight = messages[j].text || "";
                            break;
                        }
                    }

                    const isLastBot =
                        msgIdx === messages.length - 1 ||
                        !messages.slice(msgIdx + 1).some((m) => m.type === "bot");

                    return (
                        <div key={msg.id} data-msg-id={msg.id} className="flex gap-5 fade-up items-start">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shrink-0 mt-8">
                                <span className="material-symbols-rounded text-black text-lg">
                                    neurology
                                </span>
                            </div>
                            <div className="flex-1 max-w-4xl">
                                <div className="flex items-center gap-4 mb-3 ml-1">
                                    <span className="text-[12px] font-bold text-white uppercase tracking-brutal">
                                        DocuMind AI
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase badge-${msg.data.confidence}`}
                                    >
                                        {msg.data.confidence}
                                    </span>
                                    <span className="text-[11px] text-[#525252] font-mono ml-auto">
                                        {msg.ms}ms
                                    </span>
                                </div>
                                <div className="bg-[#0A0A0A] border border-[#262626] overflow-hidden rounded-2xl">
                                    <div
                                        className={`px-6 py-6 text-[14px] leading-relaxed font-light ${isNF ? "text-[#8a8a8a] italic" : "text-white"
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
