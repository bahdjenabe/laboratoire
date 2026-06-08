"use client";

import { useRouter } from "next/navigation";
import { useDashboard } from "@/hooks/useDashboard";
import type { StatutExamen } from "@/types";

const STATUT_CONFIG: Record<StatutExamen, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "bg-slate-100 text-slate-600" },
  en_cours: { label: "En cours", cls: "bg-amber-100 text-amber-700" },
  termine: { label: "Terminé", cls: "bg-blue-100 text-blue-700" },
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
};

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

export default function DashboardPage() {
  const { stats, loading, refresh } = useDashboard();
  const router = useRouter();

  const cards = [
    {
      label: "Patients aujourd'hui",
      value: stats ? String(stats.patientsAujourdhui) : "0",
      icon: "👤",
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-100",
    },
    {
      label: "Examens en cours",
      value: stats ? String(stats.examensEnCours) : "0",
      icon: "🔬",
      bg: "bg-amber-50",
      text: "text-amber-600",
      border: "border-amber-100",
    },
    {
      label: "Résultats validés",
      value: stats ? String(stats.resultatsValides) : "0",
      icon: "📋",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      border: "border-emerald-100",
    },
    {
      label: "Revenus du jour",
      value: stats ? formatGNF(stats.revenusDuJour) : "0 GNF",
      icon: "💳",
      bg: "bg-violet-50",
      text: "text-violet-600",
      border: "border-violet-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Vue d&apos;ensemble de l&apos;activité du laboratoire
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200
            hover:bg-slate-50 text-slate-700 text-sm font-semibold
            rounded-xl transition-all disabled:opacity-50"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span>
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat) => (
          <div
            key={stat.label}
            className={`bg-white rounded-2xl p-5 border ${stat.border} shadow-sm`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
              <div
                className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.text}
                flex items-center justify-center text-lg`}
              >
                {stat.icon}
              </div>
            </div>
            {loading ? (
              <div className="h-9 w-20 bg-slate-100 rounded-lg animate-pulse" />
            ) : (
              <p className="text-3xl font-extrabold text-slate-900">
                {stat.value}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">Mis à jour maintenant</p>
          </div>
        ))}
      </div>

      {/* Activité récente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Examens récents */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Examens récents</h2>
            <button
              onClick={() => router.push("/dashboard/examens")}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              Voir tout →
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-50 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : stats && stats.examensRecents.length > 0 ? (
            <ul className="space-y-1">
              {stats.examensRecents.map((examen) => {
                const conf = STATUT_CONFIG[examen.statut];
                return (
                  <li
                    key={examen.id}
                    onClick={() =>
                      router.push(`/dashboard/examens/${examen.id}`)
                    }
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                      hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600
                      flex items-center justify-center text-base flex-shrink-0"
                    >
                      🔬
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {examen.nomExamen}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {examen.patientNom}
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
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-300">
              <span className="text-5xl mb-3">🔬</span>
              <p className="text-sm font-medium text-slate-400">
                Aucun examen pour l&apos;instant
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Les examens apparaîtront ici
              </p>
            </div>
          )}
        </div>

        {/* Derniers patients */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Derniers patients</h2>
            <button
              onClick={() => router.push("/dashboard/patients")}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              Voir tout →
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-50 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : stats && stats.patientsRecents.length > 0 ? (
            <ul className="space-y-1">
              {stats.patientsRecents.map((patient) => (
                <li
                  key={patient.id}
                  onClick={() =>
                    router.push(`/dashboard/patients/${patient.id}`)
                  }
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                    hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div
                    className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700
                    flex items-center justify-center text-sm font-bold flex-shrink-0"
                  >
                    {`${patient.prenom?.[0] ?? ""}${patient.nom?.[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {patient.prenom} {patient.nom}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {patient.telephone}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-300">
              <span className="text-5xl mb-3">👤</span>
              <p className="text-sm font-medium text-slate-400">
                Aucun patient enregistré
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Les nouveaux patients apparaîtront ici
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
