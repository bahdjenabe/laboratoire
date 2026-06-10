import { useState, useEffect } from 'react';
import {
  subscribeCatalogue,
  createCatalogueExamen,
  updateCatalogueExamen,
  deleteCatalogueExamen,
} from '@/lib/firestore/catalogue';
import { logError } from '@/lib/logError';
import type { CatalogueExamen } from '@/types';

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState<CatalogueExamen[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeCatalogue(
      (data) => {
        setCatalogue(data);
        setLoading(false);
      },
      (err) => {
        setError('Erreur lors du chargement du catalogue');
        setLoading(false);
        logError(err, { scope: 'catalogue' });
      },
    );
    return () => unsub();
  }, []);

  const addCatalogueExamen = async (
    data: Omit<CatalogueExamen, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    await createCatalogueExamen(data);
  };

  const editCatalogueExamen = async (
    id: string,
    data: Partial<Omit<CatalogueExamen, 'id' | 'createdAt'>>
  ): Promise<void> => {
    await updateCatalogueExamen(id, data);
  };

  const removeCatalogueExamen = async (id: string): Promise<void> => {
    await deleteCatalogueExamen(id);
  };

  return {
    catalogue,
    loading,
    error,
    addCatalogueExamen,
    editCatalogueExamen,
    removeCatalogueExamen,
  };
}
