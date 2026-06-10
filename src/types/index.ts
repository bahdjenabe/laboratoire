// Le patient ne se connecte pas : il consulte ses résultats via un lien
// sécurisé (public_resultats/{token}). Aucun rôle « patient » authentifié.
export type Role = 'admin' | 'medecin' | 'technicien';

export interface User {
  uid: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  createdAt: Date;
}

export interface Patient {
  id: string;
  // Matricule lisible attribué à l'enregistrement (ex: P-2026-0042),
  // unique par année. Sert d'identifiant métier pour retrouver le dossier.
  numero?: string;
  nom: string;
  prenom: string;
  dateNaissance: Date;
  sexe: 'M' | 'F' | 'Autre';
  telephone: string;
  email?: string;
  adresse?: string;
  groupeSanguin?: string;
  antecedents?: string;
  // Archivage (suppression douce) : le dossier est conservé mais masqué.
  archive?: boolean;
  archiveAt?: Date;
  createdAt: Date;
}

// Catalogue des examens proposés par le laboratoire, géré par l'admin.
// Chaque examen porte son prix : à la création d'un examen patient, le prix
// est repris du catalogue (plus de saisie manuelle).
export interface CatalogueExamen {
  id: string;
  nom: string;
  prix: number;
  createdAt: Date;
  updatedAt: Date;
}

export type StatutExamen = 'en_attente' | 'en_cours' | 'termine' | 'valide';

export interface Examen {
  id: string;
  patientId: string;
  nomExamen: string;
  // Regroupe les examens saisis ensemble pour un patient (une « commande »).
  // Absent sur les examens créés avant cette fonctionnalité.
  commandeId?: string;
  technicienId?: string;
  medecinId?: string;
  statut: StatutExamen;
  prix: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Resultat {
  id: string;
  examenId: string;
  patientId: string;
  valeurs: Record<string, string | number>;
  observations?: string;
  valideParMedecin: boolean;
  valideAt?: Date;
  // Token aléatoire dédié à la consultation publique (≠ id Firestore).
  // Généré à la validation ; sert de clé du document public_resultats.
  token?: string;
  pdfUrl?: string;
  // Snapshot dénormalisé pour la consultation publique (portail patient).
  examenNom?: string;
  patientNom?: string;
  createdAt: Date;
}

// Snapshot public et figé d'un résultat validé, exposé via lien sécurisé.
// Ne contient aucune référence interne (ni patientId ni examenId).
// L'id du document EST le token.
export interface PublicResultat {
  token: string;
  examenNom?: string;
  patientPrenom?: string;
  patientNom?: string;
  // Démographie du patient (sa propre donnée) — pour un PDF identique au labo.
  dateNaissance?: Date;
  sexe?: 'M' | 'F' | 'Autre';
  telephone?: string;
  groupeSanguin?: string;
  valeurs: Record<string, string | number>;
  observations?: string;
  valideAt: Date;
  // Référence courte affichée sur le rapport (= id du résultat).
  ref?: string;
  // Variante « commande » : un seul lien regroupant plusieurs examens validés.
  // Présent uniquement pour les snapshots de commande (sinon résultat unique).
  examens?: {
    examenNom?: string;
    valeurs: Record<string, string | number>;
    observations?: string;
    ref?: string;
  }[];
}

export interface Paiement {
  id: string;
  patientId: string;
  examenId: string;
  // Regroupe les paiements d'une même commande d'examens (encaissés ensemble).
  // Absent sur les paiements créés avant cette fonctionnalité.
  commandeId?: string;
  montant: number;
  statut: 'paye' | 'non_paye';
  modePaiement?: string;
  // Précision du mode : réseau de carte (Visa…), opérateur mobile (Orange
  // Money…) ou banque pour un virement. Vide pour les espèces.
  detailPaiement?: string;
  // Référence de la transaction pour le rapprochement comptable : ID Mobile
  // Money, n° d'autorisation TPE, réf. de virement. JAMAIS de n° de carte/CVV.
  referencePaiement?: string;
  createdAt: Date;
}