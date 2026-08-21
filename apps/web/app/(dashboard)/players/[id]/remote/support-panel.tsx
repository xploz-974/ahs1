"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  addStoreContact,
  getStoreContacts,
  getSupportMessages,
  removeStoreContact,
  sendAdminSupportMessage,
  type StoreContactRow,
  type SupportMessageRow,
} from "./actions";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ContactsEditor({ storeId }: { storeId: string }) {
  const [contacts, setContacts] = useState<StoreContactRow[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();

  async function reload() {
    setContacts(await getStoreContacts(storeId));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    startPending(async () => {
      const result = await addStoreContact(storeId, trimmed);
      if (result.error) setError(result.error);
      else {
        setName("");
        await reload();
      }
    });
  }

  return (
    <div className="mb-4 rounded-md border border-ink-700 p-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-400">
        Contacts autorisés à écrire ({contacts.length}/3)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {contacts.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-2.5 py-1 text-xs text-ink-200"
          >
            {c.name}
            <button
              type="button"
              onClick={() => startPending(async () => { await removeStoreContact(c.id); await reload(); })}
              className="text-ink-500 hover:text-status-critical"
            >
              ×
            </button>
          </span>
        ))}
        {contacts.length === 0 && <span className="text-xs text-ink-500">Aucun — le chat démarre sans identification.</span>}
      </div>
      {contacts.length < 3 && (
        <form onSubmit={handleAdd} className="mt-2 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du contact (ex : responsable magasin)"
            className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-signal"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
          >
            Ajouter
          </button>
        </form>
      )}
      {error && <p className="mt-1 text-xs text-status-critical">{error}</p>}
    </div>
  );
}

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
    <div className="mt-6 rounded-lg border border-ink-700 bg-ink-900">
      <div className="border-b border-ink-700 px-4 py-3">
        <p className="text-sm font-medium text-ink-100">🆘 Assistance magasin</p>
      </div>

      <div className="p-4">
        <ContactsEditor storeId={storeId} />
      </div>

      <div ref={listRef} className="h-64 space-y-2 overflow-y-auto px-4 pb-2">
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
              {m.sender === "admin" ? "Toi" : m.sender_name ?? "Magasin"} · {formatDateTime(m.created_at)}
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
