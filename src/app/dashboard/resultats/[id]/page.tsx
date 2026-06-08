"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// La saisie/validation du résultat se fait désormais directement sur la fiche
// de l'examen. Cette page (clé = examenId) redirige pour garder les anciens
// liens fonctionnels.
export default function ResultatRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const examenId = params.id as string;

  useEffect(() => {
    router.replace(`/dashboard/examens/${examenId}`);
  }, [router, examenId]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
