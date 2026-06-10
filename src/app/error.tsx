"use client";

// Capture les erreurs de rendu d'un segment (sous le layout racine) et affiche
// une UI de récupération au lieu d'un écran blanc. L'erreur est journalisée
// via logError (point unique branchable sur un service de monitoring).

import { useEffect } from "react";
import { logError } from "@/lib/logError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError(error, { digest: error.digest, boundary: "route" });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
        <span className="text-5xl mb-4 block">⚠️</span>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Une erreur est survenue
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Quelque chose s&apos;est mal passé. Vous pouvez réessayer ; si le
          problème persiste, contactez l&apos;administrateur.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-5 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
              text-white text-sm font-semibold transition-colors"
          >
            Réessayer
          </button>
          <a
            href="/dashboard/dashboard"
            className="px-5 h-11 inline-flex items-center rounded-xl border border-slate-200
              text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Tableau de bord
          </a>
        </div>
      </div>
    </div>
  );
}
