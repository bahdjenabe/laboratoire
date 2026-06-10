import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CatalogueExamen } from '@/types';

const COLLECTION = 'catalogue_examens';

// ── Récupérer le catalogue (trié par nom) ─────────
export async function getCatalogue(): Promise<CatalogueExamen[]> {
  const q = query(collection(db, COLLECTION), orderBy('nom', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CatalogueExamen[];
}

// ── S'abonner au catalogue en temps réel ──────────
export function subscribeCatalogue(
  onData: (catalogue: CatalogueExamen[]) => void,
  onError?: (e: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION), orderBy('nom', 'asc'));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CatalogueExamen[]
      ),
    onError
  );
}

// ── Ajouter un examen au catalogue ────────────────
export async function createCatalogueExamen(
  data: Omit<CatalogueExamen, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Mettre à jour un examen du catalogue ──────────
export async function updateCatalogueExamen(
  id: string,
  data: Partial<Omit<CatalogueExamen, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ── Supprimer un examen du catalogue ──────────────
export async function deleteCatalogueExamen(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
