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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Patient } from '@/types';

const COLLECTION = 'patients';

// ── Créer un patient ──────────────────────────────
export async function createPatient(
  data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
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