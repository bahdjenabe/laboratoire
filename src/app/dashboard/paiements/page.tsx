"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePaiements } from "@/hooks/usePaiements";
import { useExamens } from "@/hooks/useExamens";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { getPatient } from "@/lib/firestore/patients";
import { getExamen } from "@/lib/firestore/examens";
import { generateRecu } from "@/lib/pdf/generateRecu";
import { paiementSchema, type PaiementInput } from "@/lib/validations";
import ExamenPicker from "@/components/ExamenPicker";
import Pagination from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";

const MODES = ["Espèces", "Mobile Money", "Carte bancaire", "Virement"];

const FILTRES: { key: "tous" | "paye" | "non_paye"; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "paye", label: "Payés" },
  { key: "non_paye", label: "Non payés" },
];

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

export default function PaiementsPage() {
  const { paiements, loading, addPaiement, editPaiement, removePaiement } =
    usePaiements();
  const { examens } = useExamens();
  const { patients } = usePatients();
  const { user } = useAuth();

  const [filtre, setFiltre] = useState<"tous" | "paye" | "non_paye">("tous");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaiementInput>({
    resolver: zodResolver(paiementSchema),
    defaultValues: {
      examenId: "",
      montant: 0,
      modePaiement: MODES[0],
      statut: "paye",
    },
  });
  const statut = watch("statut");
  const examenId = watch("examenId");

  const examensMap = useMemo(
    () => new Map(examens.map((e) => [e.id, e])),
    [examens],
  );
  const patientsMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  );

  // Examens ayant déjà un paiement → exclus de la liste « à facturer ».
  const examensFactures = useMemo(
    () => new Set(paiements.map((p) => p.examenId)),
    [paiements],
  );
  const examensAFacturer = useMemo(
    () => examens.filter((e) => !examensFactures.has(e.id)),
    [examens, examensFactures],
  );

  const examenNom = (id: string) =>
    examensMap.get(id)?.nomExamen ?? "Examen supprimé";
  const patientNom = (id: string) => {
    const p = patientsMap.get(id);
    return p ? `${p.prenom} ${p.nom}` : "Patient inconnu";
  };

  // Totaux
  const totalEncaisse = paiements
    .filter((p) => p.statut === "paye")
    .reduce((s, p) => s + (p.montant || 0), 0);
  const totalAttente = paiements
    .filter((p) => p.statut === "non_paye")
    .reduce((s, p) => s + (p.montant || 0), 0);

  const filtered = paiements.filter((p) => {
    if (filtre !== "tous" && p.statut !== filtre) return false;
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      patientNom(p.patientId).toLowerCase().includes(s) ||
      examenNom(p.examenId).toLowerCase().includes(s)
    );
  });

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(filtered, 10, `${search}|${filtre}`);

  // Sélection d'un examen → pré-remplit le montant avec son prix.
  const handleExamenSelect = (id: string) => {
    setValue("examenId", id, { shouldValidate: true });
    const ex = examensMap.get(id);
    if (ex) setValue("montant", ex.prix);
  };

  const onSubmit = async (data: PaiementInput) => {
    setFormError("");
    const ex = examensMap.get(data.examenId);
    if (!ex) {
      setFormError("Veuillez sélectionner un examen.");
      return;
    }
    try {
      await addPaiement({
        examenId: ex.id,
        patientId: ex.patientId,
        montant: data.montant,
        statut: data.statut,
        modePaiement: data.modePaiement,
      });
      reset({
        examenId: "",
        montant: 0,
        modePaiement: MODES[0],
        statut: "paye",
      });
      setShowForm(false);
    } catch (err) {
      setFormError("Erreur lors de l'enregistrement. Réessayez.");
      console.error(err);
    }
  };

  const toggleStatut = async (id: string, statut: "paye" | "non_paye") => {
    setBusy(id);
    try {
      await editPaiement(id, {
        statut: statut === "paye" ? "non_paye" : "paye",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleRecu = async (paiementId: string) => {
    const paiement = paiements.find((p) => p.id === paiementId);
    if (!paiement) return;
    setBusy(paiementId);
    try {
      const [patient, examen] = await Promise.all([
        getPatient(paiement.patientId),
        paiement.examenId ? getExamen(paiement.examenId) : Promise.resolve(null),
      ]);
      if (patient) generateRecu(paiement, patient, examen);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await removePaiement(id);
    } finally {
      setDeleting(null);
      setShowConfirm(null);
    }
  };

  // Encaissement : admin ou technicien (accueil). Suppression : admin seul.
  const estAdmin = user?.role === "admin";
  if (user && user.role !== "admin" && user.role !== "technicien") {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <span className="text-5xl mb-4 block">🔒</span>
        <p className="text-slate-600 font-semibold">
          Accès réservé aux administrateurs et techniciens
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paiements</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {paiements.length} transaction{paiements.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600
            hover:bg-emerald-700 text-white text-sm font-semibold
            rounded-xl transition-all shadow-lg shadow-emerald-600/20
            hover:shadow-emerald-600/30 hover:-translate-y-0.5"
        >
          + Nouveau paiement
        </button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Encaissé</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-2">
            {formatGNF(totalEncaisse)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">En attente</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-2">
            {formatGNF(totalAttente)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Total facturé</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {formatGNF(totalEncaisse + totalAttente)}
          </p>
        </div>
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
            placeholder="Rechercher par patient ou examen..."
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
          <div className="col-span-3">Patient</div>
          <div className="col-span-3">Examen</div>
          <div className="col-span-2">Montant</div>
          <div className="col-span-2">Statut</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-12 px-5 py-4 border-b border-slate-50 items-center"
              >
                <div className="col-span-3 h-3 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-3 h-3 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-2 h-3 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-2 h-5 w-16 bg-slate-200 rounded-full animate-pulse" />
                <div className="col-span-2 flex justify-end gap-2">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
                  <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-5xl mb-4">💳</span>
            <p className="text-slate-600 font-semibold text-base mb-1">
              {search || filtre !== "tous"
                ? "Aucun résultat"
                : "Aucun paiement enregistré"}
            </p>
            <p className="text-slate-400 text-sm mb-5">
              {search || filtre !== "tous"
                ? "Essayez d'autres critères"
                : "Enregistrez le paiement d'un examen"}
            </p>
            {!search && filtre === "tous" && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-emerald-600 text-white text-sm
                  font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                + Enregistrer un paiement
              </button>
            )}
          </div>
        ) : (
          pageItems.map((paiement, idx) => (
            <div
              key={paiement.id}
              className={`grid grid-cols-12 px-5 py-4 items-center
                ${idx < pageItems.length - 1 ? "border-b border-slate-50" : ""}`}
            >
              <div className="col-span-3">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {patientNom(paiement.patientId)}
                </p>
                <p className="text-xs text-slate-400">
                  {paiement.modePaiement ?? "—"}
                </p>
              </div>
              <div className="col-span-3">
                <p className="text-sm text-slate-700 truncate">
                  {examenNom(paiement.examenId)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-slate-900">
                  {formatGNF(paiement.montant)}
                </p>
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => toggleStatut(paiement.id, paiement.statut)}
                  disabled={busy === paiement.id}
                  title="Cliquer pour changer le statut"
                  className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50
                    ${
                      paiement.statut === "paye"
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    }`}
                >
                  {paiement.statut === "paye" ? "✓ Payé" : "Non payé"}
                </button>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleRecu(paiement.id)}
                  disabled={busy === paiement.id}
                  title="Télécharger le reçu"
                  className="w-8 h-8 flex items-center justify-center rounded-lg
                    bg-slate-100 hover:bg-emerald-100 hover:text-emerald-600
                    text-slate-500 transition-colors text-sm disabled:opacity-50"
                >
                  🧾
                </button>
                {estAdmin && (
                  <button
                    onClick={() => setShowConfirm(paiement.id)}
                    title="Supprimer"
                    className="w-8 h-8 flex items-center justify-center rounded-lg
                      bg-slate-100 hover:bg-red-100 hover:text-red-600
                      text-slate-500 transition-colors text-sm"
                  >
                    🗑️
                  </button>
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
          unitLabel="paiements"
        />
      )}

      {/* Modal création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                Nouveau paiement
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                  text-slate-400 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Examen *
                </label>
                <input type="hidden" {...register("examenId")} />
                <ExamenPicker
                  examens={examensAFacturer}
                  patientNom={patientNom}
                  value={examenId}
                  onChange={handleExamenSelect}
                  error={errors.examenId?.message}
                />
                {examensAFacturer.length === 0 && (
                  <p className="text-xs text-amber-600">
                    {examens.length === 0
                      ? "Aucun examen. Créez d'abord un examen."
                      : "Tous les examens ont déjà un paiement enregistré."}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Montant (GNF) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...register("montant", { valueAsNumber: true })}
                    placeholder="ex: 50000"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200
                      bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                      focus:outline-none focus:border-emerald-500
                      focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                  {errors.montant && (
                    <p className="text-xs text-red-600">
                      {errors.montant.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Mode
                  </label>
                  <select
                    {...register("modePaiement")}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200
                      bg-slate-50 text-sm text-slate-900
                      focus:outline-none focus:border-emerald-500
                      focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Statut
                </label>
                <div className="flex gap-2">
                  {(["paye", "non_paye"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        setValue("statut", st, { shouldValidate: true })
                      }
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-colors border
                        ${
                          statut === st
                            ? st === "paye"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-red-600 text-white border-red-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                      {st === "paye" ? "Payé" : "Non payé"}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-200
                    text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
                    text-white text-sm font-semibold transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              🗑️
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              Supprimer ce paiement ?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
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
          </div>
        </div>
      )}
    </div>
  );
}
