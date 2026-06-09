"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPatient, deletePatient } from "@/lib/firestore/patients";
import { getExamensByPatient } from "@/lib/firestore/examens";
import { getPaiementsByPatient } from "@/lib/firestore/paiements";
import { useAuth } from "@/context/AuthContext";
import type { Examen, Paiement, Patient, StatutExamen } from "@/types";

const STATUT_CONFIG: Record<StatutExamen, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "bg-slate-100 text-slate-600" },
  en_cours: { label: "En cours", cls: "bg-amber-100 text-amber-700" },
  termine: { label: "Terminé", cls: "bg-blue-100 text-blue-700" },
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
};

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

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

const getAge = (value: unknown): string => {
  const d = toDate(value);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  return `${Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))} ans`;
};

const formatDate = (value: unknown): string => {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
};

export default function PatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [examens, setExamens] = useState<Examen[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const p = await getPatient(id);
      if (!p) {
        setNotFound(true);
        return;
      }
      setPatient(p);
      const [ex, pa] = await Promise.all([
        getExamensByPatient(id),
        getPaiementsByPatient(id),
      ]);
      setExamens(ex);
      setPaiements(pa);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Intégrité : on n'autorise pas la suppression d'un patient qui a des
  // examens (sinon examens/résultats/paiements deviennent orphelins).
  const aDesExamens = examens.length > 0;

  const handleDelete = async () => {
    if (aDesExamens) return; // garde-fou
    setDeleting(true);
    try {
      await deletePatient(id);
      router.push("/dashboard/patients");
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  const totalPaye = paiements
    .filter((p) => p.statut === "paye")
    .reduce((s, p) => s + (p.montant || 0), 0);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-40 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        <div className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse" />
      </div>
    );
  }

  if (notFound || !patient) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <span className="text-5xl mb-4 block">🔍</span>
        <p className="text-slate-600 font-semibold mb-4">Patient introuvable</p>
        <button
          onClick={() => router.push("/dashboard/patients")}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700"
        >
          Retour aux patients
        </button>
      </div>
    );
  }

  const initiales =
    `${patient.prenom?.[0] ?? ""}${patient.nom?.[0] ?? ""}`.toUpperCase();
  const peutSupprimer = user?.role === "admin";
  const peutModifier = user?.role === "admin" || user?.role === "technicien";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
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
          <h1 className="text-2xl font-bold text-slate-900">
            {patient.prenom} {patient.nom}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Patient depuis le {formatDate(patient.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {peutModifier && (
            <button
              onClick={() =>
                router.push(`/dashboard/patients/${patient.id}/modifier`)
              }
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200
                text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              ✏️ Modifier
            </button>
          )}
          {peutSupprimer && (
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-100
                text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
            >
              🗑️ Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Identité + infos */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold flex-shrink-0">
            {initiales}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">
              {patient.prenom} {patient.nom}
            </p>
            <p className="text-sm text-slate-400">
              {patient.numero && (
                <span className="font-mono text-emerald-600 font-semibold">
                  {patient.numero}
                </span>
              )}
              {patient.numero && " • "}
              {getAge(patient.dateNaissance)} •{" "}
              {patient.sexe === "M"
                ? "Masculin"
                : patient.sexe === "F"
                  ? "Féminin"
                  : "Autre"}
            </p>
          </div>
          {patient.groupeSanguin && (
            <span className="ml-auto inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-red-50 text-red-600 border border-red-100">
              {patient.groupeSanguin}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {[
            ["Téléphone", patient.telephone || "—"],
            ["Email", patient.email || "—"],
            ["Date de naissance", formatDate(patient.dateNaissance)],
            ["Adresse", patient.adresse || "—"],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                {label}
              </p>
              <p className="text-sm text-slate-800">{val}</p>
            </div>
          ))}
        </div>

        {patient.antecedents && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
              Antécédents médicaux
            </p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">
              {patient.antecedents}
            </p>
          </div>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm text-slate-500 font-medium">Examens</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {examens.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm text-slate-500 font-medium">Total payé</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">
            {formatGNF(totalPaye)}
          </p>
        </div>
      </div>

      {/* Historique examens */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-4">Historique des examens</h2>
        {examens.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Aucun examen pour ce patient
          </p>
        ) : (
          <ul className="space-y-1">
            {examens.map((ex) => {
              const conf = STATUT_CONFIG[ex.statut];
              return (
                <li
                  key={ex.id}
                  onClick={() => router.push(`/dashboard/examens/${ex.id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base flex-shrink-0">
                    🔬
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {ex.nomExamen}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(ex.createdAt)} • {formatGNF(ex.prix)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${conf.cls}`}
                  >
                    {conf.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Historique paiements */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-4">
          Historique des paiements
        </h2>
        {paiements.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Aucun paiement pour ce patient
          </p>
        ) : (
          <ul className="space-y-1">
            {paiements.map((pa) => (
              <li
                key={pa.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-base flex-shrink-0">
                  💳
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatGNF(pa.montant)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(pa.createdAt)} • {pa.modePaiement ?? "—"}
                  </p>
                </div>
                {pa.statut === "paye" ? (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">
                    ✓ Payé
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">
                    Non payé
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal confirmation suppression */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            {aDesExamens ? (
              <>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  ⚠️
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                  Suppression impossible
                </h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                  Ce patient a {examens.length} examen
                  {examens.length > 1 ? "s" : ""} associé
                  {examens.length > 1 ? "s" : ""}. Supprimez d&apos;abord ses
                  examens pour pouvoir le supprimer.
                </p>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800
                    text-white text-sm font-semibold transition-colors"
                >
                  J&apos;ai compris
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  🗑️
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                  Supprimer ce patient ?
                </h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                  Cette action est irréversible.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 h-11 rounded-xl border border-slate-200
                      text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700
                      text-white text-sm font-semibold transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? "Suppression..." : "Supprimer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
