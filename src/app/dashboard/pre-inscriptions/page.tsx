"use client";

// Écran labo : traitement des pré-inscriptions patients (formulaire public).
// Le technicien lit l'ordonnance papier du patient, choisit les analyses au
// catalogue, puis confirme — ce qui crée (ou rattache) le patient et la
// commande d'examens. Le reste du flux (encaissement, saisie, validation)
// est inchangé.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreInscriptions } from "@/hooks/usePreInscriptions";
import { usePatients } from "@/hooks/usePatients";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useExamens } from "@/hooks/useExamens";
import { useAuth } from "@/context/AuthContext";
import {
  findPatientDuplicate,
  createPatientWithId,
  restorePatient,
} from "@/lib/firestore/patients";
import {
  confirmPreInscription,
  rejectPreInscription,
} from "@/lib/firestore/preinscriptions";
import type { PreInscription } from "@/types";

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

export default function PreInscriptionsPage() {
  const { preinscriptions, loading } = usePreInscriptions();
  const { patients } = usePatients();
  const { catalogue, loading: catalogueLoading } = useCatalogue();
  const { addExamens } = useExamens();
  const { user } = useAuth();
  const router = useRouter();

  const peutGerer = user?.role === "admin" || user?.role === "technicien";

  // Recherche par code (ref), nom ou téléphone. Pré-remplie depuis ?code=
  // (raccourci QR : le scan amène directement sur la demande filtrée).
  const [search, setSearch] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) setSearch(code);
  }, []);

  // Carte en cours de traitement (une seule à la fois) + sa sélection.
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [catSearch, setCatSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  // Message de confirmation après traitement (le patient + la commande créés).
  const [success, setSuccess] = useState<{ msg: string; commandeId: string } | null>(
    null,
  );

  const catalogueFiltre = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return catalogue;
    return catalogue.filter((c) => c.nom.toLowerCase().includes(q));
  }, [catalogue, catSearch]);

  const total = useMemo(
    () =>
      catalogue
        .filter((c) => selectedIds.includes(c.id))
        .reduce((s, c) => s + (c.prix || 0), 0),
    [catalogue, selectedIds],
  );

  // Demandes filtrées par la recherche (code, nom/prénom ou téléphone).
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return preinscriptions;
    return preinscriptions.filter(
      (pre) =>
        pre.ref.toLowerCase().includes(s) ||
        pre.nom.toLowerCase().includes(s) ||
        pre.prenom.toLowerCase().includes(s) ||
        pre.telephone.includes(s),
    );
  }, [preinscriptions, search]);

  const ouvrir = (token: string) => {
    setActiveToken(token);
    setSelectedIds([]);
    setCatSearch("");
    setError("");
  };

  const fermer = () => {
    setActiveToken(null);
    setSelectedIds([]);
    setCatSearch("");
    setError("");
  };

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // ── Confirmer : crée/rattache le patient + crée la commande ──
  const handleConfirm = async (pre: PreInscription) => {
    setError("");
    const choisis = catalogue.filter((c) => selectedIds.includes(c.id));
    if (choisis.length === 0) {
      setError("Sélectionnez au moins une analyse au catalogue.");
      return;
    }
    setBusy(true);
    try {
      // 1. Patient : rattacher au dossier existant (même téléphone/email) ou
      // en créer un nouveau. On réutilise la détection de doublon de l'app.
      const dup = findPatientDuplicate(patients, {
        telephone: pre.telephone,
        email: pre.email,
      });
      let patientId: string;
      let numero: string | undefined;
      const rattache = !!dup;
      if (dup) {
        patientId = dup.patient.id;
        numero = dup.patient.numero;
        if (dup.patient.archive) await restorePatient(patientId);
      } else {
        const created = await createPatientWithId({
          nom: pre.nom,
          prenom: pre.prenom,
          dateNaissance: toDate(pre.dateNaissance) ?? new Date(),
          sexe: pre.sexe,
          telephone: pre.telephone,
          email: pre.email || undefined,
        });
        patientId = created.id;
        numero = created.numero;
      }

      // 2. Commande d'examens : prix repris du catalogue courant (jamais du
      // client). Tous les examens partagent le même commandeId.
      const commandeId = crypto.randomUUID();
      await addExamens(
        choisis.map((cat) => ({
          patientId,
          nomExamen: cat.nom,
          prix: cat.prix,
          commandeId,
          statut: "en_attente" as const,
          technicienId: user?.uid,
        })),
      );

      // 3. Marquer la pré-inscription comme traitée.
      await confirmPreInscription(pre.token, {
        patientId,
        commandeId,
        confirmePar: user?.uid,
      });

      // 4. Confirmer visuellement (le patient + la commande sont créés). La
      // carte disparaît de la file ; le message reste affiché en haut.
      const nom = `${pre.prenom} ${pre.nom}`;
      const ref = numero ? ` (${numero})` : "";
      setSuccess({
        msg: `Patient ${nom}${ref} ${
          rattache ? "rattaché" : "créé"
        } — commande de ${choisis.length} analyse${
          choisis.length > 1 ? "s" : ""
        } prête à encaisser.`,
        commandeId,
      });
      fermer();
      setBusy(false);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la confirmation. Réessayez.");
      setBusy(false);
    }
  };

  const handleReject = async (token: string) => {
    setBusy(true);
    try {
      await rejectPreInscription(token, user?.uid);
      setConfirmReject(null);
      if (activeToken === token) fermer();
    } catch (err) {
      console.error(err);
      setError("Erreur lors du rejet. Réessayez.");
    } finally {
      setBusy(false);
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
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pré-inscriptions</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Demandes en ligne à confirmer avec l&apos;ordonnance du patient.
        </p>
      </div>

      {/* Confirmation après traitement */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-2xl flex-shrink-0">✅</span>
          <p className="flex-1 text-sm text-emerald-800 font-medium">
            {success.msg}
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() =>
                router.push(
                  `/dashboard/paiements?commande=${encodeURIComponent(
                    success.commandeId,
                  )}`,
                )
              }
              className="px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700
                text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              💳 Encaisser
            </button>
            <button
              onClick={() => setSuccess(null)}
              className="px-3 h-10 rounded-xl border border-emerald-200 text-emerald-700
                hover:bg-white text-sm font-semibold transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Recherche par code / nom / téléphone */}
      {!loading && preinscriptions.length > 0 && (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par code, nom ou téléphone..."
            className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200
              rounded-xl text-sm text-slate-900 placeholder:text-slate-400
              focus:outline-none focus:border-emerald-500
              focus:ring-2 focus:ring-emerald-500/10 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-28 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          <div className="h-28 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        </div>
      ) : preinscriptions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <span className="text-5xl mb-4 block">📭</span>
          <p className="text-slate-600 font-semibold">
            Aucune pré-inscription en attente
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Les demandes envoyées par les patients apparaîtront ici.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <span className="text-5xl mb-4 block">🔍</span>
          <p className="text-slate-600 font-semibold">
            Aucune demande pour « {search} »
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Vérifiez le code ou essayez le nom du patient.
          </p>
        </div>
      ) : (
        filtered.map((pre) => {
          const actif = activeToken === pre.token;
          return (
            <div
              key={pre.token}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
            >
              {/* Identité */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-slate-900 text-base">
                      {pre.prenom} {pre.nom}
                    </h2>
                    <span className="text-xs font-bold tracking-widest bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      {pre.ref}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {pre.sexe === "M"
                      ? "Masculin"
                      : pre.sexe === "F"
                        ? "Féminin"
                        : "Autre"}{" "}
                    • Né(e) le {formatDate(pre.dateNaissance)} • 📞{" "}
                    {pre.telephone}
                    {pre.email ? ` • ${pre.email}` : ""}
                  </p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                  {formatDate(pre.createdAt)}
                </span>
              </div>

              {/* Note patient */}
              {pre.note && (
                <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
                  📝 {pre.note}
                </div>
              )}

              {!actif ? (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => ouvrir(pre.token)}
                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
                      text-white text-sm font-semibold transition-colors"
                  >
                    ✓ Traiter / confirmer
                  </button>
                  <button
                    onClick={() => setConfirmReject(pre.token)}
                    className="px-4 h-11 rounded-xl border border-slate-200 text-slate-600
                      hover:bg-red-50 hover:text-red-600 hover:border-red-200
                      text-sm font-semibold transition-colors"
                  >
                    Rejeter
                  </button>
                </div>
              ) : (
                <div className="mt-5 border-t border-slate-100 pt-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      Analyses prescrites (lire l&apos;ordonnance)
                    </p>
                    {catalogue.length > 8 && (
                      <input
                        value={catSearch}
                        onChange={(e) => setCatSearch(e.target.value)}
                        placeholder="Rechercher une analyse..."
                        className="w-full h-10 px-3 mb-2 rounded-xl border border-slate-200
                          bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
                          focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      />
                    )}

                    {catalogueLoading ? (
                      <p className="text-sm text-slate-400 py-3">
                        Chargement du catalogue...
                      </p>
                    ) : catalogue.length === 0 ? (
                      <p className="text-sm text-slate-400 py-3">
                        Aucun examen au catalogue. Un administrateur doit
                        d&apos;abord en ajouter.
                      </p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
                        {catalogueFiltre.length === 0 ? (
                          <p className="px-4 py-4 text-sm text-slate-400 text-center">
                            Aucune analyse trouvée.
                          </p>
                        ) : (
                          catalogueFiltre.map((c) => {
                            const checked = selectedIds.includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                                  checked ? "bg-emerald-50/60" : "hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggle(c.id)}
                                  className="w-4 h-4 accent-emerald-600 flex-shrink-0"
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

                    {selectedIds.length > 0 && (
                      <p className="text-sm text-slate-500 mt-2">
                        {selectedIds.length} analyse
                        {selectedIds.length > 1 ? "s" : ""} •{" "}
                        <span className="font-semibold text-slate-900">
                          {formatGNF(total)}
                        </span>
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
                      ⚠️ {error}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => handleConfirm(pre)}
                      disabled={busy}
                      className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
                        text-white text-sm font-semibold transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy
                        ? "Confirmation..."
                        : "Confirmer et créer la commande →"}
                    </button>
                    <button
                      onClick={fermer}
                      disabled={busy}
                      className="px-4 h-11 rounded-xl border border-slate-200 text-slate-600
                        hover:bg-slate-50 text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation de rejet */}
              {confirmReject === pre.token && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-4">
                  <p className="text-sm text-red-700 font-medium mb-3">
                    Rejeter définitivement cette pré-inscription ?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(pre.token)}
                      disabled={busy}
                      className="px-4 h-10 rounded-xl bg-red-600 hover:bg-red-700
                        text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Oui, rejeter
                    </button>
                    <button
                      onClick={() => setConfirmReject(null)}
                      disabled={busy}
                      className="px-4 h-10 rounded-xl border border-slate-200 text-slate-600
                        hover:bg-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Non
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
