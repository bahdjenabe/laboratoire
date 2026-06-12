import { useState, useEffect } from 'react';
import { FirebaseError } from 'firebase/app';
import { subscribePreInscriptionsEnAttente } from '@/lib/firestore/preinscriptions';
import { logError } from '@/lib/logError';
import type { PreInscription } from '@/types';

// Pré-inscriptions « en attente » en temps réel. Utilisé par l'écran labo et
// par le badge du menu (compteur de demandes à traiter).
export function usePreInscriptions() {
  const [preinscriptions, setPreinscriptions] = useState<PreInscription[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePreInscriptionsEnAttente(
      (data) => {
        setPreinscriptions(data);
        setLoading(false);
      },
      (err) => {
        // À la déconnexion, le jeton d'auth est révoqué pendant que l'écouteur
        // est encore attaché → Firestore émet un permission-denied transitoire
        // et inoffensif. On l'ignore (sinon une fausse erreur apparaît à
        // chaque déconnexion) ; le badge est dans le menu, toujours monté.
        if (err instanceof FirebaseError && err.code === 'permission-denied') {
          return;
        }
        setError('Erreur lors du chargement des pré-inscriptions');
        setLoading(false);
        logError(err, { scope: 'preinscriptions' });
      },
    );
    return () => unsub();
  }, []);

  return { preinscriptions, loading, error };
}
