"use client";

import { useRef, useCallback, useEffect } from "react";

interface InputAreaProps {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    disabled?: boolean;
}

export default function InputArea({
    value,
    onChange,
    onSend,
    disabled,
}: InputAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }, []);

    useEffect(() => {
        autoResize();
    }, [value, autoResize]);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            onSend();
        }
    };

    return (
        <div className="px-8 pb-8 pt-4 z-10 relative shrink-0">
            <div className="max-w-4xl mx-auto">
                <div className="bg-card-dark border border-white/10 rounded-2xl p-2.5 shadow-2xl transition-all duration-300 focus-within:border-primary/50 focus-within:glow-ring glass">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            placeholder="Type your question here..."
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-4 resize-none max-h-40 placeholder-slate-600 text-slate-100 outline-none leading-relaxed"
                        />
                        <div className="pb-1.5 pr-1.5 shrink-0 flex items-center gap-2">
                            <button className="p-2 text-slate-500 hover:text-primary transition-colors cursor-pointer">
                                <span className="material-symbols-rounded text-xl">mic</span>
                            </button>
                            <button
                                onClick={onSend}
                                disabled={disabled || !value.trim()}
                                className="w-11 h-11 bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:cursor-not-allowed text-black rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/30 cursor-pointer"
                            >
                                <span className="material-symbols-rounded text-2xl font-bold">
                                    arrow_upward
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                <p className="text-center mt-3 text-[10px] text-slate-700 font-medium">
                    ↵ Send &nbsp;·&nbsp; Shift+↵ Newline &nbsp;·&nbsp; Answers grounded
                    in local indexed context
                </p>
            </div>
        </div>
    );
}
