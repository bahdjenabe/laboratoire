import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getExamen } from '@/lib/firestore/examens';
import type { Resultat, PublicResultat } from '@/types';

const COLLECTION = 'resultats';
const PUBLIC_COLLECTION = 'public_resultats';

// Token de consultation publique : ~192 bits d'entropie, indevinable.
function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Token public stable d'une commande : SHA-256 de sa clé (commandeId).
// Déterministe → le lien reste le même à chaque partage ; indevinable car
// dérivé du commandeId (UUID aléatoire non exposé publiquement).
export async function commandeToken(key: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('cmd:' + key),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

// ── S'abonner aux résultats en temps réel ─────────
export function subscribeResultats(
  onData: (resultats: Resultat[]) => void,
  onError?: (e: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Resultat[]),
    onError
  );
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
// Champs du snapshot public d'un résultat : uniquement les données destinées
// au patient (sa propre donnée), aucune référence interne (ni patientId ni
// examenId).
export interface ResultatPublicInput {
  examenNom?: string;
  patientPrenom?: string;
  patientNom?: string;
  dateNaissance?: Date;
  sexe?: 'M' | 'F' | 'Autre';
  telephone?: string;
  groupeSanguin?: string;
  valeurs: Record<string, string | number>;
  observations?: string;
}

async function publierSnapshotResultat(
  token: string,
  id: string,
  snapshot: ResultatPublicInput
): Promise<void> {
  await setDoc(doc(db, PUBLIC_COLLECTION, token), {
    examenNom: snapshot.examenNom ?? '',
    patientPrenom: snapshot.patientPrenom ?? '',
    patientNom: snapshot.patientNom ?? '',
    dateNaissance: snapshot.dateNaissance ?? null,
    sexe: snapshot.sexe ?? '',
    telephone: snapshot.telephone ?? '',
    groupeSanguin: snapshot.groupeSanguin ?? '',
    valeurs: snapshot.valeurs,
    observations: snapshot.observations ?? '',
    valideAt: serverTimestamp(),
    ref: id,
  });
}

// Génère un token, publie un snapshot figé dans public_resultats/{token}
// (consultation publique), puis marque le résultat comme validé.
// Retourne le token pour construire le lien de consultation.
export async function validerResultat(
  id: string,
  snapshot: ResultatPublicInput
): Promise<string> {
  const token = generateToken();
  await publierSnapshotResultat(token, id, snapshot);
  await updateDoc(doc(db, COLLECTION, id), {
    valideParMedecin: true,
    valideAt: serverTimestamp(),
    token,
  });
  return token;
}

// ── Générer un nouveau lien pour un résultat déjà validé ──────────
// Utilisé après une révocation : publie un nouveau snapshot sous un token
// neuf, sans toucher à la validation. Retourne le nouveau token.
export async function genererLienResultat(
  id: string,
  snapshot: ResultatPublicInput
): Promise<string> {
  const token = generateToken();
  await publierSnapshotResultat(token, id, snapshot);
  await updateDoc(doc(db, COLLECTION, id), { token });
  return token;
}

// ── Révoquer les liens publics d'une commande ─────────────────────
// Supprime le snapshot combiné de la commande ET les snapshots individuels
// de chaque résultat (le champ token est effacé : les boutons de partage
// regénéreront un lien neuf). Les anciens liens cessent de fonctionner.
export async function revoquerLiensCommande(args: {
  commandeKey: string;
  resultats: { id: string; token?: string }[];
}): Promise<void> {
  await deleteDoc(doc(db, PUBLIC_COLLECTION, await commandeToken(args.commandeKey)));
  for (const r of args.resultats) {
    if (!r.token) continue;
    await deleteDoc(doc(db, PUBLIC_COLLECTION, r.token));
    await updateDoc(doc(db, COLLECTION, r.id), { token: deleteField() });
  }
}

// ── Publier une commande (un seul lien pour plusieurs examens) ────
// Crée/écrase un snapshot public combiné sous `token`, contenant la
// démographie du patient + la liste des examens validés. Idempotent.
export interface CommandePublicInput {
  patientPrenom?: string;
  patientNom?: string;
  dateNaissance?: Date;
  sexe?: 'M' | 'F' | 'Autre';
  telephone?: string;
  groupeSanguin?: string;
  examens: {
    examenNom?: string;
    valeurs: Record<string, string | number>;
    observations?: string;
    ref?: string;
  }[];
}

export async function publierCommande(
  token: string,
  data: CommandePublicInput
): Promise<void> {
  await setDoc(doc(db, PUBLIC_COLLECTION, token), {
    patientPrenom: data.patientPrenom ?? '',
    patientNom: data.patientNom ?? '',
    dateNaissance: data.dateNaissance ?? null,
    sexe: data.sexe ?? '',
    telephone: data.telephone ?? '',
    groupeSanguin: data.groupeSanguin ?? '',
    valideAt: serverTimestamp(),
    examens: data.examens.map((e) => ({
      examenNom: e.examenNom ?? '',
      valeurs: e.valeurs,
      observations: e.observations ?? '',
      ref: e.ref ?? '',
    })),
  });
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
// Supprime aussi ses snapshots publics : le lien individuel (token) et le
// lien de commande éventuel (qui contenait ce résultat). Sans cette cascade,
// le rapport resterait consultable publiquement après suppression.
export async function deleteResultat(id: string): Promise<void> {
  const existing = await getResultat(id);
  if (existing) {
    if (existing.token) {
      await deleteDoc(doc(db, PUBLIC_COLLECTION, existing.token));
    }
    if (existing.examenId) {
      const examen = await getExamen(existing.examenId);
      if (examen?.commandeId) {
        await deleteDoc(
          doc(db, PUBLIC_COLLECTION, await commandeToken(examen.commandeId))
        );
      }
    }
  }
  await deleteDoc(doc(db, COLLECTION, id));
}
