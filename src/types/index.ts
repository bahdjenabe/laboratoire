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
  nom: string;
  prenom: string;
  dateNaissance: Date;
  sexe: 'M' | 'F' | 'Autre';
  telephone: string;
  email?: string;
  adresse?: string;
  groupeSanguin?: string;
  antecedents?: string;
  createdAt: Date;
}

export type StatutExamen = 'en_attente' | 'en_cours' | 'termine' | 'valide';

export interface Examen {
  id: string;
  patientId: string;
  nomExamen: string;
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
  patientNom?: string;
  valeurs: Record<string, string | number>;
  observations?: string;
  valideAt: Date;
}

export interface Paiement {
  id: string;
  patientId: string;
  examenId: string;
  montant: number;
  statut: 'paye' | 'non_paye';
  modePaiement?: string;
  createdAt: Date;
}