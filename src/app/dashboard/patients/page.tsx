"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import { useSelection } from "@/hooks/useSelection";
import BulkDeleteBar from "@/components/BulkDeleteBar";
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
  const { patients, loading, archive, restore, backfillNumeros } =
    usePatients();
  const { user } = useAuth();
  const router = useRouter();

  // Médecin = lecture seule sur les patients.
  const peutGerer = user?.role === "admin" || user?.role === "technicien";
  // Archivage (simple ou multiple) = admin uniquement.
  const estAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  // Vue : patients actifs (par défaut) ou archivés.
  const [vue, setVue] = useState<"actifs" | "archives">("actifs");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Patient | null>(null);

  const actifsCount = patients.filter((p) => !p.archive).length;
  const archivesCount = patients.length - actifsCount;

  const filtered = patients.filter((p) => {
    if (vue === "actifs" && p.archive) return false;
    if (vue === "archives" && !p.archive) return false;
    const s = search.toLowerCase();
    return (
      p.nom.toLowerCase().includes(s) ||
      p.prenom.toLowerCase().includes(s) ||
      p.telephone.includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.numero?.toLowerCase().includes(s)
    );
  });

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(filtered, 5, `${search}|${vue}`);

  // Sélection multiple (admin) pour suppression groupée.
  const { selected, toggle, setMany, clear } = useSelection();
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const pageIds = pageItems.map((p) => p.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  // Migration : patients sans matricule (anciens enregistrements).
  const sansNumero = patients.filter((p) => !p.numero).length;
  const [backfilling, setBackfilling] = useState(false);
  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const n = await backfillNumeros();
      setBulkMsg(`${n} matricule(s) attribué(s) aux anciens patients.`);
    } finally {
      setBackfilling(false);
    }
  };

  // Action groupée : archive (vue actifs) ou restaure (vue archivés).
  const handleBulkAction = async () => {
    const ids = [...selected];
    for (const id of ids) {
      if (vue === "actifs") await archive(id);
      else await restore(id);
    }
    clear();
    setBulkMsg(
      vue === "actifs"
        ? `${ids.length} patient(s) archivé(s).`
        : `${ids.length} patient(s) restauré(s).`,
    );
  };

  const handleArchive = async (id: string) => {
    setBusyId(id);
    try {
      await archive(id);
      setBulkMsg("Patient archivé — restaurable dans la vue « Archivés ».");
    } finally {
      setBusyId(null);
      setConfirmArchive(null);
    }
  };

  const handleRestore = async (id: string) => {
    setBusyId(id);
    try {
      await restore(id);
      setBulkMsg("Patient restauré.");
    } finally {
      setBusyId(null);
    }
  };

  // Changer de vue réinitialise la sélection.
  const changeVue = (v: "actifs" | "archives") => {
    setVue(v);
    clear();
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
            {actifsCount} patient{actifsCount > 1 ? "s" : ""} actif
            {actifsCount > 1 ? "s" : ""}
            {archivesCount > 0 && ` • ${archivesCount} archivé${
              archivesCount > 1 ? "s" : ""
            }`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {estAdmin && sansNumero > 0 && (
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              title="Attribuer un matricule aux patients qui n'en ont pas"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200
                hover:bg-slate-50 text-slate-700 text-sm font-semibold
                rounded-xl transition-colors disabled:opacity-50"
            >
              {backfilling
                ? "Attribution..."
                : `🔢 Attribuer les matricules (${sansNumero})`}
            </button>
          )}
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
      </div>

      {/* Vue + recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
          {(
            [
              { key: "actifs", label: "Actifs" },
              { key: "archives", label: `Archivés${
                archivesCount ? ` (${archivesCount})` : ""
              }` },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              onClick={() => changeVue(v.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${
                  vue === v.key
                    ? "bg-emerald-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, nom, téléphone..."
            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200
              rounded-xl text-sm text-slate-900 placeholder:text-slate-400
              focus:outline-none focus:border-emerald-500
              focus:ring-2 focus:ring-emerald-500/10 transition-all"
          />
        </div>
      </div>

      {/* Résumé suppression multiple */}
      {bulkMsg && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm">
          <span>✅ {bulkMsg}</span>
          <button
            onClick={() => setBulkMsg(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        {/* Header table */}
        <div
          className="grid grid-cols-12 min-w-[760px] px-5 py-3 bg-slate-50
          border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider"
        >
          <div className="col-span-4 flex items-center gap-3">
            {estAdmin && (
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={(e) => setMany(pageIds, e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
              />
            )}
            Patient
          </div>
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
            <span className="text-5xl mb-4">{vue === "archives" ? "🗄️" : "👤"}</span>
            <p className="text-slate-600 font-semibold text-base mb-1">
              {search
                ? "Aucun résultat trouvé"
                : vue === "archives"
                  ? "Aucun patient archivé"
                  : "Aucun patient enregistré"}
            </p>
            <p className="text-slate-400 text-sm mb-5">
              {search
                ? "Essayez avec d'autres termes de recherche"
                : vue === "archives"
                  ? "Les patients archivés apparaîtront ici"
                  : "Commencez par ajouter votre premier patient"}
            </p>
            {!search && vue === "actifs" && peutGerer && (
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
                {estAdmin && (
                  <input
                    type="checkbox"
                    checked={selected.has(patient.id)}
                    onChange={() => toggle(patient.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
                  />
                )}
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
                    {patient.numero && (
                      <span className="font-mono text-emerald-600">
                        {patient.numero}
                      </span>
                    )}
                    {patient.numero && " · "}
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
                    {estAdmin && vue === "actifs" && (
                      <button
                        onClick={() => setConfirmArchive(patient)}
                        title="Archiver"
                        className="w-8 h-8 flex items-center justify-center rounded-lg
                          bg-slate-100 hover:bg-amber-100 hover:text-amber-600
                          text-slate-500 transition-colors text-sm"
                      >
                        📥
                      </button>
                    )}
                    {estAdmin && vue === "archives" && (
                      <button
                        onClick={() => handleRestore(patient.id)}
                        disabled={busyId === patient.id}
                        title="Restaurer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg
                          bg-slate-100 hover:bg-emerald-100 hover:text-emerald-600
                          text-slate-500 transition-colors text-sm disabled:opacity-50"
                      >
                        ♻️
                      </button>
                    )}
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

      {estAdmin && (
        <BulkDeleteBar
          count={selected.size}
          onClear={clear}
          onConfirm={handleBulkAction}
          unitLabel="patients"
          verb={vue === "actifs" ? "Archiver" : "Restaurer"}
          icon={vue === "actifs" ? "📥" : "♻️"}
          danger={false}
          description={
            vue === "actifs"
              ? "Les patients archivés sont masqués mais conservés. Vous pourrez les restaurer à tout moment."
              : "Les patients sélectionnés redeviendront actifs."
          }
        />
      )}

      {/* Modal confirmation archivage */}
      {confirmArchive && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              📥
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              Archiver ce patient ?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              {confirmArchive.prenom} {confirmArchive.nom} sera masqué de la
              liste, mais son dossier et son historique sont conservés. Vous
              pourrez le restaurer à tout moment.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmArchive(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200
                  text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleArchive(confirmArchive.id)}
                disabled={busyId === confirmArchive.id}
                className="flex-1 h-11 rounded-xl bg-amber-600 hover:bg-amber-700
                  text-white text-sm font-semibold transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busyId === confirmArchive.id ? "Archivage..." : "Archiver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
