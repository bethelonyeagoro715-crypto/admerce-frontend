'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  MdCheckCircle,
  MdCancel,
  MdTimer,
  MdArrowForward,
  MdDirections,
  MdCancelPresentation,
  MdStore,
  MdPersonOutline,
} from 'react-icons/md';
import api from '../../services/api';

interface ReservationConfirmedProps {
  pickupTime?: string;
  storeLat?: number | null;
  storeLng?: number | null;
  storeName?: string;
  orderDetails?: {
    order_id?: string;
    customer_name?: string;
    items?: unknown[];
    total?: number | string;
  };
}

export default function ReservationConfirmedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pickupTime = searchParams.get('pickup_time') || '3 hours';
  const storeLat = searchParams.get('store_lat') ? parseFloat(searchParams.get('store_lat')!) : null;
  const storeLng = searchParams.get('store_lng') ? parseFloat(searchParams.get('store_lng')!) : null;
  const storeName = searchParams.get('store_name') || 'Store';
  const [orderId] = useState(() => searchParams.get('order_id') || `ORD-${Date.now()}`);
  const customerName = searchParams.get('customer_name') || 'Customer';
  const total = searchParams.get('total') ? parseFloat(searchParams.get('total')!) : 0;

  const [remaining, setRemaining] = useState<number>(() => {
    const numericPart = pickupTime.replace(/\D/g, '');
    const hours = numericPart ? parseInt(numericPart, 10) : 3;
    return hours * 3600;
  });
  const [showDropModal, setShowDropModal] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining > 0]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const handlePickUpComplete = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      await api.confirmOrder(orderId);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
      });
      // Navigate to receipt page (correct path)
      router.push(
        `/shopper/orders/receipt/${orderId}?store_name=${encodeURIComponent(storeName)}&total=${total}&customer_name=${encodeURIComponent(customerName)}`
      );
    } catch (error) {
      console.error(error);
      alert('Failed to complete order. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const handleDropOrder = async () => {
    setDropping(true);
    try {
      await api.returnOrder(orderId);
      alert('Order dropped. Refund processed.');
      router.push('/wallet');
    } catch (error) {
      console.error(error);
      alert('Failed to drop order. Please try again.');
    } finally {
      setDropping(false);
      setShowDropModal(false);
    }
  };

  const handleNavigateToStore = () => {
    if (storeLat !== null && storeLng !== null) {
      // ✅ Fixed: Use /shopper/map instead of /map to match existing route
      router.push(`/shopper/map?lat=${storeLat}&lng=${storeLng}&destination=${encodeURIComponent(storeName)}&navigate=true`);
    } else {
      alert('Store location not available.');
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={styles.container}
    >
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Reservation Confirmed</h1>
        <button
          onClick={() => setShowDropModal(true)}
          style={styles.dropIconButton}
          title="Drop Order"
        >
          <MdCancel size={28} color="#DC2626" />
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          style={styles.successIconWrapper}
        >
          <MdCheckCircle size={64} color="#16A34A" />
        </motion.div>

        <h2 style={styles.heading}>You&apos;re all set!</h2>
        <p style={styles.subheading}>Your reservation is confirmed</p>

        {/* Pickup Time */}
        <div style={styles.timerCard}>
          <MdTimer size={24} color="#0504AA" />
          <span style={styles.timerLabel}>Pickup time: {pickupTime}</span>
        </div>

        {/* Countdown */}
        <div style={styles.countdownContainer}>
          <span style={styles.countdownLabel}>Time remaining</span>
          <span
            style={{
              ...styles.countdownValue,
              color: remaining > 0 ? '#0504AA' : '#DC2626',
            }}
          >
            {remaining > 0 ? formatTime(remaining) : 'EXPIRED'}
          </span>
        </div>

        {/* Pickup Identifier Card */}
        <div style={styles.identifierCard}>
          <div style={styles.identifierHeader}>
            <MdPersonOutline size={20} color="#0504AA" />
            <span style={styles.identifierTitle}>Pickup for</span>
          </div>
          <p style={styles.customerName}>{customerName}</p>
          <p style={styles.orderId}>Order #{orderId.slice(-4)}</p>
          <div style={styles.storeRow}>
            <MdStore size={16} color="#666" />
            <span style={styles.storeName}>{storeName}</span>
          </div>
          <p style={styles.total}>Total: ₦{total.toFixed(0)}</p>
        </div>

        {/* Action Buttons */}
        <div style={styles.actions}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePickUpComplete}
            disabled={completing}
            style={styles.primaryBtn}
          >
            <MdArrowForward size={20} color="#fff" />
            {completing ? 'Processing...' : 'Pick Up & Complete'}
          </motion.button>

          <button onClick={handleNavigateToStore} style={styles.outlineBtn}>
            <MdDirections size={20} color="#0504AA" />
            Navigate to Store
          </button>

          <button onClick={() => setShowDropModal(true)} style={styles.dropBtn}>
            <MdCancelPresentation size={20} color="#DC2626" />
            Drop Order (Refund)
          </button>
        </div>
      </div>

      {/* Drop Confirmation Modal */}
      <AnimatePresence>
        {showDropModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.modalOverlay}
            onClick={() => setShowDropModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: 'spring', damping: 25 }}
              style={styles.modalCard}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={styles.modalTitle}>Drop Order?</h3>
              <p style={styles.modalText}>
                If you drop this order, your payment will be refunded to your wallet.
              </p>
              <div style={styles.modalActions}>
                <button onClick={() => setShowDropModal(false)} style={styles.modalCancelBtn}>
                  Cancel
                </button>
                <button onClick={handleDropOrder} disabled={dropping} style={styles.modalConfirmBtn}>
                  {dropping ? 'Dropping...' : 'Confirm Drop'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}

// ... styles unchanged (same as originally provided)
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F8F9FA' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#fff', borderBottom: '1px solid #eee' },
  title: { fontSize: 20, fontWeight: 700, color: '#1A1A1A' },
  dropIconButton: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  content: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', textAlign: 'center' },
  successIconWrapper: { marginBottom: 16 },
  heading: { fontSize: 28, fontWeight: 800, color: '#1A1A1A', margin: 0 },
  subheading: { fontSize: 16, color: '#666', marginTop: 4 },
  timerCard: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', backgroundColor: '#EEF2FF', borderRadius: 20, marginTop: 24 },
  timerLabel: { fontSize: 16, fontWeight: 600, color: '#0504AA' },
  countdownContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 },
  countdownLabel: { fontSize: 14, color: '#888' },
  countdownValue: { fontSize: 32, fontWeight: 800, letterSpacing: 1 },
  identifierCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 20, padding: 24, marginTop: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', textAlign: 'left' },
  identifierHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  identifierTitle: { fontSize: 14, fontWeight: 600, color: '#666' },
  customerName: { fontSize: 28, fontWeight: 800, color: '#0504AA', margin: 0 },
  orderId: { fontSize: 14, color: '#888', marginTop: 4 },
  storeRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 },
  storeName: { fontSize: 15, fontWeight: 600, color: '#333' },
  total: { marginTop: 12, fontSize: 16, fontWeight: 700, color: '#1A1A1A' },
  actions: { width: '100%', maxWidth: 400, marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  primaryBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,4,170,0.3)' },
  outlineBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: 'transparent', color: '#0504AA', border: '1px solid #0504AA', borderRadius: 16, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  dropBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: 'transparent', color: '#DC2626', border: '1px solid #DC2626', borderRadius: 16, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '90%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#1A1A1A' },
  modalText: { fontSize: 14, color: '#4B5563', marginBottom: 24, lineHeight: 1.5 },
  modalActions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  modalCancelBtn: { padding: '10px 20px', backgroundColor: 'transparent', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 12, cursor: 'pointer', fontWeight: 600 },
  modalConfirmBtn: { padding: '10px 20px', backgroundColor: '#DC2626', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600 },
};