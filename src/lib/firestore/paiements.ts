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
import type { Paiement } from '@/types';

const COLLECTION = 'paiements';

// ── Créer un paiement ─────────────────────────────
export async function createPaiement(
  data: Omit<Paiement, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Récupérer tous les paiements ──────────────────
export async function getPaiements(): Promise<Paiement[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Paiement[];
}

// ── Récupérer un paiement par ID ──────────────────
export async function getPaiement(id: string): Promise<Paiement | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Paiement;
}

// ── Récupérer les paiements d'un patient ──────────
export async function getPaiementsByPatient(
  patientId: string
): Promise<Paiement[]> {
  const q = query(collection(db, COLLECTION), where('patientId', '==', patientId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Paiement[];
}

// ── Récupérer les paiements d'un examen ───────────
export async function getPaiementsByExamen(
  examenId: string
): Promise<Paiement[]> {
  const q = query(collection(db, COLLECTION), where('examenId', '==', examenId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Paiement[];
}

// ── Mettre à jour un paiement ─────────────────────
export async function updatePaiement(
  id: string,
  data: Partial<Omit<Paiement, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { ...data });
}

// ── Supprimer un paiement ─────────────────────────
export async function deletePaiement(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
