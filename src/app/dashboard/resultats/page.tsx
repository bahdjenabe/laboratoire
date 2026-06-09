"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useResultats } from "@/hooks/useResultats";
import { useExamens } from "@/hooks/useExamens";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";

const FILTRES: { key: "tous" | "valide" | "attente"; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "attente", label: "À valider" },
  { key: "valide", label: "Validés" },
];

export default function ResultatsPage() {
  const { resultats, loading } = useResultats();
  const { examens } = useExamens();
  const { patients } = usePatients();
  const { user } = useAuth();
  const router = useRouter();

  // Le médecin se concentre sur la validation : « À valider » par défaut.
  const [filtre, setFiltre] = useState<"tous" | "valide" | "attente">(
    user?.role === "medecin" ? "attente" : "tous",
  );
  const [search, setSearch] = useState("");

  const examensMap = useMemo(
    () => new Map(examens.map((e) => [e.id, e])),
    [examens],
  );
  const patientsMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  );

  const examenNom = (examenId: string) =>
    examensMap.get(examenId)?.nomExamen ?? "Examen supprimé";
  const patientNom = (patientId: string) => {
    const p = patientsMap.get(patientId);
    return p ? `${p.prenom} ${p.nom}` : "Patient inconnu";
  };

  const filtered = resultats.filter((r) => {
    if (filtre === "valide" && !r.valideParMedecin) return false;
    if (filtre === "attente" && r.valideParMedecin) return false;
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      examenNom(r.examenId).toLowerCase().includes(s) ||
      patientNom(r.patientId).toLowerCase().includes(s)
    );
  });

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(filtered, 10, `${search}|${filtre}`);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Résultats</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {resultats.length} résultat{resultats.length > 1 ? "s" : ""} —{" "}
          {resultats.filter((r) => !r.valideParMedecin).length} à valider
        </p>
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
          {FILTRES.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltre(f.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${
                  filtre === f.key
                    ? "bg-emerald-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
            >
              {f.label}
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
            placeholder="Rechercher par examen ou patient..."
            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200
              rounded-xl text-sm text-slate-900 placeholder:text-slate-400
              focus:outline-none focus:border-emerald-500
              focus:ring-2 focus:ring-emerald-500/10 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div
          className="grid grid-cols-12 px-5 py-3 bg-slate-50
          border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider"
        >
          <div className="col-span-4">Examen</div>
          <div className="col-span-4">Patient</div>
          <div className="col-span-2">Valeurs</div>
          <div className="col-span-2 text-right">Statut</div>
        </div>

        {loading ? (
          <div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-12 px-5 py-4 border-b border-slate-50 items-center"
              >
                <div className="col-span-4 h-3 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-4 h-3 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-2 h-3 w-10 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-2 flex justify-end">
                  <div className="h-5 w-16 bg-slate-200 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-5xl mb-4">📋</span>
            <p className="text-slate-600 font-semibold text-base mb-1">
              {search || filtre !== "tous"
                ? "Aucun résultat"
                : "Aucun résultat saisi"}
            </p>
            <p className="text-slate-400 text-sm">
              {search || filtre !== "tous"
                ? "Essayez d'autres critères"
                : "Les résultats se saisissent depuis la fiche d'un examen"}
            </p>
          </div>
        ) : (
          pageItems.map((resultat, idx) => {
            const nbValeurs = Object.keys(resultat.valeurs ?? {}).length;
            return (
              <div
                key={resultat.id}
                onClick={() =>
                  router.push(`/dashboard/examens/${resultat.examenId}`)
                }
                className={`grid grid-cols-12 px-5 py-4 items-center
                  hover:bg-slate-50 transition-colors cursor-pointer
                  ${idx < pageItems.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base flex-shrink-0">
                    📋
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {examenNom(resultat.examenId)}
                  </p>
                </div>
                <div className="col-span-4">
                  <p className="text-sm text-slate-700 truncate">
                    {patientNom(resultat.patientId)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">
                    {nbValeurs} paramètre{nbValeurs > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="col-span-2 flex justify-end">
                  {resultat.valideParMedecin ? (
                    <span className="inline-flex text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">
                      ✓ Validé
                    </span>
                  ) : (
                    <span className="inline-flex text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                      À valider
                    </span>
                  )}
                </div>
              </div>
            );
          })
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
          unitLabel="résultats"
        />
      )}
    </div>
  );
}
