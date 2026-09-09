'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '../../../services/api';
import {
  clear as clearLocalStorage,
  getActiveRole,
  setActiveRole,
} from '../../../services/localStorage';
import {
  MdSave,
  MdPerson,
  MdCameraAlt,
  MdClose,
  MdPhotoLibrary,
  MdCheckCircle,
  MdArrowForwardIos,
  MdLogout,
  MdStore,
  MdShoppingBag,
  MdDeliveryDining,
  MdSwapHoriz,
  MdBuild,
  MdAdd,
  MdEdit,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface Profile {
  nickname?: string;
  username?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  role?: string;
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const initialRole = params.role || 'shopper';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboardedRoles, setOnboardedRoles] = useState<string[]>([]);
  const [currentRole, setCurrentRole] = useState(initialRole);
  const [loading, setLoading] = useState(true);

  // Avatar upload
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // General notification toggles
  const [notificationsWantedAlerts, setNotificationsWantedAlerts] = useState(true);
  const [notificationsFollowedStores, setNotificationsFollowedStores] = useState(true);
  const [notificationsMessages, setNotificationsMessages] = useState(true);
  const [notificationsDeliveryUpdates, setNotificationsDeliveryUpdates] = useState(true);

  // Role-specific notification toggles
  const [notificationsPriceChanges, setNotificationsPriceChanges] = useState(false);
  const [notificationsSaleCompleted, setNotificationsSaleCompleted] = useState(false);
  const [notificationsArbitrage, setNotificationsArbitrage] = useState(false);
  const [notificationsNewBooking, setNotificationsNewBooking] = useState(false);
  const [notificationsBookingReminders, setNotificationsBookingReminders] = useState(false);
  const [notificationsEarningsUpdates, setNotificationsEarningsUpdates] = useState(false);

  // Store settings
  const [autoAcceptReservations, setAutoAcceptReservations] = useState(false);
  const [vacationMode, setVacationMode] = useState(false);
  const [defaultPickupWindow, setDefaultPickupWindow] = useState('2 hours');

  // Service provider booking & availability
  const [bufferTime, setBufferTime] = useState(30);
  const [serviceAreaRadius, setServiceAreaRadius] = useState(10);
  const [defaultServiceDuration, setDefaultServiceDuration] = useState(60);
  const [calendarSync, setCalendarSync] = useState(false);

  // Flipper reselling preferences
  const [autoApplyKeywords, setAutoApplyKeywords] = useState(false);
  const [defaultMarkupType, setDefaultMarkupType] = useState('Quick Flip');

  // Privacy
  const [privacyShowLastName, setPrivacyShowLastName] = useState(false);
  const [privacyShareActivity, setPrivacyShareActivity] = useState(false);

  // Discovery
  const [discoveryRadius, setDiscoveryRadius] = useState(50);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);

  // Appearance
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');

  // Load profile and settings
  const loadData = async () => {
    setLoading(true);
    try {
      const profileData = (await api.getMyProfile()) as Profile;
      const rolesData = await api.getOnboardedRoles();
      const active = getActiveRole() || profileData.role || initialRole;

      // Load settings for the active role
      const settings = (await api.getSettings(active)) as Record<string, unknown>;

      // Populate states from settings (if keys exist)
      setNotificationsWantedAlerts((settings.notifications_wanted_alerts as boolean) ?? true);
      setNotificationsFollowedStores((settings.notifications_followed_stores as boolean) ?? true);
      setNotificationsMessages((settings.notifications_messages as boolean) ?? true);
      setNotificationsDeliveryUpdates((settings.notifications_delivery_updates as boolean) ?? true);
      setNotificationsPriceChanges((settings.notifications_price_changes as boolean) ?? false);
      setNotificationsSaleCompleted((settings.notifications_sale_completed as boolean) ?? false);
      setNotificationsArbitrage((settings.notifications_arbitrage as boolean) ?? false);
      setNotificationsNewBooking((settings.notifications_new_booking as boolean) ?? false);
      setNotificationsBookingReminders((settings.notifications_booking_reminders as boolean) ?? false);
      setNotificationsEarningsUpdates((settings.notifications_earnings_updates as boolean) ?? false);
      setAutoAcceptReservations((settings.auto_accept_reservations as boolean) ?? false);
      setVacationMode((settings.vacation_mode as boolean) ?? false);
      setDefaultPickupWindow((settings.default_pickup_window as string) ?? '2 hours');
      setBufferTime((settings.buffer_time as number) ?? 30);
      setServiceAreaRadius((settings.service_area_radius as number) ?? 10);
      setDefaultServiceDuration((settings.default_service_duration as number) ?? 60);
      setCalendarSync((settings.calendar_sync as boolean) ?? false);
      setAutoApplyKeywords((settings.auto_apply_keywords as boolean) ?? false);
      setDefaultMarkupType((settings.default_markup_type as string) ?? 'Quick Flip');
      setPrivacyShowLastName((settings.privacy_show_last_name as boolean) ?? false);
      setPrivacyShareActivity((settings.privacy_share_activity as boolean) ?? false);
      setDiscoveryRadius((settings.discovery_radius as number) ?? 50);
      setPreferredCategories((settings.preferred_categories as string[]) ?? []);
      setThemeMode((settings.theme_mode as 'system' | 'light' | 'dark') ?? 'system');

      setProfile(profileData);
      setOnboardedRoles(rolesData);
      setCurrentRole(active);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Save all settings to backend
  const saveSettings = async () => {
    const settings = {
      notifications_wanted_alerts: notificationsWantedAlerts,
      notifications_followed_stores: notificationsFollowedStores,
      notifications_messages: notificationsMessages,
      notifications_delivery_updates: notificationsDeliveryUpdates,
      notifications_price_changes: notificationsPriceChanges,
      notifications_sale_completed: notificationsSaleCompleted,
      notifications_arbitrage: notificationsArbitrage,
      notifications_new_booking: notificationsNewBooking,
      notifications_booking_reminders: notificationsBookingReminders,
      notifications_earnings_updates: notificationsEarningsUpdates,
      auto_accept_reservations: autoAcceptReservations,
      vacation_mode: vacationMode,
      default_pickup_window: defaultPickupWindow,
      buffer_time: bufferTime,
      service_area_radius: serviceAreaRadius,
      default_service_duration: defaultServiceDuration,
      calendar_sync: calendarSync,
      auto_apply_keywords: autoApplyKeywords,
      default_markup_type: defaultMarkupType,
      privacy_show_last_name: privacyShowLastName,
      privacy_share_activity: privacyShareActivity,
      discovery_radius: discoveryRadius,
      preferred_categories: preferredCategories,
      theme_mode: themeMode,
    };
    try {
      await api.saveSettings(currentRole, settings);
      alert('Settings saved successfully!');
    } catch (error) {
      alert('Failed to save settings. Please try again.');
    }
  };

  const switchRole = async (role: string) => {
    if (role === currentRole) return;
    setActiveRole(role);
    setCurrentRole(role);
    const routes: Record<string, string> = {
      shopper: '/shopper/home',
      storekeeper: '/storekeeper/home',
      courier: '/courier/home',
      flipper: '/flipper/home',
      service_provider: '/service-provider/home',
    };
    router.replace(routes[role] || '/shopper/home');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      clearLocalStorage();
      router.replace('/');
    }
  };

  // Avatar upload
  const openAvatarModal = () => setShowAvatarModal(true);
  const closeAvatarModal = () => {
    setShowAvatarModal(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  };
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };
  const uploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      await api.uploadAvatar(avatarFile);
      await loadData();
      closeAvatarModal();
    } catch {
      alert('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  const name = profile?.nickname || profile?.username || profile?.phone || 'User';
  const email = profile?.email || '';
  const phone = profile?.phone || '';
  const avatarUrl = avatarPreview || resolveImageUrl(profile?.avatar_url) || '';

  const roleDisplayName: Record<string, string> = {
    shopper: 'Shopper',
    storekeeper: 'Storekeeper',
    courier: 'Courier',
    flipper: 'Flipper',
    service_provider: 'Service Provider',
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Profile & Settings</h1>
        <button onClick={saveSettings} style={styles.headerIcon} title="Save settings">
          <MdSave size={24} color="#0504AA" />
        </button>
      </div>

      <div style={styles.scrollArea}>
        {/* Profile Card */}
        <div style={styles.profileCard}>
          <div style={styles.avatarWrapper} onClick={openAvatarModal}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={styles.avatar} />
            ) : (
              <MdPerson size={40} color="#aaa" />
            )}
            <div style={styles.cameraBadge}>
              <MdCameraAlt size={14} color="#fff" />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.profileName}>{name}</div>
            {email && <div style={styles.profileEmail}>{email}</div>}
            {phone && <div style={styles.profilePhone}>{phone}</div>}
            <span style={styles.roleBadge}>
              {(roleDisplayName[currentRole] || currentRole).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Roles Section */}
        <SectionCard title="Your Roles">
          {[
            { id: 'shopper', label: 'Shopper', icon: <MdShoppingBag size={22} color="#0504AA" /> },
            { id: 'storekeeper', label: 'Storekeeper', icon: <MdStore size={22} color="#0504AA" /> },
            { id: 'courier', label: 'Courier', icon: <MdDeliveryDining size={22} color="#0504AA" /> },
            { id: 'flipper', label: 'Flipper', icon: <MdSwapHoriz size={22} color="#0504AA" /> },
            { id: 'service_provider', label: 'Service Provider', icon: <MdBuild size={22} color="#0504AA" /> },
          ].map((role) => {
            const isActive = currentRole === role.id;
            const isOnboarded = onboardedRoles.includes(role.id);
            return (
              <div key={role.id} style={styles.roleItem}>
                {role.icon}
                <div style={styles.roleInfo}>
                  <div style={styles.roleLabel}>{role.label}</div>
                  <div style={styles.roleStatus}>
                    {isActive ? 'Active' : isOnboarded ? 'Onboarded' : 'Not onboarded'}
                  </div>
                </div>
                {isActive ? (
                  <MdCheckCircle size={20} color="#0504AA" />
                ) : isOnboarded ? (
                  <button onClick={() => switchRole(role.id)} style={styles.switchBtn}>
                    Switch
                  </button>
                ) : null}
              </div>
            );
          })}
        </SectionCard>

        {/* Account */}
        <SectionCard title="Account">
          <InfoTile label="Edit Profile" onTap={() => alert('Edit profile coming soon')} />
          <InfoTile label="Change Password" onTap={() => alert('Change password coming soon')} />
          <InfoTile label="Phone" value={phone || '—'} />
          <InfoTile label="Email" value={email || '—'} />
          <InfoTile label="Linked Payment Methods" value="Coming soon" onTap={() => alert('Payment methods coming soon')} />
        </SectionCard>

        {/* Store Settings (storekeeper AND service_provider) */}
        {(currentRole === 'storekeeper' || currentRole === 'service_provider') && (
          <SectionCard title="Store Settings">
            <ToggleTile
              title="Auto-accept reservations"
              value={autoAcceptReservations}
              onChanged={setAutoAcceptReservations}
            />
            <ToggleTile
              title="Vacation mode"
              value={vacationMode}
              onChanged={setVacationMode}
            />
            <DropdownTile
              title="Default pickup window"
              value={defaultPickupWindow}
              items={['1 hour', '2 hours', '3 hours', '4 hours', 'Same day']}
              onChanged={(val) => setDefaultPickupWindow(val)}
            />
          </SectionCard>
        )}

        {/* Booking & Availability (service_provider) */}
        {currentRole === 'service_provider' && (
          <SectionCard title="Booking & Availability">
            <SliderTile
              title="Buffer time"
              value={bufferTime}
              min={0}
              max={120}
              label={`${bufferTime} min`}
              onChanged={(v) => setBufferTime(Math.round(v))}
            />
            <SliderTile
              title="Service area radius"
              value={serviceAreaRadius}
              min={1}
              max={50}
              label={`${serviceAreaRadius} km`}
              onChanged={(v) => setServiceAreaRadius(v)}
            />
            <SliderTile
              title="Default service duration"
              value={defaultServiceDuration}
              min={15}
              max={240}
              label={`${defaultServiceDuration} min`}
              onChanged={(v) => setDefaultServiceDuration(Math.round(v))}
            />
            <ToggleTile
              title="Calendar sync"
              value={calendarSync}
              onChanged={setCalendarSync}
            />
          </SectionCard>
        )}

        {/* Reselling Preferences (flipper) */}
        {currentRole === 'flipper' && (
          <SectionCard title="Reselling Preferences">
            <DropdownTile
              title="Default markup type"
              value={defaultMarkupType}
              items={['Quick Flip', 'Standard', 'Premium']}
              onChanged={(val) => setDefaultMarkupType(val)}
            />
            <ToggleTile
              title="Auto-apply keyword tags"
              value={autoApplyKeywords}
              onChanged={setAutoApplyKeywords}
            />
          </SectionCard>
        )}

        {/* Notifications */}
        <SectionCard title="Notifications">
          <ToggleTile title="Wanted alerts" value={notificationsWantedAlerts} onChanged={setNotificationsWantedAlerts} />
          <ToggleTile title="New from followed stores" value={notificationsFollowedStores} onChanged={setNotificationsFollowedStores} />
          <ToggleTile title="Messages" value={notificationsMessages} onChanged={setNotificationsMessages} />
          <ToggleTile title="Delivery updates" value={notificationsDeliveryUpdates} onChanged={setNotificationsDeliveryUpdates} />

          {currentRole === 'flipper' && (
            <>
              <ToggleTile title="Price changes on tracked items" value={notificationsPriceChanges} onChanged={setNotificationsPriceChanges} />
              <ToggleTile title="Sale completed" value={notificationsSaleCompleted} onChanged={setNotificationsSaleCompleted} />
              <ToggleTile title="New arbitrage opportunities" value={notificationsArbitrage} onChanged={setNotificationsArbitrage} />
            </>
          )}

          {currentRole === 'service_provider' && (
            <>
              <ToggleTile title="New booking" value={notificationsNewBooking} onChanged={setNotificationsNewBooking} />
              <ToggleTile title="Booking reminders" value={notificationsBookingReminders} onChanged={setNotificationsBookingReminders} />
              <ToggleTile title="Earnings updates" value={notificationsEarningsUpdates} onChanged={setNotificationsEarningsUpdates} />
            </>
          )}
        </SectionCard>

        {/* Discovery */}
        <SectionCard title="Discovery">
          <SliderTile
            title="Default radius"
            value={discoveryRadius}
            min={5}
            max={100}
            label={`${discoveryRadius} km`}
            onChanged={setDiscoveryRadius}
          />
          <InfoTile
            label="Preferred categories"
            value={preferredCategories.length > 0 ? `${preferredCategories.length} selected` : 'Tap to select'}
            onTap={() => alert('Category selection coming soon')}
          />
        </SectionCard>

        {/* Privacy */}
        <SectionCard title="Privacy">
          <ToggleTile title="Show my last name" value={privacyShowLastName} onChanged={setPrivacyShowLastName} />
          <ToggleTile title="Share activity with the seller" value={privacyShareActivity} onChanged={setPrivacyShareActivity} />
        </SectionCard>

        {/* Appearance */}
        <SectionCard title="Appearance">
          <RadioTile
            title="System default"
            groupValue={themeMode}
            value="system"
            onChanged={(mode) => setThemeMode(mode as 'system')}
          />
          <RadioTile
            title="Light"
            groupValue={themeMode}
            value="light"
            onChanged={(mode) => setThemeMode(mode as 'light')}
          />
          <RadioTile
            title="Dark"
            groupValue={themeMode}
            value="dark"
            onChanged={(mode) => setThemeMode(mode as 'dark')}
          />
        </SectionCard>

        {/* About */}
        <SectionCard title="About">
          <InfoTile label="Terms and Conditions" onTap={() => {}} />
          <InfoTile label="Privacy Policy" onTap={() => {}} />
          <InfoTile label="App version" value="1.0.0" />
        </SectionCard>

        {/* Logout */}
        <div style={styles.logoutCard} onClick={handleLogout}>
          <MdLogout size={24} color="#FF0000" />
          <span style={styles.logoutText}>Log Out</span>
          <MdArrowForwardIos size={16} color="#FF0000" />
        </div>
      </div>

      {/* Avatar Upload Modal */}
      {showAvatarModal && (
        <div style={styles.modalOverlay} onClick={closeAvatarModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={closeAvatarModal}>
              <MdClose size={20} color="#666" />
            </button>
            <h3 style={styles.modalTitle}>Update Avatar</h3>
            <div style={styles.modalAvatarPreview} onClick={() => avatarInputRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <MdCameraAlt size={40} color="#888" />
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <div style={styles.modalActions}>
              <button onClick={() => avatarInputRef.current?.click()} style={styles.secondaryBtn}>
                <MdPhotoLibrary size={18} color="#0504AA" />
                Gallery
              </button>
              <button onClick={() => avatarInputRef.current?.click()} style={styles.secondaryBtn}>
                <MdCameraAlt size={18} color="#0504AA" />
                Camera
              </button>
            </div>
            <button
              onClick={uploadAvatar}
              disabled={!avatarFile || uploadingAvatar}
              style={styles.primaryBtn}
            >
              {uploadingAvatar ? 'Uploading...' : 'Save Avatar'}
            </button>
          </div>
        </div>
      )}

      {/* Global styles for switch */}
      <style>{`
        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 24px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        .switch input:checked + .slider {
          background-color: #0504AA;
        }
        .switch input:checked + .slider:before {
          transform: translateX(20px);
        }
      `}</style>
    </main>
  );
}

// ─── Reusable Components ──────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.sectionCard}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function InfoTile({ label, value, onTap }: { label: string; value?: string; onTap?: () => void }) {
  return (
    <div style={styles.infoTile} onClick={onTap}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value || ''}</span>
    </div>
  );
}

function ToggleTile({ title, value, onChanged }: { title: string; value: boolean; onChanged: (v: boolean) => void }) {
  return (
    <div style={styles.toggleRow}>
      <span style={styles.toggleLabel}>{title}</span>
      <label className="switch">
        <input type="checkbox" checked={value} onChange={(e) => onChanged(e.target.checked)} />
        <span className="slider"></span>
      </label>
    </div>
  );
}

function SliderTile({ title, value, min, max, label, onChanged }: { title: string; value: number; min: number; max: number; label: string; onChanged: (v: number) => void }) {
  return (
    <div style={styles.sliderRow}>
      <span style={styles.sliderLabel}>{title}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChanged(Number(e.target.value))}
        style={styles.sliderInput}
      />
      <span style={styles.sliderValue}>{label}</span>
    </div>
  );
}

function DropdownTile({ title, value, items, onChanged }: { title: string; value: string; items: string[]; onChanged: (v: string) => void }) {
  return (
    <div style={styles.dropdownRow}>
      <span style={styles.dropdownLabel}>{title}</span>
      <select
        value={value}
        onChange={(e) => onChanged(e.target.value)}
        style={styles.dropdownSelect}
      >
        {items.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

function RadioTile({ title, groupValue, value, onChanged }: { title: string; groupValue: string; value: string; onChanged: (v: string) => void }) {
  return (
    <label style={styles.radioRow}>
      <input
        type="radio"
        checked={groupValue === value}
        onChange={() => onChanged(value)}
        style={{ marginRight: 8 }}
      />
      <span>{title}</span>
    </label>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#fff' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: '#fff' },
  spinner: { width: 36, height: 36, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee' },
  headerTitle: { fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 },
  headerIcon: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '12px 16px' },
  profileCard: { display: 'flex', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 12 },
  avatarWrapper: { position: 'relative', width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16, cursor: 'pointer' },
  avatar: { width: '100%', height: '100%', objectFit: 'cover' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', backgroundColor: '#0504AA', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 20, fontWeight: 700, color: '#1A1A1A' },
  profileEmail: { fontSize: 13, color: '#666' },
  profilePhone: { fontSize: 12, color: '#888' },
  roleBadge: { display: 'inline-block', marginTop: 8, padding: '4px 12px', backgroundColor: '#0504AA10', color: '#0504AA', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: '12px 0', marginBottom: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #eee' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#0504AA', padding: '0 16px 8px' },
  roleItem: { display: 'flex', alignItems: 'center', padding: '8px 16px' },
  roleInfo: { flex: 1, marginLeft: 12 },
  roleLabel: { fontSize: 15, fontWeight: 600, color: '#1A1A1A' },
  roleStatus: { fontSize: 12, color: '#888' },
  switchBtn: { background: 'none', border: 'none', color: '#0504AA', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  infoTile: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f5f5f5' },
  infoLabel: { fontSize: 15, color: '#1A1A1A' },
  infoValue: { fontSize: 14, color: '#666' },
  toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' },
  toggleLabel: { fontSize: 15, color: '#1A1A1A' },
  sliderRow: { display: 'flex', alignItems: 'center', padding: '10px 16px' },
  sliderLabel: { fontSize: 15, color: '#1A1A1A', width: 120 },
  sliderInput: { flex: 1, margin: '0 8px' },
  sliderValue: { fontSize: 14, color: '#666', width: 50, textAlign: 'right' },
  dropdownRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' },
  dropdownLabel: { fontSize: 15, color: '#1A1A1A' },
  dropdownSelect: { padding: '6px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
  radioRow: { display: 'flex', alignItems: 'center', padding: '8px 16px', cursor: 'pointer' },
  logoutCard: { display: 'flex', alignItems: 'center', padding: '14px 16px', backgroundColor: '#fff', borderRadius: 16, border: '1px solid #FFCDD2', cursor: 'pointer', marginTop: 12 },
  logoutText: { flex: 1, marginLeft: 12, color: '#FF0000', fontWeight: 600 },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, position: 'relative' },
  modalClose: { position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer' },
  modalTitle: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  modalAvatarPreview: { width: 120, height: 120, borderRadius: '50%', backgroundColor: '#f0f0f0', margin: '0 auto', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalActions: { display: 'flex', gap: 12, marginTop: 16, marginBottom: 16 },
  secondaryBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, border: '1px solid #0504AA', background: 'none', color: '#0504AA', fontWeight: 600, cursor: 'pointer' },
  primaryBtn: { width: '100%', padding: '14px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
};