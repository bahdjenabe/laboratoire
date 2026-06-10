import { useState, useEffect, useCallback } from 'react';
import {
  getPaiements,
  createPaiement,
  createPaiements,
  updatePaiement,
  deletePaiement,
} from '@/lib/firestore/paiements';
import type { Paiement } from '@/types';

export function usePaiements() {
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaiements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPaiements();
      setPaiements(data);
    } catch (err) {
      setError('Erreur lors du chargement des paiements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaiements();
  }, [fetchPaiements]);

  const addPaiement = async (
    data: Omit<Paiement, 'id' | 'createdAt'>
  ): Promise<void> => {
    await createPaiement(data);
    await fetchPaiements();
  };

  // Encaissement groupé atomique (tous les examens d'une commande).
  const addPaiements = async (
    items: Omit<Paiement, 'id' | 'createdAt'>[]
  ): Promise<void> => {
    await createPaiements(items);
    await fetchPaiements();
  };

  const editPaiement = async (
    id: string,
    data: Partial<Omit<Paiement, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updatePaiement(id, data);
    await fetchPaiements();
  };

  const removePaiement = async (id: string): Promise<void> => {
    await deletePaiement(id);
    await fetchPaiements();
  };

  return {
    paiements,
    loading,
    error,
    fetchPaiements,
    addPaiement,
    addPaiements,
    editPaiement,
    removePaiement,
  };
}
