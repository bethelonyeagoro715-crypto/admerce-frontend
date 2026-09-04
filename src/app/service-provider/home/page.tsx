'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdSettings,
  MdAutoAwesome,
  MdEdit,
  MdCheckCircle,
  MdPauseCircle,
  MdMoreVert,
  MdDeleteOutline,
  MdPlayArrow,
  MdPause,
  MdRestaurantMenu,
  MdCalendarToday,
  MdToday,
  MdWallet,
  MdStar,
  MdAdd,
  MdStorefront,
  MdToggleOn,
  MdToggleOff,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface ServiceItem {
  service_id: string;
  title?: string;
  description?: string;
  price?: number;
  duration_minutes?: number;
  is_active?: boolean | number;
  image_url?: string;
  video_url?: string;
  [key: string]: unknown;
}

interface Booking {
  id: string;
  service_title?: string;
  user_name?: string;
  booking_date?: string;
  status?: string;
  [key: string]: unknown;
}

interface Stats {
  today_bookings?: number;
  total_earnings?: number;
  rating?: number;
  [key: string]: unknown;
}

interface Profile {
  business_name?: string;
  nickname?: string;
  username?: string;
  avatar_url?: string;
  business_image_url?: string;
  is_available?: boolean;
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_URL || ''}${url}`;
}

export default function ServiceProviderDashboardPage() {
  const router = useRouter();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [servicesData, bookingsData, statsData, profileData] = await Promise.all([
        api.getProviderServices() as Promise<ServiceItem[]>,
        api.getProviderBookings() as Promise<Booking[]>,
        api.getProviderStats() as Promise<Stats>,
        api.getMyProfile().catch(() => ({
          nickname: 'Service Provider',
          username: 'Provider',
          avatar_url: null,
        })) as Promise<Profile>,
      ]);

      setServices(Array.isArray(servicesData) ? servicesData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setStats(statsData || {});
      setProfile(profileData);

      // Use profile.is_available if present; otherwise keep default true
      if (typeof profileData?.is_available === 'boolean') {
        setIsAvailable(profileData.is_available);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const refreshDashboard = async () => {
    await loadDashboardData();
  };

  const toggleAvailability = async (value: boolean) => {
    try {
      await api.updateProviderAvailability(value);
      setIsAvailable(value);
      alert(value ? 'Now accepting bookings' : 'Paused bookings');
    } catch (err) {
      alert('Failed to update availability');
    }
  };

  const confirmBooking = async (bookingId: string) => {
    if (!window.confirm('Confirm this booking?')) return;
    try {
      await api.confirmBooking(bookingId);
      await refreshDashboard();
      alert('Booking confirmed!');
    } catch (err) {
      alert('Failed to confirm booking');
    }
  };

  const completeBooking = async (bookingId: string) => {
    if (!window.confirm('Complete this booking? Payment will be released.')) return;
    try {
      await api.completeBooking(bookingId);
      await refreshDashboard();
      alert('Booking completed! Payment released.');
    } catch (err) {
      alert('Failed to complete booking');
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await api.deleteService(serviceId);
      await refreshDashboard();
      alert('Service deleted');
    } catch (err) {
      alert('Failed to delete service');
    }
  };

  const toggleServiceActive = async (serviceId: string) => {
    try {
      await api.toggleServiceActive(serviceId);
      await refreshDashboard();
    } catch (err) {
      alert('Failed to toggle service');
    }
  };

  const editProfile = () => {
    router.push('/service-provider/edit-profile');
  };

  const openSeaiAgent = () => {
    router.push('/seai/ask?mode=agent');
  };

  const addService = () => {
    router.push('/service-provider/add-service');
  };

  if (isLoading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  const name = profile?.business_name || profile?.nickname || profile?.username || 'Service Provider';
  const avatarUrl = resolveImageUrl(profile?.avatar_url) || '';
  const businessImageUrl = resolveImageUrl(profile?.business_image_url) || '';

  const statsToday = stats.today_bookings ?? 0;
  const statsEarnings = stats.total_earnings ?? 0;
  const statsRating = stats.rating ?? 0;

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Dashboard</h1>
        <button onClick={() => router.push('/settings')} style={styles.iconBtn} title="Settings">
          <MdSettings size={24} color="#1A1A1A" />
        </button>
      </div>

      {/* Floating SEAI button */}
      <button onClick={openSeaiAgent} style={styles.fab} title="Ask SEAI">
        <MdAutoAwesome size={24} color="#fff" />
      </button>

      <div style={styles.scrollArea}>
        {/* Business Image Banner */}
        <div onClick={editProfile} style={styles.businessImage}>
          {businessImageUrl ? (
            <img src={businessImageUrl} alt="Business" style={styles.businessImg} />
          ) : (
            <div style={styles.businessPlaceholder}>Tap to add business image</div>
          )}
        </div>

        {/* Profile Header */}
        <div style={styles.profileCard}>
          <div style={styles.avatarWrapper} onClick={editProfile}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={styles.avatar} />
            ) : (
              <MdStorefront size={30} color="#0504AA" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.profileName}>{name}</div>
            <div style={styles.profileRole}>Service Provider</div>
          </div>
          <button onClick={editProfile} style={styles.iconBtn}>
            <MdEdit size={22} color="#0504AA" />
          </button>
        </div>

        {/* Availability Toggle */}
        <div style={{
          ...styles.availabilityCard,
          backgroundColor: isAvailable ? '#E8F5E9' : '#F5F5F5',
          borderColor: isAvailable ? '#4CAF50' : '#9E9E9E',
        }}>
          <div style={styles.availabilityIcon}>
            {isAvailable ? <MdToggleOn size={32} color="#4CAF50" /> : <MdToggleOff size={32} color="#9E9E9E" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.availabilityTitle}>
              {isAvailable ? 'Available Now' : 'Unavailable'}
            </div>
            <div style={styles.availabilitySubtitle}>
              {isAvailable ? 'Customers can book your services' : 'Paused – no new bookings will be accepted'}
            </div>
          </div>
          {/* Toggle Switch with sliding knob */}
          <label style={styles.switch}>
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => toggleAvailability(e.target.checked)}
              style={{ display: 'none' }}
            />
            <span style={{
              ...styles.slider,
              backgroundColor: isAvailable ? '#4CAF50' : '#ccc',
            }} />
            <span style={{
              ...styles.knob,
              transform: isAvailable ? 'translateX(20px)' : 'translateX(0)',
            }} />
          </label>
        </div>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <StatCard icon={<MdToday size={14} color="#0504AA" />} title="Today" value={String(statsToday)} subtitle="Bookings" />
          <StatCard icon={<MdWallet size={14} color="#0504AA" />} title="Earnings" value={`₦${Number(statsEarnings).toFixed(0)}`} subtitle="Total" />
          <StatCard icon={<MdStar size={14} color="#0504AA" />} title="Rating" value={Number(statsRating).toFixed(1)} subtitle="Stars" />
        </div>

        {/* Menu Section */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>My Menu</h2>
          <span style={styles.sectionCount}>{services.length} items</span>
        </div>

        {services.length === 0 ? (
          <EmptyState icon={<MdRestaurantMenu size={48} color="#ccc" />} message="Your menu is empty" subMessage="Add your first service to start getting bookings" />
        ) : (
          services.map((service) => (
            <MenuItemCard
              key={service.service_id}
              service={service}
              onEdit={() => router.push(`/service-provider/edit-service/${service.service_id}`)}
              onDelete={() => deleteService(service.service_id)}
              onToggle={() => toggleServiceActive(service.service_id)}
            />
          ))
        )}

        {/* Add Service Button */}
        <button onClick={addService} style={styles.addBtn}>
          <MdAdd size={20} color="#fff" />
          Add to Menu
        </button>

        {/* Bookings Section */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Upcoming Bookings</h2>
          {bookings.length > 0 && <span style={styles.pendingCount}>{bookings.length} pending</span>}
        </div>

        {bookings.length === 0 ? (
          <EmptyState icon={<MdCalendarToday size={48} color="#ccc" />} message="No bookings yet" subMessage="When customers book your services, they'll appear here" />
        ) : (
          bookings.slice(0, 3).map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onConfirm={() => confirmBooking(booking.id)}
              onComplete={() => completeBooking(booking.id)}
            />
          ))
        )}

        {bookings.length > 3 && (
          <button onClick={() => router.push('/service-provider/bookings')} style={styles.viewAllBtn}>
            View all {bookings.length} bookings
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────
function StatCard({ icon, title, value, subtitle }: { icon: React.ReactNode; title: string; value: string; subtitle: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}
        <span style={styles.statTitle}>{title}</span>
      </div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statSubtitle}>{subtitle}</div>
    </div>
  );
}

// ─── Menu Item Card ─────────────────────────────────────────────────
function MenuItemCard({ service, onEdit, onDelete, onToggle }: { service: ServiceItem; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const title = service.title || 'Untitled';
  const description = service.description || '';
  const price = Number(service.price || 0).toFixed(0);
  const duration = service.duration_minutes ?? 30;
  const isActive = typeof service.is_active === 'boolean' ? service.is_active : service.is_active === 1;
  const mediaUrl = resolveImageUrl(service.image_url || service.video_url);

  return (
    <div style={styles.menuItem}>
      <div style={styles.menuThumb}>
        {mediaUrl ? (
          <img src={mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <MdRestaurantMenu size={24} color={isActive ? '#4CAF50' : '#9E9E9E'} />
        )}
        <span style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          backgroundColor: isActive ? '#4CAF50' : '#9E9E9E',
          borderRadius: '50%',
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isActive ? <MdCheckCircle size={10} color="#fff" /> : <MdPause size={10} color="#fff" />}
        </span>
      </div>
      <div style={styles.menuInfo}>
        <div style={styles.menuTitle}>{title}</div>
        {description && <div style={styles.menuDescription}>{description}</div>}
        <div style={styles.menuPrice}>
          ₦{price} <span style={{ margin: '0 8px' }}>•</span> {duration} min
        </div>
      </div>
      <button onClick={onEdit} style={styles.iconBtn}>
        <MdMoreVert size={20} color="#666" />
      </button>
      <button onClick={onDelete} style={styles.iconBtn}>
        <MdDeleteOutline size={20} color="#FF0000" />
      </button>
      <button onClick={onToggle} style={styles.iconBtn}>
        {isActive ? <MdPause size={20} color="#FFA000" /> : <MdPlayArrow size={20} color="#4CAF50" />}
      </button>
    </div>
  );
}

// ─── Booking Card ───────────────────────────────────────────────────
function BookingCard({ booking, onConfirm, onComplete }: { booking: Booking; onConfirm: () => void; onComplete: () => void }) {
  const serviceTitle = booking.service_title || 'Service';
  const userName = booking.user_name || 'Customer';
  const date = booking.booking_date || 'Date TBD';
  const status = booking.status || 'pending';

  let statusColor = '#999';
  let statusText = status;
  if (status === 'pending') { statusColor = '#FFA000'; statusText = 'Pending'; }
  else if (status === 'confirmed') { statusColor = '#2196F3'; statusText = 'Confirmed'; }
  else if (status === 'completed') { statusColor = '#4CAF50'; statusText = 'Completed'; }

  return (
    <div style={styles.bookingCard}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={styles.bookingAvatar}>
          {userName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={styles.bookingTitle}>{serviceTitle}</div>
          <div style={styles.bookingUser}>{userName}</div>
        </div>
        <span style={{ ...styles.bookingStatus, backgroundColor: `${statusColor}20`, color: statusColor }}>
          {statusText}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
        <MdCalendarToday size={14} color="#888" />
        <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>{date}</span>
        <div style={{ flex: 1 }} />
        {status === 'pending' && (
          <button onClick={onConfirm} style={styles.confirmBtn}>Confirm</button>
        )}
        {status === 'confirmed' && (
          <button onClick={onComplete} style={styles.completeBtn}>Complete</button>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────
function EmptyState({ icon, message, subMessage }: { icon: React.ReactNode; message: string; subMessage?: string }) {
  return (
    <div style={styles.emptyState}>
      {icon}
      <div style={styles.emptyMessage}>{message}</div>
      {subMessage && <div style={styles.emptySub}>{subMessage}</div>}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#fff' },
  spinner: { width: 36, height: 36, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee' },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  fab: { position: 'fixed', bottom: 90, right: 24, width: 56, height: 56, borderRadius: '50%', backgroundColor: '#0504AA', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(5,4,170,0.4)', cursor: 'pointer', zIndex: 50 },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '16px' },
  businessImage: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#f0f0f0', cursor: 'pointer', overflow: 'hidden', marginBottom: 12 },
  businessImg: { width: '100%', height: '100%', objectFit: 'cover' },
  businessPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' },
  profileCard: { display: 'flex', alignItems: 'center', padding: 16, backgroundColor: '#f9f9f9', borderRadius: 16, border: '1px solid #eee', marginBottom: 24 },
  avatarWrapper: { width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16, cursor: 'pointer' },
  avatar: { width: '100%', height: '100%', objectFit: 'cover' },
  profileName: { fontSize: 16, fontWeight: 700, color: '#1A1A1A' },
  profileRole: { fontSize: 13, color: '#888' },
  availabilityCard: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid', marginBottom: 24 },
  availabilityIcon: { marginRight: 12 },
  availabilityTitle: { fontSize: 15, fontWeight: 600, color: '#1A1A1A' },
  availabilitySubtitle: { fontSize: 12, color: '#888' },
  switch: { position: 'relative', width: 44, height: 24, display: 'inline-block' },
  slider: { position: 'absolute', inset: 0, borderRadius: 24, transition: 'background-color 0.3s' },
  knob: { position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff', transition: 'transform 0.3s' },
  statsRow: { display: 'flex', gap: 8, marginBottom: 24 },
  statCard: { flex: 1, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 12 },
  statTitle: { fontSize: 12, color: '#888' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  statSubtitle: { fontSize: 11, color: '#888' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 },
  sectionCount: { fontSize: 13, color: '#888' },
  pendingCount: { fontSize: 13, color: '#FFA000' },
  menuItem: { display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f0f0' },
  menuThumb: { position: 'relative', width: 48, height: 48, borderRadius: 8, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: 600, color: '#1A1A1A' },
  menuDescription: { fontSize: 13, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  menuPrice: { fontSize: 13, color: '#0504AA', fontWeight: 600, marginTop: 2 },
  bookingCard: { backgroundColor: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 12, marginBottom: 8 },
  bookingAvatar: { width: 32, height: 32, borderRadius: '50%', backgroundColor: '#0504AA10', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, color: '#0504AA', fontWeight: 'bold' },
  bookingTitle: { fontSize: 14, fontWeight: 600 },
  bookingUser: { fontSize: 12, color: '#888' },
  bookingStatus: { padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600 },
  confirmBtn: { padding: '6px 12px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  completeBtn: { padding: '6px 12px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  emptyState: { padding: '32px 16px', backgroundColor: '#f9f9f9', borderRadius: 12, border: '1px solid #eee', textAlign: 'center' },
  emptyMessage: { fontSize: 15, fontWeight: 600, color: '#666', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#888', marginTop: 4 },
  addBtn: { width: '100%', padding: '16px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  viewAllBtn: { background: 'none', border: 'none', color: '#0504AA', fontWeight: 600, cursor: 'pointer', padding: '8px 0' },
};