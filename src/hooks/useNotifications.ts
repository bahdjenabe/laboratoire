import { useState, useEffect, useCallback } from "react";
import { getExamens } from "@/lib/firestore/examens";
import { getResultats } from "@/lib/firestore/resultats";
import { useAuth } from "@/context/AuthContext";

export interface NotificationItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
  href: string;
}

// Notifications dérivées des données existantes, filtrées selon le rôle :
// - médecin/admin : résultats en attente de validation
// - technicien/admin : examens à démarrer ou dont le résultat reste à saisir
export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const role = user.role;
      const next: NotificationItem[] = [];

      if (role === "medecin" || role === "admin") {
        const resultats = await getResultats();
        resultats
          .filter((r) => !r.valideParMedecin)
          .forEach((r) =>
            next.push({
              id: `res-${r.id}`,
              icon: "📋",
              title: "Résultat à valider",
              desc:
                [r.examenNom, r.patientNom].filter(Boolean).join(" — ") ||
                "Analyse",
              href: `/dashboard/examens/${r.examenId}`,
            }),
          );
      }

      if (role === "technicien" || role === "admin") {
        const examens = await getExamens();
        examens
          .filter((e) => e.statut === "en_attente" || e.statut === "en_cours")
          .forEach((e) =>
            next.push({
              id: `exa-${e.id}`,
              icon: "🔬",
              title:
                e.statut === "en_attente"
                  ? "Examen à démarrer"
                  : "Résultat à saisir",
              desc: e.nomExamen,
              href: `/dashboard/examens/${e.id}`,
            }),
          );
      }

      setItems(next);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, count: items.length, loading, refresh: load };
}
