"use client";

// Déconnexion automatique après inactivité (espace /dashboard).
// Après IDLE_TIMEOUT_MS sans activité, l'utilisateur est déconnecté.
// Une modale d'avertissement s'affiche WARNING_BEFORE_MS avant l'échéance ;
// pendant l'avertissement, l'activité souris/clavier est ignorée afin
// d'imposer un choix explicite (« Rester connecté » ou « Se déconnecter »).
//
// La détection repose sur l'horodatage ABSOLU de la dernière activité
// (Date.now()), pas sur un setTimeout : ainsi le temps passé en veille de
// l'ordinateur est correctement compté (un setTimeout est suspendu pendant la
// veille, ce qui prolongeait indûment le délai). Au réveil / retour d'onglet,
// une re-vérification immédiate est déclenchée (visibilitychange).
//
// L'horodatage est PERSISTÉ dans localStorage (lib/idleActivity) : un
// rechargement de page ou le déchargement de l'onglet par le navigateur
// (fréquent pendant la veille du PC) ne remet donc pas le compteur à zéro.
// AuthContext fait le même contrôle au démarrage, avant de restaurer la
// session Firebase.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  IDLE_TIMEOUT_MS,
  getLastActivity,
  touchActivity,
} from "@/lib/idleActivity";
const WARNING_BEFORE_MS = 2 * 60 * 1000; // avertissement 2 min avant
const TICK_MS = 1000; // fréquence de vérification + décompte
const COUNTDOWN_START = Math.ceil(WARNING_BEFORE_MS / 1000);
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
  "click",
] as const;

export default function IdleLogout() {
  const { logout } = useAuth();
  const router = useRouter();

  const [showWarning, setShowWarning] = useState(false);
  const [remaining, setRemaining] = useState(COUNTDOWN_START);

  const lastActivity = useRef(0); // initialisé au montage (cf. effet)
  const warningActive = useRef(false);
  const lastReset = useRef(0);

  const doLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  }, [logout, router]);

  // Garder une référence à jour de doLogout sans relancer l'effet principal.
  const doLogoutRef = useRef(doLogout);
  useEffect(() => {
    doLogoutRef.current = doLogout;
  }, [doLogout]);

  // Réarme le minuteur (activité récente ou clic « Rester connecté »).
  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    touchActivity();
    warningActive.current = false;
    setShowWarning(false);
  }, []);

  useEffect(() => {
    // Point de départ = horodatage persisté (survit aux rechargements) ;
    // s'il n'y en a pas encore, l'inactivité démarre au montage.
    const stored = getLastActivity();
    lastActivity.current = stored ?? Date.now();
    if (stored === null) touchActivity();

    // Compare le temps écoulé réel (horloge murale) au seuil d'inactivité.
    // Lit localStorage pour partager l'activité entre onglets (fallback sur
    // la ref si localStorage est indisponible).
    const check = () => {
      const last = getLastActivity() ?? lastActivity.current;
      const elapsed = Date.now() - last;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        warningActive.current = false;
        void doLogoutRef.current();
        return;
      }
      if (elapsed >= IDLE_TIMEOUT_MS - WARNING_BEFORE_MS) {
        warningActive.current = true;
        setShowWarning(true);
        setRemaining(Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - elapsed) / 1000)));
      } else if (warningActive.current) {
        warningActive.current = false;
        setShowWarning(false);
      }
    };

    const onActivity = () => {
      if (warningActive.current) return; // choix explicite requis pendant l'alerte
      const now = Date.now();
      if (now - lastReset.current < 1000) return; // throttle
      lastReset.current = now;
      lastActivity.current = now;
      touchActivity();
    };

    // Retour d'onglet / réveil de veille : vérifier sans attendre le prochain tick.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    const interval = setInterval(check, TICK_MS);
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
        <span className="text-5xl mb-4 block">⏳</span>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Toujours là ?</h2>
        <p className="text-sm text-slate-500 mb-1">
          Vous allez être déconnecté pour inactivité dans
        </p>
        <p className="text-4xl font-extrabold text-emerald-600 mb-6 tabular-nums">
          {remaining >= 60
            ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
            : `${remaining}s`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => void doLogout()}
            className="flex-1 h-11 rounded-xl border border-slate-200 bg-white
              text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Se déconnecter
          </button>
          <button
            onClick={resetActivity}
            className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
              text-white font-semibold text-sm transition-colors"
          >
            Rester connecté
          </button>
        </div>
      </div>
    </div>
  );
}
