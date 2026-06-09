"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePatients } from "@/hooks/usePatients";
import { getExamensByPatient } from "@/lib/firestore/examens";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import type { Patient } from "@/types";

// Firestore renvoie un Timestamp : on le convertit en Date de façon sûre.
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return null;
}

function getAge(value: unknown): string {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "-";
  const ans = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
  );
  return Number.isFinite(ans) ? `${ans} ans` : "-";
}

export default function PatientsPage() {
  const { patients, loading, removePatient } = usePatients();
  const { user } = useAuth();
  const router = useRouter();

  // Médecin = lecture seule sur les patients.
  const peutGerer = user?.role === "admin" || user?.role === "technicien";

  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  // Intégrité : un patient ayant des examens ne peut pas être supprimé.
  const [checkLoading, setCheckLoading] = useState(false);
  const [blockCount, setBlockCount] = useState<number | null>(null);

  const filtered = patients.filter((p) => {
    const s = search.toLowerCase();
    return (
      p.nom.toLowerCase().includes(s) ||
      p.prenom.toLowerCase().includes(s) ||
      p.telephone.includes(s) ||
      p.email?.toLowerCase().includes(s)
    );
  });

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(filtered, 10, search);

  // Ouvre la confirmation et vérifie si le patient a des examens.
  const askDelete = async (id: string) => {
    setShowConfirm(id);
    setBlockCount(null);
    setCheckLoading(true);
    try {
      const examens = await getExamensByPatient(id).catch(() => []);
      setBlockCount(examens.length);
    } finally {
      setCheckLoading(false);
    }
  };

  const closeConfirm = () => {
    setShowConfirm(null);
    setBlockCount(null);
    setCheckLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (blockCount && blockCount > 0) return; // garde-fou
    setDeleting(id);
    try {
      await removePatient(id);
    } finally {
      setDeleting(null);
      closeConfirm();
    }
  };

  const getInitiales = (p: Patient) =>
    `${p.prenom[0] ?? ""}${p.nom[0] ?? ""}`.toUpperCase();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {patients.length} patient{patients.length > 1 ? "s" : ""} enregistré
            {patients.length > 1 ? "s" : ""}
          </p>
        </div>
        {peutGerer && (
          <button
            onClick={() => router.push("/dashboard/patients/nouveau")}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600
              hover:bg-emerald-700 text-white text-sm font-semibold
              rounded-xl transition-all shadow-lg shadow-emerald-600/20
              hover:shadow-emerald-600/30 hover:-translate-y-0.5"
          >
            + Nouveau patient
          </button>
        )}
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, prénom, téléphone..."
          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200
            rounded-xl text-sm text-slate-900 placeholder:text-slate-400
            focus:outline-none focus:border-emerald-500
            focus:ring-2 focus:ring-emerald-500/10 transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header table */}
        <div
          className="grid grid-cols-12 px-5 py-3 bg-slate-50
          border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider"
        >
          <div className="col-span-4">Patient</div>
          <div className="col-span-2">Age / Sexe</div>
          <div className="col-span-2">Groupe</div>
          <div className="col-span-2">Telephone</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-12 px-5 py-4 border-b border-slate-50"
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="w-32 h-3 bg-slate-200 rounded animate-pulse" />
                    <div className="w-20 h-2 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="col-span-2 flex items-center">
                  <div className="w-16 h-3 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="col-span-2 flex items-center">
                  <div className="w-10 h-5 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="col-span-2 flex items-center">
                  <div className="w-24 h-3 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
                  <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-5xl mb-4">👤</span>
            <p className="text-slate-600 font-semibold text-base mb-1">
              {search ? "Aucun résultat trouvé" : "Aucun patient enregistré"}
            </p>
            <p className="text-slate-400 text-sm mb-5">
              {search
                ? "Essayez avec d'autres termes de recherche"
                : "Commencez par ajouter votre premier patient"}
            </p>
            {!search && peutGerer && (
              <button
                onClick={() => router.push("/dashboard/patients/nouveau")}
                className="px-4 py-2 bg-emerald-600 text-white text-sm
                  font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                + Ajouter un patient
              </button>
            )}
          </div>
        ) : (
          pageItems.map((patient, idx) => (
            <div
              key={patient.id}
              className={`grid grid-cols-12 px-5 py-4 items-center
                hover:bg-slate-50 transition-colors cursor-pointer
                ${idx < pageItems.length - 1 ? "border-b border-slate-50" : ""}`}
              onClick={() => router.push(`/dashboard/patients/${patient.id}`)}
            >
              {/* Nom + email */}
              <div className="col-span-4 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700
                  flex items-center justify-center text-sm font-bold flex-shrink-0"
                >
                  {getInitiales(patient)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {patient.prenom} {patient.nom}
                  </p>
                  <p className="text-xs text-slate-400">
                    {patient.email ?? "Pas d'email"}
                  </p>
                </div>
              </div>

              {/* Age / Sexe */}
              <div className="col-span-2">
                <p className="text-sm text-slate-700">
                  {getAge(patient.dateNaissance)}
                </p>
                <p className="text-xs text-slate-400">
                  {patient.sexe === "M" ? "Masculin" : "Feminin"}
                </p>
              </div>

              {/* Groupe sanguin */}
              <div className="col-span-2">
                {patient.groupeSanguin ? (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full
                    text-xs font-semibold bg-red-50 text-red-600 border border-red-100"
                  >
                    {patient.groupeSanguin}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </div>

              {/* Telephone */}
              <div className="col-span-2">
                <p className="text-sm text-slate-700">{patient.telephone}</p>
              </div>

              {/* Actions */}
              <div
                className="col-span-2 flex items-center justify-end gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {peutGerer ? (
                  <>
                    <button
                      onClick={() =>
                        router.push(
                          `/dashboard/patients/${patient.id}/modifier`,
                        )
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-lg
                        bg-slate-100 hover:bg-blue-100 hover:text-blue-600
                        text-slate-500 transition-colors text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => askDelete(patient.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg
                        bg-slate-100 hover:bg-red-100 hover:text-red-600
                        text-slate-500 transition-colors text-sm"
                    >
                      🗑️
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && (
        <Pagination
          page={page}
          totalPages={totalPages}
          from={from}
          to={to}
          total={total}
          onChange={setPage}
          unitLabel="patients"
        />
      )}

      {/* Modal confirmation suppression */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            {checkLoading ? (
              <div className="py-6 text-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Vérification...</p>
              </div>
            ) : blockCount && blockCount > 0 ? (
              <>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  ⚠️
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                  Suppression impossible
                </h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                  Ce patient a {blockCount} examen{blockCount > 1 ? "s" : ""}{" "}
                  associé{blockCount > 1 ? "s" : ""}. Supprimez d&apos;abord ses
                  examens pour pouvoir le supprimer.
                </p>
                <button
                  onClick={closeConfirm}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800
                    text-white text-sm font-semibold transition-colors"
                >
                  J&apos;ai compris
                </button>
              </>
            ) : (
              <>
                <div
                  className="w-12 h-12 bg-red-100 rounded-full flex items-center
                  justify-center text-2xl mx-auto mb-4"
                >
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
                    onClick={closeConfirm}
                    className="flex-1 h-11 rounded-xl border border-slate-200
                      text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleDelete(showConfirm)}
                    disabled={!!deleting}
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
