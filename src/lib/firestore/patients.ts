import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Patient } from '@/types';

const COLLECTION = 'patients';
const COUNTERS = 'compteurs';

function yearOf(value: unknown): number {
  if (value instanceof Timestamp) return value.toDate().getFullYear();
  if (value instanceof Date) return value.getFullYear();
  return new Date().getFullYear();
}

// Alloue le prochain matricule de l'année via une transaction sur le compteur
// `compteurs/patients-{année}` → garantit l'unicité même en accès concurrent.
async function allocateNumero(year: number): Promise<string> {
  const counterRef = doc(db, COUNTERS, `patients-${year}`);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists() ? (snap.data().seq as number) : 0) + 1;
    tx.set(counterRef, { seq: next }, { merge: true });
    return next;
  });
  return `P-${year}-${String(seq).padStart(4, '0')}`;
}

// ── Créer un patient ──────────────────────────────
// Retourne le matricule attribué (ex: P-2026-0042).
export async function createPatient(
  data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const numero = await allocateNumero(new Date().getFullYear());
  await addDoc(collection(db, COLLECTION), {
    ...data,
    numero,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return numero;
}

// ── Attribuer un matricule aux patients qui n'en ont pas (migration) ──
// Traite du plus ancien au plus récent, par année de création.
export async function assignMissingNumeros(): Promise<number> {
  const all = await getPatients();
  const missing = all
    .filter((p) => !p.numero)
    .sort((a, b) => {
      const da = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const dbb = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return da - dbb;
    });
  for (const p of missing) {
    const numero = await allocateNumero(yearOf(p.createdAt));
    await updateDoc(doc(db, COLLECTION, p.id), { numero });
  }
  return missing.length;
}

// ── Récupérer tous les patients ───────────────────
export async function getPatients(): Promise<Patient[]> {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Patient[];
}

// ── Récupérer un patient par ID ───────────────────
export async function getPatient(id: string): Promise<Patient | null> {
  const ref = doc(db, COLLECTION, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Patient;
}

// ── Mettre à jour un patient ──────────────────────
export async function updatePatient(
  id: string,
  data: Partial<Omit<Patient, 'id' | 'createdAt'>>
): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ── Supprimer un patient ──────────────────────────
export async function deletePatient(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

// ── Archiver / restaurer un patient (suppression douce) ──
export async function archivePatient(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    archive: true,
    archiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restorePatient(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    archive: false,
    archiveAt: null,
    updatedAt: serverTimestamp(),
  });
}

// ── Unicité téléphone / email ─────────────────────
// Normalise un téléphone pour la comparaison (chiffres uniquement) afin
// d'ignorer les espaces et formats (« 620 00 » == « 62000 »).
export function normalizePhone(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

// Détecte un doublon de téléphone ou d'email parmi les patients (hors
// exceptId, pour la modification). Retourne le champ en conflit + le patient.
export function findPatientDuplicate(
  patients: Patient[],
  data: { telephone?: string; email?: string },
  exceptId?: string
): { field: 'telephone' | 'email'; patient: Patient } | null {
  const tel = normalizePhone(data.telephone);
  const email = (data.email ?? '').trim().toLowerCase();
  for (const p of patients) {
    if (p.id === exceptId) continue;
    if (tel && normalizePhone(p.telephone) === tel) {
      return { field: 'telephone', patient: p };
    }
    if (email && (p.email ?? '').trim().toLowerCase() === email) {
      return { field: 'email', patient: p };
    }
  }
  return null;
}

// ── Rechercher des patients ───────────────────────
export async function searchPatients(search: string): Promise<Patient[]> {
  const all = await getPatients();
  const s = search.toLowerCase();
  return all.filter(p =>
    p.nom.toLowerCase().includes(s) ||
    p.prenom.toLowerCase().includes(s) ||
    p.telephone.includes(s) ||
    p.email?.toLowerCase().includes(s)
  );
}