'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// --- Utility: Scroll Reveal Hook ---
function useReveal() {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            },
            { threshold: 0.1 }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, []);

    return ref;
}

// --- Atomic Components ---

const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) => {
    const ref = useReveal();
    return (
        <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
            {children}
        </div>
    );
};

const Button = ({
    children,
    variant = 'primary',
    className = "",
    as = 'button',
    href = '#',
    ...props
}: any) => {
    const baseStyles = "px-6 py-2 text-sm font-medium transition-all duration-300 border border-transparent inline-flex items-center justify-center";
    const variants: any = {
        primary: "bg-white text-black hover:invert",
        ghost: "border-border bg-transparent text-white hover:bg-neutral-900 border-[#1f1f1f]",
        white: "bg-white text-black hover:invert",
    };

    const combinedClassName = `${baseStyles} ${variants[variant]} ${className}`;

    if (as === 'link') {
        return <Link href={href} className={combinedClassName}>{children}</Link>;
    }

    return (
        <button className={combinedClassName} {...props}>
            {children}
        </button>
    );
};

const Badge = ({ children, status = 'success' }: { children: React.ReactNode, status?: 'success' | 'blocked' }) => {
    const styles = status === 'success'
        ? "border-emerald-900 text-emerald-500"
        : "border-neutral-700 text-neutral-500";
    return (
        <span className={`border text-[10px] px-2 py-0.5 uppercase tracking-tight ${styles}`}>
            {children}
        </span>
    );
};

// --- Page Component ---

export default function LandingPage() {
    const [copied, setCopied] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="min-h-screen bg-background text-white selection:bg-white selection:text-black">

            {/* 1. NAVBAR */}
            <nav className="fixed top-0 w-full h-16 z-50 bg-background border-b border-border flex items-center px-6 md:px-12 justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-white rotate-45 flex-shrink-0"></div>
                    <span className="font-medium tracking-tight text-lg">DocuMind AI</span>
                </div>

                <div className="hidden md:flex items-center space-x-8">
                    <a href="#hero" className="text-sm text-neutral-400 hover:text-white transition-colors">Product</a>
                    <a href="#demo" className="text-sm text-neutral-400 hover:text-white transition-colors">Chat</a>
                    <a href="#how-it-works" className="text-sm text-neutral-400 hover:text-white transition-colors">Docs</a>
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-400 hover:text-white transition-colors">GitHub</a>
                </div>

                <Button variant="white" as="link" href="/chat" className="px-5">Get Started</Button>
            </nav>

            <main>
                {/* HERO SECTION */}
                <section id="hero" className="pt-32 pb-24 border-b border-border dot-grid" style={{ backgroundImage: 'radial-gradient(#1f1f1f 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                    <div className="container mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-16 items-center">
                        <Reveal>
                            <div className="flex items-center space-x-2 mb-8">
                                <div className="w-2 h-2 bg-neutral-400"></div>
                                <span className="text-[10px] uppercase tracking-widest text-neutral-500">Vision v2.0</span>
                            </div>

                            <h1 className="text-6xl md:text-7xl font-light tracking-tighter leading-[1.1] mb-8">
                                Ask anything. Get answers from your documents. <br />
                                <span className="text-neutral-500">Instantly.</span>
                            </h1>

                            <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-lg mb-12">
                                DocuMind indexes your PDFs, contracts, and research papers into a local vector store. No cloud. No hallucination. Precise answers with citations.
                            </p>

                            <div className="flex flex-wrap gap-4 mb-10">
                                <Button as="link" href="/chat" className="px-10 py-4 h-auto">Start for Free</Button>
                                <Button variant="ghost" className="px-10 py-4 h-auto">View on GitHub →</Button>
                            </div>

                            <p className="text-neutral-500 text-sm font-mono tracking-wide">
                                100% local · No API key needed · Open source
                            </p>
                        </Reveal>

                        <Reveal delay={200}>
                            <div className="bg-neutral-900/30 border border-border p-1">
                                <div className="bg-black border border-border p-6 font-mono text-sm overflow-hidden">
                                    <div className="flex space-x-1.5 mb-6">
                                        <div className="w-3 h-3 bg-neutral-800 rounded-full"></div>
                                        <div className="w-3 h-3 bg-neutral-800 rounded-full"></div>
                                        <div className="w-3 h-3 bg-neutral-800 rounded-full"></div>
                                        <span className="ml-2 text-neutral-600 text-xs">terminal — query_engine.py</span>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="text-neutral-500">
                                            <div className="mb-1"># Request</div>
                                            <div className="text-neutral-400">POST /ask</div>
                                            <div className="text-neutral-400">{`{ "question": "What are the termination conditions?" }`}</div>
                                        </div>

                                        <div className="text-emerald-500">
                                            <div className="mb-1"># Response (1.4s)</div>
                                            <div>{`{`}</div>
                                            <div className="pl-4">"answer": "Either party may terminate with 30 days...",</div>
                                            <div className="pl-4">"confidence": "high",</div>
                                            <div className="pl-4">"sources": [{`{ "document": "contract_v2.pdf", "score": 0.94 }`}],</div>
                                            <div className="pl-4">"follow_ups": ["What is the notice period?", ...]</div>
                                            <div>{`}`}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </section>

                {/* LOGO BAR */}
                <section className="py-12 border-b border-border">
                    <div className="container mx-auto px-6 md:px-12 flex flex-wrap items-center justify-between gap-8 opacity-50 grayscale">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Trusted by teams using</span>
                        <div className="flex flex-wrap gap-8 md:gap-12 items-center text-xl font-bold font-sans tracking-tighter">
                            <span>ChromaDB</span>
                            <span>HuggingFace</span>
                            <span>FastAPI</span>
                            <span>sentence-transformers</span>
                            <span>PyMuPDF</span>
                        </div>
                    </div>
                </section>

                {/* HOW IT WORKS */}
                <section id="how-it-works" className="py-24 border-b border-border">
                    <div className="container mx-auto px-6 md:px-12">
                        <Reveal className="mb-16">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-4">PROCESS</div>
                            <h2 className="text-4xl font-light tracking-tight">From document to answer in seconds</h2>
                        </Reveal>

                        <div className="grid md:grid-cols-3">
                            <Reveal className="pr-12 py-8 border-r border-[#1f1f1f] h-full">
                                <div className="font-mono text-neutral-500 text-sm mb-6">01 / INGEST</div>
                                <h3 className="text-xl mb-4">Connect your data</h3>
                                <p className="text-neutral-400 font-light leading-relaxed">
                                    Drop PDFs, text files, or markdown. Auto-chunked and embedded locally into ChromaDB.
                                </p>
                            </Reveal>

                            <Reveal className="px-12 py-8 border-r border-[#1f1f1f] h-full" delay={100}>
                                <div className="font-mono text-neutral-500 text-sm mb-6">02 / RETRIEVE</div>
                                <h3 className="text-xl mb-4">Two-Stage Search</h3>
                                <p className="text-neutral-400 font-light leading-relaxed">
                                    Bi-encoder shortlists candidates. Cross-encoder re-ranks for precision. Best context wins.
                                </p>
                            </Reveal>

                            <Reveal className="pl-12 py-8 h-full" delay={200}>
                                <div className="font-mono text-neutral-500 text-sm mb-6">03 / ANSWER</div>
                                <h3 className="text-xl mb-4">Verifiable Output</h3>
                                <p className="text-neutral-400 font-light leading-relaxed">
                                    flan-t5 generates answers grounded in chunks only. Every answer cites its source.
                                </p>
                            </Reveal>
                        </div>
                    </div>
                </section>

                {/* FEATURES GRID */}
                <section className="py-24 border-b border-border">
                    <div className="container mx-auto px-6 md:px-12">
                        <Reveal className="mb-16">
                            <h2 className="text-4xl font-light tracking-tight">Engineered for Accuracy.</h2>
                        </Reveal>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 border-t border-l border-[#1f1f1f]">
                            {[
                                { icon: 'security', title: 'Local First', body: 'Your data never leaves your machine. Runs fully on CPU, no cloud, no API key.' },
                                { icon: 'bolt', title: 'Sub-2s Response', body: 'Two-stage retrieval pipeline optimized for speed without sacrificing accuracy.' },
                                { icon: 'auto_awesome', title: 'Zero Hallucination', body: '3-layer guard blocks any answer not grounded in your indexed documents.' },
                                { icon: 'memory', title: 'Conversation Memory', body: 'Remembers last 3 exchanges. Ask follow-ups naturally without repeating context.' },
                                { icon: 'api', title: 'Clean REST API', body: 'FastAPI backend with Pydantic validation. POST /ask, POST /ingest, GET /health.' },
                                { icon: 'account_tree', title: 'Two-Stage Retrieval', body: 'MiniLM bi-encoder + ms-marco cross-encoder. Precision over recall, always.' },
                            ].map((feature, i) => (
                                <Reveal key={i} delay={i * 50} className="p-10 border-r border-b border-[#1f1f1f] hover:bg-neutral-900/20 transition-colors group">
                                    <span className="material-symbols-outlined text-neutral-400 text-4xl mb-6 group-hover:text-white transition-colors">{feature.icon}</span>
                                    <h4 className="text-xl mb-4">{feature.title}</h4>
                                    <p className="text-neutral-400 font-light leading-relaxed text-sm">{feature.body}</p>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* DEMO SECTION */}
                <section id="demo" className="border-b border-border">
                    <div className="flex flex-col md:flex-row min-h-[600px] border-t border-border">
                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col border-r border-[#1f1f1f]">
                            <div className="px-6 py-4 border-b border-border bg-neutral-900/50 flex justify-between items-center">
                                <span className="text-sm font-medium">Session: Legal Contract Review</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-neutral-500">LIVE // SECURE</span>
                                    <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse"></div>
                                </div>
                            </div>

                            <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-background/50">
                                <Reveal className="flex justify-end">
                                    <div className="bg-neutral-900 border border-border p-4 max-w-md text-sm">
                                        Who are the parties in this services agreement?
                                    </div>
                                </Reveal>

                                <Reveal className="flex justify-start">
                                    <div className="border border-border p-5 max-w-lg text-sm bg-neutral-900/10">
                                        <p className="leading-relaxed mb-6">
                                            Based on the contract, the parties are <span className="underline decoration-neutral-700 underline-offset-4">Northstar Logistics Inc.</span> as the [Provider] and <span className="underline decoration-neutral-700 underline-offset-4">TELCOSTAR PTE, LTD.</span>, a company organized under the laws of Singapore.
                                        </p>

                                        <div className="pt-4 border-t border-neutral-800 flex flex-wrap gap-2 mb-6">
                                            <span className="bg-neutral-900 px-2 py-1 text-[10px] font-mono text-neutral-500 border border-border">Doc #1 cuad_contract_3.txt</span>
                                            <span className="bg-neutral-900 px-2 py-1 text-[10px] font-mono text-neutral-500 border border-border">Doc #2 cuad_contract_0.txt</span>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {["What are the obligations?", "What is the governing law?", "What are the payment terms?"].map((q, i) => (
                                                <button key={i} className="border border-[#1f1f1f] px-3 py-2 text-[11px] hover:bg-neutral-900 transition-colors text-neutral-400 hover:text-white">
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </Reveal>
                            </div>

                            <div className="p-6 border-t border-border bg-background">
                                <div className="border border-[#1f1f1f] flex items-center p-4 hover:border-neutral-600 transition-colors">
                                    <input
                                        type="text"
                                        readOnly
                                        placeholder="Ask a question about your documents..."
                                        className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-neutral-500"
                                    />
                                    <span className="material-symbols-outlined text-neutral-500 cursor-not-allowed">send</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar Stats */}
                        <aside className="w-full md:w-72 border-l border-[#1f1f1f] bg-neutral-900/20 p-8 space-y-12">
                            <div>
                                <h4 className="text-[10px] uppercase tracking-widest text-neutral-500 mb-8 font-medium">Indexed Stats</h4>
                                <div className="space-y-8">
                                    {[
                                        { val: '1,071', label: 'Chunks Indexed' },
                                        { val: '< 2s', label: 'Mean Latency' },
                                        { val: '0', label: 'Hallucinations' },
                                    ].map((stat, i) => (
                                        <div key={i}>
                                            <div className="text-3xl font-light text-white mb-1">{stat.val}</div>
                                            <div className="text-[10px] uppercase tracking-tighter text-neutral-500">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] uppercase tracking-widest text-neutral-500 mb-8 font-medium">Connected Sources</h4>
                                <div className="space-y-4">
                                    {['cuad_contract_1.txt', 'wiki_algorithm.txt', 'company_policies.txt'].map((source, i) => (
                                        <div key={i} className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 flex-shrink-0"></div>
                                            {source}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>

                {/* EVALUATION TABLE */}
                <section id="evaluation" className="py-24 border-b border-border px-6">
                    <div className="max-w-7xl mx-auto">
                        <Reveal className="mb-16">
                            <h2 className="text-4xl font-light tracking-tight">System Evaluation</h2>
                        </Reveal>

                        <Reveal className="overflow-hidden border border-[#1f1f1f]">
                            <div className="overflow-x-auto">
                                <table className="w-full font-mono text-sm text-left">
                                    <thead className="bg-neutral-900/50 border-b border-[#1f1f1f]">
                                        <tr>
                                            <th className="p-6 font-medium text-neutral-500 uppercase text-[10px] tracking-widest">Test Case</th>
                                            <th className="p-6 font-medium text-neutral-500 uppercase text-[10px] tracking-widest">Expected Source</th>
                                            <th className="p-6 font-medium text-neutral-500 uppercase text-[10px] tracking-widest">Result</th>
                                            <th className="p-6 font-medium text-neutral-500 uppercase text-[10px] tracking-widest">Confidence</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-900">
                                        {[
                                            { q: "What is the effective date?", s: "cuad_contract_3.txt", r: "PASS", c: "0.999" },
                                            { q: "Who are the parties?", s: "cuad_contract_0.txt", r: "PASS", c: "0.942" },
                                            { q: "What is artificial intelligence?", s: "wiki_ai.txt", r: "PASS", c: "1.000" },
                                            { q: "What is the refund policy?", s: "company_policies.txt", r: "PASS", c: "0.981" },
                                            { q: "What is the population of Mars?", s: "—", r: "BLOCK", c: "—" },
                                            { q: "What is the CEO salary?", s: "—", r: "BLOCK", c: "—" },
                                        ].map((row, i) => (
                                            <tr key={i} className="hover:bg-neutral-900/30 transition-colors">
                                                <td className="p-6 text-white">{row.q}</td>
                                                <td className="p-6 text-neutral-500">{row.s}</td>
                                                <td className="p-6">
                                                    <Badge status={row.r === 'PASS' ? 'success' : 'blocked'}>{row.r}</Badge>
                                                </td>
                                                <td className="p-6 text-neutral-400">{row.c}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Reveal>
                    </div>
                </section>

                {/* CTA SECTION */}
                <section className="py-32 border-b border-border">
                    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                        <Reveal>
                            <h2 className="text-6xl font-light tracking-tight leading-[1.1] mb-12">
                                Ready to ask your documents anything?
                            </h2>
                            <div className="space-y-8">
                                <Button as="link" href="/chat" className="px-12 py-5 text-lg">Get Started Now</Button>
                                <div className="font-mono text-neutral-500 text-sm tracking-tight">
                                    Compatible with FastAPI, ChromaDB, and Docker.
                                </div>
                            </div>
                        </Reveal>

                        <Reveal delay={200} className="space-y-6">
                            {[
                                { label: 'Quick Install', cmd: 'pip install -r requirements.txt', id: 'install' },
                                { label: 'Docker Deployment', cmd: 'docker pull documind/rag:latest', id: 'docker' },
                            ].map((item) => (
                                <div key={item.id} className="bg-neutral-900/40 p-8 border border-[#1f1f1f] group hover:border-neutral-700 transition-colors">
                                    <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-600 mb-6 font-medium">{item.label}</div>
                                    <div className="bg-black p-5 font-mono text-sm border border-neutral-900 flex justify-between items-center overflow-x-auto whitespace-nowrap">
                                        <span className="text-emerald-500 mr-4">{item.cmd}</span>
                                        <button
                                            onClick={() => copyToClipboard(item.cmd, item.id)}
                                            className="material-symbols-outlined text-neutral-600 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                                        >
                                            {copied === item.id ? 'check' : 'content_copy'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </Reveal>
                    </div>
                </section>
            </main>

            {/* FOOTER */}
            <footer className="bg-neutral-950 pt-24 pb-12 border-t border-[#1f1f1f]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-24">
                        <div className="col-span-2">
                            <div className="flex items-center space-x-3 mb-8">
                                <div className="w-5 h-5 border-2 border-white rotate-45"></div>
                                <span className="font-medium tracking-tight text-xl">DocuMind AI</span>
                            </div>
                            <p className="text-neutral-500 text-sm font-light leading-relaxed max-w-xs">
                                Precision document intelligence. Open source. Local first. Next-generation RAG system for modern engineering teams.
                            </p>
                        </div>

                        <div>
                            <h5 className="text-[10px] uppercase tracking-widest text-neutral-400 mb-8">Product</h5>
                            <ul className="space-y-4 text-sm font-light text-neutral-500">
                                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Evaluation</a></li>
                            </ul>
                        </div>

                        <div>
                            <h5 className="text-[10px] uppercase tracking-widest text-neutral-400 mb-8">Resources</h5>
                            <ul className="space-y-4 text-sm font-light text-neutral-500">
                                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
                            </ul>
                        </div>

                        <div>
                            <h5 className="text-[10px] uppercase tracking-widest text-neutral-400 mb-8">Company</h5>
                            <ul className="space-y-4 text-sm font-light text-neutral-500">
                                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-10 border-t border-neutral-900 flex flex-col md:flex-row justify-between gap-6">
                        <div className="text-neutral-600 text-[10px] uppercase tracking-widest font-mono">
                            © 2025 DocuMind AI · MIT License · Built for Synthetix Hackathon
                        </div>

                        <div className="flex items-center gap-8 text-neutral-500 font-mono text-xs">
                            <a href="#" className="hover:text-white transition-colors">X / Twitter</a>
                            <a href="#" className="hover:text-white transition-colors">GitHub</a>
                            <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
