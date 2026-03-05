"use client";

import { useState, useCallback, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ChatArea from "../components/ChatArea";
import InputArea from "../components/InputArea";
import MiniSidebar from "../components/MiniSidebar";
import DocumentPanel from "../components/DocumentPanel";
import { postAsk, fetchDocuments, fetchDocumentContent } from "../lib/api";
import type { ChatMessage, HistoryEntry, ConversationTurn } from "../lib/types";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [topK, setTopK] = useState(5);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [sidebarHistory, setSidebarHistory] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [conversationMemory, setConversationMemory] = useState<
    ConversationTurn[]
  >([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [selectedDocContent, setSelectedDocContent] = useState<string | null>(null);
  const [selectedDocName, setSelectedDocName] = useState<string | null>(null);


  // Lifted state for document awareness
  const [docCount, setDocCount] = useState(0);
  const [documents, setDocuments] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // --- Persistence Logic ---

  // Load from local storage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedMessages = localStorage.getItem("documind_messages");
      if (savedMessages) setMessages(JSON.parse(savedMessages));

      const savedHistoryLog = localStorage.getItem("documind_historyLog");
      if (savedHistoryLog) setHistoryLog(JSON.parse(savedHistoryLog));

      const savedSidebarHistory = localStorage.getItem("documind_sidebarHistory");
      if (savedSidebarHistory) setSidebarHistory(JSON.parse(savedSidebarHistory));

      const savedConversationMemory = localStorage.getItem("documind_conversationMemory");
      if (savedConversationMemory) setConversationMemory(JSON.parse(savedConversationMemory));
    } catch (e) {
      console.error("Failed to load state from localStorage:", e);
    }
  }, []);

  // Save to local storage on any state change
  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem("documind_messages", JSON.stringify(messages));
      localStorage.setItem("documind_historyLog", JSON.stringify(historyLog));
      localStorage.setItem("documind_sidebarHistory", JSON.stringify(sidebarHistory));
      localStorage.setItem("documind_conversationMemory", JSON.stringify(conversationMemory));
    } catch (e) {
      console.error("Failed to save state to localStorage:", e);
    }
  }, [messages, historyLog, sidebarHistory, conversationMemory, isMounted]);

  const loadDocs = useCallback(async () => {
    try {
      const d = await fetchDocuments();
      setDocuments(d.documents || []);
      setDocCount(d.count || 0);
    } catch {
      console.error("Failed to sync docs");
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs, dataRefreshKey]);

  const setQ = useCallback((q: string) => {
    setInputValue(q);
    setTimeout(() => {
      const input = document.getElementById("q-input") as HTMLTextAreaElement;
      if (input) {
        input.focus();
        // Move cursor to end
        input.selectionStart = input.selectionEnd = input.value.length;
      }
    }, 10);
  }, []);

  const updateHistory = useCallback((q: string, data: any, ms: number) => {
    setHistoryLog((prev) => [...prev, { q, data, ms }]);
    setSidebarHistory((prev) => {
      const filtered = prev.filter(item => item !== q);
      return [q, ...filtered].slice(0, 10);
    });
  }, []);

  const sendQuestion = useCallback(
    async (overrideQuestion?: string) => {
      const q = (overrideQuestion || inputValue).trim();
      if (!q) return;

      const userId = "user-" + Date.now();
      const thinkingId = "think-" + Date.now();

      setMessages((prev) => [
        ...prev,
        { id: userId, type: "user", text: q },
        { id: thinkingId, type: "thinking" },
      ]);
      setInputValue("");

      const t0 = Date.now();
      try {
        const context = memoryEnabled ? conversationMemory : undefined;
        const data = await postAsk(q, topK, context);
        const ms = Date.now() - t0;

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== thinkingId),
          { id: "bot-" + Date.now(), type: "bot", data, ms },
        ]);

        updateHistory(q, data, ms);

        if (memoryEnabled) {
          setConversationMemory((prev) => [
            ...prev.slice(-4),
            { question: q, answer: data.answer },
          ]);
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== thinkingId),
          {
            id: "err-" + Date.now(),
            type: "error",
            text:
              e instanceof Error
                ? e.message
                : "API unreachable. Is backend running?",
          },
        ]);
      }
    },
    [inputValue, topK, memoryEnabled, conversationMemory, updateHistory]
  );

  const handleCitationClick = useCallback((index: number, msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (msg && msg.type === "bot" && msg.data?.sources) {
      const source = msg.data.sources[index - 1];
      if (source) {
        setActiveDocument(source.document);
        setPanelOpen(true);
      }
    }
  }, [messages]);

  const handleFollowUp = useCallback(
    (q: string) => {
      setQ(q);
      setTimeout(() => {
        sendQuestion(q);
      }, 100);
    },
    [sendQuestion, setQ]
  );

  const clearChat = () => {
    setMessages([]);
    setHistoryLog([]);
    setConversationMemory([]);
    setSidebarHistory([]);
    setSelectedDocContent(null);
    setSelectedDocName(null);
    try {
      localStorage.removeItem("documind_messages");
      localStorage.removeItem("documind_historyLog");
      localStorage.removeItem("documind_sidebarHistory");
      localStorage.removeItem("documind_conversationMemory");
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
    }
  };

  const viewDocument = useCallback(async (docName: string | null) => {
    if (!docName) {
      setSelectedDocName(null);
      setSelectedDocContent(null);
      return;
    }
    try {
      setSelectedDocName(docName);
      setSelectedDocContent("Generating AI summary for this document...");
      setPanelOpen(true);
      const data = await postAsk(`Give me a detailed summary of the main points and key information in the document "${docName}".`, 10);
      setSelectedDocContent(data.answer);
    } catch (e) {
      setSelectedDocContent("Error generating AI summary. Please check your connection.");
      console.error(e);
    }
  }, [topK]);


  const setQuestion = (q: string) => {
    setQ(q);
  };

  const handleDataChange = () => {
    setDataRefreshKey((k) => k + 1);
  };

  const exportChat = () => {
    if (!historyLog.length) return;
    const txt = historyLog
      .map(
        (h, i) =>
          `Q${i + 1}: ${h.q}\nAnswer: ${h.data.answer}\nConfidence: ${h.data.confidence} | Latency: ${h.ms}ms\nSources: ${(h.data.sources || []).map((s) => s.document).join(", ")}`
      )
      .join("\n\n" + "─".repeat(60) + "\n\n");
    const blob = new Blob(
      [`DocuMind AI — Chat Export\n${"═".repeat(60)}\n\n${txt}`],
      { type: "text/plain" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `documind-${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="flex w-full h-screen bg-black text-white selection:bg-white selection:text-black">
      <Sidebar
        onSetQuestion={setQ}
        onViewDoc={viewDocument}
        onDataChange={handleDataChange}
        history={sidebarHistory}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-transparent min-w-0">
        {/* Startup Background Image */}
        <div
          className={`absolute inset-0 z-0 pointer-events-none transition-all duration-1000 ease-in-out ${messages.length > 0 ? "blur-3xl opacity-0 scale-110" : "opacity-40 scale-100"
            }`}
          style={{
            backgroundImage: "url('/img2.jpeg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        <Header
          topK={topK}
          onTopKChange={setTopK}
          onClear={clearChat}
          memoryEnabled={memoryEnabled}
          onMemoryToggle={() => setMemoryEnabled(!memoryEnabled)}
          memoryCount={conversationMemory.length}
        />
        <ChatArea
          messages={messages}
          onFollowUp={handleFollowUp}
          onCitationClick={handleCitationClick}
        />
        <InputArea
          value={inputValue}
          onChange={setInputValue}
          onSend={() => sendQuestion()}
        />
      </main>

      <MiniSidebar
        onRefresh={() => window.location.reload()}
        onExport={exportChat}
      />

      {/* Only show Document Panel if documents are actually indexed */}
      {docCount > 0 && (
        <DocumentPanel
          onSummarize={(q) => {
            setInputValue(q);
            setTimeout(() => sendQuestion(q), 100);
          }}
          historyLog={historyLog}
          refreshKey={dataRefreshKey}
          documents={documents}
          docCount={docCount}
          isOpen={panelOpen}
          onToggle={() => setPanelOpen(!panelOpen)}
          activeDocument={activeDocument}
          selectedDocName={selectedDocName}
          selectedDocContent={selectedDocContent}
          onViewDoc={viewDocument}
        />
      )}
    </div>
  );
}
