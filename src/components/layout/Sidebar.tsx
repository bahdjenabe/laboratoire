"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Role } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard/dashboard",
    icon: "▦",
    roles: ["admin", "medecin", "technicien"],
  },
  {
    // Gestion des patients : saisie réservée à l'admin et au technicien.
    // Le médecin consulte la fiche patient depuis l'examen (lecture seule).
    label: "Patients",
    href: "/dashboard/patients",
    icon: "👤",
    roles: ["admin", "technicien"],
  },
  {
    label: "Examens",
    href: "/dashboard/examens",
    icon: "🔬",
    roles: ["admin", "medecin", "technicien"],
  },
  {
    // Consultation de la liste des résultats : médecin + admin.
    // Le technicien saisit les résultats depuis la fiche d'un examen.
    label: "Resultats",
    href: "/dashboard/resultats",
    icon: "📋",
    roles: ["admin", "medecin"],
  },
  {
    // Encaissement à l'accueil : admin et technicien.
    label: "Paiements",
    href: "/dashboard/paiements",
    icon: "💳",
    roles: ["admin", "technicien"],
  },
  {
    label: "Personnel",
    href: "/dashboard/personnel",
    icon: "👥",
    roles: ["admin"],
  },
];

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  medecin: "Medecin",
  technicien: "Technicien",
  patient: "Patient",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-red-100 text-red-700",
  medecin: "bg-emerald-100 text-emerald-700",
  technicien: "bg-blue-100 text-blue-700",
  patient: "bg-violet-100 text-violet-700",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  // ✅ Le layout garantit que user existe toujours ici
  if (!user) return null;

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.role),
  );

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-64 bg-slate-900
      flex flex-col z-40 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 flex-shrink-0">
        <div
          className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center
          justify-center text-lg flex-shrink-0 shadow-lg"
        >
          ⚗
        </div>
        <div>
          <p className="text-white font-bold text-sm tracking-tight">
            LabMedical
          </p>
          <p className="text-slate-500 text-xs">Gestion laboratoire</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-slate-600 text-xs uppercase tracking-widest px-3 mb-3">
          Menu
        </p>
        <ul className="space-y-1">
          {filteredNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl
                    text-sm font-medium transition-all duration-150
                    ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                >
                  <span className="text-base w-5 text-center flex-shrink-0">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Profil */}
      <div className="px-3 py-3 border-t border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800 mb-2">
          <div
            className="w-8 h-8 rounded-full bg-emerald-600 flex items-center
            justify-center text-white text-sm font-bold flex-shrink-0"
          >
            {user.prenom?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user.prenom} {user.nom}
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium
              ${ROLE_COLORS[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl
            text-slate-400 hover:text-red-400 hover:bg-red-500/10
            text-sm font-medium transition-all"
        >
          <span>🚪</span>
          Se deconnecter
        </button>
      </div>
    </aside>
  );
}
