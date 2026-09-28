'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { clear as clearLocalStorage } from '../../../services/localStorage';
import { confirmDialog } from '../../../components/ui/dialogs';
import {
  SettingsShell,
  SettingsSection,
  SettingsRow,
} from '../../../components/settings/SettingsUI';
import {
  MdEdit,
  MdLock,
  MdCreditCard,
  MdLocationOn,
  MdSwapHoriz,
  MdNotifications,
  MdPalette,
  MdShield,
  MdHelpOutline,
  MdReportProblem,
  MdDescription,
  MdInfo,
  MdLogout,
  MdVerified,
  MdPhone,
  MdDevices,
  MdDeleteForever,
  MdFeedback,
  MdGavel,
  MdStarOutline,
  MdLanguage,
  MdHistory,
  MdPolicy,
  MdSecurity,
} from 'react-icons/md';

interface Profile {
  nickname?: string;
  username?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  role?: string;
  verified?: boolean;
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
    return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function displayName(p: Profile | null): string {
  if (!p) return 'User';
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return p.nickname || full || p.real_name || p.username || p.phone || 'User';
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    shopper: 'Shopper',
    storekeeper: 'Storekeeper',
    service_provider: 'Service Provider',
    courier: 'Courier',
    flipper: 'Flipper',
    admin: 'Admin',
  };
  return map[role.toLowerCase()] || role;
}

export default function SettingsHubPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const rawSlug = (params?.role || 'shopper').toLowerCase();
  const role = rawSlug === 'service-provider' ? 'service_provider' : rawSlug;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [, setLoading] = useState(true);
  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const p = (await api.getMyProfile()) as Profile;
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setProfile(p);
    } catch {
      if (seq === reqSeq.current && isMountedRef.current) setProfile(null);
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadData]);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${roleSlug}/profile`);
    }
  };

  const handleLogout = async () => {
    const ok = await confirmDialog({
      title: 'Log out?',
      body: 'You will need to sign in again to access your account.',
      kind: 'danger',
    });
    if (!ok) return;
    clearLocalStorage();
    router.replace('/');
  };

  const name = displayName(profile);
  const phone = profile?.phone || '';
  const email = profile?.email || '';
  const avatarUrl = resolveImageUrl(profile?.avatar_url);
  const isVerified = profile?.verified === true;
  const initial = (name.charAt(0) || '?').toUpperCase();

  return (
    <SettingsShell title="Settings" onBack={goBack}>
      <style>{`
        .sh-logout:hover { background-color: #FEF2F2; }
        .sh-logout:active { transform: scale(0.99); }
      `}</style>

      {/* Identity card */}
      <div style={css.idCard}>
        <div style={css.avatarWrap}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" style={css.avatarImg} />
          ) : (
            <div style={css.avatarFallback}>{initial}</div>
          )}
        </div>
        <div style={css.idMeta}>
          <div style={css.idNameRow}>
            <span style={css.idName}>{name}</span>
            {isVerified && <MdVerified size={16} color="#0504AA" />}
          </div>
          {(email || phone) && (
            <div style={css.idContact}>{email || phone}</div>
          )}
          <span style={css.roleChip}>{roleLabel(role).toUpperCase()}</span>
        </div>
      </div>

      {/* Account */}
      <SettingsSection label="Account">
        <SettingsRow
          icon={<MdEdit size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="Edit profile"
          subtitle="Name, nickname, bio"
          onClick={() => router.push(`/${roleSlug}/profile/edit`)}
        />
        <SettingsRow
          icon={<MdPhone size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Phone & email"
          value={phone || email || 'Not set'}
          onClick={() => router.push(`/settings/${roleSlug}/account/contact`)}
        />
        <SettingsRow
          icon={<MdLock size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Password"
          subtitle="Change your password"
          onClick={() => router.push('/change-password')}
        />
        <SettingsRow
          icon={<MdSecurity size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="Two-factor authentication"
          subtitle="Extra security for your account"
          onClick={() => router.push(`/settings/${roleSlug}/account/2fa`)}
        />
        <SettingsRow
          icon={<MdDevices size={18} color="#D97706" />}
          iconBg="#FEF3C7"
          label="Active sessions"
          subtitle="Devices where you're signed in"
          onClick={() => router.push(`/settings/${roleSlug}/account/sessions`)}
        />
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection label="Notifications">
        <SettingsRow
          icon={<MdNotifications size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="Notification preferences"
          subtitle="Push, email, and per-category alerts"
          onClick={() => router.push(`/settings/${roleSlug}/notifications`)}
        />
      </SettingsSection>

      {/* Privacy & Security */}
      <SettingsSection label="Privacy & Security">
        <SettingsRow
          icon={<MdShield size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Privacy"
          subtitle="Visibility and activity sharing"
          onClick={() => router.push(`/settings/${roleSlug}/privacy`)}
        />
        <SettingsRow
          icon={<MdLock size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Blocked users"
          onClick={() => router.push(`/settings/${roleSlug}/privacy/blocked`)}
        />
        <SettingsRow
          icon={<MdHistory size={18} color="#D97706" />}
          iconBg="#FEF3C7"
          label="Login activity"
          onClick={() => router.push(`/settings/${roleSlug}/privacy/activity`)}
        />
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection label="Appearance">
        <SettingsRow
          icon={<MdPalette size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Theme"
          subtitle="System, light, or dark"
          onClick={() => router.push(`/settings/${roleSlug}/appearance`)}
        />
        <SettingsRow
          icon={<MdLanguage size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Language"
          value="English"
          onClick={() =>
            router.push(`/settings/${roleSlug}/appearance/language`)
          }
        />
      </SettingsSection>

      {/* Payments */}
      <SettingsSection label="Payments">
        <SettingsRow
          icon={<MdCreditCard size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Payment methods"
          subtitle="Saved cards and bank accounts"
          onClick={() => router.push(`/${roleSlug}/wallet/cards`)}
        />
        <SettingsRow
          icon={<MdLock size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="Wallet PIN"
          subtitle="Used for withdrawals"
          onClick={() => router.push('/wallet-pin-setup')}
        />
      </SettingsSection>

      {/* Role-specific */}
      {role === 'shopper' && (
        <SettingsSection label="Discovery">
          <SettingsRow
            icon={<MdLocationOn size={18} color="#D97706" />}
            iconBg="#FEF3C7"
            label="Discovery preferences"
            subtitle="Radius and preferred categories"
            onClick={() => router.push(`/settings/${roleSlug}/discovery`)}
          />
          <SettingsRow
            icon={<MdLocationOn size={18} color="#0891B2" />}
            iconBg="#E0F2FE"
            label="Delivery addresses"
            onClick={() => router.push(`/${roleSlug}/profile/addresses`)}
          />
        </SettingsSection>
      )}

      {(role === 'storekeeper' || role === 'service_provider') && (
        <SettingsSection label="Business">
          <SettingsRow
            icon={<MdStarOutline size={18} color="#D97706" />}
            iconBg="#FEF3C7"
            label={
              role === 'storekeeper'
                ? 'Store preferences'
                : 'Booking & availability'
            }
            subtitle={
              role === 'storekeeper'
                ? 'Auto-accept, vacation mode, pickup window'
                : 'Buffer time, service area, duration'
            }
            onClick={() => router.push(`/settings/${roleSlug}/preferences`)}
          />
        </SettingsSection>
      )}

      {/* Roles */}
      <SettingsSection label="Roles">
        <SettingsRow
          icon={<MdSwapHoriz size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="Switch role"
          subtitle="Change your active role"
          onClick={() => router.push('/onboarding?mode=switch')}
        />
      </SettingsSection>

      {/* Support */}
      <SettingsSection label="Support">
        <SettingsRow
          icon={<MdHelpOutline size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="Help center"
          onClick={() => router.push(`/settings/${roleSlug}/help`)}
        />
        <SettingsRow
          icon={<MdReportProblem size={18} color="#DC2626" />}
          iconBg="#FEE2E2"
          label="Report a problem"
          onClick={() => router.push(`/settings/${roleSlug}/report`)}
        />
        <SettingsRow
          icon={<MdFeedback size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Send feedback"
          onClick={() => router.push(`/settings/${roleSlug}/feedback`)}
        />
      </SettingsSection>

      {/* Legal */}
      <SettingsSection label="Legal">
        <SettingsRow
          icon={<MdDescription size={18} color="#475569" />}
          iconBg="#F1F5F9"
          label="Terms and conditions"
          onClick={() => router.push(`/settings/${roleSlug}/legal/terms`)}
        />
        <SettingsRow
          icon={<MdPolicy size={18} color="#475569" />}
          iconBg="#F1F5F9"
          label="Privacy policy"
          onClick={() => router.push(`/settings/${roleSlug}/legal/privacy`)}
        />
        <SettingsRow
          icon={<MdGavel size={18} color="#475569" />}
          iconBg="#F1F5F9"
          label="Licenses"
          onClick={() => router.push(`/settings/${roleSlug}/legal/licenses`)}
        />
      </SettingsSection>

      {/* About */}
      <SettingsSection label="About">
        <SettingsRow
          icon={<MdInfo size={18} color="#475569" />}
          iconBg="#F1F5F9"
          label="App version"
          value="1.0.0"
          onClick={() => router.push(`/settings/${roleSlug}/about`)}
        />
      </SettingsSection>

      {/* Danger zone */}
      <SettingsSection label="Danger zone">
        <SettingsRow
          icon={<MdDeleteForever size={18} color="#DC2626" />}
          iconBg="#FEE2E2"
          label="Delete account"
          subtitle="Permanently remove your account and data"
          danger
          onClick={() => router.push(`/settings/${roleSlug}/account/delete`)}
        />
      </SettingsSection>

      <button
        onClick={handleLogout}
        style={css.logoutBtn}
        className="sh-logout"
      >
        <MdLogout size={20} color="#DC2626" />
        <span>Log out</span>
      </button>

      <p style={css.footerNote}>Admerce · Version 1.0.0 · Made for Nigeria</p>
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  idCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    boxShadow: '0 6px 18px rgba(5,4,170,0.06)',
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: { fontSize: 24, fontWeight: 800, color: '#0504AA' },
  idMeta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  idNameRow: { display: 'flex', alignItems: 'center', gap: 6 },
  idName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.2,
  },
  idContact: {
    fontSize: 12.5,
    color: '#64748B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  roleChip: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.6,
    color: '#0504AA',
    backgroundColor: '#EEF0FF',
    padding: '3px 8px',
    borderRadius: 999,
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginTop: 4,
    padding: '14px 20px',
    borderRadius: 16,
    border: '1.5px solid #FECACA',
    backgroundColor: '#FFFFFF',
    color: '#DC2626',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    transition: 'background-color 0.15s, transform 0.12s',
  },
  footerNote: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    margin: '12px 0 0',
  },
};