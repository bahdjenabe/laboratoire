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

// ── Créer plusieurs examens en une écriture atomique ─
// Tous les examens d'une commande sont créés ensemble : soit tout réussit,
// soit rien (pas de commande partielle).
export async function createExamens(
  items: Omit<Examen, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const data of items) {
    const ref = doc(collection(db, COLLECTION));
    batch.set(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// ── Récupérer tous les examens ────────────────────
export async function getExamens(): Promise<Examen[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Examen[];
}

// ── S'abonner aux examens en temps réel ───────────
// Renvoie une fonction de désabonnement. Met à jour l'UI à chaque changement
// (y compris ceux d'un autre utilisateur) sans re-télécharger toute la
// collection à chaque mutation locale.
export function subscribeExamens(
  onData: (examens: Examen[]) => void,
  onError?: (e: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Examen[]),
    onError
  );
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

// ── Récupérer tous les examens d'une commande ─────
// La « clé » de commande est le commandeId. Repli sur l'examen seul pour les
// examens anciens sans commandeId (leur clé est alors leur propre id).
export async function getExamensByCommande(key: string): Promise<Examen[]> {
  const q = query(collection(db, COLLECTION), where('commandeId', '==', key));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Examen[];
  if (list.length > 0) return list;
  const single = await getExamen(key);
  return single ? [single] : [];
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
