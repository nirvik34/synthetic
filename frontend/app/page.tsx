"use client";

import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ChatArea from "./components/ChatArea";
import InputArea from "./components/InputArea";
import MiniSidebar from "./components/MiniSidebar";
import { postAsk } from "./lib/api";
import type { ChatMessage, HistoryEntry, ConversationTurn } from "./lib/types";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [topK, setTopK] = useState(5);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [conversationMemory, setConversationMemory] = useState<
    ConversationTurn[]
  >([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

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
        // Send conversation context for memory
        const context = memoryEnabled ? conversationMemory : undefined;
        const data = await postAsk(q, topK, context);
        const ms = Date.now() - t0;

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== thinkingId),
          { id: "bot-" + Date.now(), type: "bot", data, ms },
        ]);
        setHistoryLog((prev) => [...prev, { q, data, ms }]);

        // Update conversation memory
        if (memoryEnabled) {
          setConversationMemory((prev) => [
            ...prev.slice(-4), // Keep last 5 turns
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
    [inputValue, topK, memoryEnabled, conversationMemory]
  );

  const handleFollowUp = useCallback(
    (q: string) => {
      setInputValue(q);
      // Auto-send the follow-up
      setTimeout(() => {
        sendQuestion(q);
      }, 100);
    },
    [sendQuestion]
  );

  const clearChat = () => {
    setMessages([]);
    setHistoryLog([]);
    setConversationMemory([]);
  };

  const setQuestion = (q: string) => {
    setInputValue(q);
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
      [
        `DocuMind AI — Chat Export\n${"═".repeat(60)}\n\n${txt}`,
      ],
      { type: "text/plain" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `documind-${Date.now()}.txt`;
    a.click();
  };

  return (
    <>
      <Sidebar onSetQuestion={setQuestion} />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-bg-dark">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] bg-primary/20 blur-[160px] rounded-full" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[400px] h-[400px] bg-primary/10 blur-[130px] rounded-full" />
        </div>

        <Header
          topK={topK}
          onTopKChange={setTopK}
          onClear={clearChat}
          memoryEnabled={memoryEnabled}
          onMemoryToggle={() => setMemoryEnabled(!memoryEnabled)}
          memoryCount={conversationMemory.length}
        />
        <ChatArea messages={messages} onFollowUp={handleFollowUp} />
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
    </>
  );
}
