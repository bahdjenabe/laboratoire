"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getPatient, findPatientDuplicate } from "@/lib/firestore/patients";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { patientSchema, type PatientInput } from "@/lib/validations";

const inputCls = `w-full h-11 px-3.5 rounded-xl border border-slate-200
  bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
  focus:outline-none focus:border-emerald-500
  focus:ring-2 focus:ring-emerald-500/10 transition-all`;
const labelCls =
  "block text-xs font-semibold text-slate-600 uppercase tracking-wide";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  return null;
}

// Format yyyy-mm-dd pour <input type="date">
function toInputDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default function ModifierPatientPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { editPatient, patients } = usePatients();
  const { user } = useAuth();
  const peutGerer = user?.role === "admin" || user?.role === "technicien";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      nom: "",
      prenom: "",
      dateNaissance: "",
      sexe: "M",
      telephone: "",
      email: "",
      adresse: "",
      groupeSanguin: "",
      antecedents: "",
    },
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const p = await getPatient(id);
      if (!p) {
        setNotFound(true);
        return;
      }
      reset({
        nom: p.nom ?? "",
        prenom: p.prenom ?? "",
        dateNaissance: toInputDate(p.dateNaissance),
        sexe: p.sexe ?? "M",
        telephone: p.telephone ?? "",
        email: p.email ?? "",
        adresse: p.adresse ?? "",
        groupeSanguin: p.groupeSanguin ?? "",
        antecedents: p.antecedents ?? "",
      });
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, reset]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (data: PatientInput) => {
    setError("");
    // Unicité : exclut le patient courant de la comparaison.
    const dup = findPatientDuplicate(
      patients,
      { telephone: data.telephone, email: data.email },
      id,
    );
    if (dup) {
      const champ =
        dup.field === "telephone" ? "numéro de téléphone" : "adresse email";
      const archive = dup.patient.archive
        ? " (patient archivé — restaurez-le plutôt)"
        : "";
      setError(`Un patient avec ce ${champ} existe déjà${archive}.`);
      return;
    }
    try {
      await editPatient(id, {
        nom: data.nom,
        prenom: data.prenom,
        dateNaissance: new Date(data.dateNaissance),
        sexe: data.sexe,
        telephone: data.telephone,
        email: data.email || undefined,
        adresse: data.adresse || undefined,
        groupeSanguin: data.groupeSanguin || undefined,
        antecedents: data.antecedents || undefined,
      });
      router.push(`/dashboard/patients/${id}`);
    } catch (err) {
      setError("Erreur lors de la mise à jour. Réessayez.");
      console.error(err);
    }
  };

  if (user && !peutGerer) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <span className="text-5xl mb-4 block">🔒</span>
        <p className="text-slate-600 font-semibold">
          Accès réservé aux administrateurs et techniciens
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-96 bg-white rounded-2xl border border-slate-100 animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <span className="text-5xl mb-4 block">🔍</span>
        <p className="text-slate-600 font-semibold mb-4">Patient introuvable</p>
        <button
          onClick={() => router.push("/dashboard/patients")}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700"
        >
          Retour aux patients
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl
            bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Modifier le patient
          </h1>
          <p className="text-sm text-slate-400">Mettez à jour les informations</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Infos personnelles */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
            Informations personnelles
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Prénom *</label>
              <input {...register("prenom")} className={inputCls} />
              {errors.prenom && (
                <p className="text-xs text-red-600">{errors.prenom.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Nom *</label>
              <input {...register("nom")} className={inputCls} />
              {errors.nom && (
                <p className="text-xs text-red-600">{errors.nom.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Date de naissance *</label>
              <input
                type="date"
                {...register("dateNaissance")}
                className={inputCls}
              />
              {errors.dateNaissance && (
                <p className="text-xs text-red-600">
                  {errors.dateNaissance.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Sexe *</label>
              <select {...register("sexe")} className={inputCls}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Groupe sanguin</label>
            <select {...register("groupeSanguin")} className={inputCls}>
              <option value="">Non renseigné</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Coordonnées */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
            Coordonnées
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Téléphone *</label>
              <input {...register("telephone")} className={inputCls} />
              {errors.telephone && (
                <p className="text-xs text-red-600">
                  {errors.telephone.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Email</label>
              <input type="email" {...register("email")} className={inputCls} />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Adresse</label>
            <input {...register("adresse")} className={inputCls} />
          </div>
        </div>

        {/* Antécédents */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
            Antécédents médicaux
          </h2>
          <textarea
            {...register("antecedents")}
            rows={3}
            placeholder="Diabète, hypertension, allergies..."
            className={`${inputCls} h-auto py-3 resize-none`}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 h-12 rounded-xl border border-slate-200
              text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700
              text-white font-semibold text-sm transition-all
              shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {isSubmitting ? "Mise à jour..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </div>
  );
}
