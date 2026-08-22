// Assistant "simple IA" — pas de LLM, des règles par mots-clés/variantes sur
// la base de connaissances AHS1 (41 entrées, voir ahs1-faq-kb.ts). Si rien ne
// correspond avec une confiance suffisante, on laisse la main à l'escalade
// vers le support (support_messages) — jamais de réponse inventée : soit une
// entrée de la base correspond, soit on dit qu'on ne sait pas.

import { FAQ_ENTRIES } from "./ahs1-faq-kb";

export interface FaqMatch {
  answer: string;
  escalate: boolean;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // enlève les accents pour un matching plus robuste
}

const PRIORITY_WEIGHT: Record<string, number> = { critical: 3, high: 2, normal: 1 };

export function matchFaq(question: string): FaqMatch | null {
  const q = normalize(question);
  if (!q) return null;

  let best: { entry: (typeof FAQ_ENTRIES)[number]; score: number } | null = null;

  for (const entry of FAQ_ENTRIES) {
    let score = 0;
    for (const variant of entry.variants) {
      const v = normalize(variant);
      if (q.includes(v) || v.includes(q)) score += 3;
    }
    for (const keyword of entry.keywords) {
      if (q.includes(normalize(keyword))) score += 1;
    }
    if (score === 0) continue;

    // Départage : score d'abord, puis priorité (un souci "high"/"critical"
    // l'emporte sur une entrée générique à score égal).
    if (
      !best ||
      score > best.score ||
      (score === best.score && PRIORITY_WEIGHT[entry.priority] > PRIORITY_WEIGHT[best.entry.priority])
    ) {
      best = { entry, score };
    }
  }

  if (!best) return null;
  return { answer: best.entry.answer, escalate: best.entry.escalate };
}
