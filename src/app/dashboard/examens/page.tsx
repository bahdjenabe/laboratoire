"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useExamens } from "@/hooks/useExamens";
import { usePatients } from "@/hooks/usePatients";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useAuth } from "@/context/AuthContext";
import { getResultatByExamen } from "@/lib/firestore/resultats";
import { getPaiementsByExamen } from "@/lib/firestore/paiements";
import PatientNumeroPicker from "@/components/PatientNumeroPicker";
import Pagination from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useSelection } from "@/hooks/useSelection";
import BulkDeleteBar from "@/components/BulkDeleteBar";
import { examenSchema, type ExamenInput } from "@/lib/validations";
import type { Examen, StatutExamen } from "@/types";

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
        month: "short",
        year: "numeric",
      })
    : "—";
};

// Statut « global » d'une commande = le moins avancé de ses examens.
const STATUT_ORDRE: StatutExamen[] = [
  "en_attente",
  "en_cours",
  "termine",
  "valide",
];

export default function ExamensPage() {
  const { examens, loading, addExamens, removeExamen } = useExamens();
  const { patients } = usePatients();
  const { catalogue, loading: catalogueLoading } = useCatalogue();
  const { user } = useAuth();
  const router = useRouter();

  // Médecin = lecture + validation uniquement (pas de création/suppression).
  const peutGerer = user?.role === "admin" || user?.role === "technicien";
  // Suppression (simple ou multiple) = admin uniquement (règles Firestore).
  const estAdmin = user?.role === "admin";

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
    defaultValues: { patientId: "", catalogueIds: [] },
  });
  const patientId = watch("patientId");
  const catalogueIds = watch("catalogueIds");

  // Recherche dans le catalogue lors de la sélection des examens.
  const [catSearch, setCatSearch] = useState("");
  const catalogueFiltre = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return catalogue;
    return catalogue.filter((c) => c.nom.toLowerCase().includes(q));
  }, [catalogue, catSearch]);

  const toggleCatalogue = (id: string) => {
    const next = catalogueIds.includes(id)
      ? catalogueIds.filter((x) => x !== id)
      : [...catalogueIds, id];
    setValue("catalogueIds", next, { shouldValidate: true });
  };

  const totalSelection = useMemo(
    () =>
      catalogue
        .filter((c) => catalogueIds.includes(c.id))
        .reduce((sum, c) => sum + c.prix, 0),
    [catalogue, catalogueIds],
  );

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

  // Regroupement par commande (examens saisis ensemble pour un patient).
  // Les examens d'avant la fonctionnalité (sans commandeId) forment chacun
  // leur propre groupe. L'ordre (createdAt desc) est préservé via la Map.
  const commandes = useMemo(() => {
    const map = new Map<string, Examen[]>();
    for (const e of filtered) {
      const key = e.commandeId ?? e.id;
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()].map(([key, exams]) => ({
      key,
      patientId: exams[0].patientId,
      createdAt: exams[0].createdAt,
      exams,
      total: exams.reduce((s, e) => s + (e.prix || 0), 0),
      statut: STATUT_ORDRE[
        Math.min(...exams.map((e) => STATUT_ORDRE.indexOf(e.statut)))
      ],
    }));
  }, [filtered]);

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(commandes, 6, `${search}|${filtre}`);

  // Lignes dépliées (clé de commande).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Sélection multiple (admin) pour suppression groupée — au niveau examen.
  const { selected, toggle, setMany, clear } = useSelection();
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const pageExamIds = pageItems.flatMap((c) => c.exams.map((e) => e.id));
  const allPageSelected =
    pageExamIds.length > 0 && pageExamIds.every((id) => selected.has(id));

  const handleBulkDelete = async () => {
    const ids = [...selected];
    let deleted = 0;
    let skipped = 0;
    for (const id of ids) {
      const [res, paies] = await Promise.all([
        getResultatByExamen(id).catch(() => null),
        getPaiementsByExamen(id).catch(() => []),
      ]);
      if (res || paies.length > 0) {
        skipped++;
        continue;
      }
      await removeExamen(id);
      deleted++;
    }
    clear();
    setBulkMsg(
      `${deleted} examen(s) supprimé(s)` +
        (skipped ? `, ${skipped} ignoré(s) (résultat/paiement lié)` : ""),
    );
  };

  // Ouvre une création vierge (réinitialise le patient/champs précédents).
  const openForm = () => {
    reset({ patientId: "", catalogueIds: [] });
    setCatSearch("");
    setFormError("");
    setShowForm(true);
  };

  // Un patient peut faire plusieurs examens : on crée un document par examen
  // sélectionné, chacun avec le prix repris du catalogue.
  const onSubmit = async (data: ExamenInput) => {
    setFormError("");
    const choisis = catalogue.filter((c) => data.catalogueIds.includes(c.id));
    if (choisis.length === 0) {
      setFormError("Sélectionnez au moins un examen.");
      return;
    }
    // Tous les examens cochés ensemble partagent le même identifiant de
    // commande : ils s'afficheront groupés sur une seule ligne du tableau.
    const commandeId = crypto.randomUUID();
    try {
      await addExamens(
        choisis.map((cat) => ({
          patientId: data.patientId,
          nomExamen: cat.nom,
          prix: cat.prix,
          commandeId,
          statut: "en_attente" as const,
          technicienId: user?.uid,
        })),
      );
      reset({ patientId: "", catalogueIds: [] });
      setCatSearch("");
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
            onClick={openForm}
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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div
          className="grid grid-cols-12 px-5 py-3 bg-slate-50
          border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider"
        >
          <div className="col-span-4 flex items-center gap-3">
            {estAdmin && (
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={(e) => setMany(pageExamIds, e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
              />
            )}
            Examens
          </div>
          <div className="col-span-3">Patient</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-1">Statut</div>
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
                onClick={openForm}
                className="px-4 py-2 bg-emerald-600 text-white text-sm
                  font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                + Créer un examen
              </button>
            )}
          </div>
        ) : (
          pageItems.map((cmd, idx) => {
            const conf = STATUT_CONFIG[cmd.statut];
            const isOpen = expanded.has(cmd.key);
            const groupIds = cmd.exams.map((e) => e.id);
            const groupSelected =
              estAdmin && groupIds.every((id) => selected.has(id));
            const resume = cmd.exams.map((e) => e.nomExamen).join(", ");
            return (
              <div
                key={cmd.key}
                className={
                  idx < pageItems.length - 1 ? "border-b border-slate-50" : ""
                }
              >
                {/* Ligne commande */}
                <div
                  onClick={() => toggleExpand(cmd.key)}
                  className="grid grid-cols-12 px-5 py-4 items-center
                    hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    {estAdmin && (
                      <input
                        type="checkbox"
                        checked={groupSelected}
                        onChange={(e) => setMany(groupIds, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
                      />
                    )}
                    <span className="text-slate-400 text-xs w-3 flex-shrink-0">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <div
                      className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600
                      flex items-center justify-center text-base flex-shrink-0"
                    >
                      🔬
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {cmd.exams.length} examen
                        {cmd.exams.length > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{resume}</p>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm text-slate-700 truncate">
                      {patientNom(cmd.patientId)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-slate-700">
                      {formatDate(cmd.createdAt)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatGNF(cmd.total)}
                    </p>
                  </div>
                  <div className="col-span-1">
                    <span
                      className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium ${conf.cls}`}
                    >
                      {conf.label}
                    </span>
                  </div>
                </div>

                {/* Examens de la commande (dépliés) */}
                {isOpen && (
                  <div className="bg-slate-50/60">
                    {cmd.exams.map((examen) => {
                      const sc = STATUT_CONFIG[examen.statut];
                      return (
                        <div
                          key={examen.id}
                          onClick={() =>
                            router.push(`/dashboard/examens/${examen.id}`)
                          }
                          className="grid grid-cols-12 px-5 py-3 items-center
                            border-t border-slate-100 hover:bg-white transition-colors cursor-pointer"
                        >
                          <div className="col-span-4 flex items-center gap-3 pl-7">
                            {estAdmin && (
                              <input
                                type="checkbox"
                                checked={selected.has(examen.id)}
                                onChange={() => toggle(examen.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
                              />
                            )}
                            <p className="text-sm text-slate-700 truncate">
                              {examen.nomExamen}
                            </p>
                          </div>
                          <div className="col-span-3 text-xs text-slate-400">
                            Voir le détail →
                          </div>
                          <div className="col-span-2" />
                          <div className="col-span-2">
                            <p className="text-sm text-slate-600">
                              {formatGNF(examen.prix)}
                            </p>
                          </div>
                          <div className="col-span-1 flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}
                            >
                              {sc.label}
                            </span>
                            {peutGerer && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  askDelete(examen.id);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg
                                  bg-slate-100 hover:bg-red-100 hover:text-red-600
                                  text-slate-500 transition-colors text-xs flex-shrink-0"
                              >
                                🗑️
                              </button>
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

      {estAdmin && (
        <BulkDeleteBar
          count={selected.size}
          onClear={clear}
          onConfirm={handleBulkDelete}
          unitLabel="examens"
        />
      )}

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
                  Matricule du patient *
                </label>
                <input type="hidden" {...register("patientId")} />
                <PatientNumeroPicker
                  patients={patients.filter((p) => !p.archive)}
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

              {/* Suite de la procédure : visible une fois le patient trouvé */}
              {!patientId ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  Saisissez le matricule du patient puis lancez la recherche
                  pour continuer.
                </p>
              ) : (
                <>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Examens à réaliser *
                </label>
                <p className="text-xs text-slate-400">
                  Cochez un ou plusieurs examens. Le prix est repris du
                  catalogue.
                </p>
                <input type="hidden" {...register("catalogueIds")} />

                {catalogue.length > 8 && (
                  <input
                    type="text"
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder="Rechercher un examen..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200
                      bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                      focus:outline-none focus:border-emerald-500
                      focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                )}

                {catalogueLoading ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    Chargement du catalogue...
                  </p>
                ) : catalogue.length === 0 ? (
                  <p className="text-xs text-amber-600 py-2">
                    Aucun examen au catalogue. Un administrateur doit d&apos;abord
                    en ajouter (menu Catalogue).
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-50">
                    {catalogueFiltre.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">
                        Aucun examen trouvé.
                      </p>
                    ) : (
                      catalogueFiltre.map((c) => {
                        const checked = catalogueIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                              ${checked ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCatalogue(c.id)}
                              className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
                            />
                            <span className="flex-1 text-sm font-medium text-slate-800 truncate">
                              {c.nom}
                            </span>
                            <span className="text-sm text-slate-500 flex-shrink-0">
                              {formatGNF(c.prix)}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}

                {errors.catalogueIds && (
                  <p className="text-xs text-red-600">
                    {errors.catalogueIds.message}
                  </p>
                )}

                {catalogueIds.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                    <span className="text-slate-500">
                      {catalogueIds.length} examen
                      {catalogueIds.length > 1 ? "s" : ""} sélectionné
                      {catalogueIds.length > 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold text-slate-900">
                      Total : {formatGNF(totalSelection)}
                    </span>
                  </div>
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
                  {isSubmitting
                    ? "Enregistrement..."
                    : catalogueIds.length > 1
                      ? `Créer ${catalogueIds.length} examens`
                      : "Créer l'examen"}
                </button>
              </div>
                </>
              )}
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
