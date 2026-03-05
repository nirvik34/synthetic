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
        <div className="px-8 pb-8 pt-6 z-10 relative shrink-0 bg-transparent">
            <div className="max-w-4xl mx-auto">
                <div className="bg-[#0A0A0A] border border-[#262626] rounded-2xl p-2 shadow-none transition-all focus-within:border-white">
                    <div className="flex items-end gap-3">
                        <textarea
                            id="q-input"
                            ref={textareaRef}
                            rows={1}
                            placeholder="ASK A QUESTION..."
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] py-4 px-4 resize-none max-h-40 placeholder-[#8a8a8a] text-white outline-none leading-relaxed tracking-widest font-light"
                        />
                        <div className="pb-2 pr-2 shrink-0 flex items-center gap-3">
                            <button className="p-2 text-[#525252] hover:text-white transition-colors cursor-pointer border border-transparent hover:border-[#262626] rounded-full">
                                <span className="material-symbols-rounded text-lg">mic</span>
                            </button>
                            <button
                                id="send-btn"
                                onClick={onSend}
                                disabled={disabled || !value.trim()}
                                className="w-11 h-11 brutal-btn flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer shadow-none rounded-full"
                            >
                                <span className="material-symbols-rounded text-xl">
                                    arrow_upward
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                <p className="text-center mt-4 text-[11px] text-[#8a8a8a] font-bold uppercase tracking-brutal">
                    ENTER: SEND &nbsp;·&nbsp; SHIFT+ENTER: NEWLINE &nbsp;·&nbsp; LOCAL GROUNDING
                </p>
            </div>
        </div>
    );
}
