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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Examen, StatutExamen } from '@/types';

const COLLECTION = 'examens';

// ── Créer un examen ───────────────────────────────
export async function createExamen(
  data: Omit<Examen, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Récupérer tous les examens ────────────────────
export async function getExamens(): Promise<Examen[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Examen[];
}

// ── Récupérer un examen par ID ────────────────────
export async function getExamen(id: string): Promise<Examen | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Examen;
}

// ── Récupérer les examens d'un patient ────────────
export async function getExamensByPatient(patientId: string): Promise<Examen[]> {
  const q = query(collection(db, COLLECTION), where('patientId', '==', patientId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Examen[];
}

// ── Mettre à jour un examen ───────────────────────
export async function updateExamen(
  id: string,
  data: Partial<Omit<Examen, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ── Changer le statut d'un examen ─────────────────
export async function updateStatutExamen(
  id: string,
  statut: StatutExamen
): Promise<void> {
  await updateExamen(id, { statut });
}

// ── Supprimer un examen ───────────────────────────
export async function deleteExamen(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
