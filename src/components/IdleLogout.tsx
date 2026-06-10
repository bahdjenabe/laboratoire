"use client";

// Déconnexion automatique après inactivité (espace /dashboard).
// Après IDLE_TIMEOUT_MS sans activité, l'utilisateur est déconnecté.
// Une modale d'avertissement s'affiche WARNING_BEFORE_MS avant l'échéance ;
// pendant l'avertissement, l'activité souris/clavier est ignorée afin
// d'imposer un choix explicite (« Rester connecté » ou « Se déconnecter »).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// ⚠️ TEST TEMPORAIRE : remettre 2 * 60 * 60 * 1000 (2 h) après vérification.
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (TEST)
const WARNING_BEFORE_MS = 60 * 1000; // avertissement 1 min avant (TEST)
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

  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningActive = useRef(false);
  const lastReset = useRef(0);
  const resetRef = useRef<() => void>(() => {});

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

  useEffect(() => {
    const clearTimers = () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (countdown.current) clearInterval(countdown.current);
    };

    const startWarning = () => {
      console.debug("[IdleLogout] ⚠️ avertissement affiché");
      warningActive.current = true;
      setRemaining(COUNTDOWN_START);
      setShowWarning(true);
      logoutTimer.current = setTimeout(() => {
        console.debug("[IdleLogout] 🔴 déconnexion déclenchée");
        void doLogoutRef.current();
      }, WARNING_BEFORE_MS);
      countdown.current = setInterval(() => {
        setRemaining((r) => (r > 1 ? r - 1 : 0));
      }, 1000);
    };

    const reset = () => {
      clearTimers();
      warningActive.current = false;
      setShowWarning(false);
      warnTimer.current = setTimeout(
        startWarning,
        IDLE_TIMEOUT_MS - WARNING_BEFORE_MS,
      );
    };
    resetRef.current = reset;

    const onActivity = (ev: Event) => {
      if (warningActive.current) return; // choix explicite requis pendant l'alerte
      const now = Date.now();
      if (now - lastReset.current < 1000) return; // throttle
      lastReset.current = now;
      console.debug(`[IdleLogout] ↻ minuteur réarmé par « ${ev.type} »`);
      reset();
    };

    console.debug(
      `[IdleLogout] ✅ surveillance active — avertissement dans ${(IDLE_TIMEOUT_MS - WARNING_BEFORE_MS) / 1000}s d'inactivité`,
    );
    reset();
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
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
            onClick={() => resetRef.current()}
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
