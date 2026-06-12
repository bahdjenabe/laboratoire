"use client";

// Suivi public d'une pré-inscription via son token (cible du QR code).
// Affiche l'état : en attente / confirmée / rejetée.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getPreInscription } from "@/lib/firestore/preinscriptions";
import type { PreInscription } from "@/types";

const ETAT: Record<
  PreInscription["statut"],
  { emoji: string; titre: string; texte: string; cls: string }
> = {
  en_attente: {
    emoji: "⏳",
    titre: "En attente de confirmation",
    texte:
      "Présentez votre code à l'accueil du laboratoire avec votre ordonnance.",
    cls: "text-amber-600",
  },
  confirmee: {
    emoji: "✅",
    titre: "Pré-inscription confirmée",
    texte:
      "Votre dossier a été créé par le laboratoire. Vous pouvez vous présenter pour le prélèvement.",
    cls: "text-emerald-600",
  },
  rejetee: {
    emoji: "❌",
    titre: "Pré-inscription annulée",
    texte:
      "Cette demande n'a pas été retenue. Rapprochez-vous du laboratoire pour plus d'informations.",
    cls: "text-red-600",
  },
};

export default function StatutPreInscriptionPage() {
  const params = useParams();
  const token = params.token as string;

  const [pre, setPre] = useState<PreInscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalide, setInvalide] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPreInscription(token);
      if (!res) {
        setInvalide(true);
        return;
      }
      setPre(res);
    } catch (err) {
      console.error(err);
      setInvalide(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (invalide || !pre) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md text-center">
          <span className="text-5xl mb-4 block">🔒</span>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Demande introuvable
          </h1>
          <p className="text-sm text-slate-500">
            Ce lien est invalide ou la demande n&apos;existe plus.
          </p>
        </div>
      </main>
    );
  }

  const etat = ETAT[pre.statut];

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
        <span className="text-5xl mb-4 block">{etat.emoji}</span>
        <h1 className={`text-xl font-bold mb-2 ${etat.cls}`}>{etat.titre}</h1>
        <p className="text-sm text-slate-500 mb-6">{etat.texte}</p>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Code</span>
            <span className="font-bold tracking-widest text-slate-900">
              {pre.ref}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Patient</span>
            <span className="font-semibold text-slate-900">
              {pre.prenom} {pre.nom}
            </span>
          </div>
        </div>

        {/* Raccourci personnel : ouvre la demande filtrée par son code dans
            l'espace labo (le patient, non connecté, est renvoyé au login). */}
        {pre.statut === "en_attente" && (
          <Link
            href={`/dashboard/pre-inscriptions?code=${encodeURIComponent(
              pre.ref,
            )}`}
            className="block mt-6 text-center text-xs font-semibold text-slate-400 hover:text-emerald-600 transition-colors"
          >
            Personnel du laboratoire : ouvrir cette demande →
          </Link>
        )}

        <p className="text-center text-xs text-slate-400 mt-4">
          Document confidentiel • LabMédical • Conakry, Guinée
        </p>
      </div>
    </main>
  );
}
