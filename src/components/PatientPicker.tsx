"use client";

// Sélecteur de patient avec recherche (nom ou téléphone) et désambiguïsation
// (téléphone + date de naissance + sexe), adapté à un grand nombre de patients.

import { useEffect, useMemo, useRef, useState } from "react";
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

export default function PatientPicker({
  patients,
  value,
  onChange,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => patients.find((p) => p.id === value) ?? null,
    [patients, value],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? patients.filter((p) => {
          const nom = `${p.prenom} ${p.nom}`.toLowerCase();
          const tel = (p.telephone ?? "").toLowerCase();
          return nom.includes(q) || tel.includes(q);
        })
      : patients;
    return base.slice(0, 50); // limiter l'affichage pour rester fluide
  }, [patients, query]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const select = (p: Patient) => {
    onChange(p.id);
    setOpen(false);
    setQuery("");
  };

  // Patient sélectionné → carte récapitulative
  if (selected) {
    const naiss = formatNaissance(selected.dateNaissance);
    return (
      <div>
        <div className="flex items-center gap-3 h-12 px-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials(selected)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {selected.prenom} {selected.nom}
            </p>
            <p className="text-xs text-slate-400 truncate">
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

  // Mode recherche
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un patient (nom ou téléphone)..."
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200
            bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400
            focus:outline-none focus:border-emerald-500
            focus:ring-2 focus:ring-emerald-500/10 transition-all"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400 text-center">
              {patients.length === 0
                ? "Aucun patient enregistré."
                : "Aucun patient trouvé."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {results.map((p) => {
                const naiss = formatNaissance(p.dateNaissance);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => select(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5
                        text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials(p)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {p.prenom} {p.nom}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {p.telephone}
                          {naiss && ` • ${naiss}`}
                          {p.sexe && ` • ${p.sexe}`}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
