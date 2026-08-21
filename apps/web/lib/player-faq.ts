// Assistant "simple IA" — pas de LLM, juste des règles par mots-clés sur les
// soucis les plus courants côté player/magasin. Si rien ne correspond, on
// laisse la main à l'escalade vers le support (support_messages).

interface FaqRule {
  keywords: string[];
  answer: string;
}

const RULES: FaqRule[] = [
  {
    keywords: ["son", "silence", "muet", "entend", "entends", "volume"],
    answer:
      "Vérifie le gros bouton rond au centre de l'écran : s'il affiche 0%, appuie dessus et remonte le volume. Vérifie aussi qu'une enceinte Bluetooth n'est pas connectée sans être allumée.",
  },
  {
    keywords: ["coupe", "coupé", "arrete", "arrêté", "stoppe", "joue plus", "s'est arrêté"],
    answer:
      "Regarde le statut en haut de l'écran : si c'est 🟠 HORS CONNEXION, vérifie le Wi-Fi de la tablette. Le player réessaie de se reconnecter automatiquement.",
  },
  {
    keywords: ["code", "pin", "verrouille", "verrouillé", "déverrouiller", "technicien"],
    answer:
      "Le code technicien par défaut est 1990, sauf s'il a été changé (visible/modifiable dans le dashboard, page Players).",
  },
  {
    keywords: ["suivant", "changer", "morceau", "piste", "sauter"],
    answer:
      "Le morceau suivant passe automatiquement. Pour forcer le passage, entre en mode technicien (icône 🔒) puis utilise le bouton ⏭.",
  },
  {
    keywords: ["wifi", "reseau", "réseau", "connexion", "internet"],
    answer:
      "Vérifie que la tablette est connectée au Wi-Fi du magasin dans ses réglages Android — l'icône Wi-Fi doit être pleine, pas barrée.",
  },
  {
    keywords: ["publicite", "publicité", "pub", "annonce"],
    answer:
      "Les publicités sont programmées depuis le dashboard (page Publicités) et se lancent automatiquement aux horaires configurés — rien à faire depuis la tablette.",
  },
];

export function matchFaq(question: string): string | null {
  const q = question.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => q.includes(k))) return rule.answer;
  }
  return null;
}
