import { useState, useEffect } from 'react';
import {
  subscribeResultats,
  createResultat,
  updateResultat,
  validerResultat,
  deleteResultat,
} from '@/lib/firestore/resultats';
import { logError } from '@/lib/logError';
import type { Resultat } from '@/types';

export function useResultats() {
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeResultats(
      (data) => {
        setResultats(data);
        setLoading(false);
      },
      (err) => {
        setError('Erreur lors du chargement des résultats');
        setLoading(false);
        logError(err, { scope: 'resultats' });
      },
    );
    return () => unsub();
  }, []);

  const addResultat = async (
    data: Omit<Resultat, 'id' | 'createdAt'>
  ): Promise<string> => {
    return createResultat(data);
  };

  const editResultat = async (
    id: string,
    data: Partial<Omit<Resultat, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updateResultat(id, data);
  };

  const valider = async (resultat: Resultat): Promise<string> => {
    return validerResultat(resultat.id, {
      examenNom: resultat.examenNom,
      patientNom: resultat.patientNom,
      valeurs: resultat.valeurs,
      observations: resultat.observations,
    });
  };

  const removeResultat = async (id: string): Promise<void> => {
    await deleteResultat(id);
  };

  return {
    resultats,
    loading,
    error,
    addResultat,
    editResultat,
    valider,
    removeResultat,
  };
}
