import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PreInscription } from '@/types';

const COLLECTION = 'preinscriptions';

// Token de la pré-inscription : ~192 bits d'entropie, sert de secret pour le
// suivi public (get par token) et d'id du document. Même schéma que les
// snapshots public_resultats.
function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Code court lisible (6 hexa en majuscules) dérivé du token, à présenter à
// l'accueil. N'est qu'une aide de recherche : la vraie clé reste le token.
function shortRef(token: string): string {
  return token.slice(0, 6).toUpperCase();
}

export interface PreInscriptionInputData {
  prenom: string;
  nom: string;
  dateNaissance: Date;
  sexe: 'M' | 'F' | 'Autre';
  telephone: string;
  email?: string;
  note?: string;
}

// ── Créer une pré-inscription (formulaire public, sans authentification) ──
// Retourne le token (= id) et le code court à afficher au patient.
export async function createPreInscription(
  data: PreInscriptionInputData
): Promise<{ token: string; ref: string }> {
  const token = generateToken();
  const ref = shortRef(token);
  await setDoc(doc(db, COLLECTION, token), {
    token,
    ref,
    prenom: data.prenom,
    nom: data.nom,
    dateNaissance: data.dateNaissance,
    sexe: data.sexe,
    telephone: data.telephone,
    email: data.email ?? '',
    note: data.note ?? '',
    statut: 'en_attente',
    createdAt: serverTimestamp(),
  });
  return { token, ref };
}

// ── Suivi public d'une pré-inscription (get par token) ──
export async function getPreInscription(
  token: string
): Promise<PreInscription | null> {
  const snap = await getDoc(doc(db, COLLECTION, token));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as unknown as PreInscription;
}

// ── S'abonner aux pré-inscriptions en attente (personnel) ──
// Filtre sur le statut uniquement (pas d'orderBy → aucun index composite
// requis) ; le tri par date est fait côté client.
export function subscribePreInscriptionsEnAttente(
  onData: (list: PreInscription[]) => void,
  onError?: (e: unknown) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('statut', '==', 'en_attente')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(
        (d) => ({ token: d.id, ...d.data() }) as PreInscription
      );
      list.sort((a, b) => {
        const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(list);
    },
    onError
  );
}

// ── Confirmer une pré-inscription (personnel) ──
// Le patient et la commande sont créés en amont par l'appelant (réutilise les
// flux existants) ; on ne fait ici que marquer la demande comme traitée.
export async function confirmPreInscription(
  token: string,
  refs: { patientId: string; commandeId: string; confirmePar?: string }
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, token), {
    statut: 'confirmee',
    patientId: refs.patientId,
    commandeId: refs.commandeId,
    confirmePar: refs.confirmePar ?? null,
    confirmeAt: serverTimestamp(),
  });
}

// ── Rejeter une pré-inscription (personnel) — doublon / spam / erreur ──
export async function rejectPreInscription(
  token: string,
  confirmePar?: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, token), {
    statut: 'rejetee',
    confirmePar: confirmePar ?? null,
    confirmeAt: serverTimestamp(),
  });
}
