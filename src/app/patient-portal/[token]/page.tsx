"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getPublicResultat } from "@/lib/firestore/resultats";
import { generatePublicReport } from "@/lib/pdf/generateReport";
import type { PublicResultat } from "@/types";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  return null;
}

const formatDate = (value: unknown): string => {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";
};

export default function PatientPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [resultat, setResultat] = useState<PublicResultat | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalide, setInvalide] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Le snapshot public n'existe que pour un résultat validé.
      const res = await getPublicResultat(token);
      if (!res) {
        setInvalide(true);
        return;
      }
      setResultat(res);
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

  if (invalide || !resultat) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md text-center">
          <span className="text-5xl mb-4 block">🔒</span>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Résultat indisponible
          </h1>
          <p className="text-sm text-slate-500">
            Ce lien est invalide, expiré, ou le résultat n&apos;a pas encore été
            validé par le médecin.
          </p>
        </div>
      </main>
    );
  }

  // Vue unifiée : un résultat unique = une seule « section » ; une commande =
  // plusieurs examens. Un seul PDF regroupe toutes les sections.
  const sections =
    resultat.examens && resultat.examens.length > 0
      ? resultat.examens
      : [
          {
            examenNom: resultat.examenNom,
            valeurs: resultat.valeurs,
            observations: resultat.observations,
            ref: resultat.ref,
          },
        ];

  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto">
        {/* Carte résultat */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden print:shadow-none">
          {/* En-tête */}
          <div className="bg-slate-900 px-8 py-6 flex items-center gap-4 print:bg-white print:border-b print:border-slate-200">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
              ⚗
            </div>
            <div>
              <p className="text-white text-xl font-bold print:text-slate-900">
                LabMedical
              </p>
              <p className="text-slate-400 text-xs print:text-slate-500">
                Rapport d&apos;analyse médicale
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full print:text-emerald-700">
              ✓ Validé
            </span>
          </div>

          <div className="p-8 space-y-6">
            {/* Infos patient */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  Patient
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {`${resultat.patientPrenom ?? ""} ${
                    resultat.patientNom ?? ""
                  }`.trim() || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  Validé le
                </p>
                <p className="text-sm text-slate-700">
                  {formatDate(resultat.valideAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  {sections.length > 1 ? "Examens" : "Analyse"}
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {sections.length > 1
                    ? `${sections.length} examens`
                    : (sections[0].examenNom ?? "—")}
                </p>
              </div>
            </div>

            {/* Une section par examen */}
            {sections.map((s, idx) => {
              const valeurs = Object.entries(s.valeurs ?? {});
              return (
                <div
                  key={s.ref ?? idx}
                  className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0"
                >
                  {sections.length > 1 && (
                    <h2 className="text-base font-bold text-slate-900 mb-3">
                      {s.examenNom ?? "Analyse"}
                    </h2>
                  )}
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="grid grid-cols-2 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <span>Paramètre</span>
                      <span>Valeur</span>
                    </div>
                    {valeurs.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-slate-400">
                        Aucune valeur.
                      </p>
                    ) : (
                      valeurs.map(([param, valeur], i) => (
                        <div
                          key={param}
                          className={`grid grid-cols-2 px-4 py-3 text-sm ${
                            i % 2 === 1 ? "bg-slate-50/50" : ""
                          }`}
                        >
                          <span className="text-slate-600">{param}</span>
                          <span className="font-semibold text-slate-900">
                            {valeur}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {s.observations && (
                    <div className="mt-3">
                      <h3 className="text-sm font-bold text-slate-900 mb-2">
                        Observations
                      </h3>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-2xl p-4">
                        {s.observations}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Téléchargement (PDF unique, tous examens) + impression */}
            <div className="pt-2 print:hidden flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => generatePublicReport(resultat)}
                className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700
                  text-white font-semibold text-sm transition-colors"
              >
                ⬇️ Télécharger le rapport (PDF)
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 h-12 rounded-xl border border-slate-200 hover:bg-slate-50
                  text-slate-700 font-semibold text-sm transition-colors"
              >
                🖨️ Imprimer la page
              </button>
            </div>
          </div>

          {/* Pied */}
          <div className="px-8 py-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Document confidentiel • LabMedical • Conakry, Guinée
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 print:hidden">
          En cas de question, contactez votre laboratoire.
        </p>
      </div>
    </main>
  );
}
