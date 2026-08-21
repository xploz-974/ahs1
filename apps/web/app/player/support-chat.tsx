"use client";

import { useEffect, useRef, useState } from "react";
import { fetchContacts, fetchSupportMessages, sendSupportMessage, type StoreContact, type SupportMessage } from "./api";
import { matchFaq } from "@/lib/player-faq";

type LocalEntry =
  | { kind: "local-question"; text: string; at: number }
  | { kind: "local-answer"; text: string; at: number };

function formatDateTime(iso: string | number): string {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function SupportChat({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [local, setLocal] = useState<LocalEntry[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [awaitingEscalation, setAwaitingEscalation] = useState<string | null>(null);
  // Une fois la conversation engagée (première escalade, ou messages déjà
  // existants), on ne redemande plus "Contacter le support" à chaque envoi.
  const [escalated, setEscalated] = useState(false);
  const [contacts, setContacts] = useState<StoreContact[] | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchContacts().then(setContacts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const msgs = await fetchSupportMessages();
      if (!cancelled) {
        setMessages(msgs);
        if (msgs.length > 0) setEscalated(true);
      }
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Identification obligatoire avant de discuter s'il existe des contacts
  // déclarés pour ce magasin (max recommandé : 3, gérés depuis le dashboard).
  const needsIdentity = contacts !== null && contacts.length > 0 && identity === null;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [local, messages]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput("");

    if (escalated) {
      // Conversation déjà en cours avec le support : on envoie directement.
      await sendSupportMessage(question, identity);
      setMessages(await fetchSupportMessages());
      return;
    }

    const answer = matchFaq(question);
    if (answer) {
      setLocal((prev) => [
        ...prev,
        { kind: "local-question", text: question, at: Date.now() },
        { kind: "local-answer", text: answer, at: Date.now() },
      ]);
    } else {
      setLocal((prev) => [...prev, { kind: "local-question", text: question, at: Date.now() }]);
      setAwaitingEscalation(question);
    }
  }

  async function handleEscalate() {
    if (!awaitingEscalation) return;
    const ok = await sendSupportMessage(awaitingEscalation, identity);
    if (ok) {
      setEscalated(true);
      setLocal([]); // la conversation continue désormais via `messages` (serveur)
      setMessages(await fetchSupportMessages());
    } else {
      setLocal((prev) => [...prev, { kind: "local-answer", text: "Échec de l'envoi, réessaie.", at: Date.now() }]);
    }
    setAwaitingEscalation(null);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="flex h-[70vh] w-full max-w-md flex-col rounded-lg border border-[#232b37] bg-[#11161d]">
        <div className="flex items-center justify-between border-b border-[#232b37] px-4 py-3">
          <p className="text-sm font-medium text-[#e8ecf1]">🆘 Assistance</p>
          <button type="button" onClick={onClose} className="text-[#7c8a9c] hover:text-[#e8ecf1]">
            ✕
          </button>
        </div>

        {needsIdentity ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-[#e8ecf1]">Qui es-tu ?</p>
            <p className="text-xs text-[#7c8a9c]">Choisis ton nom pour commencer la conversation.</p>
            <div className="mt-2 w-full space-y-2">
              {contacts!.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setIdentity(c.name)}
                  className="block w-full rounded-md border border-[#333d4d] py-2.5 text-sm text-[#e8ecf1] hover:border-[#3ddbc4]"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
        <>
        <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-4">
          {local.length === 0 && messages.length === 0 && (
            <p className="text-xs text-[#7c8a9c]">
              Décris ton souci (pas de son, coupure, code oublié…) — je réponds automatiquement si je connais la
              solution, sinon un technicien prendra le relais ici.
            </p>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] ${m.sender === "admin" ? "ml-auto text-right" : ""}`}>
              <div
                className={`inline-block rounded-lg px-3 py-2 text-sm ${
                  m.sender === "admin" ? "bg-[#3ddbc4] text-[#0b0f14]" : "bg-[#171d26] text-[#e8ecf1]"
                }`}
              >
                {m.body}
              </div>
              <p className="mt-0.5 text-[10px] text-[#333d4d]">
                {m.sender === "admin" ? "Technicien" : m.sender_name ?? "Toi"} · {formatDateTime(m.created_at)}
              </p>
            </div>
          ))}

          {local.map((entry, i) => {
            if (entry.kind === "local-question") {
              return (
                <div key={i} className="max-w-[85%]">
                  <div className="inline-block rounded-lg bg-[#171d26] px-3 py-2 text-sm text-[#e8ecf1]">
                    {entry.text}
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#333d4d]">Toi · {formatDateTime(entry.at)}</p>
                </div>
              );
            }
            return (
              <div key={i} className="ml-auto max-w-[85%] text-right">
                <div className="inline-block rounded-lg bg-[#232b37] px-3 py-2 text-sm text-[#e8ecf1]">
                  {entry.text}
                </div>
                <p className="mt-0.5 text-[10px] text-[#333d4d]">Assistant · {formatDateTime(entry.at)}</p>
              </div>
            );
          })}

          {awaitingEscalation && (
            <div className="rounded-lg border border-[#333d4d] p-3 text-center">
              <p className="text-xs text-[#7c8a9c]">Pas de réponse automatique pour ça.</p>
              <button
                type="button"
                onClick={handleEscalate}
                className="mt-2 rounded-md bg-[#3ddbc4] px-3 py-1.5 text-xs font-medium text-[#0b0f14]"
              >
                Contacter le support
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleAsk} className="flex gap-2 border-t border-[#232b37] p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Décris ton problème…"
            className="flex-1 rounded-md border border-[#333d4d] bg-[#171d26] px-3 py-2 text-sm text-[#e8ecf1] outline-none focus:border-[#3ddbc4]"
          />
          <button type="submit" className="rounded-md bg-[#3ddbc4] px-4 py-2 text-sm font-medium text-[#0b0f14]">
            Envoyer
          </button>
        </form>
        </>
        )}
      </div>
    </div>
  );
}
