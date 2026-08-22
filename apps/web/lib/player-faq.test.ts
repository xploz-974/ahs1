import { describe, expect, it } from "vitest";
import { matchFaq } from "./player-faq";

describe("matchFaq", () => {
  it("retrouve une entrée via une variante presque exacte", () => {
    const match = matchFaq("Il n'y a plus de son");
    expect(match).not.toBeNull();
    expect(match?.answer).toMatch(/volume/i);
    expect(match?.escalate).toBe(false);
  });

  it("retrouve une entrée via un simple mot-clé", () => {
    const match = matchFaq("mon wifi ne marche pas");
    expect(match).not.toBeNull();
  });

  it("est insensible à la casse et aux accents", () => {
    const match = matchFaq("PLUS DE MUSIQUE");
    expect(match).not.toBeNull();
  });

  it("renvoie null pour une question totalement hors sujet", () => {
    expect(matchFaq("quel temps fait-il à Paris demain")).toBeNull();
  });

  it("renvoie null pour une chaîne vide", () => {
    expect(matchFaq("")).toBeNull();
    expect(matchFaq("   ")).toBeNull();
  });

  it("force l'escalade pour l'entrée générique 'problème non résolu'", () => {
    const match = matchFaq("Support AHS1, besoin d'aide");
    expect(match?.escalate).toBe(true);
  });
});
