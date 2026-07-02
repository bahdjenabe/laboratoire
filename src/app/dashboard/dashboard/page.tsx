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
      href: "/dashboard/patients",
      icon: "👤",
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-100",
    },
    {
      label: "Examens à traiter",
      value: stats ? String(stats.examensATraiter) : "0",
      href: "/dashboard/examens",
      icon: "🔬",
      bg: "bg-amber-50",
      text: "text-amber-600",
      border: "border-amber-100",
    },
    {
      label: "Résultats validés",
      value: stats ? String(stats.resultatsValides) : "0",
      href: "/dashboard/resultats",
      icon: "📋",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      border: "border-emerald-100",
    },
    {
      label: "Revenus du jour",
      value: stats ? formatGNF(stats.revenusDuJour) : "0 GNF",
      href: "/dashboard/paiements",
      icon: "💳",
      bg: "bg-violet-50",
      text: "text-violet-600",
      border: "border-violet-100",
    },
  ];

  const actions = [
    {
      label: "Pré-inscriptions à confirmer",
      value: stats?.preInscriptionsEnAttente ?? 0,
      display: String(stats?.preInscriptionsEnAttente ?? 0),
      href: "/dashboard/pre-inscriptions",
      hint: "À confirmer à l'accueil",
      icon: "📝",
      bg: "bg-sky-50",
      text: "text-sky-600",
      activeBorder: "border-sky-300",
    },
    {
      label: "Résultats à valider",
      value: stats?.resultatsAValider ?? 0,
      display: String(stats?.resultatsAValider ?? 0),
      href: "/dashboard/resultats",
      hint: "En attente d'un médecin",
      icon: "🩺",
      bg: "bg-amber-50",
      text: "text-amber-600",
      activeBorder: "border-amber-300",
    },
    {
      label: "Impayés",
      value: stats?.impayes ?? 0,
      display: stats ? formatGNF(stats.impayes) : "0 GNF",
      href: "/dashboard/paiements",
      hint: "Créances à encaisser",
      icon: "⚠️",
      bg: "bg-rose-50",
      text: "text-rose-600",
      activeBorder: "border-rose-300",
    },
  ];

  const revenusTotal = stats
    ? stats.revenusMensuels.reduce((sum, j) => sum + j.total, 0)
    : 0;
  const revenusMax = stats
    ? Math.max(0, ...stats.revenusMensuels.map((j) => j.total))
    : 0;
  const revenusMoyenne = stats
    ? Math.round(revenusTotal / stats.revenusMensuels.length)
    : 0;

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
            hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer
            rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span>
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat) => (
          <button
            key={stat.label}
            onClick={() => router.push(stat.href)}
            className={`text-left cursor-pointer bg-white rounded-2xl p-5 border ${stat.border}
              shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5`}
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
            <p className="text-xs text-slate-400 mt-1">Voir le détail →</p>
          </button>
        ))}
      </div>

      {/* Actions requises */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {actions.map((action) => {
          const active = !loading && action.value > 0;
          return (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className={`text-left cursor-pointer bg-white rounded-2xl p-5 border shadow-sm
                transition-all hover:shadow-md ${
                  active ? action.activeBorder : "border-slate-100"
                }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-500 font-medium">
                  {action.label}
                </p>
                <div
                  className={`w-10 h-10 rounded-xl ${action.bg} ${action.text}
                  flex items-center justify-center text-lg`}
                >
                  {action.icon}
                </div>
              </div>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 rounded-lg animate-pulse" />
              ) : (
                <p
                  className={`text-3xl font-extrabold ${
                    active ? action.text : "text-slate-900"
                  }`}
                >
                  {action.display}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {active ? action.hint : "Rien à traiter"} →
              </p>
            </button>
          );
        })}
      </div>

      {/* Revenus des 6 derniers mois */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h2 className="font-bold text-slate-900">Revenus des 6 derniers mois</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Total encaissé : {formatGNF(revenusTotal)}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-slate-400">Moyenne / mois</p>
            <p className="text-sm font-bold text-slate-700">
              {formatGNF(revenusMoyenne)}
            </p>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 bg-slate-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : revenusMax > 0 ? (
          <ul className="space-y-1">
            {stats!.revenusMensuels.map((mois, i) => {
              const isCurrent = i === stats!.revenusMensuels.length - 1;
              const pct = Math.round((mois.total / revenusMax) * 100);
              const prev = i > 0 ? stats!.revenusMensuels[i - 1].total : null;
              // Évolution en % vs le mois précédent (si celui-ci avait des revenus).
              const variation =
                prev && prev > 0
                  ? Math.round(((mois.total - prev) / prev) * 100)
                  : null;
              return (
                <li
                  key={i}
                  onClick={() =>
                    router.push(`/dashboard/paiements?mois=${mois.mois}`)
                  }
                  title={`Voir les paiements de ${mois.label}`}
                  className={`flex items-center gap-4 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                    isCurrent ? "bg-violet-50 hover:bg-violet-100" : "hover:bg-slate-50"
                  }`}
                >
                  {/* Nom du mois */}
                  <div className="w-32 flex-shrink-0">
                    <p
                      className={`text-sm leading-tight ${
                        isCurrent
                          ? "font-bold text-violet-700"
                          : "font-semibold text-slate-700"
                      }`}
                    >
                      {mois.label}
                    </p>
                    {isCurrent && (
                      <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide">
                        En cours
                      </p>
                    )}
                  </div>

                  {/* Barre de comparaison */}
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCurrent
                          ? "bg-gradient-to-r from-violet-500 to-violet-600"
                          : "bg-gradient-to-r from-violet-300 to-violet-400"
                      }`}
                      style={{ width: `${Math.max(pct, mois.total > 0 ? 4 : 0)}%` }}
                    />
                  </div>

                  {/* Montant + évolution */}
                  <div className="w-40 flex-shrink-0 text-right">
                    <p
                      className={`text-sm tabular-nums ${
                        mois.total > 0
                          ? "font-bold text-slate-800"
                          : "text-slate-300 font-medium"
                      }`}
                    >
                      {formatGNF(mois.total)}
                    </p>
                    {variation !== null && (
                      <p
                        className={`text-[11px] font-semibold tabular-nums ${
                          variation > 0
                            ? "text-emerald-600"
                            : variation < 0
                              ? "text-rose-500"
                              : "text-slate-400"
                        }`}
                      >
                        {variation > 0 ? "▲" : variation < 0 ? "▼" : "="}{" "}
                        {Math.abs(variation)}%
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300">
            <span className="text-5xl mb-3">💳</span>
            <p className="text-sm font-medium text-slate-400">
              Aucun revenu sur la période
            </p>
          </div>
        )}
      </div>

      {/* Activité récente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Examens récents */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Examens récents</h2>
            <button
              onClick={() => router.push("/dashboard/examens")}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
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
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
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
