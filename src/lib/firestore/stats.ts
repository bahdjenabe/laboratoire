import { getPatients } from './patients';
import { getExamens } from './examens';
import { getResultats } from './resultats';
import { getPaiements } from './paiements';
import type { Patient, Examen } from '@/types';

export interface ExamenRecent extends Examen {
  patientNom: string;
}

export interface DashboardStats {
  patientsAujourdhui: number;
  totalPatients: number;
  examensEnCours: number;
  resultatsValides: number;
  revenusDuJour: number;
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

export async function getDashboardStats(): Promise<DashboardStats> {
  // .catch(() => []) : une collection vide ou un refus de permission
  // (ex. technicien sans accès paiements) ne doit pas casser le dashboard.
  const [patients, examens, resultats, paiements] = await Promise.all([
    getPatients().catch(() => []),
    getExamens().catch(() => []),
    getResultats().catch(() => []),
    getPaiements().catch(() => []),
  ]);

  const patientsMap = new Map(patients.map(p => [p.id, p]));

  const patientsAujourdhui = patients.filter(p =>
    isToday(toDate(p.createdAt))
  ).length;

  const examensEnCours = examens.filter(e => e.statut === 'en_cours').length;

  const resultatsValides = resultats.filter(r => r.valideParMedecin).length;

  const revenusDuJour = paiements
    .filter(p => p.statut === 'paye' && isToday(toDate(p.createdAt)))
    .reduce((sum, p) => sum + (p.montant || 0), 0);

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
    examensEnCours,
    resultatsValides,
    revenusDuJour,
    examensRecents,
    patientsRecents,
  };
}
