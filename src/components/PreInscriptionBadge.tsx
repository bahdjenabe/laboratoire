"use client";

// Pastille de comptage des pré-inscriptions en attente, affichée dans le menu
// à côté de l'entrée « Pré-inscriptions ». Ne s'affiche que s'il y en a.

import { usePreInscriptions } from "@/hooks/usePreInscriptions";

export default function PreInscriptionBadge() {
  const { preinscriptions } = usePreInscriptions();
  const n = preinscriptions.length;
  if (n === 0) return null;
  return (
    <span className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center
      rounded-full bg-amber-500 text-white text-[11px] font-bold">
      {n > 99 ? "99+" : n}
    </span>
  );
}
