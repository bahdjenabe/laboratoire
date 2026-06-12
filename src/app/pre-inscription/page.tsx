"use client";

// Formulaire public de pré-inscription patient (sans compte). Le patient ne
// saisit que son identité ; le laboratoire confirmera avec son ordonnance et
// choisira les analyses. À la soumission, on affiche un code + un QR à
// présenter à l'accueil.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import QRCode from "qrcode";
import { createPreInscription } from "@/lib/firestore/preinscriptions";
import {
  preInscriptionSchema,
  type PreInscriptionInput,
} from "@/lib/validations";

const inputCls = `w-full h-11 px-3.5 rounded-xl border border-slate-200
  bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
  focus:outline-none focus:border-emerald-500
  focus:ring-2 focus:ring-emerald-500/10 transition-all`;
const labelCls =
  "block text-xs font-semibold text-slate-600 uppercase tracking-wide";

interface Succes {
  ref: string;
  token: string;
  qr: string; // data URL
}

export default function PreInscriptionPage() {
  const [error, setError] = useState("");
  const [succes, setSucces] = useState<Succes | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PreInscriptionInput>({
    resolver: zodResolver(preInscriptionSchema),
    defaultValues: {
      prenom: "",
      nom: "",
      dateNaissance: "",
      sexe: "M",
      telephone: "",
      email: "",
      note: "",
    },
  });

  const onSubmit = async (data: PreInscriptionInput) => {
    setError("");
    try {
      const { token, ref } = await createPreInscription({
        prenom: data.prenom,
        nom: data.nom,
        dateNaissance: new Date(data.dateNaissance),
        sexe: data.sexe,
        telephone: data.telephone,
        email: data.email || undefined,
        note: data.note || undefined,
      });
      const url = `${window.location.origin}/pre-inscription/statut/${token}`;
      const qr = await QRCode.toDataURL(url, { width: 220, margin: 1 });
      setSucces({ ref, token, qr });
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    }
  };

  // ── Écran de confirmation ──────────────────────────
  if (succes) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
          <span className="text-5xl mb-4 block">✅</span>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Pré-inscription enregistrée
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Présentez ce code à l&apos;accueil du laboratoire avec votre
            ordonnance. Le technicien finalisera votre dossier.
          </p>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">
              Votre code
            </p>
            <p className="text-3xl font-extrabold tracking-[0.3em] text-emerald-600 mb-5">
              {succes.ref}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={succes.qr}
              alt="QR code de pré-inscription"
              className="mx-auto rounded-xl"
              width={180}
              height={180}
            />
          </div>

          <p className="text-xs text-slate-400">
            Conservez cette page (capture d&apos;écran) ou notez votre code.
          </p>
        </div>
      </main>
    );
  }

  // ── Formulaire ─────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        {/* En-tête */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
            ⚗
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Pré-inscription en ligne
            </h1>
            <p className="text-sm text-slate-400">
              LabMédical • Conakry — gagnez du temps à l&apos;accueil
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Identité */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
              Vos informations
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {/* Analyses (optionnel) */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
              Analyses prescrites{" "}
              <span className="text-slate-400 font-normal">(facultatif)</span>
            </h2>
            <p className="text-sm text-slate-500">
              Pas besoin de connaître le nom des analyses : votre laboratoire
              les déterminera avec votre ordonnance. Vous pouvez laisser une
              note si vous le souhaitez.
            </p>
            <textarea
              {...register("note")}
              rows={3}
              placeholder="ex: bilan sanguin prescrit par le Dr. ..."
              className={`${inputCls} h-auto py-3 resize-none`}
            />
            {errors.note && (
              <p className="text-xs text-red-600">{errors.note.message}</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700
              text-white font-semibold text-sm transition-all
              shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5
              disabled:opacity-50 disabled:cursor-not-allowed
              disabled:hover:translate-y-0"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enregistrement...
              </span>
            ) : (
              "Valider ma pré-inscription"
            )}
          </button>

          <p className="text-center text-xs text-slate-400 pb-6">
            🔒 Vos données ne servent qu&apos;à préparer votre dossier au
            laboratoire.
          </p>
        </form>
      </div>
    </main>
  );
}
