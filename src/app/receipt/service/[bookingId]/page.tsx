'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { MdPrint, MdShare, MdDownload, MdReceiptLong, MdPersonOutline } from 'react-icons/md';
import api from '../../../../services/api'; // adjust path as needed

export default function ServiceReceiptPage() {
  const router = useRouter();
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();

  const bookingId = params.bookingId || searchParams.get('booking_id') || 'Unknown';
  const serviceName = searchParams.get('service_name') || 'Service';
  const providerName = searchParams.get('provider_name') || 'Provider';
  const amount = searchParams.get('amount') || '0';

  const [customerName, setCustomerName] = useState('Customer');

  useEffect(() => {
    (async () => {
      try {
        const profile = (await api.getMyProfile()) as {
          first_name?: string;
          last_name?: string;
          nickname?: string;
          real_name?: string;
        };
        const name =
          [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
          profile?.nickname ||
          profile?.real_name ||
          'Customer';
        setCustomerName(name);
      } catch {
        // keep default
      }
    })();
  }, []);

  const handlePrint = () => window.print();
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Receipt',
          text: `Receipt for ${serviceName} booking #${bookingId}`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      alert('Share not supported');
    }
  };
  const handleDownload = () => window.print();

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => router.back()} style={styles.backBtn}>←</button>
        <h1 style={styles.title}>Receipt</h1>
        <div style={styles.headerActions}>
          <button onClick={handlePrint} style={styles.iconBtn}><MdPrint size={22} color="#333" /></button>
          <button onClick={handleShare} style={styles.iconBtn}><MdShare size={22} color="#333" /></button>
          <button onClick={handleDownload} style={styles.iconBtn}><MdDownload size={22} color="#333" /></button>
        </div>
      </div>

      <div style={styles.receiptCard}>
        <div style={styles.cardHeader}>
          <div style={styles.receiptIconWrapper}>
            <MdReceiptLong size={32} color="#fff" />
          </div>
          <h2 style={styles.cardTitle}>Service Receipt</h2>
          <p style={styles.orderId}>Booking #{bookingId}</p>
          <p style={styles.dateTime}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>

        <div style={styles.infoSection}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Customer</span>
            <span style={styles.infoValue}>{customerName}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Service</span>
            <span style={styles.infoValue}>{serviceName}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Provider</span>
            <span style={styles.infoValue}>{providerName}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Amount</span>
            <span style={styles.infoValue}>₦{Number(amount).toFixed(0)}</span>
          </div>
        </div>

        <p style={styles.footerNote}>Thank you for using Admerce services!</p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F8F9FA' },
  header: { display: 'flex', alignItems: 'center', padding: '14px 16px', backgroundColor: '#fff', borderBottom: '1px solid #eee' },
  backBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', marginRight: 12 },
  title: { fontSize: 20, fontWeight: 700, flex: 1 },
  headerActions: { display: 'flex', gap: 16 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer' },
  receiptCard: { margin: 16, backgroundColor: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' },
  cardHeader: { background: 'linear-gradient(135deg, #0504AA 0%, #3B82F6 100%)', margin: -20, marginBottom: 20, padding: 24, textAlign: 'center', color: '#fff' },
  receiptIconWrapper: { width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  cardTitle: { fontSize: 22, fontWeight: 800, margin: 0 },
  orderId: { fontSize: 14, opacity: 0.9, marginTop: 4 },
  dateTime: { fontSize: 12, opacity: 0.8, marginTop: 2 },
  infoSection: { padding: '4px 0' },
  infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 },
  infoLabel: { color: '#666', fontWeight: 500 },
  infoValue: { color: '#1A1A1A', fontWeight: 600, textAlign: 'right', maxWidth: '60%' },
  footerNote: { marginTop: 20, textAlign: 'center', color: '#888', fontSize: 13 },
};