"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useResultats } from "@/hooks/useResultats";
import { useExamens } from "@/hooks/useExamens";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import {
  validerResultat,
  publierCommande,
  commandeToken,
  genererLienResultat,
  revoquerLiensCommande,
} from "@/lib/firestore/resultats";
import { updateStatutExamen } from "@/lib/firestore/examens";
import { logError } from "@/lib/logError";
import Pagination from "@/components/Pagination";
import PatientNotify from "@/components/PatientNotify";
import CommandeNotify from "@/components/CommandeNotify";
import type { Patient, Resultat } from "@/types";

const FILTRES: { key: "tous" | "valide" | "attente"; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "attente", label: "À valider" },
  { key: "valide", label: "Validés" },
];

type StatutCmd = "valide" | "attente" | "partiel";
const STATUT_CMD: Record<StatutCmd, { label: string; cls: string }> = {
  valide: { label: "✓ Validé", cls: "bg-emerald-100 text-emerald-700" },
  attente: { label: "À valider", cls: "bg-amber-100 text-amber-700" },
  partiel: { label: "Partiel", cls: "bg-blue-100 text-blue-700" },
};

interface CommandeResultat {
  key: string;
  patientId: string;
  resultats: Resultat[];
  nbAValider: number;
  statut: StatutCmd;
}

// Active une ligne au clavier (Entrée / Espace) comme un bouton.
const onActivate =
  (action: () => void) => (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCmd, setConfirmCmd] = useState<CommandeResultat | null>(null);
  const [revokeCmd, setRevokeCmd] = useState<CommandeResultat | null>(null);
  const [shareResultat, setShareResultat] = useState<Resultat | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{
    patient: Patient;
    lien: string;
    nb: number;
  } | null>(null);

  const peutValider = user?.role === "medecin" || user?.role === "admin";

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

  // Regroupement par commande : un résultat est rattaché à sa commande via
  // le commandeId de son examen (repli sur l'examenId).
  const commandes = useMemo<CommandeResultat[]>(() => {
    const map = new Map<string, Resultat[]>();
    for (const r of filtered) {
      const key = examensMap.get(r.examenId)?.commandeId ?? r.examenId;
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()].map(([key, res]) => {
      const nbAValider = res.filter((r) => !r.valideParMedecin).length;
      const statut: StatutCmd =
        nbAValider === 0
          ? "valide"
          : nbAValider === res.length
            ? "attente"
            : "partiel";
      return { key, patientId: res[0].patientId, resultats: res, nbAValider, statut };
    });
  }, [filtered, examensMap]);

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(commandes, 6, `${search}|${filtre}`);

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Valide en une fois tous les résultats non encore validés d'une commande.
  const validerCommande = async (cmd: CommandeResultat) => {
    setBusy(cmd.key);
    try {
      for (const r of cmd.resultats) {
        if (r.valideParMedecin) continue;
        const examen = examensMap.get(r.examenId);
        const patient = patientsMap.get(r.patientId);
        await validerResultat(r.id, {
          examenNom: examen?.nomExamen,
          patientPrenom: patient?.prenom,
          patientNom: patient?.nom,
          dateNaissance: patient?.dateNaissance,
          sexe: patient?.sexe,
          telephone: patient?.telephone,
          groupeSanguin: patient?.groupeSanguin,
          valeurs: r.valeurs,
          observations: r.observations,
        });
        // Aligne le statut de l'examen sur la validation (comme la fiche examen).
        await updateStatutExamen(r.examenId, "valide");
      }
    } catch (err) {
      logError(err, { scope: "resultats", action: "validerCommande" });
    } finally {
      setBusy(null);
      setConfirmCmd(null);
    }
  };

  // Révoque tous les liens publics d'une commande : le lien combiné et les
  // liens individuels. Les liens déjà transmis cessent de fonctionner ;
  // « Partager » regénérera des liens neufs.
  const revoquerCommande = async (cmd: CommandeResultat) => {
    setBusy(cmd.key);
    try {
      await revoquerLiensCommande({
        commandeKey: cmd.key,
        resultats: cmd.resultats.map((r) => ({ id: r.id, token: r.token })),
      });
    } catch (err) {
      logError(err, { scope: "resultats", action: "revoquerCommande" });
    } finally {
      setBusy(null);
      setRevokeCmd(null);
    }
  };

  // Partage d'un résultat seul. Si son lien a été révoqué, un nouveau token
  // est généré (nouveau snapshot public) avant d'ouvrir le partage.
  const partagerResultat = async (r: Resultat) => {
    if (r.token) {
      setShareResultat(r);
      return;
    }
    const patient = patientsMap.get(r.patientId);
    if (!patient) return;
    setSharing(r.id);
    try {
      const token = await genererLienResultat(r.id, {
        examenNom: examensMap.get(r.examenId)?.nomExamen,
        patientPrenom: patient.prenom,
        patientNom: patient.nom,
        dateNaissance: patient.dateNaissance,
        sexe: patient.sexe,
        telephone: patient.telephone,
        groupeSanguin: patient.groupeSanguin,
        valeurs: r.valeurs,
        observations: r.observations,
      });
      setShareResultat({ ...r, token });
    } catch (err) {
      logError(err, { scope: "resultats", action: "partageResultat" });
    } finally {
      setSharing(null);
    }
  };

  // Publie un snapshot combiné (1 token = tous les examens validés) puis
  // ouvre le partage avec ce lien unique.
  const ouvrirPartageCommande = async (cmd: CommandeResultat) => {
    const patient = patientsMap.get(cmd.patientId);
    const valides = cmd.resultats.filter((r) => r.valideParMedecin);
    if (!patient || valides.length === 0) return;
    setSharing(cmd.key);
    try {
      const token = await commandeToken(cmd.key);
      await publierCommande(token, {
        patientPrenom: patient.prenom,
        patientNom: patient.nom,
        dateNaissance: patient.dateNaissance,
        sexe: patient.sexe,
        telephone: patient.telephone,
        groupeSanguin: patient.groupeSanguin,
        examens: valides.map((r) => ({
          examenNom: examenNom(r.examenId),
          valeurs: r.valeurs,
          observations: r.observations,
          ref: r.id,
        })),
      });
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setShareData({
        patient,
        lien: `${origin}/patient-portal/${token}`,
        nb: valides.length,
      });
    } catch (err) {
      logError(err, { scope: "resultats", action: "partageCommande" });
    } finally {
      setSharing(null);
    }
  };

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
          <div className="col-span-4">Patient</div>
          <div className="col-span-4">Examens</div>
          <div className="col-span-2">Statut</div>
          <div className="col-span-2 text-right">Action</div>
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
                <div className="col-span-2 h-5 w-16 bg-slate-200 rounded-full animate-pulse" />
                <div className="col-span-2 flex justify-end">
                  <div className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : commandes.length === 0 ? (
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
          pageItems.map((cmd, idx) => {
            const conf = STATUT_CMD[cmd.statut];
            const isOpen = expanded.has(cmd.key);
            const resume = cmd.resultats
              .map((r) => examenNom(r.examenId))
              .join(", ");
            return (
              <div
                key={cmd.key}
                className={
                  idx < pageItems.length - 1 ? "border-b border-slate-50" : ""
                }
              >
                {/* Ligne commande */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-label={`Résultats de ${patientNom(cmd.patientId)}, ${cmd.resultats.length} examen(s)`}
                  onClick={() => toggleExpand(cmd.key)}
                  onKeyDown={onActivate(() => toggleExpand(cmd.key))}
                  className="grid grid-cols-12 px-5 py-4 items-center
                    hover:bg-slate-50 transition-colors cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="text-slate-400 text-xs w-3 flex-shrink-0"
                    >
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <div
                      aria-hidden="true"
                      className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base flex-shrink-0"
                    >
                      📋
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {patientNom(cmd.patientId)}
                    </p>
                  </div>
                  <div className="col-span-4 min-w-0">
                    <p className="text-sm text-slate-700">
                      {cmd.resultats.length} examen
                      {cmd.resultats.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{resume}</p>
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium ${conf.cls}`}
                    >
                      {conf.label}
                    </span>
                  </div>
                  <div
                    className="col-span-2 flex justify-end items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {peutValider && cmd.nbAValider > 0 && (
                      <button
                        onClick={() => setConfirmCmd(cmd)}
                        disabled={busy === cmd.key}
                        className="px-3 h-9 rounded-lg bg-blue-600 hover:bg-blue-700
                          text-white text-xs font-semibold transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busy === cmd.key
                          ? "Validation..."
                          : `✔ Valider (${cmd.nbAValider})`}
                      </button>
                    )}
                    {cmd.resultats.some((r) => r.valideParMedecin) && (
                      <button
                        onClick={() => ouvrirPartageCommande(cmd)}
                        disabled={sharing === cmd.key}
                        title="Partager les résultats au patient"
                        aria-label="Partager les résultats de la commande"
                        className="px-3 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700
                          text-white text-xs font-semibold transition-colors whitespace-nowrap
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sharing === cmd.key ? "Préparation..." : "📤 Partager"}
                      </button>
                    )}
                    {peutValider && cmd.resultats.some((r) => r.token) && (
                      <button
                        onClick={() => setRevokeCmd(cmd)}
                        disabled={busy === cmd.key}
                        title="Révoquer les liens partagés au patient"
                        aria-label="Révoquer les liens publics de la commande"
                        className="px-3 h-9 rounded-lg border border-red-200 text-red-600
                          hover:bg-red-50 text-xs font-semibold transition-colors whitespace-nowrap
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🔒 Révoquer
                      </button>
                    )}
                  </div>
                </div>

                {/* Résultats de la commande (dépliés) */}
                {isOpen && (
                  <div className="bg-slate-50/60">
                    {cmd.resultats.map((r) => {
                      const nbValeurs = Object.keys(r.valeurs ?? {}).length;
                      return (
                        <div
                          key={r.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Ouvrir l'examen ${examenNom(r.examenId)}`}
                          onClick={() =>
                            router.push(`/dashboard/examens/${r.examenId}`)
                          }
                          onKeyDown={onActivate(() =>
                            router.push(`/dashboard/examens/${r.examenId}`),
                          )}
                          className="grid grid-cols-12 px-5 py-3 items-center
                            border-t border-slate-100 hover:bg-white transition-colors cursor-pointer
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                        >
                          <div className="col-span-4 flex items-center gap-3 pl-7">
                            <p className="text-sm text-slate-700 truncate">
                              {examenNom(r.examenId)}
                            </p>
                          </div>
                          <div className="col-span-4 text-xs text-slate-400">
                            {nbValeurs} paramètre{nbValeurs > 1 ? "s" : ""} • Voir
                            le détail →
                          </div>
                          <div
                            className="col-span-4 flex justify-end items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.valideParMedecin && (
                              <button
                                onClick={() => partagerResultat(r)}
                                disabled={sharing === r.id}
                                title="Partager le résultat au patient"
                                aria-label={`Partager le résultat ${examenNom(r.examenId)}`}
                                className="px-2.5 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100
                                  hover:text-emerald-700 text-slate-600 text-xs font-semibold
                                  transition-colors whitespace-nowrap
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {sharing === r.id ? "..." : "📤 Partager"}
                              </button>
                            )}
                            {r.valideParMedecin ? (
                              <span className="inline-flex text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                                ✓ Validé
                              </span>
                            ) : (
                              <span className="inline-flex text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                                À valider
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
          unitLabel="commandes"
        />
      )}

      {/* Confirmation de validation groupée */}
      {confirmCmd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              ✔
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              Valider {confirmCmd.nbAValider} résultat
              {confirmCmd.nbAValider > 1 ? "s" : ""} ?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Les résultats de {patientNom(confirmCmd.patientId)} seront validés
              et rendus consultables par le patient. Action définitive.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCmd(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200
                  text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => validerCommande(confirmCmd)}
                disabled={!!busy}
                className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700
                  text-white text-sm font-semibold transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Validation..." : "Valider"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation de révocation des liens publics */}
      {revokeCmd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              🔒
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              Révoquer les liens partagés ?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Les liens de consultation transmis à{" "}
              {patientNom(revokeCmd.patientId)} cesseront immédiatement de
              fonctionner. Vous pourrez en générer de nouveaux en repartageant.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeCmd(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200
                  text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => revoquerCommande(revokeCmd)}
                disabled={!!busy}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700
                  text-white text-sm font-semibold transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Révocation..." : "Révoquer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partage d'un résultat validé au patient */}
      {shareResultat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShareResultat(null)}
                aria-label="Fermer"
                className="w-9 h-9 flex items-center justify-center rounded-xl
                  bg-white text-slate-500 hover:bg-slate-100 transition-colors shadow"
              >
                ✕
              </button>
            </div>
            {(() => {
              const patient = patientsMap.get(shareResultat.patientId);
              if (!patient) {
                return (
                  <div className="bg-white rounded-2xl p-6 text-center text-sm text-slate-500">
                    Patient introuvable.
                  </div>
                );
              }
              const lien =
                typeof window !== "undefined"
                  ? `${window.location.origin}/patient-portal/${shareResultat.token}`
                  : `/patient-portal/${shareResultat.token}`;
              return (
                <PatientNotify
                  patient={patient}
                  examenNom={examenNom(shareResultat.examenId)}
                  lien={lien}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* Partage groupé : un seul lien pour tous les résultats validés */}
      {shareData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShareData(null)}
                aria-label="Fermer"
                className="w-9 h-9 flex items-center justify-center rounded-xl
                  bg-white text-slate-500 hover:bg-slate-100 transition-colors shadow"
              >
                ✕
              </button>
            </div>
            <CommandeNotify
              patient={shareData.patient}
              lien={shareData.lien}
              nb={shareData.nb}
            />
          </div>
        </div>
      )}
    </div>
  );
}
