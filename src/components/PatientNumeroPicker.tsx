"use client";

// Sélection d'un patient par son matricule pour la création d'examen.
// Aucune liste pendant la frappe : on saisit le numéro puis on « Recherche ».
// Une fois trouvé, la fiche patient s'affiche (la suite du formulaire suit).

import { useState } from "react";
import type { Patient } from "@/types";

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

const formatNaissance = (value: unknown): string => {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
};

const initials = (p: Patient) =>
  `${p.prenom?.[0] ?? ""}${p.nom?.[0] ?? ""}`.toUpperCase();

interface Props {
  patients: Patient[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

export default function PatientNumeroPicker({
  patients,
  value,
  onChange,
  error,
}: Props) {
  const [numero, setNumero] = useState("");
  const [notFound, setNotFound] = useState(false);

  const selected = patients.find((p) => p.id === value) ?? null;

  const search = () => {
    const q = numero.trim().toLowerCase();
    if (!q) return;
    const found = patients.find((p) => (p.numero ?? "").toLowerCase() === q);
    if (found) {
      onChange(found.id);
      setNotFound(false);
      setNumero("");
    } else {
      setNotFound(true);
    }
  };

  // Patient trouvé → fiche récapitulative
  if (selected) {
    const naiss = formatNaissance(selected.dateNaissance);
    return (
      <div>
        <div className="flex items-center gap-3 h-auto p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {initials(selected)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {selected.prenom} {selected.nom}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {selected.numero && (
                <span className="font-mono text-emerald-600">
                  {selected.numero}
                </span>
              )}
              {selected.numero && " • "}
              {selected.telephone}
              {naiss && ` • Né(e) le ${naiss}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-semibold text-slate-500 hover:text-emerald-700 px-2 flex-shrink-0"
          >
            Changer
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      </div>
    );
  }

  // Saisie du matricule
  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={numero}
          onChange={(e) => {
            setNumero(e.target.value);
            setNotFound(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Numéro du patient (ex: P-2026-0042)"
          className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200
            bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
            focus:outline-none focus:border-emerald-500
            focus:ring-2 focus:ring-emerald-500/10 transition-all"
        />
        <button
          type="button"
          onClick={search}
          className="px-4 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700
            text-white text-sm font-semibold transition-colors whitespace-nowrap"
        >
          🔍 Rechercher
        </button>
      </div>
      {notFound ? (
        <p className="text-xs text-red-600 mt-1.5">
          Aucun patient actif avec ce numéro. Vérifiez le matricule.
        </p>
      ) : (
        error && <p className="text-xs text-red-600 mt-1.5">{error}</p>
      )}
    </div>
  );
}
