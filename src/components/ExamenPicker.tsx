"use client";

// Sélecteur d'examen à facturer, avec recherche (nom d'examen ou nom du
// patient) et affichage examen + patient + prix. Adapté à un grand nombre
// d'examens.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Examen } from "@/types";

const formatGNF = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} GNF`;

interface Props {
  examens: Examen[];
  patientNom: (patientId: string) => string;
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

export default function ExamenPicker({
  examens,
  patientNom,
  value,
  onChange,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => examens.find((e) => e.id === value) ?? null,
    [examens, value],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? examens.filter((e) => {
          const nom = e.nomExamen.toLowerCase();
          const pat = patientNom(e.patientId).toLowerCase();
          return nom.includes(q) || pat.includes(q);
        })
      : examens;
    return base.slice(0, 50);
  }, [examens, query, patientNom]);

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

  const select = (e: Examen) => {
    onChange(e.id);
    setOpen(false);
    setQuery("");
  };

  // Examen sélectionné → carte récapitulative
  if (selected) {
    return (
      <div>
        <div className="flex items-center gap-3 h-12 px-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base flex-shrink-0">
            🔬
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {selected.nomExamen}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {patientNom(selected.patientId)} • {formatGNF(selected.prix)}
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
          placeholder="Rechercher un examen (examen ou patient)..."
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
              Aucun examen trouvé.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {results.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => select(e)}
                    className="w-full flex items-center gap-3 px-3 py-2.5
                      text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base flex-shrink-0">
                      🔬
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {e.nomExamen}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {patientNom(e.patientId)} • {formatGNF(e.prix)}
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
