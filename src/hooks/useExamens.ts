import { useState, useEffect, useCallback } from 'react';
import {
  getExamens,
  createExamen,
  updateExamen,
  updateStatutExamen,
  deleteExamen,
} from '@/lib/firestore/examens';
import type { Examen, StatutExamen } from '@/types';

export function useExamens() {
  const [examens, setExamens] = useState<Examen[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExamens = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getExamens();
      setExamens(data);
    } catch (err) {
      setError('Erreur lors du chargement des examens');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExamens();
  }, [fetchExamens]);

  const addExamen = async (
    data: Omit<Examen, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    await createExamen(data);
    await fetchExamens();
  };

  const editExamen = async (
    id: string,
    data: Partial<Omit<Examen, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updateExamen(id, data);
    await fetchExamens();
  };

  const changeStatut = async (
    id: string,
    statut: StatutExamen
  ): Promise<void> => {
    await updateStatutExamen(id, statut);
    await fetchExamens();
  };

  const removeExamen = async (id: string): Promise<void> => {
    await deleteExamen(id);
    await fetchExamens();
  };

  return {
    examens,
    loading,
    error,
    fetchExamens,
    addExamen,
    editExamen,
    changeStatut,
    removeExamen,
  };
}
