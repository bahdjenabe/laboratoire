import { getPatients } from './patients';
import { getExamens } from './examens';
import { getResultats } from './resultats';
import { getPaiements } from './paiements';
import { getPreInscriptionsEnAttente } from './preinscriptions';
import type { Patient, Examen } from '@/types';

export interface ExamenRecent extends Examen {
  patientNom: string;
}

// Point de la courbe des revenus (un par mois, 6 derniers mois inclus).
export interface RevenuPoint {
  // Clé machine « AAAA-M » (mois civil), pour le lien vers la page Paiements.
  mois: string;
  // Libellé lisible (ex: « Février 2026 »).
  label: string;
  total: number;
}

export interface DashboardStats {
  patientsAujourdhui: number;
  totalPatients: number;
  examensATraiter: number;
  resultatsValides: number;
  revenusDuJour: number;
  // Pré-inscriptions en ligne restant à confirmer à l'accueil.
  preInscriptionsEnAttente: number;
  // Somme des paiements « non_paye » : créances en attente d'encaissement.
  impayes: number;
  // Résultats saisis mais pas encore validés par un médecin.
  resultatsAValider: number;
  // Revenus encaissés mois par mois sur les 6 derniers mois (ordre chronologique).
  revenusMensuels: RevenuPoint[];
  examensRecents: ExamenRecent[];
  patientsRecents: Patient[];
}

// Firestore renvoie un Timestamp ; on le convertit en Date de façon sûre.
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return null;
}

function isToday(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

// Clé « AAAA-M » (heure locale) pour regrouper des paiements par mois civil.
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // .catch(() => []) : une collection vide ou un refus de permission
  // (ex. technicien sans accès paiements) ne doit pas casser le dashboard.
  const [patients, examens, resultats, paiements, preInscriptions] =
    await Promise.all([
      getPatients().catch(() => []),
      getExamens().catch(() => []),
      getResultats().catch(() => []),
      getPaiements().catch(() => []),
      getPreInscriptionsEnAttente().catch(() => []),
    ]);

  const patientsMap = new Map(patients.map(p => [p.id, p]));

  const patientsAujourdhui = patients.filter(p =>
    isToday(toDate(p.createdAt))
  ).length;

  // Examens à traiter = pas encore terminés ni validés.
  const examensATraiter = examens.filter(
    e => e.statut === 'en_attente' || e.statut === 'en_cours'
  ).length;

  const resultatsValides = resultats.filter(r => r.valideParMedecin).length;

  // Résultats saisis en attente de validation médecin.
  const resultatsAValider = resultats.filter(r => !r.valideParMedecin).length;

  const paiementsPayes = paiements.filter(p => p.statut === 'paye');

  const revenusDuJour = paiementsPayes
    .filter(p => isToday(toDate(p.createdAt)))
    .reduce((sum, p) => sum + (p.montant || 0), 0);

  // Créances : montant total des paiements marqués « non_paye ».
  const impayes = paiements
    .filter(p => p.statut === 'non_paye')
    .reduce((sum, p) => sum + (p.montant || 0), 0);

  const preInscriptionsEnAttente = preInscriptions.length;

  // Revenus mois par mois sur les 6 derniers mois (mois en cours inclus).
  // On prépare 6 seaux vides, puis on ventile chaque paiement payé.
  const totauxParMois = new Map<string, number>();
  const mois: { key: string; label: string }[] = [];
  const monthFmt = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = monthFmt.format(d);
    mois.push({
      key: monthKey(d),
      // Majuscule initiale (« Février 2026 » plutôt que « février 2026 »).
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
    totauxParMois.set(monthKey(d), 0);
  }
  for (const p of paiementsPayes) {
    const d = toDate(p.createdAt);
    if (!d) continue;
    const key = monthKey(d);
    if (totauxParMois.has(key)) {
      totauxParMois.set(key, totauxParMois.get(key)! + (p.montant || 0));
    }
  }
  const revenusMensuels = mois.map(m => ({
    mois: m.key,
    label: m.label,
    total: totauxParMois.get(m.key) ?? 0,
  }));

  const examensRecents: ExamenRecent[] = examens.slice(0, 5).map(e => {
    const patient = patientsMap.get(e.patientId);
    return {
      ...e,
      patientNom: patient
        ? `${patient.prenom} ${patient.nom}`
        : 'Patient inconnu',
    };
  });

  const patientsRecents = patients.slice(0, 5);

  return {
    patientsAujourdhui,
    totalPatients: patients.length,
    examensATraiter,
    resultatsValides,
    revenusDuJour,
    preInscriptionsEnAttente,
    impayes,
    resultatsAValider,
    revenusMensuels,
    examensRecents,
    patientsRecents,
  };
}
