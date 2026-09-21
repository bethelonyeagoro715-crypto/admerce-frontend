'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../services/api';
import PickTimeBottomSheet from '../../../components/PickTimeBottomSheet';
import {
  MdShare,
  MdFavorite,
  MdFavoriteBorder,
  MdImage,
  MdChatBubbleOutline,
  MdLocationOn,
  MdStar,
  MdCalendarToday,
  MdCheckCircle,
  MdClose,
} from 'react-icons/md';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:8000';

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

interface ServiceDetail {
  service_id: string;
  title: string;
  price: number;
  description?: string;
  image_url?: string;
  video_url?: string;
  duration_minutes?: number;
  provider_id?: string;
  business_name?: string;
  business_image_url?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  review_count?: number;
  [key: string]: unknown;
}

interface ActiveBooking {
  booking_id: string;
  service_id: string;
  status: string;
  amount?: number;
  service_title?: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' },
  appBar: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 10 },
  backBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', marginRight: 12, color: '#333', display: 'flex', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 600, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actions: { display: 'flex', gap: 8 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 32 },
  imageSection: { position: 'relative', marginBottom: 16 },
  image: { width: '100%', height: 280, objectFit: 'cover', borderRadius: 20, backgroundColor: '#f0f0f0' },
  video: { width: '100%', height: 280, objectFit: 'cover', borderRadius: 20, backgroundColor: '#000' },
  lensButton: { position: 'absolute', bottom: 12, right: 12, width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  serviceTitle: { fontSize: 22, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 },
  priceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  price: { fontSize: 24, fontWeight: 700, color: '#0504AA' },
  qtyControl: { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' },
  qtyButton: { background: 'none', border: 'none', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#333' },
  qtyValue: { width: 28, textAlign: 'center', fontWeight: 600 },
  providerRow: { display: 'flex', alignItems: 'center', marginTop: 8 },
  avatar: { width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#0504AA20', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#0504AA', fontWeight: 'bold', fontSize: 14 },
  providerName: { color: '#666', flex: 1 },
  chatButton: { width: 36, height: 36, borderRadius: '50%', backgroundColor: '#0504AA14', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mapRow: { display: 'flex', alignItems: 'center', marginTop: 8 },
  mapText: { fontSize: 14, color: '#888', flex: 1 },
  viewMapLink: { color: '#0504AA', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' },
  ratingRow: { display: 'flex', alignItems: 'center', marginTop: 8 },
  star: { color: '#FFA000', marginRight: 4 },
  ratingText: { fontWeight: 600, fontSize: 14 },
  reviewText: { fontSize: 12, color: '#888', marginLeft: 4 },
  durationBadge: { backgroundColor: '#E8F0FE', color: '#1A73E8', padding: '2px 10px', borderRadius: 12, fontSize: 12, marginLeft: 'auto' },
  fulfillmentSection: { marginTop: 24, padding: 16, backgroundColor: '#f9f9f9', borderRadius: 16, border: '1px solid #eee' },
  sectionTitle: { fontWeight: 600, fontSize: 16, marginBottom: 12 },
  actionButton: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  descriptionSection: { marginTop: 24 },
  descriptionTitle: { fontWeight: 600, fontSize: 16, marginBottom: 8 },
  descriptionText: { color: '#555', lineHeight: 1.5 },
  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  // Overlay for the in-page spinner
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  spinner: { width: 40, height: 40, border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};

export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const serviceId = params.id;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  // ✅ PickTime bottom sheet for booking
  const [showPickTime, setShowPickTime] = useState(false);

  // ✅ Satisfaction modal for Job Done
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
  const [checkingBooking, setCheckingBooking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = (await api.getService(serviceId)) as unknown as ServiceDetail;
        setService(data);
      } catch (error) {
        console.error('Failed to load service:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceId]);

  const toggleSave = async () => {
    if (isSaveLoading) return;
    setIsSaveLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsSaved(!isSaved);
    setIsSaveLoading(false);
  };

  const shareService = () => {
    alert('Share feature coming soon!');
  };

  const openVisualSearch = () => {
    const imageUrl = service?.image_url;
    if (imageUrl) {
      const absolute = resolveImageUrl(imageUrl);
      router.push(`/seai-lens?image=${encodeURIComponent(absolute)}`);
    } else {
      alert('No image available for visual search.');
    }
  };

  // ─── Book Service: opens the PickTime sheet ─────────────────────
  const handleBookClick = () => {
    if (!service) return;
    setShowPickTime(true);
  };

  // ─── PickTime callback — user picked a datetime ─────────────────
  const handlePickTime = async (scheduledFor: string) => {
    if (!service) return;
    setShowPickTime(false);

    // Check wallet balance before booking
    try {
      const wallet = (await api.getWalletBalance()) as { balance: number };
      if (wallet.balance < service.price) {
        alert(
          `Insufficient balance. You need ₦${service.price.toFixed(0)} but have ₦${wallet.balance.toFixed(0)}.`,
        );
        router.push('/shopper/wallet');
        return;
      }
    } catch (err) {
      console.error('Could not verify wallet balance:', err);
    }

    setIsLoading(true);
    try {
      const response = await api.bookService(
        serviceId,
        scheduledFor,
        '',
        undefined,
        undefined,
      );
      const bookingId = (response as { booking_id?: string }).booking_id || '';

      const query = new URLSearchParams({
        service_name: service.title,
        provider_name: service.business_name || 'Service Provider',
        scheduled_for: scheduledFor,
        amount: String(service.price),
        booking_id: bookingId,
      });
      router.push(`/booking-confirmed?${query.toString()}`);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Booking failed');
      console.error('Booking error:', detail);
      alert(detail);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Job Done: find active booking, open satisfaction modal ─────
  const handleJobDoneClick = async () => {
    if (!service) return;
    setCheckingBooking(true);
    try {
      const bookings = (await api.getServiceBookings()) as ActiveBooking[];
      // ✅ Accept either 'locked' OR 'accepted' — a provider who forgot
      //    to tap accept can still have the job completed.
      const active = bookings.find(
        (b) =>
          b.service_id === serviceId &&
          (b.status?.toLowerCase() === 'locked' ||
            b.status?.toLowerCase() === 'accepted'),
      );

      if (!active) {
        alert('No active booking found for this service.');
        return;
      }

      setActiveBooking(active);
      setShowSatisfaction(true);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Could not load your bookings');
      alert(detail);
    } finally {
      setCheckingBooking(false);
    }
  };

  // ─── Confirm satisfaction → release funds → navigate to receipt ─
  const handleConfirmSatisfaction = async () => {
    if (!service || !activeBooking) return;
    setShowSatisfaction(false);
    setIsLoading(true);
    try {
      await api.completeServiceBooking(activeBooking.booking_id);
      const query = new URLSearchParams({
        service_name: service.title,
        provider_name: service.business_name || 'Service Provider',
        amount: String(service.price),
        booking_id: activeBooking.booking_id,
        status: 'completed',
      });
      router.push(
        `/receipt/service/${activeBooking.booking_id}?${query.toString()}`,
      );
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Failed to complete job');
      console.error('Completion error:', detail);
      alert(detail);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={styles.loadingContainer}>
        <div>Loading...</div>
      </main>
    );
  }

  if (!service) {
    return (
      <main style={styles.loadingContainer}>
        <div>Service not found</div>
      </main>
    );
  }

  const imageUrl = resolveImageUrl(service.image_url);
  const videoUrl = resolveImageUrl(service.video_url);
  const providerImageUrl = resolveImageUrl(service.business_image_url);
  const providerName = service.business_name || 'Service Provider';
  const providerId = service.provider_id || '';

  return (
    <main style={styles.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={styles.appBar}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <MdClose size={24} />
        </button>
        <h1 style={styles.title}>Service Detail</h1>
        <div style={styles.actions}>
          <button style={styles.iconBtn} onClick={shareService} title="Share">
            <MdShare size={24} color="#0504AA" />
          </button>
          <button
            style={styles.iconBtn}
            onClick={toggleSave}
            disabled={isSaveLoading}
            title={isSaved ? 'Unsave' : 'Save'}
          >
            {isSaved ? (
              <MdFavorite size={24} color="#0504AA" />
            ) : (
              <MdFavoriteBorder size={24} color="#666" />
            )}
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={styles.overlay}>
          <div style={styles.spinner} />
        </div>
      )}

      <div style={styles.scrollArea}>
        <div style={styles.imageSection}>
          {videoUrl ? (
            <video
              src={videoUrl}
              poster={imageUrl || undefined}
              controls
              muted
              playsInline
              style={styles.video}
            />
          ) : imageUrl ? (
            <img src={imageUrl} alt={service.title} style={styles.image} />
          ) : (
            <div
              style={{
                ...styles.image,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MdImage size={64} color="#aaa" />
            </div>
          )}
          <button
            style={styles.lensButton}
            onClick={openVisualSearch}
            title="Visual Search"
          >
            <MdImage size={18} color="#0504AA" />
          </button>
        </div>

        <h2 style={styles.serviceTitle}>{service.title}</h2>
        <div style={styles.priceRow}>
          <span style={styles.price}>₦{service.price.toFixed(0)}</span>
          {/* ✅ Quantity removed — services are booked one at a time */}
        </div>

        <div style={styles.providerRow}>
          <div style={styles.avatar}>
            {providerImageUrl ? (
              <img
                src={providerImageUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={styles.avatarText}>
                {providerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span style={styles.providerName}>By {providerName}</span>
          <button
            style={styles.chatButton}
            onClick={() => router.push(`/chat/${providerId}`)}
            title="Message Provider"
          >
            <MdChatBubbleOutline size={18} color="#0504AA" />
          </button>
        </div>

        {service.lat && service.lng && (
          <div style={styles.mapRow}>
            <MdLocationOn size={16} color="#888" style={{ marginRight: 4 }} />
            <span style={styles.mapText}>Tap to view on map</span>
            <button
              style={styles.viewMapLink}
              onClick={() =>
                router.push(
                  `/shopper/map?lat=${service.lat}&lng=${service.lng}&destination=${encodeURIComponent(
                    providerName,
                  )}`,
                )
              }
            >
              View on Map
            </button>
          </div>
        )}

        <div style={styles.ratingRow}>
          {(service.rating ?? 0) > 0 && (
            <>
              <MdStar size={16} style={styles.star} />
              <span style={styles.ratingText}>
                {(service.rating ?? 0).toFixed(1)}
              </span>
              <span style={styles.reviewText}>
                ({service.review_count ?? 0} reviews)
              </span>
            </>
          )}
          {(service.duration_minutes ?? 0) > 0 && (
            <span style={styles.durationBadge}>
              {service.duration_minutes} min
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div style={styles.fulfillmentSection}>
          <h3 style={styles.sectionTitle}>What would you like to do?</h3>
          <button
            style={{
              ...styles.actionButton,
              backgroundColor: '#0504AA',
              marginBottom: 10,
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
            onClick={handleBookClick}
            disabled={isLoading}
          >
            <MdCalendarToday size={20} />
            Book Service
          </button>
          <button
            style={{
              ...styles.actionButton,
              backgroundColor: '#27AE60',
              opacity: checkingBooking || isLoading ? 0.6 : 1,
              cursor: checkingBooking || isLoading ? 'not-allowed' : 'pointer',
            }}
            onClick={handleJobDoneClick}
            disabled={checkingBooking || isLoading}
          >
            <MdCheckCircle size={20} />
            {checkingBooking ? 'Checking…' : 'Job Done'}
          </button>
        </div>

        {service.description && (
          <div style={styles.descriptionSection}>
            <h3 style={styles.descriptionTitle}>Description</h3>
            <p style={styles.descriptionText}>{service.description}</p>
          </div>
        )}
      </div>

      {/* ✅ PickTime bottom sheet — service mode */}
      <PickTimeBottomSheet
        isOpen={showPickTime}
        onClose={() => setShowPickTime(false)}
        onSelect={handlePickTime}
        mode="service"
      />

      {/* ✅ Satisfaction modal — replaces window.confirm */}
      <SatisfactionModal
        isOpen={showSatisfaction}
        providerName={providerName}
        amount={service.price}
        onCancel={() => {
          setShowSatisfaction(false);
          setActiveBooking(null);
        }}
        onConfirm={handleConfirmSatisfaction}
      />
    </main>
  );
}

// ─── Satisfaction modal ─────────────────────────────────────────
function SatisfactionModal({
  isOpen,
  providerName,
  amount,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  providerName: string;
  amount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === 'undefined') return null;
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 1999,
            }}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: '24px 22px',
              width: '90%',
              maxWidth: 380,
              zIndex: 2000,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <MdCheckCircle size={36} color="#16A34A" />
            </div>

            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#1A1A1A',
                margin: '0 0 8px',
              }}
            >
              Are you satisfied with the service?
            </h3>

            <p
              style={{
                fontSize: 14,
                color: '#555',
                lineHeight: 1.5,
                margin: '0 0 20px',
              }}
            >
              Confirming will release{' '}
              <strong style={{ color: '#0504AA' }}>
                ₦{amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </strong>{' '}
              to <strong>{providerName}</strong>. This cannot be undone.
            </p>

            <button
              onClick={onConfirm}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#27AE60',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <MdCheckCircle size={20} />
              Yes, release funds
            </button>

            <button
              onClick={onCancel}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'transparent',
                color: '#666',
                border: '1px solid #E5E7EB',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Not yet
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}