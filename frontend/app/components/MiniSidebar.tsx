"use client";

interface MiniSidebarProps {
    onRefresh: () => void;
    onExport: () => void;
}

export default function MiniSidebar({ onRefresh, onExport }: MiniSidebarProps) {
    return (
        <aside className="w-16 border-l border-white/5 bg-sidebar-dark flex flex-col items-center py-6 gap-6 shrink-0">
            <button
                onClick={onRefresh}
                title="Refresh status"
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-primary transition-all cursor-pointer"
            >
                <span className="material-symbols-rounded text-xl">refresh</span>
            </button>
            <button
                onClick={() => window.open("http://localhost:8000/docs", "_blank")}
                title="API Documentation"
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-primary transition-all cursor-pointer"
            >
                <span className="material-symbols-rounded text-xl">api</span>
            </button>
            <button
                onClick={onExport}
                title="Export chat"
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-primary transition-all cursor-pointer"
            >
                <span className="material-symbols-rounded text-xl">download</span>
            </button>
            <div
                className="mt-auto w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-emerald-300 p-0.5 cursor-default"
                title="DocuMind AI"
            >
                <div className="w-full h-full rounded-full bg-sidebar-dark flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">AI</span>
                </div>
            </div>
        </aside>
    );
}
