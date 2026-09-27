'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdRefresh,
  MdErrorOutline,
  MdSearch,
  MdClose,
  MdGroups,
  MdChevronRight,
  MdDoneAll,
  MdOutlineMarkChatUnread,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface Conversation {
  conversation_id: string;
  last_message?: string;
  last_time?: string;
  unread_count?: number;
  other_user_id?: string;
  other_user_name?: string;
  other_user_avatar?: string;
  last_sender_id?: string;
  [key: string]: unknown;
}

type Filter = 'all' | 'unread';

// ─── Helpers ────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function relativeRowTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thenDate = new Date(then);
  thenDate.setHours(0, 0, 0, 0);

  const dayMs = 86_400_000;
  const dayDiff = Math.round((today.getTime() - thenDate.getTime()) / dayMs);

  if (dayDiff <= 0) {
    return new Date(then).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) {
    return new Date(then).toLocaleDateString([], { weekday: 'short' });
  }
  return new Date(then).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  });
}

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

// ─── Component ──────────────────────────────────────────────────────
export default function ServiceProviderInboxPage() {
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [inputFocused, setInputFocused] = useState(false);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  type MyProfile = {
    id?: string | number | null;
    user_id?: string | number | null;
  };

  useEffect(() => {
    (async () => {
      try {
        const me = (await api.getMyProfile()) as MyProfile | null;
        if (!isMountedRef.current) return;
        const profileId = me?.id ?? me?.user_id ?? null;
        setMyUserId(profileId == null ? null : String(profileId));
      } catch {
        // non-critical
      }
    })();
  }, []);

  const loadConversations = useCallback(async (showSpinner = true) => {
    const seq = ++reqSeq.current;
    if (showSpinner) setIsLoading(true);
    setError(null);
    try {
      const data = (await api.getConversations()) as Conversation[];
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      const filtered = (data || []).filter(
        (conv) => !String(conv.conversation_id).endsWith('_seai'),
      );
      setConversations(filtered);
    } catch (err: unknown) {
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadConversations(), 0);
    return () => clearTimeout(timer);
  }, [loadConversations]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadConversations(false);
    setIsRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && !(c.unread_count && c.unread_count > 0)) {
        return false;
      }
      if (!q) return true;
      const name = (c.other_user_name || '').toLowerCase();
      const last = (c.last_message || '').toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [conversations, query, filter]);

  const unreadTotal = useMemo(
    () =>
      conversations.reduce(
        (sum, c) => sum + (c.unread_count && c.unread_count > 0 ? c.unread_count : 0),
        0,
      ),
    [conversations],
  );

  const openChat = (conv: Conversation) => {
    const params = new URLSearchParams();
    if (conv.other_user_id) params.set('otherUserId', conv.other_user_id);
    if (conv.other_user_name) params.set('otherUserName', conv.other_user_name);
    if (conv.other_user_avatar) params.set('otherUserAvatar', conv.other_user_avatar);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    router.push(`/chat/${conv.conversation_id}${suffix}`);
  };

  const openCommunity = () => router.push('/service-provider/community');

  return (
    <main style={styles.container}>
      <style>{PAGE_CSS}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Inbox</h1>
          {unreadTotal > 0 && (
            <span style={styles.headerUnread}>{unreadTotal}</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          style={styles.headerIconBtn}
          aria-label="Refresh"
          disabled={isRefreshing}
        >
          <MdRefresh
            size={22}
            color="#0B0B1A"
            style={{
              animation: isRefreshing ? 'spInboxSpin 0.8s linear infinite' : 'none',
            }}
          />
        </button>
      </header>

      {/* Search */}
      <div style={styles.searchWrap}>
        <div
          style={{
            ...styles.searchBox,
            ...(inputFocused ? styles.searchBoxFocused : null),
          }}
        >
          <MdSearch size={20} color="#94A3B8" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            style={styles.searchInput}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={styles.searchClear}
              aria-label="Clear search"
            >
              <MdClose size={16} color="#94A3B8" />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div style={styles.pillRow}>
        <FilterPill
          label="All"
          active={filter === 'all'}
          count={conversations.length}
          onClick={() => setFilter('all')}
        />
        <FilterPill
          label="Unread"
          active={filter === 'unread'}
          count={unreadTotal}
          onClick={() => setFilter('unread')}
        />
      </div>

      {/* Body */}
      <div style={styles.body}>
        {isLoading ? (
          <div style={styles.skeletonList}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={styles.skeletonRow}>
                <div style={styles.skeletonAvatar} />
                <div style={styles.skeletonBody}>
                  <div style={{ ...styles.skeletonLine, width: '45%' }} />
                  <div style={{ ...styles.skeletonLine, width: '75%', height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={styles.center}>
            <div style={styles.errorHalo}>
              <MdErrorOutline size={36} color="#B91C1C" />
            </div>
            <h3 style={styles.stateTitle}>Couldn&apos;t load your chats</h3>
            <p style={styles.stateBody}>{error}</p>
            <button onClick={() => loadConversations()} style={styles.retryBtn}>
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Pinned Community row */}
            {(filter === 'all' || query) && (
              <button
                onClick={openCommunity}
                style={styles.communityRow}
                className="sp-community-row"
              >
                <div style={styles.communityIcon}>
                  <MdGroups size={26} color="#FFFFFF" />
                </div>
                <div style={styles.communityInfo}>
                  <div style={styles.communityName}>Community</div>
                  <div style={styles.communityPreview}>
                    Sellers&apos; room · storekeepers and providers
                  </div>
                </div>
                <MdChevronRight size={20} color="#7C3AED" />
              </button>
            )}

            {filtered.length === 0 ? (
              <div style={styles.center}>
                {query || filter === 'unread' ? (
                  <>
                    <div style={styles.emptyHalo}>
                      <MdOutlineMarkChatUnread size={34} color="#0504AA" />
                    </div>
                    <h3 style={styles.stateTitle}>
                      {query ? 'No matches' : 'All caught up'}
                    </h3>
                    <p style={styles.stateBody}>
                      {query
                        ? `Nothing matches "${query}"`
                        : 'No unread messages right now'}
                    </p>
                  </>
                ) : (
                  <>
                    <div style={styles.emptyHalo}>
                      <MdOutlineMarkChatUnread size={34} color="#0504AA" />
                    </div>
                    <h3 style={styles.stateTitle}>No conversations yet</h3>
                    <p style={styles.stateBody}>
                      When customers book or message you, they&apos;ll appear
                      here.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div style={styles.list}>
                {filtered.map((conv) => {
                  const name = conv.other_user_name || 'User';
                  const avatar = resolveImageUrl(conv.other_user_avatar);
                  const unread = conv.unread_count ?? 0;
                  const isUnread = unread > 0;
                  const lastTime = conv.last_time ? relativeRowTime(conv.last_time) : '';
                  const mine =
                    myUserId && conv.last_sender_id
                      ? conv.last_sender_id === myUserId
                      : false;
                  const hue = avatarHue(conv.other_user_id || name);

                  return (
                    <button
                      key={conv.conversation_id}
                      onClick={() => openChat(conv)}
                      style={styles.row}
                      className="sp-inbox-row"
                    >
                      <div
                        style={{
                          ...styles.avatar,
                          ...(avatar ? null : {
                            background: `linear-gradient(135deg, hsl(${hue}, 65%, 55%) 0%, hsl(${(hue + 40) % 360}, 70%, 45%) 100%)`,
                          }),
                        }}
                      >
                        {avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatar} alt="" style={styles.avatarImg} />
                        ) : (
                          <span style={styles.avatarInitials}>{initials(name)}</span>
                        )}
                      </div>

                      <div style={styles.rowContent}>
                        <div style={styles.nameRow}>
                          <span
                            style={{
                              ...styles.name,
                              ...(isUnread ? styles.nameUnread : null),
                            }}
                          >
                            {name}
                          </span>
                        </div>
                        <div style={styles.previewRow}>
                          {mine && (
                            <MdDoneAll
                              size={14}
                              color="#34B7F1"
                              style={{ flexShrink: 0, marginRight: 4 }}
                            />
                          )}
                          <span
                            style={{
                              ...styles.preview,
                              ...(isUnread ? styles.previewUnread : null),
                            }}
                          >
                            {mine && <span style={styles.previewYou}>You: </span>}
                            {conv.last_message || 'No messages yet'}
                          </span>
                        </div>
                      </div>

                      <div style={styles.trailing}>
                        {isUnread ? (
                          <span style={styles.unreadPill}>
                            {unread > 99 ? '99+' : unread}
                          </span>
                        ) : (
                          lastTime && (
                            <span style={styles.timeText}>{lastTime}</span>
                          )
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ─── Filter pill ─────────────────────────────────────────────────────
function FilterPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="sp-filter-pill"
      style={{
        ...styles.pill,
        ...(active ? styles.pillActive : null),
      }}
    >
      <span
        style={{
          ...styles.pillLabel,
          ...(active ? styles.pillLabelActive : null),
        }}
      >
        {label}
      </span>
      {count > 0 && (
        <span
          style={{
            ...styles.pillCount,
            ...(active ? styles.pillCountActive : null),
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// ─── Keyframes ───────────────────────────────────────────────────────
const PAGE_CSS = `
  @keyframes spInboxSpin { to { transform: rotate(360deg); } }
  @keyframes spInboxShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .sp-inbox-row:hover { background-color: #F8FAFC; }
  .sp-inbox-row:active { background-color: #F1F5F9; }
  .sp-community-row:hover { box-shadow: 0 8px 24px rgba(124, 58, 237, 0.18); }
  .sp-community-row:active { transform: scale(0.995); }
  .sp-filter-pill:active { transform: scale(0.97); }
`;

// ─── Styles ──────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.7,
  },
  headerUnread: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    height: 24,
    padding: '0 8px',
    borderRadius: 999,
    backgroundColor: '#0504AA',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 800,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: 'none',
    background: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  searchWrap: {
    padding: '0 16px 12px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 14,
    backgroundColor: '#F4F5FB',
    border: '1.5px solid transparent',
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  searchBoxFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0504AA',
    boxShadow: '0 0 0 4px rgba(5, 4, 170, 0.08)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 15,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    minWidth: 0,
  },
  searchClear: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#E2E8F0',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },

  pillRow: {
    display: 'flex',
    gap: 8,
    padding: '0 16px 12px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 999,
    border: '1px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
    transition: 'background-color 0.15s, border-color 0.15s, transform 0.12s',
  },
  pillActive: {
    backgroundColor: '#EEF0FF',
    borderColor: '#C7CCFF',
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#64748B',
    letterSpacing: 0.1,
  },
  pillLabelActive: {
    color: '#0504AA',
  },
  pillCount: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94A3B8',
    minWidth: 18,
    textAlign: 'center',
  },
  pillCountActive: {
    color: '#0504AA',
  },

  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px 24px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },

  communityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '14px 12px',
    marginBottom: 6,
    borderRadius: 16,
    border: '1px solid #D8B4FE',
    background: 'linear-gradient(135deg, #F5F3FF 0%, #FAF5FF 100%)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'box-shadow 0.2s, transform 0.15s',
  },
  communityIcon: {
    width: 52,
    height: 52,
    flex: '0 0 52px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(124, 58, 237, 0.28)',
  },
  communityInfo: {
    flex: 1,
    minWidth: 0,
  },
  communityName: {
    fontSize: 15.5,
    fontWeight: 800,
    color: '#5B21B6',
    letterSpacing: -0.1,
    lineHeight: 1.25,
  },
  communityPreview: {
    fontSize: 13,
    color: '#7C3AED',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    opacity: 0.85,
  },

  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '12px 12px',
    borderRadius: 14,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background-color 0.14s',
  },
  avatar: {
    width: 52,
    height: 52,
    flex: '0 0 52px',
    borderRadius: '50%',
    backgroundColor: '#EEF0FF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: 600,
    color: '#0B0B1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: -0.1,
  },
  nameUnread: {
    fontWeight: 800,
  },
  previewRow: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  },
  preview: {
    fontSize: 13.5,
    color: '#64748B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
    lineHeight: 1.35,
  },
  previewUnread: {
    color: '#0B0B1A',
    fontWeight: 600,
  },
  previewYou: {
    color: '#94A3B8',
    fontWeight: 500,
  },
  trailing: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 40,
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 500,
    letterSpacing: 0.1,
  },
  unreadPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    padding: '0 7px',
    borderRadius: 999,
    backgroundColor: '#0504AA',
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: 0.1,
  },

  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    textAlign: 'center',
  },
  errorHalo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHalo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    background: 'linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0 10px 28px rgba(5, 4, 170, 0.08)',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.2,
  },
  stateBody: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 1.5,
    maxWidth: 300,
  },
  retryBtn: {
    marginTop: 20,
    padding: '11px 22px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5, 4, 170, 0.24)',
  },

  skeletonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '4px 4px',
  },
  skeletonRow: {
    display: 'flex',
    gap: 14,
    padding: '12px 12px',
    alignItems: 'center',
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background:
      'linear-gradient(90deg, #EEF2F6 25%, #F8FAFC 50%, #EEF2F6 75%)',
    backgroundSize: '200% 100%',
    animation: 'spInboxShimmer 1.4s linear infinite',
    flexShrink: 0,
  },
  skeletonBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 4,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    background:
      'linear-gradient(90deg, #EEF2F6 25%, #F8FAFC 50%, #EEF2F6 75%)',
    backgroundSize: '200% 100%',
    animation: 'spInboxShimmer 1.4s linear infinite',
  },
};