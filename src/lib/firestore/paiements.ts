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
  writeBatch,
  onSnapshot,
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

// ── Créer plusieurs paiements en une écriture atomique ─
// Encaissement d'une commande : un paiement par examen, tout ou rien.
export async function createPaiements(
  items: Omit<Paiement, 'id' | 'createdAt'>[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const data of items) {
    const ref = doc(collection(db, COLLECTION));
    batch.set(ref, { ...data, createdAt: serverTimestamp() });
  }
  await batch.commit();
}

// ── Récupérer tous les paiements ──────────────────
export async function getPaiements(): Promise<Paiement[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Paiement[];
}

// ── S'abonner aux paiements en temps réel ─────────
export function subscribePaiements(
  onData: (paiements: Paiement[]) => void,
  onError?: (e: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Paiement[]),
    onError
  );
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
