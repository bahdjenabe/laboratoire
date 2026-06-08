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
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_CACHE_KEY = "labmedical_user";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

// ✅ Cookie lu par le middleware (src/middleware.ts) pour protéger les routes.
function setSessionCookie(uid: string, role: string) {
  const value = encodeURIComponent(JSON.stringify({ uid, role }));
  document.cookie = `session=${value}; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax`;
}

function clearSessionCookie() {
  document.cookie = "session=; path=/; max-age=0; SameSite=Lax";
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

              // ✅ Sauvegarder dans localStorage + cookie de session
              localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
              setSessionCookie(userData.uid, userData.role);
              setUser(userData);
            } else {
              localStorage.removeItem(USER_CACHE_KEY);
              clearSessionCookie();
              setUser(null);
            }
          } catch (error) {
            console.error("Erreur Firestore:", error);
            // ✅ Garder le cache si Firestore échoue (réseau lent)
          }
        } else {
          localStorage.removeItem(USER_CACHE_KEY);
          clearSessionCookie();
          setUser(null);
        }
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async (): Promise<void> => {
    localStorage.removeItem(USER_CACHE_KEY);
    clearSessionCookie();
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
