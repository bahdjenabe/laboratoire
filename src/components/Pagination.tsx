"use client";

type Props = {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onChange: (page: number) => void;
  unitLabel?: string;
};

// Construit la liste des numéros de page avec ellipses pour les grandes listes.
function buildPages(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(total - 1, page + 1);
  if (left > 2) pages.push("…");
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export default function Pagination({
  page,
  totalPages,
  from,
  to,
  total,
  onChange,
  unitLabel = "éléments",
}: Props) {
  if (totalPages <= 1) return null;
  const pages = buildPages(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
      <p className="text-xs text-slate-400">
        {from}–{to} sur {total} {unitLabel}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm
            font-medium text-slate-600 hover:bg-slate-50 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Préc.
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`h-9 min-w-9 px-3 rounded-lg text-sm font-medium transition-colors
                ${
                  p === page
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm
            font-medium text-slate-600 hover:bg-slate-50 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suiv. →
        </button>
      </div>
    </div>
  );
}
