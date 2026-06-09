"use client";

import { useState } from "react";

type Props = {
  count: number;
  onClear: () => void;
  // Effectue la suppression (en gérant les blocages d'intégrité) et renvoie
  // un résumé affiché à l'utilisateur, ou null pour ne rien afficher.
  onConfirm: () => Promise<void>;
  unitLabel?: string;
};

/** Barre flottante d'action de suppression multiple, avec confirmation. */
export default function BulkDeleteBar({
  count,
  onClear,
  onConfirm,
  unitLabel = "éléments",
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (count === 0) return null;

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sticky bottom-4 z-30 flex items-center justify-between gap-3
        bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3">
        <span className="text-sm font-semibold">
          {count} {unitLabel} sélectionné{count > 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="h-9 px-3 rounded-lg text-sm font-medium text-slate-300
              hover:bg-slate-800 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => setConfirming(true)}
            className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white
              text-sm font-semibold transition-colors"
          >
            🗑️ Supprimer la sélection
          </button>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              🗑️
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              Supprimer {count} {unitLabel} ?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Cette action est irréversible. Les éléments liés à d&apos;autres
              données seront ignorés.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="flex-1 h-11 rounded-xl border border-slate-200
                  text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors
                  disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={run}
                disabled={busy}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700
                  text-white text-sm font-semibold transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
