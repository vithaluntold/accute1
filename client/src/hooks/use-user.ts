import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/lib/auth';

/**
 * Hook to get the current authenticated user
 * Uses React Query to fetch user data from /api/users/me
 * Falls back to getUser() from auth lib if query data is not yet available
 */
export function useUser() {
  const { data: queryUser, isLoading, error } = useQuery<any>({
    queryKey: ['/api/users/me'],
    retry: false,
  });

  // Fallback to getUser() for immediate access during SSR or initial load
  const user = queryUser || getUser();

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
  };
}
