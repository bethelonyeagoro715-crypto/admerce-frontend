'use client';

import { useRouter } from 'next/navigation';
import { getToken, getUserRole } from '../services/localStorage';

export function useRequireAuth() {
  const router = useRouter();
  const token = getToken();
  if (!token) {
    router.replace('/login');
  }
}

export function getPostLoginDestination(intendedRole?: string | null): string {
  const role = intendedRole || getUserRole() || 'shopper';
  switch (role) {
    case 'storekeeper':
      return '/storekeeper/onboarding/personal-info';
    case 'courier':
      return '/courier/onboarding';
    case 'flipper':
      return '/flipper/onboarding';
    case 'service-provider':
      return '/service-provider/onboarding';
    default:
      return '/shopper/home';
  }
}