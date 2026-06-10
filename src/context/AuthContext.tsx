"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { logError } from "@/lib/logError";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_CACHE_KEY = "labmedical_user";

// ✅ Cookie de session signé httpOnly, posé/effacé par la route /api/session
// (le client ne peut pas le forger : le rôle est dérivé du jeton Firebase
// vérifié côté serveur). Lu par le middleware pour protéger les routes.
async function syncSessionCookie(firebaseUser: FirebaseUser): Promise<void> {
  const idToken = await firebaseUser.getIdToken();
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

async function clearSessionCookie(): Promise<void> {
  try {
    await fetch("/api/session", { method: "DELETE" });
  } catch {
    // Réseau indisponible : le cookie expirera de lui-même (7 jours).
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // ✅ Charger le cache immédiatement depuis localStorage
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      return cached ? (JSON.parse(cached) as User) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(() => {
    // ✅ Si on a déjà un cache, pas besoin de loading
    if (typeof window === "undefined") return true;
    return !localStorage.getItem(USER_CACHE_KEY);
  });

  useEffect(() => {
    // ✅ Persister la session Firebase dans le navigateur
    setPersistence(auth, browserLocalPersistence);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = {
                uid: firebaseUser.uid,
                ...userDoc.data(),
              } as User;

              // ✅ Poser le cookie AVANT d'exposer l'utilisateur : la
              // redirection (login) et le middleware le verront déjà posé.
              await syncSessionCookie(firebaseUser);
              localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
              setUser(userData);
            } else {
              localStorage.removeItem(USER_CACHE_KEY);
              await clearSessionCookie();
              setUser(null);
            }
          } catch (error) {
            logError(error, { scope: "auth", step: "onAuthStateChanged" });
            // ✅ Garder le cache si Firestore échoue (réseau lent)
          }
        } else {
          localStorage.removeItem(USER_CACHE_KEY);
          await clearSessionCookie();
          setUser(null);
        }
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Pose le cookie immédiatement (onAuthStateChanged le refera, idempotent).
    await syncSessionCookie(cred.user);
  };

  const logout = async (): Promise<void> => {
    localStorage.removeItem(USER_CACHE_KEY);
    await clearSessionCookie();
    setUser(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit etre utilise dans un AuthProvider");
  }
  return context;
}
