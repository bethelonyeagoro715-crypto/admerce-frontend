'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../../services/api';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../../components/ui/dialogs';
import { SettingsShell } from '../../../../../components/settings/SettingsUI';
import {
  MdLogin,
  MdLogout,
  MdPassword,
  MdPhoneIphone,
  MdComputer,
  MdLocationOn,
  MdRefresh,
  MdShield,
} from 'react-icons/md';

interface Activity {
  id: string;
  action: 'login' | 'logout' | 'password_change' | 'email_change' | 'phone_change' | '2fa_enabled' | '2fa_disabled';
  device_kind?: 'mobile' | 'tablet' | 'desktop';
  device_name?: string;
  ip?: string;
  city?: string;
  country?: string;
  created_at?: string;
  success?: boolean;
}

function parseAsUtc(iso?: string | null): number {
  if (!iso) return NaN;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const trimmed = iso.replace(/(\.\d{3})\d+/, '$1');
  return new Date(hasTz ? trimmed : `${trimmed}Z`).getTime();
}

function fmtDate(iso?: string): string {
  const t = parseAsUtc(iso);
  if (Number.isNaN(t)) return '';
  try {
    return new Date(t).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function actionLabel(a: Activity['action']): string {
  switch (a) {
    case 'login': return 'Signed in';
    case 'logout': return 'Signed out';
    case 'password_change': return 'Password changed';
    case 'email_change': return 'Email changed';
    case 'phone_change': return 'Phone changed';
    case '2fa_enabled': return 'Two-factor enabled';
    case '2fa_disabled': return 'Two-factor disabled';
    default: return 'Activity';
  }
}

export default function LoginActivityPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (showSpinner = true) => {
    const seq = ++reqSeq.current;
    if (showSpinner) setLoading(true);
    try {
      const res = await api.getLoginActivity(50);
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setActivity(Array.isArray(res) ? (res as Activity[]) : []);
    } catch (err) {
      if (seq === reqSeq.current && isMountedRef.current) {
        await alertDialog({
          title: 'Could not load activity',
          body: extractErrorDetail(err, 'Please try again.'),
          kind: 'danger',
        });
      }
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}/privacy`);
    }
  };

  if (loading) {
    return (
      <SettingsShell title="Login activity" onBack={goBack}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="Login activity"
      onBack={goBack}
      action={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ ...css.refreshBtn, opacity: refreshing ? 0.5 : 1 }}
          aria-label="Refresh"
        >
          <MdRefresh size={20} color="#0504AA" />
        </button>
      }
    >
      <div style={css.notice}>
        <MdShield size={18} color="#0891B2" />
        <span>
          If you see activity you don&apos;t recognize, change your password
          and sign out all devices.
        </span>
      </div>

      {activity.length === 0 ? (
        <div style={css.empty}>
          <div style={css.emptyIcon}>
            <MdLogin size={40} color="#0504AA" />
          </div>
          <h2 style={css.emptyTitle}>No activity yet</h2>
          <p style={css.emptyBody}>
            Recent sign-ins and security events will show here.
          </p>
        </div>
      ) : (
        <div style={css.list}>
          {activity.map((a) => {
            const isDanger =
              a.action === 'password_change' ||
              a.action === '2fa_disabled' ||
              a.success === false;
            return (
              <div key={a.id} style={css.row}>
                <span
                  style={{
                    ...css.iconWrap,
                    backgroundColor: isDanger ? '#FEF3C7' : '#EEF0FF',
                  }}
                >
                  {a.action === 'login' ? (
                    <MdLogin size={18} color={isDanger ? '#92400E' : '#0504AA'} />
                  ) : a.action === 'logout' ? (
                    <MdLogout size={18} color="#0504AA" />
                  ) : a.action === 'password_change' ? (
                    <MdPassword size={18} color="#92400E" />
                  ) : (
                    <MdShield size={18} color="#0504AA" />
                  )}
                </span>
                <div style={css.body}>
                  <div style={css.titleRow}>
                    <span style={css.title}>{actionLabel(a.action)}</span>
                    {a.success === false && (
                      <span style={css.failChip}>Failed</span>
                    )}
                  </div>
                  <div style={css.metaRow}>
                    {a.device_kind === 'mobile' ? (
                      <MdPhoneIphone size={11} color="#94A3B8" />
                    ) : (
                      <MdComputer size={11} color="#94A3B8" />
                    )}
                    <span style={css.metaText}>
                      {a.device_name || a.device_kind || 'Unknown device'}
                    </span>
                  </div>
                  {(a.city || a.country || a.ip) && (
                    <div style={css.metaRow}>
                      <MdLocationOn size={11} color="#94A3B8" />
                      <span style={css.metaText}>
                        {[a.city, a.country].filter(Boolean).join(', ') ||
                          a.ip}
                      </span>
                    </div>
                  )}
                </div>
                <span style={css.time}>{fmtDate(a.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  notice: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    padding: '12px 14px',
    backgroundColor: '#ECFEFF',
    border: '1px solid #A5F3FC',
    borderRadius: 14,
    fontSize: 12.5,
    color: '#155E75',
    lineHeight: 1.5,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '40px 20px',
  },
  emptyIcon: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
    margin: '8px 0 0',
    maxWidth: 300,
    lineHeight: 1.55,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px 12px 16px',
    borderBottom: '1px solid #F1F5F9',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: 700, color: '#0B0B1A' },
  failChip: {
    padding: '1px 6px',
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11.5, color: '#94A3B8' },
  time: {
    fontSize: 11,
    color: '#94A3B8',
    whiteSpace: 'nowrap',
    marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },
  skeleton: {
    height: 72,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};