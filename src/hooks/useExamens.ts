import { useState, useEffect } from 'react';
import {
  subscribeExamens,
  createExamen,
  createExamens,
  updateExamen,
  updateStatutExamen,
  deleteExamen,
} from '@/lib/firestore/examens';
import type { Examen, StatutExamen } from '@/types';

export function useExamens() {
  const [examens, setExamens] = useState<Examen[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Abonnement temps réel : l'UI reflète tout changement (y compris d'un autre
  // poste) sans re-télécharger la collection après chaque mutation.
  useEffect(() => {
    const unsub = subscribeExamens(
      (data) => {
        setExamens(data);
        setLoading(false);
      },
      (err) => {
        setError('Erreur lors du chargement des examens');
        setLoading(false);
        console.error(err);
      },
    );
    return () => unsub();
  }, []);

  const addExamen = async (
    data: Omit<Examen, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    await createExamen(data);
  };

  // Création groupée atomique (une commande de plusieurs examens).
  const addExamens = async (
    items: Omit<Examen, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<void> => {
    await createExamens(items);
  };

  const editExamen = async (
    id: string,
    data: Partial<Omit<Examen, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updateExamen(id, data);
  };

  const changeStatut = async (
    id: string,
    statut: StatutExamen
  ): Promise<void> => {
    await updateStatutExamen(id, statut);
  };

  const removeExamen = async (id: string): Promise<void> => {
    await deleteExamen(id);
  };

  return {
    examens,
    loading,
    error,
    addExamen,
    addExamens,
    editExamen,
    changeStatut,
    removeExamen,
  };
}
