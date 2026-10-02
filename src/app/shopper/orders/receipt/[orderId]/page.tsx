'use client';

import { useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';

export default function LegacyOrderReceiptRedirect() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = params.orderId || searchParams.get('order_id') || '';
    if (!ref) {
      router.replace('/shopper/saved');
      return;
    }
    // Raw reference — order_id is a plain string with no special chars.
    router.replace(`/receipt/instant/${ref}`);
  }, [params.orderId, router, searchParams]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      Opening receipt…
    </div>
  );
}