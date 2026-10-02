'use client';

import { useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';

export default function LegacyBookingReceiptRedirect() {
  const router = useRouter();
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();

  useEffect(() => {
    const bid = params.bookingId || searchParams.get('booking_id') || '';
    if (!bid) {
      router.replace('/shopper/saved?tab=Bookings');
      return;
    }
    // Raw reference with colon — do NOT encodeURIComponent, axios passes it through.
        router.replace(`/receipt/instant/book:${bid}`);
  }, [params.bookingId, router, searchParams]);

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