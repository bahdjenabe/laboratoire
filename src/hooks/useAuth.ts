import { useAuth as useAuthContext } from '@/context/AuthContext';
import { Role } from '@/types';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Hook pour vérifier si l'utilisateur a le bon rôle
export function useRequireRole(allowedRoles: Role[]) {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && !allowedRoles.includes(user.role)) {
      router.push('/dashboard/dashboard'); // Pas accès → dashboard par défaut
    }
  }, [user, loading, allowedRoles, router]);

  return { user, loading };
}

// Hook simple d'accès à l'auth
export { useAuth } from '@/context/AuthContext';