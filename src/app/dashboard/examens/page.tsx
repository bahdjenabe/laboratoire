"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useExamens } from "@/hooks/useExamens";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { getResultatByExamen } from "@/lib/firestore/resultats";
import { getPaiementsByExamen } from "@/lib/firestore/paiements";
import PatientPicker from "@/components/PatientPicker";
import { examenSchema, type ExamenInput } from "@/lib/validations";
import type { StatutExamen } from "@/types";

const STATUT_CONFIG: Record<StatutExamen, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "bg-slate-100 text-slate-600" },
  en_cours: { label: "En cours", cls: "bg-amber-100 text-amber-700" },
  termine: { label: "Terminé", cls: "bg-blue-100 text-blue-700" },
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
};

const FILTRES: { key: StatutExamen | "tous"; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "en_attente", label: "En attente" },
  { key: "en_cours", label: "En cours" },
  { key: "termine", label: "Terminé" },
  { key: "valide", label: "Validé" },
];

// Analyses fréquentes (saisie assistée)
const ANALYSES_COURANTES = [
  "Hémogramme (NFS)",
  "Glycémie à jeun",
  "Test de paludisme (TDR)",
  "Groupage sanguin",
  "Test VIH",
  "Widal (typhoïde)",
  "Créatininémie",
  "Transaminases (ASAT/ALAT)",
  "Bilan lipidique",
  "Test de grossesse (β-HCG)",
];

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

export default function ExamensPage() {
  const { examens, loading, addExamen, removeExamen } = useExamens();
  const { patients } = usePatients();
  const { user } = useAuth();
  const router = useRouter();

  // Médecin = lecture + validation uniquement (pas de création/suppression).
  const peutGerer = user?.role === "admin" || user?.role === "technicien";

  const [filtre, setFiltre] = useState<StatutExamen | "tous">("tous");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Intégrité : vérifie qu'un examen n'a ni résultat ni paiement avant suppression.
  const [checkLoading, setCheckLoading] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Formulaire de création
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExamenInput>({
    resolver: zodResolver(examenSchema),
    defaultValues: { patientId: "", nomExamen: "", prix: 0 },
  });
  const patientId = watch("patientId");

  const patientsMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  );

  const patientNom = (patientId: string) => {
    const p = patientsMap.get(patientId);
    return p ? `${p.prenom} ${p.nom}` : "Patient inconnu";
  };

  const filtered = examens.filter((e) => {
    if (filtre !== "tous" && e.statut !== filtre) return false;
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      e.nomExamen.toLowerCase().includes(s) ||
      patientNom(e.patientId).toLowerCase().includes(s)
    );
  });

  const onSubmit = async (data: ExamenInput) => {
    setFormError("");
    try {
      await addExamen({
        patientId: data.patientId,
        nomExamen: data.nomExamen,
        prix: data.prix,
        statut: "en_attente",
        technicienId: user?.uid,
      });
      reset({ patientId: "", nomExamen: "", prix: 0 });
      setShowForm(false);
    } catch (err) {
      setFormError("Erreur lors de l'enregistrement. Réessayez.");
      console.error(err);
    }
  };

  // Ouvre la confirmation et vérifie l'existence de données liées.
  const askDelete = async (id: string) => {
    setShowConfirm(id);
    setBlockReason(null);
    setCheckLoading(true);
    try {
      const [res, paies] = await Promise.all([
        getResultatByExamen(id).catch(() => null),
        getPaiementsByExamen(id).catch(() => []),
      ]);
      const raisons: string[] = [];
      if (res) raisons.push("un résultat");
      if (paies.length > 0) raisons.push("un paiement");
      setBlockReason(raisons.length > 0 ? raisons.join(" et ") : null);
    } finally {
      setCheckLoading(false);
    }
  };

  const closeConfirm = () => {
    setShowConfirm(null);
    setBlockReason(null);
    setCheckLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (blockReason) return; // garde-fou
    setDeleting(id);
    try {
      await removeExamen(id);
    } finally {
      setDeleting(null);
      closeConfirm();
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Examens</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {examens.length} examen{examens.length > 1 ? "s" : ""} enregistré
            {examens.length > 1 ? "s" : ""}
          </p>
        </div>
        {peutGerer && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600
              hover:bg-emerald-700 text-white text-sm font-semibold
              rounded-xl transition-all shadow-lg shadow-emerald-600/20
              hover:shadow-emerald-600/30 hover:-translate-y-0.5"
          >
            + Nouvel examen
          </button>
        )}
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
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
          <div className="col-span-3">Patient</div>
          <div className="col-span-2">Prix</div>
          <div className="col-span-2">Statut</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {loading ? (
          <div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-12 px-5 py-4 border-b border-slate-50 items-center"
              >
                <div className="col-span-4 h-3 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-3 h-3 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-2 h-3 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-2 h-5 w-16 bg-slate-200 rounded-full animate-pulse" />
                <div className="col-span-1 flex justify-end">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-5xl mb-4">🔬</span>
            <p className="text-slate-600 font-semibold text-base mb-1">
              {search || filtre !== "tous"
                ? "Aucun résultat"
                : "Aucun examen enregistré"}
            </p>
            <p className="text-slate-400 text-sm mb-5">
              {search || filtre !== "tous"
                ? "Essayez d'autres critères"
                : "Commencez par créer votre premier examen"}
            </p>
            {!search && filtre === "tous" && peutGerer && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-emerald-600 text-white text-sm
                  font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                + Créer un examen
              </button>
            )}
          </div>
        ) : (
          filtered.map((examen, idx) => {
            const conf = STATUT_CONFIG[examen.statut];
            return (
              <div
                key={examen.id}
                onClick={() => router.push(`/dashboard/examens/${examen.id}`)}
                className={`grid grid-cols-12 px-5 py-4 items-center
                  hover:bg-slate-50 transition-colors cursor-pointer
                  ${idx < filtered.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600
                    flex items-center justify-center text-base flex-shrink-0"
                  >
                    🔬
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {examen.nomExamen}
                  </p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-slate-700 truncate">
                    {patientNom(examen.patientId)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-slate-700">
                    {formatGNF(examen.prix)}
                  </p>
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium ${conf.cls}`}
                  >
                    {conf.label}
                  </span>
                </div>
                <div
                  className="col-span-1 flex items-center justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {peutGerer && (
                    <button
                      onClick={() => askDelete(examen.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg
                        bg-slate-100 hover:bg-red-100 hover:text-red-600
                        text-slate-500 transition-colors text-sm"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Nouvel examen</h3>
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
                  Patient *
                </label>
                <input type="hidden" {...register("patientId")} />
                <PatientPicker
                  patients={patients}
                  value={patientId}
                  onChange={(id) =>
                    setValue("patientId", id, { shouldValidate: true })
                  }
                  error={errors.patientId?.message}
                />
                {patients.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Aucun patient. Créez d&apos;abord un patient.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Type d&apos;examen *
                </label>
                <input
                  list="analyses-courantes"
                  {...register("nomExamen")}
                  placeholder="ex: Hémogramme (NFS)"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200
                    bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                    focus:outline-none focus:border-emerald-500
                    focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
                <datalist id="analyses-courantes">
                  {ANALYSES_COURANTES.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
                {errors.nomExamen && (
                  <p className="text-xs text-red-600">
                    {errors.nomExamen.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Prix (GNF) *
                </label>
                <input
                  type="number"
                  min="0"
                  {...register("prix", { valueAsNumber: true })}
                  placeholder="ex: 50000"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200
                    bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                    focus:outline-none focus:border-emerald-500
                    focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
                {errors.prix && (
                  <p className="text-xs text-red-600">{errors.prix.message}</p>
                )}
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
                  {isSubmitting ? "Enregistrement..." : "Créer l'examen"}
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
            {checkLoading ? (
              <div className="py-6 text-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Vérification...</p>
              </div>
            ) : blockReason ? (
              <>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  ⚠️
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                  Suppression impossible
                </h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                  Cet examen a {blockReason} enregistré. Il ne peut pas être
                  supprimé.
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
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  🗑️
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                  Supprimer cet examen ?
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
