"use client";

interface MiniSidebarProps {
    onRefresh: () => void;
    onExport: () => void;
}

export default function MiniSidebar({ onRefresh, onExport }: MiniSidebarProps) {
    return (
        <aside className="w-16 border-l border-[#262626] bg-[#0A0A0A] flex flex-col items-center py-8 gap-4 shrink-0">
            <button
                onClick={onRefresh}
                title="Refresh status"
                className="w-10 h-10 rounded-xl bg-transparent border border-[#262626] flex items-center justify-center text-[#525252] hover:text-white hover:border-white transition-all cursor-pointer"
            >
                <span className="material-symbols-rounded text-lg">refresh</span>
            </button>
            <button
                onClick={() => window.open("http://localhost:8000/docs", "_blank")}
                title="API Documentation"
                className="w-10 h-10 rounded-xl bg-transparent border border-[#262626] flex items-center justify-center text-[#525252] hover:text-white hover:border-white transition-all cursor-pointer"
            >
                <span className="material-symbols-rounded text-lg">api</span>
            </button>
            <button
                onClick={onExport}
                title="Export chat"
                className="w-10 h-10 rounded-xl bg-transparent border border-[#262626] flex items-center justify-center text-[#525252] hover:text-white hover:border-white transition-all cursor-pointer"
            >
                <span className="material-symbols-rounded text-lg">download</span>
            </button>

            <div
                className="mt-auto w-10 h-10 border border-white rounded-xl flex items-center justify-center cursor-default"
                title="DocuMind AI"
            >
                <span className="text-[10px] font-bold text-white tracking-widest uppercase">
                    AI
                </span>
            </div>
        </aside>
    );
}
