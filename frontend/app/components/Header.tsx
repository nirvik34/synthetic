"use client";

interface HeaderProps {
    topK: number;
    onTopKChange: (val: number) => void;
    onClear: () => void;
    memoryEnabled: boolean;
    onMemoryToggle: () => void;
    memoryCount: number;
}

export default function Header({
    topK,
    onTopKChange,
    onClear,
    memoryEnabled,
    onMemoryToggle,
    memoryCount,
}: HeaderProps) {
    return (
        <header className="h-16 flex-shrink-0 border-b border-[#262626] flex items-center justify-between px-8 bg-transparent z-20">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-white text-xl">
                        neurology
                    </span>
                    <span className="text-[10px] font-bold text-white tracking-brutal uppercase">
                        Brain
                    </span>
                </div>

                {/* Memory Toggle */}
                <div className="flex items-center gap-3 border-l border-[#262626] pl-6">
                    <button
                        onClick={onMemoryToggle}
                        className={`flex items-center gap-2 px-3 py-1.5 transition-all cursor-pointer border rounded-full ${memoryEnabled
                            ? "bg-white text-black border-white"
                            : "bg-transparent text-[#525252] border-[#262626]"
                            }`}
                    >
                        <span className="material-symbols-rounded text-sm">
                            {memoryEnabled ? "psychology" : "psychology_alt"}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-widest">
                            Memory {memoryEnabled ? "ON" : "OFF"}
                        </span>
                    </button>
                    {memoryEnabled && memoryCount > 0 && (
                        <span className="text-[9px] font-mono text-[#525252] uppercase tracking-widest">
                            [{memoryCount} TURNS]
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Model Specs */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-[#262626] bg-white/5 rounded-full">
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">
                        CPU-OPTIMIZED · FLAN-T5
                    </span>
                </div>

                <div className="h-8 w-[1px] bg-[#262626]" />

                {/* Top-K Selector */}
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-[#525252] uppercase tracking-widest">
                        Context:
                    </span>
                    <div className="flex border border-[#262626] rounded-full overflow-hidden">
                        {[3, 5, 10].map((k) => (
                            <button
                                key={k}
                                onClick={() => onTopKChange(k)}
                                className={`px-3 py-1 text-[10px] font-bold transition-all cursor-pointer ${topK === k
                                    ? "bg-white text-black"
                                    : "text-[#525252] hover:bg-white/5"
                                    }`}
                            >
                                {k}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Clear Button */}
                <button
                    onClick={onClear}
                    className="ml-4 p-2 text-[#525252] hover:text-white transition-colors cursor-pointer border border-transparent hover:border-[#262626] rounded-full"
                    title="Clear Conversation"
                >
                    <span className="material-symbols-rounded text-xl">delete_sweep</span>
                </button>
            </div>
        </header>
    );
}
