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
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 z-10 shrink-0 glass">
            <div className="flex items-center gap-4">
                <span className="material-symbols-rounded text-slate-600">
                    chevron_right
                </span>
                <span className="text-sm font-medium text-slate-300">
                    Intelligent RAG Assistant
                </span>
                <div className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/25">
                    CPU-Optimized · FLAN-T5
                </div>
            </div>
            <div className="flex items-center gap-4">
                {/* Memory Toggle */}
                <button
                    onClick={onMemoryToggle}
                    className="flex items-center gap-2 group cursor-pointer"
                    title={
                        memoryEnabled
                            ? `Memory ON (${memoryCount} turns)`
                            : "Memory OFF"
                    }
                >
                    <span className="material-symbols-rounded text-lg text-slate-500 group-hover:text-primary transition-colors">
                        psychology
                    </span>
                    <div
                        className={`w-9 h-5 rounded-full relative transition-all duration-200 ${memoryEnabled
                                ? "bg-primary/30 border-primary/50"
                                : "bg-white/10 border-white/10"
                            } border`}
                    >
                        <div
                            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-200 shadow-sm ${memoryEnabled
                                    ? "left-[18px] bg-primary"
                                    : "left-0.5 bg-slate-500"
                                }`}
                        />
                    </div>
                    {memoryEnabled && memoryCount > 0 && (
                        <span className="text-[9px] font-mono text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-md">
                            {memoryCount}
                        </span>
                    )}
                </button>

                <div className="w-px h-6 bg-white/5" />

                {/* Top K */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">top_k</span>
                    <select
                        value={topK}
                        onChange={(e) => onTopKChange(parseInt(e.target.value))}
                        className="bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 px-2 py-1 outline-none focus:border-primary/40 cursor-pointer"
                    >
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                    </select>
                </div>

                <div className="w-px h-6 bg-white/5" />

                {/* Clear */}
                <button
                    onClick={onClear}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10 cursor-pointer"
                >
                    <span className="material-symbols-rounded">delete_sweep</span>
                </button>
            </div>
        </header>
    );
}
