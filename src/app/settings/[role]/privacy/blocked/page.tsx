'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../../services/api';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { confirmDialog, alertDialog } from '../../../../../components/ui/dialogs';
import { SettingsShell } from '../../../../../components/settings/SettingsUI';
import {
  MdBlock,
  MdPersonRemove,
  MdSearch,
} from 'react-icons/md';

interface Blocked {
  id: string;
  user_id?: string;
  nickname?: string;
  real_name?: string;
  phone?: string;
  avatar_url?: string;
  blocked_at?: string;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function displayName(b: Blocked): string {
  return b.nickname || b.real_name || b.phone || 'Unknown';
}

function initial(b: Blocked): string {
  return (displayName(b).charAt(0) || '?').toUpperCase();
}

export default function BlockedUsersPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [search, setSearch] = useState('');

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const res = await api.getBlockedUsers();
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setBlocked(Array.isArray(res) ? (res as Blocked[]) : []);
    } catch (err) {
      if (seq === reqSeq.current && isMountedRef.current) {
        await alertDialog({
          title: 'Could not load',
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

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}/privacy`);
    }
  };

  const unblock = async (b: Blocked) => {
    const ok = await confirmDialog({
      title: 'Unblock this user?',
      body: `${displayName(b)} will be able to message you and see your listings again.`,
      kind: 'info',
    });
    if (!ok) return;
    try {
      await api.unblockUser(b.user_id || b.id);
      setBlocked((prev) => prev.filter((x) => x.id !== b.id));
    } catch (err) {
      await alertDialog({
        title: 'Could not unblock',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    }
  };

  const filtered = search.trim()
    ? blocked.filter((b) =>
        displayName(b).toLowerCase().includes(search.trim().toLowerCase()),
      )
    : blocked;

  if (loading) {
    return (
      <SettingsShell title="Blocked users" onBack={goBack}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="Blocked users" onBack={goBack}>
      <style>{`
        .bk-row:active { background-color: #F8FAFF; }
      `}</style>

      {blocked.length === 0 ? (
        <div style={css.empty}>
          <div style={css.emptyIcon}>
            <MdBlock size={40} color="#0504AA" />
          </div>
          <h2 style={css.emptyTitle}>No blocked users</h2>
          <p style={css.emptyBody}>
            Blocked users can&apos;t message you or see your listings. They
            will show up here when you block them.
          </p>
        </div>
      ) : (
        <>
          <div style={css.searchWrap}>
            <MdSearch size={18} color="#94A3B8" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocked users"
              style={css.searchInput}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={css.clearBtn}
                aria-label="Clear"
              >
                ×
              </button>
            )}
          </div>

          <div style={css.list}>
            {filtered.length === 0 ? (
              <p style={css.noResults}>No blocked users match</p>
            ) : (
              filtered.map((b) => {
                const avatar = resolveImageUrl(b.avatar_url);
                return (
                  <div key={b.id} className="bk-row" style={css.row}>
                    <div style={css.avatarWrap}>
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="" style={css.avatarImg} />
                      ) : (
                        <span style={css.avatarFallback}>
                          {initial(b)}
                        </span>
                      )}
                    </div>
                    <div style={css.info}>
                      <div style={css.name}>{displayName(b)}</div>
                      {b.phone && <div style={css.meta}>{b.phone}</div>}
                    </div>
                    <button
                      onClick={() => unblock(b)}
                      style={css.unblockBtn}
                    >
                      <MdPersonRemove size={18} color="#DC2626" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '60px 20px',
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
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    border: '1px solid #EAECF3',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14.5,
    fontFamily: 'inherit',
    color: '#0B0B1A',
    backgroundColor: 'transparent',
    fontWeight: 500,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: '#94A3B8',
    cursor: 'pointer',
    padding: '0 6px',
    lineHeight: 1,
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
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px 12px 16px',
    borderBottom: '1px solid #F1F5F9',
    transition: 'background-color 0.15s',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0504AA',
  },
  info: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  name: {
    fontSize: 14.5,
    fontWeight: 700,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  meta: { fontSize: 12.5, color: '#94A3B8' },
  unblockBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: '1.5px solid #FECACA',
    backgroundColor: '#FEF2F2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  noResults: {
    fontSize: 13,
    color: '#94A3B8',
    padding: '24px 16px',
    textAlign: 'center',
    margin: 0,
  },
  skeleton: {
    height: 72,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};