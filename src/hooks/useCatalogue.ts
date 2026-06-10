import { useState, useEffect, useCallback } from 'react';
import {
  getCatalogue,
  createCatalogueExamen,
  updateCatalogueExamen,
  deleteCatalogueExamen,
} from '@/lib/firestore/catalogue';
import type { CatalogueExamen } from '@/types';

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState<CatalogueExamen[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalogue = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCatalogue();
      setCatalogue(data);
    } catch (err) {
      setError('Erreur lors du chargement du catalogue');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogue();
  }, [fetchCatalogue]);

  const addCatalogueExamen = async (
    data: Omit<CatalogueExamen, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    await createCatalogueExamen(data);
    await fetchCatalogue();
  };

  const editCatalogueExamen = async (
    id: string,
    data: Partial<Omit<CatalogueExamen, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updateCatalogueExamen(id, data);
    await fetchCatalogue();
  };

  const removeCatalogueExamen = async (id: string): Promise<void> => {
    await deleteCatalogueExamen(id);
    await fetchCatalogue();
  };

  return {
    catalogue,
    loading,
    error,
    fetchCatalogue,
    addCatalogueExamen,
    editCatalogueExamen,
    removeCatalogueExamen,
  };
}
