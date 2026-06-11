"use client";

// Sélecteur d'une commande à encaisser : regroupe les examens non encore
// facturés (saisis ensemble pour un patient). Recherche par patient ou par
// nom d'examen. Affiche patient + nombre d'examens + total.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Examen } from "@/types";

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

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

// Date + heure : distingue deux commandes d'un même patient le même jour.
function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d
    ? d.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

const BROWSE_LIMIT = 8;

export interface CommandeAFacturer {
  key: string;
  patientId: string;
  exams: Examen[];
  total: number;
}

interface Props {
  commandes: CommandeAFacturer[];
  patientNom: (patientId: string) => string;
  // Matricule patient (ex: P-2026-0042) pour différencier les commandes.
  patientNumero?: (patientId: string) => string | undefined;
  value: string;
  onChange: (key: string) => void;
  error?: string;
}

export default function CommandePicker({
  commandes,
  patientNom,
  patientNumero,
  value,
  onChange,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => commandes.find((c) => c.key === value) ?? null,
    [commandes, value],
  );

  const hasQuery = query.trim().length > 0;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return commandes.length <= BROWSE_LIMIT ? commandes : [];
    }
    return commandes
      .filter((c) => {
        const pat = patientNom(c.patientId).toLowerCase();
        const num = (patientNumero?.(c.patientId) ?? "").toLowerCase();
        const exns = c.exams.map((e) => e.nomExamen.toLowerCase()).join(" ");
        return pat.includes(q) || num.includes(q) || exns.includes(q);
      })
      .slice(0, 50);
  }, [commandes, query, patientNom, patientNumero]);

  useEffect(() => {
    if (!open) return;
    const onClick = (ev: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(ev.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const select = (c: CommandeAFacturer) => {
    onChange(c.key);
    setOpen(false);
    setQuery("");
  };

  const resume = (c: CommandeAFacturer) =>
    c.exams.map((e) => e.nomExamen).join(", ");

  const commandeDate = (c: CommandeAFacturer) =>
    formatDateTime(c.exams[0]?.createdAt);

  // Ligne d'identité : matricule (si dispo) + patient + nb d'examens.
  const titre = (c: CommandeAFacturer) => {
    const num = patientNumero?.(c.patientId);
    const nom = patientNom(c.patientId);
    const base = num ? `${num} · ${nom}` : nom;
    return `${base} — ${c.exams.length} examen${c.exams.length > 1 ? "s" : ""}`;
  };

  const sousTitre = (c: CommandeAFacturer) => {
    const d = commandeDate(c);
    return `${resume(c)} • ${formatGNF(c.total)}${d ? ` • ${d}` : ""}`;
  };

  // Commande sélectionnée → carte récapitulative
  if (selected) {
    return (
      <div>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base flex-shrink-0">
            🔬
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {titre(selected)}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {sousTitre(selected)}
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
          placeholder="Rechercher (matricule, patient ou examen)..."
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
              {commandes.length === 0
                ? "Aucune commande à facturer."
                : hasQuery
                  ? "Aucune commande trouvée."
                  : `Tapez un patient ou un examen pour rechercher (${commandes.length} commandes).`}
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {results.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => select(c)}
                    className="w-full flex items-center gap-3 px-3 py-2.5
                      text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base flex-shrink-0">
                      🔬
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {titre(c)}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {sousTitre(c)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
