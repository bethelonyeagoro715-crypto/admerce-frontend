'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

export default function MapRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(`/shopper/map${params ? `?${params}` : ''}`);
  }, [router, searchParams]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#888' }}>Opening map…</p>
    </div>
  );
}