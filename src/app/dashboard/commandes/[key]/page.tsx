"use client";

// Feuille de commande : saisie groupée des résultats de tous les examens d'un
// même patient (une « commande »). Reproduit la feuille de paillasse d'un
// laboratoire : chaque analyse a sa zone de saisie, un seul bouton enregistre
// l'ensemble. La validation (médecin) reste groupée sur la page Résultats.

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getExamensByCommande, updateStatutExamen } from "@/lib/firestore/examens";
import { getPatient } from "@/lib/firestore/patients";
import { getPaiementsByCommande } from "@/lib/firestore/paiements";
import {
  getResultatByExamen,
  createResultat,
  updateResultat,
} from "@/lib/firestore/resultats";
import { useAuth } from "@/context/AuthContext";
import type { Examen, Patient } from "@/types";

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

interface Ligne {
  param: string;
  valeur: string;
}

interface ExamForm {
  examen: Examen;
  resultatId: string | null;
  valide: boolean;
  valeurs: Ligne[];
  observations: string;
}

export default function FeuilleCommandePage() {
  const params = useParams();
  const key = decodeURIComponent(params.key as string);
  const router = useRouter();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [forms, setForms] = useState<ExamForm[]>([]);
  const [estPaye, setEstPaye] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const role = user?.role;
  const peutTraiter = role === "admin" || role === "technicien";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const exams = await getExamensByCommande(key);
      if (exams.length === 0) {
        setNotFound(true);
        return;
      }
      // Ordre stable : par date de création croissante (toMillis si dispo).
      exams.sort((a, b) => {
        const ta =
          typeof (a.createdAt as { toMillis?: () => number })?.toMillis ===
          "function"
            ? (a.createdAt as unknown as { toMillis: () => number }).toMillis()
            : 0;
        const tb =
          typeof (b.createdAt as { toMillis?: () => number })?.toMillis ===
          "function"
            ? (b.createdAt as unknown as { toMillis: () => number }).toMillis()
            : 0;
        return ta - tb;
      });

      const [pat, paiements, resultats] = await Promise.all([
        exams[0].patientId
          ? getPatient(exams[0].patientId)
          : Promise.resolve(null),
        getPaiementsByCommande(key).catch(() => []),
        Promise.all(
          exams.map((e) => getResultatByExamen(e.id).catch(() => null)),
        ),
      ]);

      const payes = new Set(
        paiements.filter((p) => p.statut === "paye").map((p) => p.examenId),
      );
      setEstPaye(exams.every((e) => payes.has(e.id)));
      setPatient(pat);
      setForms(
        exams.map((examen, i) => {
          const r = resultats[i];
          const entries = r ? Object.entries(r.valeurs ?? {}) : [];
          return {
            examen,
            resultatId: r?.id ?? null,
            valide: r?.valideParMedecin ?? false,
            valeurs: entries.length
              ? entries.map(([param, valeur]) => ({
                  param,
                  valeur: String(valeur),
                }))
              : [{ param: "", valeur: "" }],
            observations: r?.observations ?? "",
          };
        }),
      );
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Édition d'une ligne / observations (mises à jour immuables) ──
  const setLigne = (
    fi: number,
    li: number,
    champ: keyof Ligne,
    valeur: string,
  ) =>
    setForms((prev) =>
      prev.map((f, i) =>
        i !== fi
          ? f
          : {
              ...f,
              valeurs: f.valeurs.map((l, j) =>
                j === li ? { ...l, [champ]: valeur } : l,
              ),
            },
      ),
    );

  const addLigne = (fi: number) =>
    setForms((prev) =>
      prev.map((f, i) =>
        i !== fi ? f : { ...f, valeurs: [...f.valeurs, { param: "", valeur: "" }] },
      ),
    );

  const removeLigne = (fi: number, li: number) =>
    setForms((prev) =>
      prev.map((f, i) =>
        i !== fi
          ? f
          : { ...f, valeurs: f.valeurs.filter((_, j) => j !== li) },
      ),
    );

  const setObs = (fi: number, valeur: string) =>
    setForms((prev) =>
      prev.map((f, i) => (i === fi ? { ...f, observations: valeur } : f)),
    );

  const total = forms.reduce((s, f) => s + (f.examen.prix || 0), 0);

  const handleSaveAll = async () => {
    setError("");
    setSavedMsg("");
    setSaving(true);
    try {
      const patientNom = patient
        ? `${patient.prenom} ${patient.nom}`
        : undefined;
      let saved = 0;
      for (const f of forms) {
        if (f.valide) continue; // résultat déjà validé : non modifiable
        const valeurs: Record<string, string> = {};
        f.valeurs.forEach((l) => {
          const k = l.param.trim();
          if (k) valeurs[k] = l.valeur.trim();
        });
        if (Object.keys(valeurs).length === 0) continue; // examen non saisi
        if (f.resultatId) {
          await updateResultat(f.resultatId, {
            valeurs,
            observations: f.observations ?? "",
            examenNom: f.examen.nomExamen,
            patientNom,
          });
        } else {
          await createResultat({
            examenId: f.examen.id,
            patientId: f.examen.patientId,
            valeurs,
            observations: f.observations ?? "",
            valideParMedecin: false,
            examenNom: f.examen.nomExamen,
            patientNom,
          });
        }
        if (f.examen.statut !== "valide") {
          await updateStatutExamen(f.examen.id, "termine");
        }
        saved++;
      }
      if (saved === 0) {
        setError("Saisissez au moins un paramètre pour un examen.");
      } else {
        setSavedMsg(
          `${saved} résultat${saved > 1 ? "s" : ""} enregistré${saved > 1 ? "s" : ""}.`,
        );
        await load();
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'enregistrement. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-40 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-slate-100 animate-pulse" />
      </div>
    );
  }

  if (notFound || forms.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <span className="text-5xl mb-4 block">🔍</span>
        <p className="text-slate-600 font-semibold mb-4">Commande introuvable</p>
        <button
          onClick={() => router.push("/dashboard/examens")}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700"
        >
          Retour aux examens
        </button>
      </div>
    );
  }

  const tousValides = forms.every((f) => f.valide);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl
            bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">
            Feuille de commande
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 truncate">
            {patient
              ? `${patient.prenom} ${patient.nom}`
              : "Patient inconnu"}{" "}
            • {forms.length} analyse{forms.length > 1 ? "s" : ""} •{" "}
            {formatGNF(total)}
          </p>
        </div>
      </div>

      {/* Bannière paiement requis */}
      {!estPaye && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800">Paiement requis</p>
            <p className="text-sm text-amber-700">
              La saisie des résultats nécessite que la commande soit encaissée.
            </p>
          </div>
          {peutTraiter && (
            <button
              onClick={() =>
                router.push(
                  `/dashboard/paiements?commande=${encodeURIComponent(key)}`,
                )
              }
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700
                text-white text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0"
            >
              💳 Encaisser
            </button>
          )}
        </div>
      )}

      {tousValides && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-700 font-medium">
          ✔ Tous les résultats de cette commande sont validés.
        </div>
      )}

      {/* Une carte de saisie par analyse */}
      {forms.map((f, fi) => {
        const editable = peutTraiter && estPaye && !f.valide;
        return (
          <div
            key={f.examen.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900 text-base truncate">
                  {f.examen.nomExamen}
                </h2>
                <button
                  onClick={() =>
                    router.push(`/dashboard/examens/${f.examen.id}`)
                  }
                  className="text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  Ouvrir la fiche individuelle →
                </button>
              </div>
              {f.valide ? (
                <span className="inline-flex text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700 flex-shrink-0">
                  ✓ Validé
                </span>
              ) : (
                editable && (
                  <button
                    type="button"
                    onClick={() => addLigne(fi)}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold flex-shrink-0"
                  >
                    + Ajouter un paramètre
                  </button>
                )
              )}
            </div>

            <div className="grid grid-cols-12 gap-3 px-1 mb-2">
              <span className="col-span-6 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Paramètre
              </span>
              <span className="col-span-6 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Valeur
              </span>
            </div>

            <div className="space-y-2">
              {f.valeurs.map((l, li) => (
                <div key={li} className="grid grid-cols-12 gap-3 items-center">
                  <input
                    value={l.param}
                    onChange={(e) => setLigne(fi, li, "param", e.target.value)}
                    disabled={!editable}
                    placeholder="ex: Hémoglobine"
                    className="col-span-6 h-10 px-3 rounded-xl border border-slate-200
                      bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                      focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10
                      disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                  />
                  <div className="col-span-6 flex items-center gap-2">
                    <input
                      value={l.valeur}
                      onChange={(e) =>
                        setLigne(fi, li, "valeur", e.target.value)
                      }
                      disabled={!editable}
                      placeholder="ex: 13.5 g/dL"
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-200
                        bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                        focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10
                        disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    />
                    {editable && f.valeurs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLigne(fi, li)}
                        aria-label="Supprimer la ligne"
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg
                          bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-400 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Observations
              </label>
              <textarea
                value={f.observations}
                onChange={(e) => setObs(fi, e.target.value)}
                disabled={!editable}
                rows={2}
                placeholder="Commentaires, interprétation..."
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200
                  bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                  focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10
                  disabled:opacity-70 disabled:cursor-not-allowed transition-all resize-none"
              />
            </div>
          </div>
        );
      })}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
          ⚠️ {error}
        </div>
      )}
      {savedMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm">
          ✅ {savedMsg}
        </div>
      )}

      {/* Barre d'action */}
      {peutTraiter && estPaye && !tousValides && (
        <div className="sticky bottom-4 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700
              text-white font-semibold text-sm transition-colors shadow-lg
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Enregistrement..." : "💾 Enregistrer tout"}
          </button>
          <button
            onClick={() => router.push("/dashboard/resultats")}
            className="flex-1 h-12 rounded-xl border border-slate-200 bg-white
              text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Aller à la validation →
          </button>
        </div>
      )}
    </div>
  );
}
