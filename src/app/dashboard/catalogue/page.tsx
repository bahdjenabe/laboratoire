"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import {
  catalogueExamenSchema,
  type CatalogueExamenInput,
} from "@/lib/validations";
import type { CatalogueExamen } from "@/types";

const inputCls = `w-full h-11 px-3.5 rounded-xl border border-slate-200
  bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
  focus:outline-none focus:border-emerald-500
  focus:ring-2 focus:ring-emerald-500/10 transition-all`;
const labelCls =
  "block text-xs font-semibold text-slate-600 uppercase tracking-wide";

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

export default function CataloguePage() {
  const {
    catalogue,
    loading,
    addCatalogueExamen,
    editCatalogueExamen,
    removeCatalogueExamen,
  } = useCatalogue();
  const { user } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CatalogueExamen | null>(null);
  const [showConfirm, setShowConfirm] = useState<CatalogueExamen | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CatalogueExamenInput>({
    resolver: zodResolver(catalogueExamenSchema),
    defaultValues: { nom: "", prix: 0 },
  });

  const filtered = catalogue.filter((c) =>
    c.nom.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(filtered, 8, search);

  // Garde-fou : page réservée aux administrateurs.
  if (user && user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <span className="text-5xl mb-4 block">🔒</span>
        <p className="text-slate-600 font-semibold">
          Accès réservé aux administrateurs
        </p>
      </div>
    );
  }

  const openCreate = () => {
    setFormError("");
    reset({ nom: "", prix: 0 });
    setShowCreate(true);
  };

  const openEdit = (item: CatalogueExamen) => {
    setFormError("");
    reset({ nom: item.nom, prix: item.prix });
    setEditing(item);
  };

  const onCreate = async (data: CatalogueExamenInput) => {
    setFormError("");
    try {
      await addCatalogueExamen(data);
      setShowCreate(false);
    } catch (err) {
      setFormError("Erreur lors de l'enregistrement. Réessayez.");
      console.error(err);
    }
  };

  const onEdit = async (data: CatalogueExamenInput) => {
    if (!editing) return;
    setFormError("");
    try {
      await editCatalogueExamen(editing.id, data);
      setEditing(null);
    } catch (err) {
      setFormError("Erreur lors de la mise à jour. Réessayez.");
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!showConfirm) return;
    setDeleting(true);
    try {
      await removeCatalogueExamen(showConfirm.id);
    } finally {
      setDeleting(false);
      setShowConfirm(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Catalogue d&apos;examens
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {catalogue.length} examen{catalogue.length > 1 ? "s" : ""} au tarif
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600
            hover:bg-emerald-700 text-white text-sm font-semibold
            rounded-xl transition-all shadow-lg shadow-emerald-600/20
            hover:shadow-emerald-600/30 hover:-translate-y-0.5"
        >
          + Nouvel examen
        </button>
      </div>

      {/* Recherche */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un examen..."
          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200
            rounded-xl text-sm text-slate-900 placeholder:text-slate-400
            focus:outline-none focus:border-emerald-500
            focus:ring-2 focus:ring-emerald-500/10 transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div
          className="grid grid-cols-12 px-5 py-3 bg-slate-50
          border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider"
        >
          <div className="col-span-7">Examen</div>
          <div className="col-span-3">Prix</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-12 px-5 py-4 border-b border-slate-50 items-center"
              >
                <div className="col-span-7 h-3 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-3 h-3 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-2 flex justify-end gap-2">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-5xl mb-4">🔬</span>
            <p className="text-slate-600 font-semibold text-base mb-1">
              {search ? "Aucun résultat" : "Catalogue vide"}
            </p>
            <p className="text-slate-400 text-sm mb-5">
              {search
                ? "Essayez un autre terme"
                : "Ajoutez les examens proposés par le laboratoire"}
            </p>
            {!search && (
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                + Ajouter un examen
              </button>
            )}
          </div>
        ) : (
          pageItems.map((item, idx) => (
            <div
              key={item.id}
              className={`grid grid-cols-12 px-5 py-4 items-center
                ${idx < pageItems.length - 1 ? "border-b border-slate-50" : ""}`}
            >
              <div className="col-span-7 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base flex-shrink-0">
                  🔬
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {item.nom}
                </p>
              </div>
              <div className="col-span-3">
                <p className="text-sm font-medium text-slate-700">
                  {formatGNF(item.prix)}
                </p>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => openEdit(item)}
                  title="Modifier"
                  className="w-8 h-8 flex items-center justify-center rounded-lg
                    bg-slate-100 hover:bg-blue-100 hover:text-blue-600
                    text-slate-500 transition-colors text-sm"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setShowConfirm(item)}
                  title="Supprimer"
                  className="w-8 h-8 flex items-center justify-center rounded-lg
                    bg-slate-100 hover:bg-red-100 hover:text-red-600
                    text-slate-500 transition-colors text-sm"
                >
                  🗑️
                </button>
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
          unitLabel="examens"
        />
      )}

      {/* Modal création / édition */}
      {(showCreate || editing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editing ? "Modifier l'examen" : "Nouvel examen"}
              </h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit(editing ? onEdit : onCreate)}
              noValidate
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className={labelCls}>Nom de l&apos;examen *</label>
                <input
                  {...register("nom")}
                  placeholder="ex: Hémogramme (NFS)"
                  className={inputCls}
                />
                {errors.nom && (
                  <p className="text-xs text-red-600">{errors.nom.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Prix (GNF) *</label>
                <input
                  type="number"
                  min="0"
                  {...register("prix", { valueAsNumber: true })}
                  placeholder="ex: 50000"
                  className={inputCls}
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
                  onClick={() => {
                    setShowCreate(false);
                    setEditing(null);
                  }}
                  className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? "Enregistrement..."
                    : editing
                      ? "Enregistrer"
                      : "Ajouter"}
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
              Supprimer cet examen du catalogue ?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              « {showConfirm.nom} » ne sera plus proposé à la création. Les
              examens déjà créés ne sont pas affectés.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
