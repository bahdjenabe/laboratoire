"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePaiements } from "@/hooks/usePaiements";
import { useExamens } from "@/hooks/useExamens";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { getPatient } from "@/lib/firestore/patients";
import { generateRecu } from "@/lib/pdf/generateRecu";
import CommandePicker, {
  type CommandeAFacturer,
} from "@/components/CommandePicker";
import Pagination from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useSelection } from "@/hooks/useSelection";
import BulkDeleteBar from "@/components/BulkDeleteBar";
import {
  grouperExamens,
  grouperPaiements,
  type CommandePaiements,
  type StatutPaiementCommande,
} from "@/lib/commandes";
import type { Paiement } from "@/types";

const MODES = ["Espèces", "Mobile Money", "Carte bancaire", "Virement"];

// Détails proposés par mode (réseau de carte, opérateur mobile, banque).
// Les espèces n'ont pas de détail.
const MODE_DETAILS: Record<string, string[]> = {
  "Carte bancaire": ["Visa", "Mastercard", "Autre"],
  "Mobile Money": ["Orange Money", "MTN MoMo", "Paycard", "Soutra Money", "Autre"],
  Virement: [
    "Ecobank",
    "BICIGUI",
    "Société Générale (SGBG)",
    "Orabank",
    "UBA",
    "Vista Bank",
    "Autre",
  ],
};

const FILTRES: { key: "tous" | "paye" | "non_paye"; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "paye", label: "Payés" },
  { key: "non_paye", label: "Non payés" },
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

// Active une ligne au clavier (Entrée / Espace) comme un bouton.
const onActivate =
  (action: () => void) => (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

// Affichage du statut global d'une commande de paiements.
const STATUT_CMD: Record<StatutPaiementCommande, { label: string; cls: string }> =
  {
    paye: { label: "✓ Payé", cls: "bg-emerald-100 text-emerald-700" },
    non_paye: { label: "Non payé", cls: "bg-red-100 text-red-700" },
    partiel: { label: "Partiel", cls: "bg-amber-100 text-amber-700" },
  };

export default function PaiementsPage() {
  const { paiements, loading, addPaiements, editPaiement, removePaiement } =
    usePaiements();
  const { examens } = useExamens();
  const { patients } = usePatients();
  const { user } = useAuth();
  const router = useRouter();

  const [filtre, setFiltre] = useState<"tous" | "paye" | "non_paye">("tous");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState<CommandePaiements | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Création d'un encaissement (au niveau commande).
  const [selectedKey, setSelectedKey] = useState("");
  const [createMode, setCreateMode] = useState(MODES[0]);
  const [createDetail, setCreateDetail] = useState("");
  const [createReference, setCreateReference] = useState("");
  const [createStatut, setCreateStatut] = useState<"paye" | "non_paye">("paye");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const createDetailOptions = MODE_DETAILS[createMode] ?? [];

  // Édition d'une commande (mode / détail / référence / statut appliqués à
  // tous ses paiements).
  const [editing, setEditing] = useState<CommandePaiements | null>(null);
  const [editMode, setEditMode] = useState(MODES[0]);
  const [editDetail, setEditDetail] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editStatut, setEditStatut] = useState<"paye" | "non_paye">("paye");
  const [savingEdit, setSavingEdit] = useState(false);
  const editDetailOptions = MODE_DETAILS[editMode] ?? [];

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

  // Commandes à facturer : examens non encore payés, regroupés par commande.
  const commandesAFacturer = useMemo<CommandeAFacturer[]>(
    () => grouperExamens(examens.filter((e) => !examensFactures.has(e.id))),
    [examens, examensFactures],
  );

  const selectedCommande = commandesAFacturer.find((c) => c.key === selectedKey);

  // Lien profond depuis la page Examens (?commande=KEY) : ouvre le formulaire
  // avec la commande déjà sélectionnée pour l'encaisser groupée.
  const [pendingCommande, setPendingCommande] = useState<string | null>(null);
  // Vrai si on arrive via le bouton « Encaisser » (lien profond ?commande=).
  // Dans ce cas, après un encaissement payé, on ouvre la feuille de la commande
  // pour saisir les résultats (la cible est dérivée de la commande payée).
  const [cameFromDeepLink, setCameFromDeepLink] = useState(false);
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("commande");
    if (k) {
      setPendingCommande(k);
      setCameFromDeepLink(true);
    }
  }, []);
  useEffect(() => {
    if (!pendingCommande) return;
    const cmd = commandesAFacturer.find((c) => c.key === pendingCommande);
    if (cmd) {
      setSelectedKey(pendingCommande);
      setCreateMode(MODES[0]);
      setCreateDetail("");
      setCreateReference("");
      setCreateStatut("paye");
      setFormError("");
      setShowForm(true);
      setPendingCommande(null);
    }
  }, [pendingCommande, commandesAFacturer]);

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

  // Regroupement par commande (paiements encaissés ensemble).
  const commandes = useMemo(() => grouperPaiements(filtered), [filtered]);

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

  // Sélection multiple (admin) pour suppression groupée — au niveau paiement.
  const { selected, toggle, setMany, clear } = useSelection();
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const pagePaiementIds = pageItems.flatMap((c) =>
    c.paiements.map((p) => p.id),
  );
  const allPageSelected =
    pagePaiementIds.length > 0 &&
    pagePaiementIds.every((id) => selected.has(id));

  const handleBulkDelete = async () => {
    const ids = [...selected];
    for (const id of ids) await removePaiement(id);
    clear();
    setBulkMsg(`${ids.length} paiement(s) supprimé(s)`);
  };

  const openForm = () => {
    setSelectedKey("");
    setCreateMode(MODES[0]);
    setCreateDetail("");
    setCreateReference("");
    setCreateStatut("paye");
    setFormError("");
    setShowForm(true);
  };

  // Encaisse tous les examens de la commande : un paiement par examen
  // (montant = prix du catalogue), partageant le même commandeId.
  const onCreate = async () => {
    setFormError("");
    if (!selectedCommande) {
      setFormError("Veuillez sélectionner une commande.");
      return;
    }
    const aDetail = !!MODE_DETAILS[createMode]?.length;
    const detail = aDetail ? createDetail : "";
    const reference = (aDetail ? createReference : "").trim();
    setCreating(true);
    try {
      await addPaiements(
        selectedCommande.exams.map((ex) => ({
          examenId: ex.id,
          patientId: ex.patientId,
          commandeId: ex.commandeId ?? ex.id,
          montant: ex.prix,
          statut: createStatut,
          modePaiement: createMode,
          detailPaiement: detail,
          referencePaiement: reference,
        })),
      );
      setShowForm(false);
      // Encaissement payé via lien profond (bouton Encaisser) → ouvrir la
      // feuille de la commande pour saisir les résultats.
      if (cameFromDeepLink && createStatut === "paye") {
        router.push(
          `/dashboard/commandes/${encodeURIComponent(selectedCommande.key)}`,
        );
      }
    } catch (err) {
      setFormError("Erreur lors de l'enregistrement. Réessayez.");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  // Bascule le statut de toute la commande (payé ⇄ non payé).
  const toggleStatutCommande = async (cmd: CommandePaiements) => {
    const cible = cmd.statut === "paye" ? "non_paye" : "paye";
    setBusy(cmd.key);
    try {
      for (const p of cmd.paiements) {
        if (p.statut !== cible) await editPaiement(p.id, { statut: cible });
      }
    } finally {
      setBusy(null);
    }
  };

  // Bascule le statut d'un seul paiement de la commande.
  const toggleStatutPaiement = async (p: Paiement) => {
    setBusy(p.id);
    try {
      await editPaiement(p.id, {
        statut: p.statut === "paye" ? "non_paye" : "paye",
      });
    } finally {
      setBusy(null);
    }
  };

  // Reçu unique pour toute la commande (toutes ses lignes d'examens).
  const handleRecu = async (cmd: CommandePaiements) => {
    setBusy(cmd.key);
    try {
      const patient = await getPatient(cmd.patientId);
      if (!patient) return;
      const lignes = cmd.paiements.map((p) => ({
        nom: examenNom(p.examenId),
        montant: p.montant,
      }));
      const meta: Paiement = {
        ...cmd.paiements[0],
        statut: cmd.statut === "paye" ? "paye" : "non_paye",
      };
      generateRecu(meta, patient, lignes);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!showConfirm) return;
    setDeleting(true);
    try {
      for (const p of showConfirm.paiements) await removePaiement(p.id);
    } finally {
      setDeleting(false);
      setShowConfirm(null);
    }
  };

  const openEdit = (cmd: CommandePaiements) => {
    const ref = cmd.paiements[0];
    setEditing(cmd);
    setEditMode(ref.modePaiement ?? MODES[0]);
    setEditDetail(ref.detailPaiement ?? "");
    setEditReference(ref.referencePaiement ?? "");
    setEditStatut(cmd.statut === "paye" ? "paye" : "non_paye");
  };

  const changeEditMode = (mode: string) => {
    setEditMode(mode);
    const opts = MODE_DETAILS[mode] ?? [];
    setEditDetail(opts[0] ?? "");
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const aDetail = !!MODE_DETAILS[editMode]?.length;
      const detail = aDetail ? editDetail : "";
      const reference = (aDetail ? editReference : "").trim();
      for (const p of editing.paiements) {
        await editPaiement(p.id, {
          modePaiement: editMode,
          detailPaiement: detail,
          referencePaiement: reference,
          statut: editStatut,
        });
      }
      setEditing(null);
    } finally {
      setSavingEdit(false);
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
          onClick={openForm}
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
          <div className="col-span-3 flex items-center gap-3">
            {estAdmin && (
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={(e) => setMany(pagePaiementIds, e.target.checked)}
                aria-label="Tout sélectionner sur la page"
                className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
              />
            )}
            Patient
          </div>
          <div className="col-span-3">Examens</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Montant</div>
          <div className="col-span-1">Statut</div>
          <div className="col-span-1 text-right">Actions</div>
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
                <div className="col-span-2 h-3 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-1 h-5 w-14 bg-slate-200 rounded-full animate-pulse" />
                <div className="col-span-1 flex justify-end">
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
                : "Enregistrez le paiement d'une commande"}
            </p>
            {!search && filtre === "tous" && (
              <button
                onClick={openForm}
                className="px-4 py-2 bg-emerald-600 text-white text-sm
                  font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                + Enregistrer un paiement
              </button>
            )}
          </div>
        ) : (
          pageItems.map((cmd, idx) => {
            const conf = STATUT_CMD[cmd.statut];
            const isOpen = expanded.has(cmd.key);
            const groupIds = cmd.paiements.map((p) => p.id);
            const groupSelected =
              estAdmin && groupIds.every((id) => selected.has(id));
            const resume = cmd.paiements
              .map((p) => examenNom(p.examenId))
              .join(", ");
            const refPaie = cmd.paiements[0];
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
                  aria-label={`Paiement de ${patientNom(cmd.patientId)}, ${cmd.paiements.length} examen(s)`}
                  onClick={() => toggleExpand(cmd.key)}
                  onKeyDown={onActivate(() => toggleExpand(cmd.key))}
                  className="grid grid-cols-12 px-5 py-4 items-center
                    hover:bg-slate-50 transition-colors cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                >
                  <div className="col-span-3 flex items-center gap-3">
                    {estAdmin && (
                      <input
                        type="checkbox"
                        checked={groupSelected}
                        onChange={(e) => setMany(groupIds, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Sélectionner la commande"
                        className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="text-slate-400 text-xs w-3 flex-shrink-0"
                    >
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {patientNom(cmd.patientId)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {refPaie.modePaiement ?? "—"}
                        {refPaie.detailPaiement
                          ? ` · ${refPaie.detailPaiement}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm text-slate-700">
                      {cmd.paiements.length} examen
                      {cmd.paiements.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{resume}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-slate-700">
                      {formatDate(cmd.createdAt)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatGNF(cmd.montantTotal)}
                    </p>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStatutCommande(cmd);
                      }}
                      disabled={busy === cmd.key}
                      title="Cliquer pour changer le statut de la commande"
                      className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${conf.cls}`}
                    >
                      {conf.label}
                    </button>
                  </div>
                  <div
                    className="col-span-1 flex items-center justify-end gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openEdit(cmd)}
                      title="Modifier le paiement"
                      aria-label="Modifier le paiement"
                      className="w-8 h-8 flex items-center justify-center rounded-lg
                        bg-slate-100 hover:bg-blue-100 hover:text-blue-600
                        text-slate-500 transition-colors text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleRecu(cmd)}
                      disabled={busy === cmd.key}
                      title="Télécharger le reçu"
                      aria-label="Télécharger le reçu"
                      className="w-8 h-8 flex items-center justify-center rounded-lg
                        bg-slate-100 hover:bg-emerald-100 hover:text-emerald-600
                        text-slate-500 transition-colors text-sm disabled:opacity-50"
                    >
                      🧾
                    </button>
                    {estAdmin && (
                      <button
                        onClick={() => setShowConfirm(cmd)}
                        title="Supprimer"
                        aria-label="Supprimer le paiement"
                        className="w-8 h-8 flex items-center justify-center rounded-lg
                          bg-slate-100 hover:bg-red-100 hover:text-red-600
                          text-slate-500 transition-colors text-sm"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Paiements de la commande (dépliés) */}
                {isOpen && (
                  <div className="bg-slate-50/60">
                    {cmd.paiements.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-12 px-5 py-3 items-center
                          border-t border-slate-100"
                      >
                        <div className="col-span-6 flex items-center gap-3 pl-7">
                          {estAdmin && (
                            <input
                              type="checkbox"
                              checked={selected.has(p.id)}
                              onChange={() => toggle(p.id)}
                              aria-label={`Sélectionner le paiement ${examenNom(p.examenId)}`}
                              className="w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
                            />
                          )}
                          <p className="text-sm text-slate-700 truncate">
                            {examenNom(p.examenId)}
                          </p>
                        </div>
                        <div className="col-span-2" />
                        <div className="col-span-2">
                          <p className="text-sm text-slate-600">
                            {formatGNF(p.montant)}
                          </p>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <button
                            onClick={() => toggleStatutPaiement(p)}
                            disabled={busy === p.id}
                            title="Changer le statut de cet examen"
                            className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50
                              ${
                                p.statut === "paye"
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                          >
                            {p.statut === "paye" ? "✓ Payé" : "Non payé"}
                          </button>
                        </div>
                      </div>
                    ))}
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

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Commande à encaisser *
                </label>
                <CommandePicker
                  commandes={commandesAFacturer}
                  patientNom={patientNom}
                  patientNumero={(id) => patientsMap.get(id)?.numero}
                  value={selectedKey}
                  onChange={setSelectedKey}
                />
                {commandesAFacturer.length === 0 && (
                  <p className="text-xs text-amber-600">
                    {examens.length === 0
                      ? "Aucun examen. Créez d'abord un examen."
                      : "Tous les examens ont déjà un paiement enregistré."}
                  </p>
                )}
              </div>

              {/* Détail de la commande sélectionnée */}
              {selectedCommande && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100">
                  {selectedCommande.exams.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <span className="text-slate-600 truncate">
                        {ex.nomExamen}
                      </span>
                      <span className="text-slate-700 font-medium flex-shrink-0">
                        {formatGNF(ex.prix)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-semibold text-slate-900">
                      Total
                    </span>
                    <span className="text-sm font-bold text-emerald-700">
                      {formatGNF(selectedCommande.total)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Mode
                </label>
                <select
                  value={createMode}
                  onChange={(e) => {
                    setCreateMode(e.target.value);
                    const opts = MODE_DETAILS[e.target.value] ?? [];
                    setCreateDetail(opts[0] ?? "");
                  }}
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

              {createDetailOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {createMode === "Virement"
                      ? "Banque"
                      : createMode === "Mobile Money"
                        ? "Opérateur"
                        : "Réseau de carte"}
                  </label>
                  <select
                    value={createDetail}
                    onChange={(e) => setCreateDetail(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200
                      bg-slate-50 text-sm text-slate-900
                      focus:outline-none focus:border-emerald-500
                      focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  >
                    {createDetailOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {createDetailOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Référence transaction
                  </label>
                  <input
                    value={createReference}
                    onChange={(e) => setCreateReference(e.target.value)}
                    placeholder={
                      createMode === "Mobile Money"
                        ? "ID transaction (ex: OM240612.1532.A45)"
                        : createMode === "Carte bancaire"
                          ? "N° d'autorisation du TPE"
                          : "Référence du virement"
                    }
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200
                      bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                      focus:outline-none focus:border-emerald-500
                      focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                  <p className="text-xs text-slate-400">
                    Pour le rapprochement comptable. Ne jamais saisir un numéro
                    de carte complet ni un code confidentiel.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Statut
                </label>
                <div className="flex gap-2">
                  {(["paye", "non_paye"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCreateStatut(st)}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-colors border
                        ${
                          createStatut === st
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
                  type="button"
                  onClick={onCreate}
                  disabled={creating || !selectedCommande}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
                    text-white text-sm font-semibold transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
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
              {showConfirm.paiements.length > 1
                ? `Les ${showConfirm.paiements.length} paiements de cette commande seront supprimés. `
                : ""}
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
                onClick={handleDelete}
                disabled={deleting}
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

      {/* Modal édition paiement */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                Modifier le paiement
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                  text-slate-400 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {patientNom(editing.patientId)}
                </p>
                <p className="text-xs text-slate-400">
                  {editing.paiements.length} examen
                  {editing.paiements.length > 1 ? "s" : ""} •{" "}
                  {formatGNF(editing.montantTotal)}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Mode
                </label>
                <select
                  value={editMode}
                  onChange={(e) => changeEditMode(e.target.value)}
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

              {editDetailOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {editMode === "Virement"
                      ? "Banque"
                      : editMode === "Mobile Money"
                        ? "Opérateur"
                        : "Réseau de carte"}
                  </label>
                  <select
                    value={editDetail}
                    onChange={(e) => setEditDetail(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200
                      bg-slate-50 text-sm text-slate-900
                      focus:outline-none focus:border-emerald-500
                      focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  >
                    {editDetailOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editDetailOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Référence transaction
                  </label>
                  <input
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    placeholder={
                      editMode === "Mobile Money"
                        ? "ID transaction (ex: OM240612.1532.A45)"
                        : editMode === "Carte bancaire"
                          ? "N° d'autorisation du TPE"
                          : "Référence du virement"
                    }
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200
                      bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                      focus:outline-none focus:border-emerald-500
                      focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Statut (toute la commande)
                </label>
                <div className="flex gap-2">
                  {(["paye", "non_paye"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditStatut(st)}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-colors border
                        ${
                          editStatut === st
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

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 h-11 rounded-xl border border-slate-200
                    text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={savingEdit}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
                    text-white text-sm font-semibold transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEdit ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
