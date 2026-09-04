'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationService from '../services/notificationService';

export default function NotificationInitializer() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      NotificationService.init(router);
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}