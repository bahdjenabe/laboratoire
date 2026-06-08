import { useState, useEffect, useCallback } from 'react';
import {
  getResultats,
  createResultat,
  updateResultat,
  validerResultat,
  deleteResultat,
} from '@/lib/firestore/resultats';
import type { Resultat } from '@/types';

export function useResultats() {
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResultats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getResultats();
      setResultats(data);
    } catch (err) {
      setError('Erreur lors du chargement des résultats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResultats();
  }, [fetchResultats]);

  const addResultat = async (
    data: Omit<Resultat, 'id' | 'createdAt'>
  ): Promise<string> => {
    const id = await createResultat(data);
    await fetchResultats();
    return id;
  };

  const editResultat = async (
    id: string,
    data: Partial<Omit<Resultat, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updateResultat(id, data);
    await fetchResultats();
  };

  const valider = async (resultat: Resultat): Promise<string> => {
    const token = await validerResultat(resultat.id, {
      examenNom: resultat.examenNom,
      patientNom: resultat.patientNom,
      valeurs: resultat.valeurs,
      observations: resultat.observations,
    });
    await fetchResultats();
    return token;
  };

  const removeResultat = async (id: string): Promise<void> => {
    await deleteResultat(id);
    await fetchResultats();
  };

  return {
    resultats,
    loading,
    error,
    fetchResultats,
    addResultat,
    editResultat,
    valider,
    removeResultat,
  };
}
