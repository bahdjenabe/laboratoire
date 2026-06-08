import {
  collection,
  doc,
  addDoc,
  setDoc,
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
import type { Resultat, PublicResultat } from '@/types';

const COLLECTION = 'resultats';
const PUBLIC_COLLECTION = 'public_resultats';

// Token de consultation publique : ~192 bits d'entropie, indevinable.
function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Créer un résultat ─────────────────────────────
export async function createResultat(
  data: Omit<Resultat, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Récupérer tous les résultats ──────────────────
export async function getResultats(): Promise<Resultat[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Resultat[];
}

// ── Récupérer un résultat par ID ──────────────────
export async function getResultat(id: string): Promise<Resultat | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Resultat;
}

// ── Récupérer le résultat lié à un examen ─────────
export async function getResultatByExamen(
  examenId: string
): Promise<Resultat | null> {
  const q = query(collection(db, COLLECTION), where('examenId', '==', examenId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Resultat;
}

// ── Mettre à jour un résultat ─────────────────────
export async function updateResultat(
  id: string,
  data: Partial<Omit<Resultat, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { ...data });
}

// ── Valider un résultat (médecin) ─────────────────
// Génère un token, publie un snapshot figé dans public_resultats/{token}
// (consultation publique), puis marque le résultat comme validé.
// Retourne le token pour construire le lien de consultation.
export async function validerResultat(
  id: string,
  snapshot: {
    examenNom?: string;
    patientNom?: string;
    valeurs: Record<string, string | number>;
    observations?: string;
  }
): Promise<string> {
  const token = generateToken();

  // Snapshot public : uniquement les champs destinés au patient.
  await setDoc(doc(db, PUBLIC_COLLECTION, token), {
    examenNom: snapshot.examenNom ?? '',
    patientNom: snapshot.patientNom ?? '',
    valeurs: snapshot.valeurs,
    observations: snapshot.observations ?? '',
    valideAt: serverTimestamp(),
  });

  await updateDoc(doc(db, COLLECTION, id), {
    valideParMedecin: true,
    valideAt: serverTimestamp(),
    token,
  });

  return token;
}

// ── Récupérer le snapshot public via token (consultation patient) ──
export async function getPublicResultat(
  token: string
): Promise<PublicResultat | null> {
  const snapshot = await getDoc(doc(db, PUBLIC_COLLECTION, token));
  if (!snapshot.exists()) return null;
  return { token: snapshot.id, ...snapshot.data() } as PublicResultat;
}

// ── Supprimer un résultat ─────────────────────────
export async function deleteResultat(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
