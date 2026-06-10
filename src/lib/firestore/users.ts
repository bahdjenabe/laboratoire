import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User, Role } from "@/types";

const COLLECTION = "users";

// Rôles considérés comme « personnel » (exclut les patients).
const STAFF_ROLES: Role[] = ["admin", "medecin", "technicien"];

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

// ── Récupérer tout le personnel ───────────────────
// Pas d'orderBy Firestore : il exclurait les comptes sans champ `createdAt`
// (ex. admin créé à la main). On trie côté client (plus récent d'abord).
export async function getStaff(): Promise<User[]> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map((d) => ({ uid: d.id, ...d.data() }) as User)
    .filter((u) => STAFF_ROLES.includes(u.role))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

// ── S'abonner au personnel en temps réel ──────────
// Même logique de filtrage/tri que getStaff (tri client, pas d'orderBy).
export function subscribeStaff(
  onData: (staff: User[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  return onSnapshot(
    collection(db, COLLECTION),
    (snap) =>
      onData(
        snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }) as User)
          .filter((u) => STAFF_ROLES.includes(u.role))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
      ),
    onError,
  );
}

// ── Récupérer un utilisateur ──────────────────────
export async function getUser(uid: string): Promise<User | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, uid));
  if (!snapshot.exists()) return null;
  return { uid: snapshot.id, ...snapshot.data() } as User;
}

// ── Mettre à jour un utilisateur (nom / rôle) ─────
export async function updateUser(
  uid: string,
  data: Partial<Pick<User, "nom" | "prenom" | "role">>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), { ...data });
}

// ── Supprimer le profil d'un utilisateur ──────────
// Note : seul le document Firestore est supprimé. Le compte Firebase Auth
// nécessite le SDK Admin (côté serveur). Sans profil, l'utilisateur est
// déconnecté automatiquement par AuthContext et perd l'accès à l'application.
export async function deleteUser(uid: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, uid));
}
