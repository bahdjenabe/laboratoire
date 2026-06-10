"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getExamen, updateStatutExamen } from "@/lib/firestore/examens";
import { getPatient } from "@/lib/firestore/patients";
import { getPaiementsByExamen } from "@/lib/firestore/paiements";
import {
  getResultatByExamen,
  createResultat,
  updateResultat,
  validerResultat,
} from "@/lib/firestore/resultats";
import { generateReport } from "@/lib/pdf/generateReport";
import { useAuth } from "@/context/AuthContext";
import { resultatSchema, type ResultatInput } from "@/lib/validations";
import PatientNotify from "@/components/PatientNotify";
import type { Examen, Patient, Resultat, StatutExamen } from "@/types";

const STATUT_CONFIG: Record<StatutExamen, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "bg-slate-100 text-slate-600" },
  en_cours: { label: "En cours", cls: "bg-amber-100 text-amber-700" },
  termine: { label: "Terminé", cls: "bg-blue-100 text-blue-700" },
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
};

const ETAPES: { statut: StatutExamen; label: string }[] = [
  { statut: "en_attente", label: "En attente" },
  { statut: "en_cours", label: "En cours" },
  { statut: "termine", label: "Terminé" },
  { statut: "valide", label: "Validé" },
];

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
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

export default function ExamenDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [examen, setExamen] = useState<Examen | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [estPaye, setEstPaye] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResultatInput>({
    resolver: zodResolver(resultatSchema),
    defaultValues: {
      valeurs: [{ param: "", valeur: "" }],
      observations: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "valeurs" });

  const role = user?.role;
  const valide = resultat?.valideParMedecin ?? false;
  const peutTraiter = role === "admin" || role === "technicien";
  // L'analyse (démarrage + saisie) est bloquée tant que l'examen n'est pas payé.
  const peutSaisir = peutTraiter && !valide && estPaye;
  const peutValider =
    (role === "admin" || role === "medecin") && !!resultat && !valide;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const ex = await getExamen(id);
      if (!ex) {
        setNotFound(true);
        return;
      }
      setExamen(ex);
      const [pat, res, paiements] = await Promise.all([
        ex.patientId ? getPatient(ex.patientId) : Promise.resolve(null),
        getResultatByExamen(id),
        getPaiementsByExamen(id).catch(() => []),
      ]);
      setPatient(pat);
      setEstPaye(paiements.some((p) => p.statut === "paye"));
      if (res) {
        setResultat(res);
        const entries = Object.entries(res.valeurs ?? {});
        reset({
          valeurs: entries.length
            ? entries.map(([param, valeur]) => ({
                param,
                valeur: String(valeur),
              }))
            : [{ param: "", valeur: "" }],
          observations: res.observations ?? "",
        });
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, reset]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDemarrer = async () => {
    if (!examen) return;
    setUpdating(true);
    try {
      await updateStatutExamen(examen.id, "en_cours");
      setExamen({ ...examen, statut: "en_cours" });
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const onSaveResultat = async (data: ResultatInput) => {
    if (!examen) return;
    const valeurs: Record<string, string> = {};
    data.valeurs.forEach((r) => {
      const key = r.param.trim();
      if (key) valeurs[key] = r.valeur.trim();
    });
    const patientNom = patient
      ? `${patient.prenom} ${patient.nom}`
      : undefined;
    setError("");
    try {
      if (resultat) {
        await updateResultat(resultat.id, {
          valeurs,
          observations: data.observations ?? "",
          examenNom: examen.nomExamen,
          patientNom,
        });
      } else {
        await createResultat({
          examenId: examen.id,
          patientId: examen.patientId,
          valeurs,
          observations: data.observations ?? "",
          valideParMedecin: false,
          examenNom: examen.nomExamen,
          patientNom,
        });
      }
      // La saisie d'un résultat fait passer l'examen en « terminé ».
      if (examen.statut !== "valide") {
        await updateStatutExamen(examen.id, "termine");
      }
      await load();
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'enregistrement. Réessayez.");
    }
  };

  const handleValider = async () => {
    if (!resultat || !examen) return;
    setValidating(true);
    try {
      await validerResultat(resultat.id, {
        examenNom: examen.nomExamen,
        patientPrenom: patient?.prenom,
        patientNom: patient?.nom,
        dateNaissance: patient?.dateNaissance,
        sexe: patient?.sexe,
        telephone: patient?.telephone,
        groupeSanguin: patient?.groupeSanguin,
        valeurs: resultat.valeurs,
        observations: resultat.observations,
      });
      await updateStatutExamen(examen.id, "valide");
      await load();
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la validation.");
    } finally {
      setValidating(false);
    }
  };

  const handlePdf = () => {
    if (examen && patient && resultat) generateReport(examen, patient, resultat);
  };

  const valeursError = errors.valeurs?.root?.message ?? errors.valeurs?.message;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-40 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-slate-100 animate-pulse" />
      </div>
    );
  }

  if (notFound || !examen) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <span className="text-5xl mb-4 block">🔍</span>
        <p className="text-slate-600 font-semibold mb-4">Examen introuvable</p>
        <button
          onClick={() => router.push("/dashboard/examens")}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700"
        >
          Retour aux examens
        </button>
      </div>
    );
  }

  const conf = STATUT_CONFIG[examen.statut];
  const etapeActive = ETAPES.findIndex((e) => e.statut === examen.statut);

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
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {examen.nomExamen}
            </h1>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${conf.cls}`}
            >
              {conf.label}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Créé le {formatDate(examen.createdAt)} • {formatGNF(examen.prix)}
          </p>
        </div>
      </div>

      {/* Bannière : paiement requis */}
      {!estPaye && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800">Paiement requis</p>
            <p className="text-sm text-amber-700">
              L&apos;analyse ne peut pas démarrer tant que cet examen n&apos;est
              pas payé.
            </p>
          </div>
          {(role === "admin" || role === "technicien") && (
            <button
              onClick={() =>
                router.push(
                  `/dashboard/paiements?commande=${encodeURIComponent(examen.commandeId ?? examen.id)}`,
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

      {/* Progression + patient */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center">
          {ETAPES.map((etape, i) => {
            const done = i <= etapeActive;
            return (
              <div
                key={etape.statut}
                className="flex items-center flex-1 last:flex-none"
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                      ${done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${done ? "text-slate-700" : "text-slate-400"}`}
                  >
                    {etape.label}
                  </span>
                </div>
                {i < ETAPES.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 -mt-6 ${i < etapeActive ? "bg-emerald-600" : "bg-slate-100"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Patient */}
        {patient && (
          <button
            onClick={() => router.push(`/dashboard/patients/${patient.id}`)}
            className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3 w-full text-left hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {`${patient.prenom?.[0] ?? ""}${patient.nom?.[0] ?? ""}`.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {patient.prenom} {patient.nom}
              </p>
              <p className="text-xs text-slate-400">{patient.telephone}</p>
            </div>
            <span className="ml-auto text-slate-300 text-sm">Voir la fiche →</span>
          </button>
        )}

        {/* Démarrer (seulement en attente ET payé) */}
        {examen.statut === "en_attente" && peutTraiter && estPaye && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <button
              onClick={handleDemarrer}
              disabled={updating}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800
                text-white text-sm font-semibold transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? "..." : "▶ Démarrer l'analyse"}
            </button>
          </div>
        )}
      </div>

      {/* Résultat (saisie inline) */}
      <form
        onSubmit={handleSubmit(onSaveResultat)}
        noValidate
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900 text-base">
            Résultat de l&apos;analyse
          </h2>
          {peutSaisir && (
            <button
              type="button"
              onClick={() => append({ param: "", valeur: "" })}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              + Ajouter un paramètre
            </button>
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
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-12 gap-3 items-center">
              <input
                {...register(`valeurs.${i}.param`)}
                disabled={!peutSaisir}
                placeholder="ex: Hémoglobine"
                className="col-span-6 h-10 px-3 rounded-xl border border-slate-200
                  bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                  focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10
                  disabled:opacity-70 disabled:cursor-not-allowed transition-all"
              />
              <div className="col-span-6 flex items-center gap-2">
                <input
                  {...register(`valeurs.${i}.valeur`)}
                  disabled={!peutSaisir}
                  placeholder="ex: 13.5 g/dL"
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-200
                    bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                    focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10
                    disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                />
                {peutSaisir && fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
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

        {valeursError && (
          <p className="mt-2 text-xs text-red-600">{valeursError}</p>
        )}

        <div className="mt-5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Observations
          </label>
          <textarea
            {...register("observations")}
            disabled={!peutSaisir}
            rows={3}
            placeholder="Commentaires, interprétation, recommandations..."
            className="w-full px-3.5 py-3 rounded-xl border border-slate-200
              bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
              focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10
              disabled:opacity-70 disabled:cursor-not-allowed transition-all resize-none"
          />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
            ⚠️ {error}
          </div>
        )}

        {valide && (
          <p className="mt-4 text-sm text-emerald-600 font-medium">
            ✔ Résultat validé — ne peut plus être modifié.
          </p>
        )}

        {/* Actions */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-wrap gap-3">
          {peutSaisir && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-w-[150px] h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
                text-white font-semibold text-sm transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "Enregistrement..."
                : resultat
                  ? "💾 Mettre à jour"
                  : "💾 Enregistrer le résultat"}
            </button>
          )}

          {peutValider && (
            <button
              type="button"
              onClick={handleValider}
              disabled={validating}
              className="flex-1 min-w-[150px] h-11 rounded-xl bg-blue-600 hover:bg-blue-700
                text-white font-semibold text-sm transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? "Validation..." : "✔ Valider (médecin)"}
            </button>
          )}

          {resultat && (
            <button
              type="button"
              onClick={handlePdf}
              className="flex-1 min-w-[150px] h-11 rounded-xl border border-slate-200
                bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              ⬇ PDF
            </button>
          )}
        </div>

        {!resultat && !peutSaisir && (
          <p className="mt-4 text-sm text-slate-400 text-center">
            {!estPaye
              ? "⚠ Paiement requis avant la saisie du résultat."
              : "En attente de la saisie du résultat par un technicien."}
          </p>
        )}
      </form>

      {/* Notification patient (résultat validé) */}
      {valide && resultat?.token && patient && (
        <PatientNotify
          patient={patient}
          examenNom={examen.nomExamen}
          lien={
            typeof window !== "undefined"
              ? `${window.location.origin}/patient-portal/${resultat.token}`
              : `/patient-portal/${resultat.token}`
          }
        />
      )}
    </div>
  );
}
