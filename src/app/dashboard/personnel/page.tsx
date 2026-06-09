"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePersonnel } from "@/hooks/usePersonnel";
import { useAuth } from "@/context/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import {
  staffSchema,
  staffEditSchema,
  type StaffInput,
  type StaffEditInput,
} from "@/lib/validations";
import type { Role, User } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  medecin: "Médecin",
  technicien: "Technicien",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  medecin: "bg-emerald-100 text-emerald-700",
  technicien: "bg-blue-100 text-blue-700",
};
const ROLES: Role[] = ["admin", "medecin", "technicien"];

const inputCls = `w-full h-11 px-3.5 rounded-xl border border-slate-200
  bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
  focus:outline-none focus:border-emerald-500
  focus:ring-2 focus:ring-emerald-500/10 transition-all`;
const labelCls =
  "block text-xs font-semibold text-slate-600 uppercase tracking-wide";

function authErrorMessage(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use": "Cet e-mail est déjà utilisé.",
    "auth/invalid-email": "Adresse e-mail invalide.",
    "auth/weak-password": "Mot de passe trop faible (min. 6 caractères).",
  };
  return map[code] ?? "Erreur lors de la création. Réessayez.";
}

export default function PersonnelPage() {
  const { staff, loading, addStaff, editStaff, removeStaff } = usePersonnel();
  const { user } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [showConfirm, setShowConfirm] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");

  const createForm = useForm<StaffInput>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      prenom: "",
      nom: "",
      email: "",
      password: "",
      role: "technicien",
    },
  });

  const editForm = useForm<StaffEditInput>({
    resolver: zodResolver(staffEditSchema),
    defaultValues: { prenom: "", nom: "", role: "technicien" },
  });

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(staff, 10);

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
    createForm.reset({
      prenom: "",
      nom: "",
      email: "",
      password: "",
      role: "technicien",
    });
    setShowCreate(true);
  };

  const openEdit = (membre: User) => {
    setFormError("");
    editForm.reset({
      prenom: membre.prenom,
      nom: membre.nom,
      role: membre.role as StaffEditInput["role"],
    });
    setEditing(membre);
  };

  const onCreate = async (data: StaffInput) => {
    setFormError("");
    try {
      await addStaff(data);
      setShowCreate(false);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setFormError(authErrorMessage(code));
      console.error(err);
    }
  };

  const onEdit = async (data: StaffEditInput) => {
    if (!editing) return;
    setFormError("");
    try {
      await editStaff(editing.uid, data);
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
      await removeStaff(showConfirm.uid);
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
          <h1 className="text-2xl font-bold text-slate-900">Personnel</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {staff.length} membre{staff.length > 1 ? "s" : ""} de l&apos;équipe
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600
            hover:bg-emerald-700 text-white text-sm font-semibold
            rounded-xl transition-all shadow-lg shadow-emerald-600/20
            hover:shadow-emerald-600/30 hover:-translate-y-0.5"
        >
          + Nouveau membre
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div
          className="grid grid-cols-12 px-5 py-3 bg-slate-50
          border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider"
        >
          <div className="col-span-5">Membre</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Rôle</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {loading ? (
          <div>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-12 px-5 py-4 border-b border-slate-50 items-center"
              >
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse" />
                  <div className="w-32 h-3 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="col-span-4 h-3 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="col-span-2 h-5 w-20 bg-slate-200 rounded-full animate-pulse" />
                <div className="col-span-1 flex justify-end gap-2">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-5xl mb-4">👥</span>
            <p className="text-slate-600 font-semibold text-base mb-1">
              Aucun membre du personnel
            </p>
            <p className="text-slate-400 text-sm mb-5">
              Ajoutez les membres de votre équipe
            </p>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
            >
              + Ajouter un membre
            </button>
          </div>
        ) : (
          pageItems.map((membre, idx) => {
            const isSelf = membre.uid === user?.uid;
            return (
              <div
                key={membre.uid}
                className={`grid grid-cols-12 px-5 py-4 items-center
                  ${idx < pageItems.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {`${membre.prenom?.[0] ?? ""}${membre.nom?.[0] ?? ""}`.toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {membre.prenom} {membre.nom}
                    {isSelf && (
                      <span className="ml-2 text-xs text-slate-400 font-normal">
                        (vous)
                      </span>
                    )}
                  </p>
                </div>
                <div className="col-span-4">
                  <p className="text-sm text-slate-600 truncate">
                    {membre.email}
                  </p>
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[membre.role]}`}
                  >
                    {ROLE_LABELS[membre.role]}
                  </span>
                </div>
                <div className="col-span-1 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEdit(membre)}
                    title="Modifier"
                    className="w-8 h-8 flex items-center justify-center rounded-lg
                      bg-slate-100 hover:bg-blue-100 hover:text-blue-600
                      text-slate-500 transition-colors text-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setShowConfirm(membre)}
                    disabled={isSelf}
                    title={
                      isSelf
                        ? "Vous ne pouvez pas vous supprimer"
                        : "Supprimer"
                    }
                    className="w-8 h-8 flex items-center justify-center rounded-lg
                      bg-slate-100 hover:bg-red-100 hover:text-red-600
                      text-slate-500 transition-colors text-sm
                      disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100 disabled:hover:text-slate-500"
                  >
                    🗑️
                  </button>
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
          unitLabel="membres"
        />
      )}

      {/* Modal création */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                Nouveau membre
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={createForm.handleSubmit(onCreate)}
              noValidate
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Prénom *</label>
                  <input
                    {...createForm.register("prenom")}
                    placeholder="ex: Aïssatou"
                    className={inputCls}
                  />
                  {createForm.formState.errors.prenom && (
                    <p className="text-xs text-red-600">
                      {createForm.formState.errors.prenom.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Nom *</label>
                  <input
                    {...createForm.register("nom")}
                    placeholder="ex: Barry"
                    className={inputCls}
                  />
                  {createForm.formState.errors.nom && (
                    <p className="text-xs text-red-600">
                      {createForm.formState.errors.nom.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Email *</label>
                <input
                  type="email"
                  {...createForm.register("email")}
                  placeholder="ex: membre@labmedical.com"
                  className={inputCls}
                />
                {createForm.formState.errors.email && (
                  <p className="text-xs text-red-600">
                    {createForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Mot de passe *</label>
                <input
                  type="password"
                  {...createForm.register("password")}
                  placeholder="Min. 6 caractères"
                  className={inputCls}
                />
                {createForm.formState.errors.password && (
                  <p className="text-xs text-red-600">
                    {createForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Rôle *</label>
                <select {...createForm.register("role")} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createForm.formState.isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createForm.formState.isSubmitting
                    ? "Création..."
                    : "Créer le membre"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal édition */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                Modifier le membre
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={editForm.handleSubmit(onEdit)}
              noValidate
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className={labelCls}>Email</label>
                <input
                  value={editing.email}
                  disabled
                  className={`${inputCls} opacity-70 cursor-not-allowed`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Prénom *</label>
                  <input
                    {...editForm.register("prenom")}
                    className={inputCls}
                  />
                  {editForm.formState.errors.prenom && (
                    <p className="text-xs text-red-600">
                      {editForm.formState.errors.prenom.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Nom *</label>
                  <input {...editForm.register("nom")} className={inputCls} />
                  {editForm.formState.errors.nom && (
                    <p className="text-xs text-red-600">
                      {editForm.formState.errors.nom.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Rôle *</label>
                <select {...editForm.register("role")} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editForm.formState.isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editForm.formState.isSubmitting
                    ? "Enregistrement..."
                    : "Enregistrer"}
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
              Retirer ce membre ?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              {showConfirm.prenom} {showConfirm.nom} perdra l&apos;accès à
              l&apos;application.
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
                {deleting ? "Suppression..." : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
