import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfig } from "@/lib/firebase";
import type { Role } from "@/types";

interface CreateStaffData {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  role: Role;
}

/**
 * Crée un membre du personnel.
 *
 * Le compte Firebase Auth est créé via une instance d'application SECONDAIRE
 * afin de ne pas remplacer la session de l'administrateur courant
 * (createUserWithEmailAndPassword connecte automatiquement le nouvel
 * utilisateur sur l'instance utilisée).
 *
 * Le document Firestore, lui, est écrit avec l'instance principale (`db`),
 * donc avec les droits de l'administrateur connecté.
 */
export async function createStaff(data: CreateStaffData): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      data.email,
      data.password,
    );
    const uid = cred.user.uid;

    await setDoc(doc(db, "users", uid), {
      email: data.email,
      nom: data.nom,
      prenom: data.prenom,
      role: data.role,
      createdAt: serverTimestamp(),
    });

    await signOut(secondaryAuth);
    return uid;
  } finally {
    // Toujours nettoyer l'instance secondaire.
    await deleteApp(secondaryApp);
  }
}
