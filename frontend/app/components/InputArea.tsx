"use client";

import { useRef, useCallback, useEffect, useState } from "react";

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
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);
    const valueRef = useRef(value);

    // Keep valueRef updated for the speech recognition callback
    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                // Set to false to avoid frequent 'network' errors in some browsers
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = "en-US";

                recognition.onstart = () => {
                    console.log("MIC START");
                    setIsRecording(true);
                };

                recognition.onend = () => {
                    console.log("MIC END");
                    setIsRecording(false);
                };

                recognition.onerror = (event: any) => {
                    console.error("MIC ERROR", event.error);
                    if (event.error === 'not-allowed') {
                        alert("Microphone permission denied. Please allow microphone access in your browser settings.");
                    } else if (event.error === 'network') {
                        alert("Speech recognition network error. This is a browser-level issue (usually with Google's speech service). Try refreshing or using a different browser like Chrome.");
                    }
                    setIsRecording(false);
                };

                recognition.onresult = (event: any) => {
                    const transcript = event.results[event.results.length - 1][0].transcript;
                    if (transcript) {
                        const currentVal = valueRef.current;
                        const newValue = currentVal.trim() ? `${currentVal.trim()} ${transcript}` : transcript;
                        onChange(newValue);
                    }
                };

                recognitionRef.current = recognition;
            }
        }

        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
        };
    }, []);

    const toggleVoice = useCallback(() => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    }, [isRecording]);

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
                            <button
                                onClick={toggleVoice}
                                className={`p-2 transition-colors cursor-pointer border border-transparent rounded-full flex items-center justify-center ${isRecording
                                    ? "text-red-500 bg-red-500/10 border-red-500/20"
                                    : "text-[#525252] hover:text-white hover:border-[#262626]"
                                    }`}
                                title={isRecording ? "Stop Recording" : "Start Voice Input"}
                            >
                                <span className={`material-symbols-rounded text-lg ${isRecording ? "animate-pulse" : ""}`}>
                                    {isRecording ? "stop_circle" : "mic"}
                                </span>
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
