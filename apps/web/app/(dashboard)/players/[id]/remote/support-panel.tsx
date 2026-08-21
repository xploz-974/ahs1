"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getSupportMessages, sendAdminSupportMessage, type SupportMessageRow } from "./actions";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Messagerie datée/horodatée magasin ↔ technicien — fenêtre distincte de la
// liste des players, mais réunie ici avec la télécommande pour que le
// technicien puisse vérifier le lecteur ET discuter au même endroit.
export function SupportPanel({ storeId }: { storeId: string }) {
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, startSend] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const msgs = await getSupportMessages(storeId);
      if (!cancelled) setMessages(msgs);
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [storeId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    startSend(async () => {
      await sendAdminSupportMessage(storeId, text);
      setMessages(await getSupportMessages(storeId));
    });
  }

  return (
    <div className="mt-6 flex h-96 flex-col rounded-lg border border-ink-700 bg-ink-900">
      <div className="border-b border-ink-700 px-4 py-3">
        <p className="text-sm font-medium text-ink-100">🆘 Assistance magasin</p>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-xs text-ink-500">Aucun message pour l&apos;instant.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[80%] ${m.sender === "admin" ? "ml-auto text-right" : ""}`}>
            <div
              className={`inline-block rounded-lg px-3 py-2 text-sm ${
                m.sender === "admin" ? "bg-signal text-ink-950" : "bg-ink-800 text-ink-100"
              }`}
            >
              {m.body}
            </div>
            <p className="mt-0.5 text-[10px] text-ink-600">
              {m.sender === "admin" ? "Toi" : "Magasin"} · {formatDateTime(m.created_at)}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-ink-700 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Répondre au magasin…"
          className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 disabled:opacity-60"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
