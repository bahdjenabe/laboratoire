"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePatients } from "@/hooks/usePatients";
import { findPatientDuplicate } from "@/lib/firestore/patients";
import { useAuth } from "@/context/AuthContext";
import { patientSchema, type PatientInput } from "@/lib/validations";

const inputCls = `w-full h-11 px-3.5 rounded-xl border border-slate-200
  bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
  focus:outline-none focus:border-emerald-500
  focus:ring-2 focus:ring-emerald-500/10 transition-all`;
const labelCls =
  "block text-xs font-semibold text-slate-600 uppercase tracking-wide";

export default function NouveauPatientPage() {
  const { addPatient, patients } = usePatients();
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const peutGerer = user?.role === "admin" || user?.role === "technicien";

  const {
    register,
    handleSubmit,
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

  const onSubmit = async (data: PatientInput) => {
    setError("");
    // Unicité : pas deux patients avec le même téléphone ou le même email.
    const dup = findPatientDuplicate(patients, {
      telephone: data.telephone,
      email: data.email,
    });
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
      await addPatient({
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
      router.push("/dashboard/patients");
    } catch (err) {
      setError("Erreur lors de l'enregistrement. Réessayez.");
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

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl
            bg-white border border-slate-200 text-slate-600
            hover:bg-slate-50 transition-colors"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nouveau patient</h1>
          <p className="text-sm text-slate-400">
            Remplissez le formulaire ci-dessous
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Infos personnelles */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
            Informations personnelles
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Prénom *</label>
              <input
                {...register("prenom")}
                placeholder="ex: Mamadou"
                className={inputCls}
              />
              {errors.prenom && (
                <p className="text-xs text-red-600">{errors.prenom.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Nom *</label>
              <input
                {...register("nom")}
                placeholder="ex: Diallo"
                className={inputCls}
              />
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
              <input
                {...register("telephone")}
                placeholder="ex: 620 00 00 00"
                className={inputCls}
              />
              {errors.telephone && (
                <p className="text-xs text-red-600">
                  {errors.telephone.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Email</label>
              <input
                type="email"
                {...register("email")}
                placeholder="ex: patient@email.com"
                className={inputCls}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Adresse</label>
            <input
              {...register("adresse")}
              placeholder="ex: Conakry, Ratoma"
              className={inputCls}
            />
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

        {/* Erreur */}
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl
            bg-red-50 text-red-600 border border-red-100 text-sm"
          >
            ⚠️ {error}
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 h-12 rounded-xl border border-slate-200
              text-slate-700 font-semibold text-sm
              hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700
              text-white font-semibold text-sm transition-all
              shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5
              disabled:opacity-50 disabled:cursor-not-allowed
              disabled:hover:translate-y-0"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 border-2 border-white border-t-transparent
                  rounded-full animate-spin"
                />
                Enregistrement...
              </span>
            ) : (
              "Enregistrer le patient"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
