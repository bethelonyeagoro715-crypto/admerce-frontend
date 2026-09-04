'use client';

import { useEffect } from 'react';
import api from '../../services/api';

export default function TestPage() {
  useEffect(() => {
    (async () => {
      console.log('API instance loaded:', api);
      try {
        const profile = await api.getMyProfile();
        console.log('Profile:', profile);
      } catch (err) {
        console.error('API call failed:', err);
      }
    })();
  }, []);

  return <h1>API Test – check the console</h1>;
}