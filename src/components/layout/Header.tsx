"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/dashboard": {
    title: "Tableau de bord",
    sub: "Vue generale du laboratoire",
  },
  "/dashboard/patients": {
    title: "Patients",
    sub: "Gestion des dossiers patients",
  },
  "/dashboard/examens": { title: "Examens", sub: "Suivi des examens medicaux" },
  "/dashboard/resultats": { title: "Resultats", sub: "Resultats des analyses" },
  "/dashboard/paiements": { title: "Paiements", sub: "Gestion financiere" },
  "/dashboard/personnel": { title: "Personnel", sub: "Gestion de l'equipe" },
};

export default function Header({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();
  const { items, count, loading, refresh } = useNotifications();
  const [open, setOpen] = useState(false);

  const toggleNotifs = () => {
    const next = !open;
    setOpen(next);
    if (next) refresh(); // rafraîchir à l'ouverture
  };

  const goTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const page = PAGE_TITLES[pathname] ?? { title: "LabMedical", sub: "" };

  const date = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header
      className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-white
      border-b border-slate-200 flex items-center justify-between
      px-4 sm:px-6 z-30"
    >
      {/* Gauche : bouton menu (mobile) + titre */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenu}
          aria-label="Ouvrir le menu"
          className="lg:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center
            rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
        >
          ☰
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 leading-tight truncate">
            {page.title}
          </h1>
          <p className="text-xs text-slate-400 truncate">{page.sub}</p>
        </div>
      </div>

      {/* Droite */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-400 hidden md:block capitalize">
          {date}
        </p>

        <div className="relative">
          <button
            onClick={toggleNotifs}
            aria-label="Notifications"
            className="relative w-9 h-9 flex items-center justify-center
            rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            🔔
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                flex items-center justify-center text-[10px] font-bold text-white
                bg-red-500 rounded-full border-2 border-white"
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>

          {open && (
            <>
              {/* Fermeture au clic extérieur */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div
                className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden
                bg-white rounded-2xl border border-slate-200 shadow-xl z-50
                flex flex-col"
              >
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">
                    Notifications
                  </p>
                  {count > 0 && (
                    <span className="text-xs font-semibold text-emerald-600">
                      {count} en attente
                    </span>
                  )}
                </div>

                <div className="overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                      Chargement...
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                      <span className="text-4xl mb-2">✅</span>
                      <p className="text-sm font-medium text-slate-400">
                        Rien à signaler
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => goTo(item.href)}
                            className="w-full flex items-start gap-3 px-4 py-3
                              text-left hover:bg-slate-50 transition-colors"
                          >
                            <span className="text-lg flex-shrink-0 mt-0.5">
                              {item.icon}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {item.desc}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center
            justify-center text-white text-sm font-bold shadow-sm"
          >
            {user?.prenom?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {user?.prenom} {user?.nom}
            </p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
