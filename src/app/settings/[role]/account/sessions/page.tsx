'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../../services/api';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { confirmDialog, alertDialog } from '../../../../../components/ui/dialogs';
import { SettingsShell, SettingsSection } from '../../../../../components/settings/SettingsUI';
import {
  MdDevices,
  MdPhoneIphone,
  MdComputer,
  MdTabletMac,
  MdLocationOn,
  MdRefresh,
  MdLogout,
} from 'react-icons/md';

interface Session {
  id: string;
  device_kind?: 'mobile' | 'tablet' | 'desktop' | 'other';
  device_name?: string;
  browser?: string;
  os?: string;
  ip?: string;
  city?: string;
  country?: string;
  last_active_at?: string;
  created_at?: string;
  current?: boolean;
}

function parseAsUtc(iso?: string | null): number {
  if (!iso) return NaN;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const trimmed = iso.replace(/(\.\d{3})\d+/, '$1');
  return new Date(hasTz ? trimmed : `${trimmed}Z`).getTime();
}

function relativeTime(iso?: string): string {
  const t = parseAsUtc(iso);
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  try {
    return new Date(t).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function SessionsPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);

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
      const res = await api.getSessions();
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setSessions(Array.isArray(res) ? (res as Session[]) : []);
    } catch (err) {
      if (seq === reqSeq.current && isMountedRef.current) {
        await alertDialog({
          title: 'Could not load sessions',
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
      router.push(`/settings/${roleSlug}`);
    }
  };

  const revoke = async (s: Session) => {
    const ok = await confirmDialog({
      title: 'Sign out this device?',
      body: s.device_name || 'This device will be signed out immediately.',
      kind: 'danger',
    });
    if (!ok) return;
    try {
      await api.revokeSession(s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err) {
      await alertDialog({
        title: 'Could not sign out',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    }
  };

  const revokeAllOthers = async () => {
    const others = sessions.filter((s) => !s.current);
    if (others.length === 0) return;
    const ok = await confirmDialog({
      title: 'Sign out all other devices?',
      body: `${others.length} other ${others.length === 1 ? 'device' : 'devices'} will be signed out.`,
      kind: 'danger',
    });
    if (!ok) return;
    try {
      await api.revokeAllOtherSessions();
      await load(false);
    } catch (err) {
      await alertDialog({
        title: 'Could not sign out',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    }
  };

  if (loading) {
    return (
      <SettingsShell title="Active sessions" onBack={goBack}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  const others = sessions.filter((s) => !s.current);

  return (
    <SettingsShell
      title="Active sessions"
      onBack={goBack}
      action={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ ...css.refreshBtn, opacity: refreshing ? 0.5 : 1 }}
          aria-label="Refresh"
        >
          <MdRefresh size={20} color="var(--brand-on-soft)" />
        </button>
      }
    >
      <style>{`
        .ss-device:active { background-color: var(--bg-hover); }
      `}</style>

      {sessions.length === 0 ? (
        <div style={css.empty}>
          <div style={css.emptyIcon}>
            <MdDevices size={40} color="var(--brand-on-soft)" />
          </div>
          <h2 style={css.emptyTitle}>No active sessions</h2>
          <p style={css.emptyBody}>
            When you sign in on a device, it will appear here.
          </p>
        </div>
      ) : (
        <SettingsSection
          label="Devices"
          footer="Signing out a device will not affect your current session."
        >
          {sessions.map((s) => (
            <div key={s.id} className="ss-device" style={css.deviceRow}>
              <span style={css.deviceIcon}>
                {s.device_kind === 'mobile' ? (
                  <MdPhoneIphone size={20} color="var(--brand-on-soft)" />
                ) : s.device_kind === 'tablet' ? (
                  <MdTabletMac size={20} color="var(--brand-on-soft)" />
                ) : (
                  <MdComputer size={20} color="var(--brand-on-soft)" />
                )}
              </span>
              <div style={css.deviceBody}>
                <div style={css.deviceTop}>
                  <span style={css.deviceName}>
                    {s.device_name || s.os || 'Unknown device'}
                  </span>
                  {s.current && (
                    <span style={css.currentChip}>This device</span>
                  )}
                </div>
                {(s.browser || s.os) && (
                  <div style={css.deviceMeta}>
                    {[s.browser, s.os].filter(Boolean).join(' · ')}
                  </div>
                )}
                {(s.city || s.country || s.ip) && (
                  <div style={css.deviceMetaRow}>
                    <MdLocationOn size={12} color="var(--text-muted)" />
                    <span style={css.deviceMeta}>
                      {[s.city, s.country].filter(Boolean).join(', ') ||
                        s.ip}
                    </span>
                  </div>
                )}
                <div style={css.deviceMeta}>
                  Last active {relativeTime(s.last_active_at)}
                </div>
              </div>
              {!s.current && (
                <button
                  onClick={() => revoke(s)}
                  style={css.revokeBtn}
                  aria-label="Sign out this device"
                >
                  <MdLogout size={18} color="var(--danger-fg)" />
                </button>
              )}
            </div>
          ))}
        </SettingsSection>
      )}

      {others.length > 0 && (
        <button onClick={revokeAllOthers} style={css.dangerBtn}>
          <MdLogout size={18} color="var(--danger-fg)" />
          <span>
            Sign out all other devices ({others.length})
          </span>
        </button>
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
    backgroundColor: 'var(--brand-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
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
    backgroundColor: 'var(--brand-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
    margin: '8px 0 0',
    maxWidth: 300,
    lineHeight: 1.55,
  },
  deviceRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background-color 0.15s',
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'var(--brand-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deviceBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  deviceTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  deviceName: {
    fontSize: 14.5,
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: -0.1,
    lineHeight: 1.35,
    wordBreak: 'break-word',
  },
  currentChip: {
    padding: '3px 9px',
    borderRadius: 999,
    backgroundColor: 'var(--success-bg)',
    color: 'var(--success-fg)',
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  deviceMeta: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  deviceMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  revokeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: 'none',
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  dangerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '14px 20px',
    borderRadius: 16,
    border: '1.5px solid var(--danger-bg)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--danger-fg)',
    fontSize: 14.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  skeleton: {
    height: 88,
    borderRadius: 18,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    opacity: 0.5,
  },
};