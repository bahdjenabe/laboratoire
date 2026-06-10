import type { Examen, Paiement, StatutExamen } from "@/types";

// Logique de regroupement « par commande » (examens saisis / encaissés
// ensemble). Pure et sans dépendance Firestore → testable unitairement.
// Utilisée par les pages Examens et Paiements.

// Ordre de progression d'un examen (du moins au plus avancé).
export const STATUT_ORDRE: StatutExamen[] = [
  "en_attente",
  "en_cours",
  "termine",
  "valide",
];

// Statut global d'une commande d'examens = le moins avancé de ses examens.
export function statutCommande(statuts: StatutExamen[]): StatutExamen {
  if (statuts.length === 0) return "en_attente";
  const idx = Math.min(...statuts.map((s) => STATUT_ORDRE.indexOf(s)));
  return STATUT_ORDRE[idx];
}

export interface CommandeExamens {
  key: string;
  patientId: string;
  createdAt: unknown;
  exams: Examen[];
  total: number;
  statut: StatutExamen;
}

// Regroupe des examens par commandeId (repli sur l'id pour les examens
// d'avant la fonctionnalité). L'ordre d'arrivée est préservé.
export function grouperExamens(examens: Examen[]): CommandeExamens[] {
  const map = new Map<string, Examen[]>();
  for (const e of examens) {
    const key = e.commandeId ?? e.id;
    const arr = map.get(key);
    if (arr) arr.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()].map(([key, exams]) => ({
    key,
    patientId: exams[0].patientId,
    createdAt: exams[0].createdAt,
    exams,
    total: exams.reduce((s, e) => s + (e.prix || 0), 0),
    statut: statutCommande(exams.map((e) => e.statut)),
  }));
}

export type StatutPaiementCommande = "paye" | "non_paye" | "partiel";

// Statut global d'une commande de paiements : payé si tout est payé, non payé
// si rien ne l'est, partiel sinon.
export function statutPaiements(
  statuts: ("paye" | "non_paye")[],
): StatutPaiementCommande {
  if (statuts.length === 0) return "non_paye";
  const nbPaye = statuts.filter((s) => s === "paye").length;
  if (nbPaye === statuts.length) return "paye";
  if (nbPaye === 0) return "non_paye";
  return "partiel";
}

export interface CommandePaiements {
  key: string;
  patientId: string;
  createdAt: unknown;
  paiements: Paiement[];
  montantTotal: number;
  statut: StatutPaiementCommande;
}

// Regroupe des paiements par commandeId (repli sur examenId pour les
// paiements d'avant la fonctionnalité).
export function grouperPaiements(paiements: Paiement[]): CommandePaiements[] {
  const map = new Map<string, Paiement[]>();
  for (const p of paiements) {
    const key = p.commandeId ?? p.examenId;
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }
  return [...map.entries()].map(([key, paies]) => ({
    key,
    patientId: paies[0].patientId,
    createdAt: paies[0].createdAt,
    paiements: paies,
    montantTotal: paies.reduce((s, p) => s + (p.montant || 0), 0),
    statut: statutPaiements(paies.map((p) => p.statut)),
  }));
}
