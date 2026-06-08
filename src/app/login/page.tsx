"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { loginSchema, type LoginInput } from "@/lib/validations";
import type { Role } from "@/types";

// Redirection par rôle après connexion
const REDIRECT_BY_ROLE: Record<Role, string> = {
  admin: "/dashboard/dashboard",
  // Le médecin atterrit sur sa file de validation des résultats.
  medecin: "/dashboard/resultats",
  technicien: "/dashboard/dashboard",
};

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showPass, setShowPass] = useState<boolean>(false);
  const [resetSent, setResetSent] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);

  // ✅ Redirection après login — plus de flash : on attend la fin du loading
  useEffect(() => {
    if (!loading && user) {
      const route = REDIRECT_BY_ROLE[user.role] ?? "/dashboard/dashboard";
      router.replace(route);
    }
  }, [user, loading, router]);

  // ✅ Pendant le chargement initial de la session, ne rien afficher
  if (loading) {
    return (
      <main className="min-h-screen w-full bg-slate-100 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // ✅ Si déjà connecté, ne pas afficher le formulaire (redirection en cours)
  if (user) return null;

  const onSubmit = async (data: LoginInput): Promise<void> => {
    setError("");
    setSubmitting(true);
    try {
      await login(data.email, data.password);
      // La redirection est gérée par le useEffect ci-dessus
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
      setSubmitting(false);
    }
  };

  // ✅ Réinitialisation du mot de passe via Firebase
  const handleForgotPassword = async (): Promise<void> => {
    const email = getValues("email");
    if (!email) {
      setError(
        "Entrez votre adresse e-mail pour réinitialiser le mot de passe.",
      );
      return;
    }
    setResetLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-2xl min-h-[600px]">
        {/* ══ Panneau gauche ══ */}
        <aside
          className="hidden lg:flex w-[46%] flex-shrink-0 flex-col justify-between
          p-12 bg-slate-900 relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/5 pointer-events-none" />
          <div className="absolute top-8 -right-8 w-44 h-44 rounded-full border border-white/[0.07] pointer-events-none" />
          <div className="absolute -bottom-28 -left-14 w-96 h-96 rounded-full border border-emerald-500/10 pointer-events-none" />

          {/* Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-emerald-900/50 flex-shrink-0">
                ⚗
              </div>
              <div>
                <p className="text-white text-xl font-bold tracking-tight">
                  LabMédical
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Système de gestion v1.0
                </p>
              </div>
            </div>
            <h2 className="text-white/90 text-2xl font-bold leading-snug mb-4">
              Votre plateforme médicale centralisée
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Gérez analyses, résultats et patients depuis un seul endroit
              sécurisé.
            </p>
          </div>

          {/* Rôles */}
          <div className="relative z-10 space-y-2.5">
            <p className="text-slate-600 text-[10px] uppercase tracking-[3px] mb-3">
              Profils d'accès
            </p>
            {(
              [
                {
                  label: "Administrateur",
                  desc: "Gestion globale",
                  dot: "bg-red-400",
                },
                {
                  label: "Médecin",
                  desc: "Validation résultats",
                  dot: "bg-emerald-400",
                },
                {
                  label: "Technicien",
                  desc: "Saisie des analyses",
                  dot: "bg-blue-400",
                },
              ] as const
            ).map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl
                  bg-white/5 border border-white/[0.06]
                  hover:bg-white/[0.08] transition-colors duration-200"
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.dot}`}
                />
                <div>
                  <p className="text-white/85 text-sm font-medium">
                    {item.label}
                  </p>
                  <p className="text-slate-500 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-slate-700 text-xs relative z-10">
            🔒 Données protégées · Chiffrement end-to-end
          </p>
        </aside>

        {/* ══ Panneau droit ══ */}
        <section className="flex-1 bg-white flex flex-col justify-center px-14 py-14">
          <span className="inline-flex items-center gap-2 w-fit mb-10 bg-emerald-50 text-emerald-700 text-xs font-semibold px-4 py-2 rounded-full border border-emerald-200">
            ✓ Connexion sécurisée SSL
          </span>

          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Bon retour 👋
          </h1>
          <p className="text-slate-400 text-base mb-10">
            Connectez-vous à votre espace de travail
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700"
              >
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                placeholder="nom@labmedical.com"
                autoComplete="email"
                className="w-full h-[52px] px-4 rounded-xl text-sm text-slate-900
                  bg-slate-50 border-2 border-slate-200 placeholder:text-slate-400
                  focus:outline-none focus:border-emerald-500 focus:bg-white
                  focus:ring-4 focus:ring-emerald-500/10 transition-all duration-200"
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Mot de passe */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Mot de passe
                </label>
                {/* ✅ Bouton mot de passe oublié fonctionnel */}
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                >
                  {resetLoading ? "Envoi..." : "Mot de passe oublié ?"}
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  {...register("password")}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  className="w-full h-[52px] px-4 pr-12 rounded-xl text-sm text-slate-900
                    bg-slate-50 border-2 border-slate-200 placeholder:text-slate-400
                    focus:outline-none focus:border-emerald-500 focus:bg-white
                    focus:ring-4 focus:ring-emerald-500/10 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  aria-label={
                    showPass
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-lg"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Message de succès reset */}
            {resetSent && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-emerald-50 text-emerald-700 border border-emerald-100">
                ✅ Un e-mail de réinitialisation a été envoyé.
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100"
              >
                ⚠️ {error}
              </div>
            )}

            {/* Bouton */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-[54px] rounded-xl text-base font-bold text-white
                bg-slate-900 hover:bg-slate-800 active:scale-[0.99]
                shadow-lg shadow-slate-900/25 hover:shadow-xl hover:shadow-slate-900/30
                hover:-translate-y-0.5 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                disabled:hover:translate-y-0 disabled:hover:shadow-lg"
            >
              {submitting ? "⏳ Connexion en cours..." : "Se connecter →"}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 mt-10 pt-6 border-t border-slate-100">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-xs text-slate-400">
              LabMédical © 2025 · Système sécurisé
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "auth/user-not-found": "Aucun compte avec cet e-mail.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
    "auth/invalid-email": "Adresse e-mail invalide.",
    "auth/too-many-requests": "Trop de tentatives. Réessayez plus tard.",
    "auth/user-disabled": "Ce compte a été désactivé.",
    "auth/missing-email": "Entrez votre adresse e-mail d'abord.",
  };
  return messages[code] ?? "Une erreur est survenue. Réessayez.";
}
