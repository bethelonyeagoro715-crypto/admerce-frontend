'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '../../../services/api';
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  bookingModal: { backgroundColor: '#fff', padding: 20, borderRadius: 16, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' },
  modalField: { marginBottom: 12 },
  modalLabel: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  modalInput: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
  modalButton: { width: '100%', padding: '12px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  modalClose: { position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer' },
  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
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
  const [quantity, setQuantity] = useState(1);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

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

  const openBookingModal = () => {
    if (!selectedDate || !selectedTime) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      setSelectedDate(dateStr);
      setSelectedTime('10:00');
    }
    setShowBookingModal(true);
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime) {
      alert('Please select date and time');
      return;
    }
    if (!service) return;

    // Check wallet balance before booking
    try {
      const wallet = (await api.getWalletBalance()) as { balance: number };
      if (wallet.balance < service.price) {
        alert(`Insufficient balance. You need ₦${service.price.toFixed(0)} but have ₦${wallet.balance.toFixed(0)}.`);
        router.push('/wallet');
        return;
      }
    } catch (err) {
      console.error('Could not verify wallet balance:', err);
    }

    const dateTime = new Date(`${selectedDate}T${selectedTime}:00`);
    const scheduledFor = dateTime.toISOString().slice(0, 19); // "2026-09-02T10:00:00"

    setIsLoading(true);
    try {
      const response = await api.bookService(serviceId, scheduledFor, '', undefined, undefined);
      const bookingId = (response as { booking_id?: string }).booking_id || '';
      setShowBookingModal(false);

      // Navigate to booking confirmed screen with details
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

  const handleJobDone = async () => {
    if (!service) return;

    setIsLoading(true);
    try {
      // Fetch all bookings for current user (as client)
      const bookings = (await api.getServiceBookings()) as Array<{
        booking_id: string;
        service_id: string;
        status: string;
        amount?: number;
        service_title?: string;
      }>;

      // Find active booking for this service
      const activeBooking = bookings.find(
        (b) => b.service_id === serviceId && b.status.toLowerCase() === 'locked'
      );

      if (!activeBooking) {
        alert('No active booking found for this service.');
        return;
      }

      if (!window.confirm('Are you satisfied with the service? This will release the payment to the provider.')) {
        return;
      }

      // Complete the booking (client releases funds)
      await api.completeServiceBooking(activeBooking.booking_id);

      // Navigate to receipt page for service booking
      const query = new URLSearchParams({
        service_name: service.title,
        provider_name: service.business_name || 'Service Provider',
        amount: String(service.price),
        booking_id: activeBooking.booking_id,
      });
      router.push(`/receipt/service/${activeBooking.booking_id}?${query.toString()}`);
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
            {isSaved ? <MdFavorite size={24} color="#0504AA" /> : <MdFavoriteBorder size={24} color="#666" />}
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={styles.overlay}>
          <div className="spinner" />
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
            <div style={{ ...styles.image, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MdImage size={64} color="#aaa" />
            </div>
          )}
          <button style={styles.lensButton} onClick={openVisualSearch} title="Visual Search">
            <MdImage size={18} color="#0504AA" />
          </button>
        </div>

        <h2 style={styles.serviceTitle}>{service.title}</h2>
        <div style={styles.priceRow}>
          <span style={styles.price}>₦{service.price.toFixed(0)}</span>
          <div style={styles.qtyControl}>
            <button style={styles.qtyButton} onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>−</button>
            <span style={styles.qtyValue}>{quantity}</span>
            <button style={styles.qtyButton} onClick={() => setQuantity(Math.min(10, quantity + 1))} disabled={quantity >= 10}>+</button>
          </div>
        </div>

        <div style={styles.providerRow}>
          <div style={styles.avatar}>
            {providerImageUrl ? (
              <img src={providerImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={styles.avatarText}>{providerName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span style={styles.providerName}>By {providerName}</span>
          <button style={styles.chatButton} onClick={() => router.push(`/chat/${providerId}`)} title="Message Provider">
            <MdChatBubbleOutline size={18} color="#0504AA" />
          </button>
        </div>

        {service.lat && service.lng && (
          <div style={styles.mapRow}>
            <MdLocationOn size={16} color="#888" style={{ marginRight: 4 }} />
            <span style={styles.mapText}>Tap to view on map</span>
            <button
              style={styles.viewMapLink}
              onClick={() => router.push(`/shopper/map?lat=${service.lat}&lng=${service.lng}&destination=${encodeURIComponent(providerName)}`)}
            >
              View on Map
            </button>
          </div>
        )}

        <div style={styles.ratingRow}>
          {(service.rating ?? 0) > 0 && (
            <>
              <MdStar size={16} style={styles.star} />
              <span style={styles.ratingText}>{(service.rating ?? 0).toFixed(1)}</span>
              <span style={styles.reviewText}>({service.review_count ?? 0} reviews)</span>
            </>
          )}
          {(service.duration_minutes ?? 0) > 0 && (
            <span style={styles.durationBadge}>{service.duration_minutes} min</span>
          )}
        </div>

        {/* Always visible action buttons */}
        <div style={styles.fulfillmentSection}>
          <h3 style={styles.sectionTitle}>What would you like to do?</h3>
          <button
            style={{ ...styles.actionButton, backgroundColor: '#0504AA', marginBottom: 10 }}
            onClick={openBookingModal}
          >
            <MdCalendarToday size={20} />
            Book Service
          </button>
          <button
            style={{ ...styles.actionButton, backgroundColor: '#27AE60' }}
            onClick={handleJobDone}
          >
            <MdCheckCircle size={20} />
            Job Done
          </button>
        </div>

        {service.description && (
          <div style={styles.descriptionSection}>
            <h3 style={styles.descriptionTitle}>Description</h3>
            <p style={styles.descriptionText}>{service.description}</p>
          </div>
        )}
      </div>

      {showBookingModal && (
        <div style={styles.overlay} onClick={() => setShowBookingModal(false)}>
          <div style={styles.bookingModal} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={() => setShowBookingModal(false)}>
              <MdClose size={20} />
            </button>
            <h3 style={styles.modalTitle}>Select Date & Time</h3>
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Date</label>
              <input type="date" style={styles.modalInput} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Time</label>
              <input type="time" style={styles.modalInput} value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} />
            </div>
            <button style={styles.modalButton} onClick={handleBooking} disabled={!selectedDate || !selectedTime || isLoading}>
              Confirm Booking
            </button>
          </div>
        </div>
      )}
    </main>
  );
}