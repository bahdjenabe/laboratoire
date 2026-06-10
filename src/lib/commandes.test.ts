import { describe, it, expect } from "vitest";
import {
  grouperExamens,
  grouperPaiements,
  statutCommande,
  statutPaiements,
} from "./commandes";
import type { Examen, Paiement } from "@/types";

// Fabriques minimales (seuls les champs utilisés à la logique).
function examen(p: Partial<Examen>): Examen {
  return {
    id: "e1",
    patientId: "pat1",
    nomExamen: "Test",
    statut: "en_attente",
    prix: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
  } as Examen;
}

function paiement(p: Partial<Paiement>): Paiement {
  return {
    id: "p1",
    patientId: "pat1",
    examenId: "e1",
    montant: 0,
    statut: "non_paye",
    createdAt: new Date(),
    ...p,
  } as Paiement;
}

describe("statutCommande (examens)", () => {
  it("renvoie le statut le moins avancé", () => {
    expect(statutCommande(["valide", "en_cours", "termine"])).toBe("en_cours");
    expect(statutCommande(["valide", "valide"])).toBe("valide");
    expect(statutCommande(["termine", "en_attente"])).toBe("en_attente");
  });

  it("gère une liste vide", () => {
    expect(statutCommande([])).toBe("en_attente");
  });
});

describe("grouperExamens", () => {
  it("regroupe les examens partageant un commandeId", () => {
    const exs = [
      examen({ id: "a", commandeId: "cmd1", prix: 1000, statut: "termine" }),
      examen({ id: "b", commandeId: "cmd1", prix: 2000, statut: "en_cours" }),
      examen({ id: "c", commandeId: "cmd2", prix: 500, statut: "valide" }),
    ];
    const groupes = grouperExamens(exs);
    expect(groupes).toHaveLength(2);

    const cmd1 = groupes.find((g) => g.key === "cmd1")!;
    expect(cmd1.exams).toHaveLength(2);
    expect(cmd1.total).toBe(3000);
    expect(cmd1.statut).toBe("en_cours"); // le moins avancé
  });

  it("met chaque examen sans commandeId dans son propre groupe", () => {
    const exs = [
      examen({ id: "x", prix: 100 }),
      examen({ id: "y", prix: 200 }),
    ];
    const groupes = grouperExamens(exs);
    expect(groupes).toHaveLength(2);
    expect(groupes.map((g) => g.key).sort()).toEqual(["x", "y"]);
  });

  it("préserve l'ordre d'arrivée des commandes", () => {
    const exs = [
      examen({ id: "a", commandeId: "second" }),
      examen({ id: "b", commandeId: "first" }),
    ];
    expect(grouperExamens(exs).map((g) => g.key)).toEqual(["second", "first"]);
  });
});

describe("statutPaiements", () => {
  it("payé seulement si tout est payé", () => {
    expect(statutPaiements(["paye", "paye"])).toBe("paye");
  });
  it("non payé si rien n'est payé", () => {
    expect(statutPaiements(["non_paye", "non_paye"])).toBe("non_paye");
  });
  it("partiel si mélange", () => {
    expect(statutPaiements(["paye", "non_paye"])).toBe("partiel");
  });
  it("non payé pour une liste vide", () => {
    expect(statutPaiements([])).toBe("non_paye");
  });
});

describe("grouperPaiements", () => {
  it("regroupe par commandeId et somme les montants", () => {
    const ps = [
      paiement({ id: "p1", commandeId: "cmd1", montant: 1000, statut: "paye" }),
      paiement({ id: "p2", commandeId: "cmd1", montant: 2000, statut: "paye" }),
    ];
    const groupes = grouperPaiements(ps);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].montantTotal).toBe(3000);
    expect(groupes[0].statut).toBe("paye");
  });

  it("retombe sur examenId quand commandeId est absent", () => {
    const ps = [paiement({ id: "p1", examenId: "ex9", montant: 500 })];
    expect(grouperPaiements(ps)[0].key).toBe("ex9");
  });

  it("marque la commande partielle si un seul examen est payé", () => {
    const ps = [
      paiement({ id: "p1", commandeId: "c", statut: "paye" }),
      paiement({ id: "p2", commandeId: "c", statut: "non_paye" }),
    ];
    expect(grouperPaiements(ps)[0].statut).toBe("partiel");
  });
});
