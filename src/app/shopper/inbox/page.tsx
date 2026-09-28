'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import {
  MdRefresh,
  MdErrorOutline,
  MdInbox,
  MdSearch,
  MdClose,
  MdStorefront,
  MdChatBubbleOutline,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface Conversation {
  conversation_id?: string;
  other_user_id?: string;
  other_user_name?: string;
  other_user_avatar?: string | null;
  last_message?: string | null;
  last_sender_id?: string;
  last_time?: string;
  unread_count?: number;
}

type Filter = 'all' | 'unread';
type Bucket = 'today' | 'yesterday' | 'week' | 'older';

interface DecoratedConversation extends Conversation {
  _bucket: Bucket | null;
  _name: string;
  _preview: string;
  _unread: number;
  _avatar: string | null;
  _sortKey: number;
}

// ─── Helpers ────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function parseAsUtc(iso?: string | null): number {
  if (!iso) return NaN;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const trimmed = iso.replace(/(\.\d{3})\d+/, '$1');
  return new Date(hasTz ? trimmed : `${trimmed}Z`).getTime();
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return '';
  const t = parseAsUtc(isoString);
  if (Number.isNaN(t)) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - t) / 1000);
  if (diffSec < 45) return 'now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  try {
    return new Date(t).toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function getBucket(iso?: string): Bucket | null {
  const t = parseAsUtc(iso);
  if (Number.isNaN(t)) return null;
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
  if (t >= startOfToday) return 'today';
  if (t >= startOfYesterday) return 'yesterday';
  if (t >= startOfWeek) return 'week';
  return 'older';
}

function bucketLabel(b: Bucket): string {
  switch (b) {
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case 'week':
      return 'Earlier this week';
    case 'older':
      return 'Older';
  }
}

function buildPreview(
  conv: Conversation,
  currentUserId: string | null,
): string {
  const raw = (conv.last_message || '').trim();
  const isMine =
    Boolean(currentUserId) &&
    Boolean(conv.last_sender_id) &&
    conv.last_sender_id === currentUserId;
  const body = raw || '🎤 Voice note';
  return isMine ? `You: ${body}` : body;
}

// Renders text with the first case-insensitive match of `query` wrapped in
// a <mark>. Returns the raw string when there's no match — cheap and safe.
function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="ibx-mark">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────
function InboxSkeleton() {
  return (
    <>
      <div className="ibx-skeletonGroup">
        <div className="ibx-skel ibx-skelSection" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="ibx-skeletonRow">
            <div className="ibx-skel ibx-skelAvatar" />
            <div className="ibx-skeletonBody">
              <div
                className="ibx-skel ibx-skelLine"
                style={{ width: '48%' }}
              />
              <div
                className="ibx-skel ibx-skelLine"
                style={{ width: '78%', marginTop: 9 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="ibx-skeletonGroup">
        <div className="ibx-skel ibx-skelSection" />
        {[0, 1].map((i) => (
          <div key={i} className="ibx-skeletonRow">
            <div className="ibx-skel ibx-skelAvatar" />
            <div className="ibx-skeletonBody">
              <div
                className="ibx-skel ibx-skelLine"
                style={{ width: '55%' }}
              />
              <div
                className="ibx-skel ibx-skelLine"
                style={{ width: '72%', marginTop: 9 }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────
export default function InboxPage() {
  useAuthGuard();

  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadConversations = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const seq = ++reqSeq.current;
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);
      try {
        const data = (await api.getConversations()) as Conversation[];
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        const filtered = (data || []).filter(
          (conv) => !String(conv.conversation_id || '').endsWith('_seai'),
        );
        setConversations(filtered);
      } catch (err: unknown) {
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load conversations',
        );
      } finally {
        if (seq === reqSeq.current && isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [],
  );

  // Fetch current user id once, for "You:" previews.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = (await api.getMyProfile()) as { id?: string };
        if (!cancelled) setCurrentUserId(me?.id ?? null);
      } catch {
        /* silent — previews fall back to no "You:" prefix */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadConversations('initial');
    }, 0);
    return () => clearTimeout(t);
  }, [loadConversations]);

  const handleRefresh = () => {
    void loadConversations('refresh');
  };

  // Escape clears search when focused.
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
    }
  };

  const totalUnread = useMemo(
    () =>
      conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
    [conversations],
  );

  // Decorate → filter → sort → group.
  const decorated = useMemo<DecoratedConversation[]>(() => {
    const q = query.trim().toLowerCase();
    const list: DecoratedConversation[] = [];

    for (const conv of conversations) {
      const name = (conv.other_user_name?.trim() || 'User').trim();
      const preview = buildPreview(conv, currentUserId);
      const unread = conv.unread_count ?? 0;

      if (filter === 'unread' && unread === 0) continue;
      if (q) {
        const hay = `${name} ${preview}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      list.push({
        ...conv,
        _bucket: getBucket(conv.last_time),
        _name: name,
        _preview: preview,
        _unread: unread,
        _avatar: resolveImageUrl(conv.other_user_avatar),
        _sortKey: parseAsUtc(conv.last_time) || 0,
      });
    }

    list.sort((a, b) => b._sortKey - a._sortKey);
    return list;
  }, [conversations, query, filter, currentUserId]);

  // Group into date buckets, preserving insertion order of first appearance.
  const grouped = useMemo(() => {
    const order: Bucket[] = ['today', 'yesterday', 'week', 'older'];
    const map = new Map<Bucket, DecoratedConversation[]>();
    for (const c of decorated) {
      const b = c._bucket;
      if (!b) continue;
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(c);
    }
    return order
      .filter((b) => map.has(b))
      .map((b) => ({ bucket: b, items: map.get(b)! }));
  }, [decorated]);

  const openChat = (conv: Conversation) => {
    const conversationId = conv.conversation_id;
    if (!conversationId) {
      console.warn('[inbox] skipping conversation with no id', conv);
      return;
    }
    const params = new URLSearchParams();
    if (conv.other_user_id) params.set('otherUserId', conv.other_user_id);
    if (conv.other_user_name)
      params.set('otherUserName', conv.other_user_name);
    if (conv.other_user_avatar)
      params.set('otherUserAvatar', conv.other_user_avatar);
    const qs = params.toString();
    router.push(`/chat/${conversationId}${qs ? `?${qs}` : ''}`);
  };

  const unreadFilterCount = totalUnread;
  const hasAnyConversations = conversations.length > 0;
  const hasResults = decorated.length > 0;
  const searching = query.trim().length > 0;

  return (
    <main className="ibx-root">
      <style>{CSS}</style>

      {/* HEADER */}
      <header className="ibx-header">
        <div className="ibx-headerText">
          <h1 className="ibx-title">Inbox</h1>
          <p className="ibx-subtitle">
            {isLoading
              ? 'Loading…'
              : totalUnread > 0
                ? `${totalUnread} unread`
                : hasAnyConversations
                  ? `${conversations.length} conversation${
                      conversations.length === 1 ? '' : 's'
                    }`
                  : 'Your chats live here'}
          </p>
        </div>
        <button
          type="button"
          className="ibx-iconBtn"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          aria-label="Refresh"
          title="Refresh"
        >
          <MdRefresh
            size={20}
            color="#0504AA"
            style={{
              animation: isRefreshing
                ? 'ibxSpin 0.8s linear infinite'
                : 'none',
            }}
          />
        </button>
      </header>

      {/* SEARCH + FILTERS */}
      {(hasAnyConversations || searching) && (
        <div className="ibx-controls">
          <div className="ibx-searchBox">
            <MdSearch size={18} color="#94A3B8" aria-hidden />
            <input
              ref={searchInputRef}
              type="text"
              className="ibx-searchInput"
              placeholder="Search conversations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              aria-label="Search conversations"
            />
            {query && (
              <button
                type="button"
                className="ibx-searchClear"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <MdClose size={14} color="#64748B" />
              </button>
            )}
          </div>

          <div className="ibx-pillRow" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={
                filter === 'all'
                  ? 'ibx-pill ibx-pillActive'
                  : 'ibx-pill'
              }
              onClick={() => setFilter('all')}
            >
              All
              {hasAnyConversations && (
                <span className="ibx-pillCount">
                  {conversations.length}
                </span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'unread'}
              className={
                filter === 'unread'
                  ? 'ibx-pill ibx-pillActive'
                  : 'ibx-pill'
              }
              onClick={() => setFilter('unread')}
              disabled={unreadFilterCount === 0 && filter !== 'unread'}
            >
              Unread
              {unreadFilterCount > 0 && (
                <span
                  className={
                    filter === 'unread'
                      ? 'ibx-pillCount ibx-pillCountOn'
                      : 'ibx-pillCount'
                  }
                >
                  {unreadFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* BODY */}
      <div className="ibx-body">
        {isLoading ? (
          <InboxSkeleton />
        ) : error ? (
          <div className="ibx-center">
            <div className="ibx-stateIconError" aria-hidden>
              <MdErrorOutline size={32} color="#DC2626" />
            </div>
            <h2 className="ibx-stateTitle">Couldn&apos;t load your chats</h2>
            <p className="ibx-stateBody">{error}</p>
            <button
              type="button"
              className="ibx-primaryBtn"
              onClick={handleRefresh}
            >
              <MdRefresh size={16} color="#fff" />
              Try again
            </button>
          </div>
        ) : !hasAnyConversations ? (
          <div className="ibx-center">
            <div className="ibx-stateIconInfo" aria-hidden>
              <MdInbox size={34} color="#0504AA" />
            </div>
            <h2 className="ibx-stateTitle">No conversations yet</h2>
            <p className="ibx-stateBody">
              Message a store or a service provider and your chats will show
              up here.
            </p>
            <button
              type="button"
              className="ibx-primaryBtn"
              onClick={() => router.push('/shopper/home')}
            >
              <MdStorefront size={16} color="#fff" />
              Browse stores
            </button>
          </div>
        ) : !hasResults ? (
          <div className="ibx-center ibx-centerTight">
            <div className="ibx-stateIconMuted" aria-hidden>
              <MdChatBubbleOutline size={30} color="#94A3B8" />
            </div>
            <h2 className="ibx-stateTitle">No matches</h2>
            <p className="ibx-stateBody">
              {searching
                ? `Nothing matches “${query.trim()}”${
                    filter === 'unread' ? ' in unread chats' : ''
                  }.`
                : 'No unread conversations right now.'}
            </p>
            {(searching || filter === 'unread') && (
              <button
                type="button"
                className="ibx-ghostBtn"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {grouped.map(({ bucket, items }) => (
              <section key={bucket} className="ibx-group">
                <div className="ibx-groupHeader">
                  <span className="ibx-groupLabel">
                    {bucketLabel(bucket)}
                  </span>
                  <span className="ibx-groupRule" aria-hidden />
                  <span className="ibx-groupCount">
                    {items.length}
                  </span>
                </div>
                <div className="ibx-groupItems">
                  {items.map((conv) => {
                    const conversationId = conv.conversation_id!;
                    const timeLabel = formatRelativeTime(conv.last_time);
                    const initials = conv._name.charAt(0).toUpperCase();
                    const unread = conv._unread;

                    return (
                      <button
                        type="button"
                        key={conversationId}
                        className={
                          unread > 0
                            ? 'ibx-card ibx-cardUnread'
                            : 'ibx-card'
                        }
                        onClick={() => openChat(conv)}
                        aria-label={`Open chat with ${conv._name}${
                          unread > 0 ? `, ${unread} unread` : ''
                        }`}
                      >
                        <span
                          className={
                            unread > 0
                              ? 'ibx-avatarWrap ibx-avatarWrapUnread'
                              : 'ibx-avatarWrap'
                          }
                          aria-hidden
                        >
                          {conv._avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={conv._avatar}
                              alt=""
                              className="ibx-avatarImg"
                            />
                          ) : (
                            <span className="ibx-avatarInitials">
                              {initials}
                            </span>
                          )}
                        </span>

                        <span className="ibx-itemBody">
                          <span className="ibx-nameRow">
                            <span
                              className={
                                unread > 0
                                  ? 'ibx-name ibx-nameUnread'
                                  : 'ibx-name'
                              }
                              title={conv._name}
                            >
                              {highlight(conv._name, query)}
                            </span>
                            {timeLabel && (
                              <span
                                className={
                                  unread > 0
                                    ? 'ibx-time ibx-timeUnread'
                                    : 'ibx-time'
                                }
                              >
                                {timeLabel}
                              </span>
                            )}
                          </span>
                          <span className="ibx-previewRow">
                            <span
                              className={
                                unread > 0
                                  ? 'ibx-preview ibx-previewUnread'
                                  : 'ibx-preview'
                              }
                            >
                              {highlight(conv._preview, query)}
                            </span>
                            {unread > 0 && (
                              <span className="ibx-badge">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes ibxShimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes ibxFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ibxSpin { to { transform: rotate(360deg); } }

  .ibx-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #F4F5FB;
  }

  /* ── Header ─────────────────────────────────────────────── */
  .ibx-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 16px 14px;
    background: #fff;
    border-bottom: 1px solid #EAECF3;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .ibx-headerText {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ibx-title {
    font-size: 22px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.03em;
    line-height: 1.15;
  }
  .ibx-subtitle {
    font-size: 12.5px;
    color: #64748B;
    margin: 0;
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .ibx-iconBtn {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .ibx-iconBtn:hover:not(:disabled) { background: #F1F3FA; }
  .ibx-iconBtn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Controls ───────────────────────────────────────────── */
  .ibx-controls {
    background: #fff;
    padding: 0 16px 14px;
    border-bottom: 1px solid #EAECF3;
    position: sticky;
    top: 71px;
    z-index: 19;
  }
  .ibx-searchBox {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: #F4F5FB;
    border: 1.5px solid transparent;
    border-radius: 14px;
    transition: border-color 0.15s, background 0.15s;
  }
  .ibx-searchBox:focus-within {
    border-color: #C7CCFF;
    background: #fff;
  }
  .ibx-searchInput {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 15px;
    color: #0B0B1A;
    font-family: inherit;
  }
  .ibx-searchInput::placeholder { color: #94A3B8; }
  .ibx-searchClear {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    background: #E2E8F0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .ibx-searchClear:hover { background: #CBD5E1; }

  .ibx-pillRow {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .ibx-pillRow::-webkit-scrollbar { display: none; }
  .ibx-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid #E6E8F0;
    background: #fff;
    color: #64748B;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .ibx-pill:hover:not(:disabled) {
    border-color: #C7CCFF;
    color: #0504AA;
  }
  .ibx-pill:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ibx-pillActive {
    background: #0504AA;
    border-color: #0504AA;
    color: #fff;
  }
  .ibx-pillActive:hover { color: #fff; }
  .ibx-pillCount {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: #F1F5F9;
    color: #475569;
    font-size: 10.5px;
    font-weight: 800;
    line-height: 1;
  }
  .ibx-pillActive .ibx-pillCount {
    background: rgba(255,255,255,0.2);
    color: #fff;
  }
  .ibx-pillCountOn {
    background: rgba(255,255,255,0.2);
    color: #fff;
  }

  /* ── Body ───────────────────────────────────────────────── */
  .ibx-body {
    flex: 1;
    padding: 16px 12px 40px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── Date group ─────────────────────────────────────────── */
  .ibx-group { display: flex; flex-direction: column; gap: 8px; }
  .ibx-groupHeader {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 6px 2px;
  }
  .ibx-groupLabel {
    font-size: 11.5px;
    font-weight: 800;
    color: #64748B;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .ibx-groupRule {
    flex: 1;
    height: 1px;
    background: #E2E8F0;
  }
  .ibx-groupCount {
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .ibx-groupItems {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ── Card ───────────────────────────────────────────────── */
  .ibx-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 16px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition:
      border-color 0.15s,
      background 0.15s,
      transform 0.1s,
      box-shadow 0.15s;
    animation: ibxFadeIn 0.22s ease both;
  }
  .ibx-card:hover {
    border-color: #C9CBFF;
    box-shadow: 0 4px 14px rgba(5,4,170,0.06);
  }
  .ibx-card:active { transform: scale(0.994); }
  .ibx-card:focus-visible {
    outline: 2px solid #0504AA;
    outline-offset: 2px;
  }
  .ibx-cardUnread {
    border-color: #DDDFFF;
    background: linear-gradient(180deg, #FFFFFF 0%, #FCFCFF 100%);
  }
  /* Left accent for unread — 3px bar on the card edge */
  .ibx-cardUnread::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: #0504AA;
  }

  /* ── Avatar ─────────────────────────────────────────────── */
  .ibx-avatarWrap {
    width: 50px;
    height: 50px;
    flex: 0 0 50px;
    border-radius: 15px;
    overflow: hidden;
    background: #EEF0FF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: box-shadow 0.15s;
  }
  .ibx-avatarWrapUnread {
    box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px #C7CCFF;
  }
  .ibx-avatarImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ibx-avatarInitials {
    color: #0504AA;
    font-weight: 800;
    font-size: 18px;
    letter-spacing: 0.01em;
  }

  /* ── Text ───────────────────────────────────────────────── */
  .ibx-itemBody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ibx-nameRow {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  .ibx-name {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    color: #0B0B1A;
    letter-spacing: -0.01em;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ibx-nameUnread { font-weight: 800; }
  .ibx-time {
    flex-shrink: 0;
    font-size: 11.5px;
    color: #94A3B8;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }
  .ibx-timeUnread { color: #0504AA; font-weight: 800; }

  .ibx-previewRow {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .ibx-preview {
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
    color: #64748B;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ibx-previewUnread { color: #334155; font-weight: 600; }

  .ibx-badge {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: #0504AA;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.02em;
    box-shadow: 0 2px 6px rgba(5,4,170,0.24);
  }

  .ibx-mark {
    background: #FFF4B8;
    color: inherit;
    padding: 0 1px;
    border-radius: 3px;
  }

  /* ── Center states ──────────────────────────────────────── */
  .ibx-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px 40px;
    gap: 6px;
    text-align: center;
  }
  .ibx-centerTight { padding-top: 60px; }
  .ibx-stateIconInfo,
  .ibx-stateIconError,
  .ibx-stateIconMuted {
    width: 78px;
    height: 78px;
    border-radius: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }
  .ibx-stateIconInfo {
    background: linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%);
    box-shadow: 0 10px 28px rgba(5,4,170,0.08);
  }
  .ibx-stateIconError { background: #FEF2F2; }
  .ibx-stateIconMuted { background: #F1F5F9; }
  .ibx-stateTitle {
    font-size: 18px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .ibx-stateBody {
    font-size: 13.5px;
    color: #64748B;
    margin: 6px 0 20px;
    max-width: 340px;
    line-height: 1.55;
  }
  .ibx-primaryBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 11px 22px;
    background: #0504AA;
    color: #fff;
    border: none;
    border-radius: 14px;
    font-weight: 700;
    font-size: 13.5px;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s, transform 0.1s;
    box-shadow: 0 8px 20px rgba(5,4,170,0.24);
  }
  .ibx-primaryBtn:hover { opacity: 0.92; }
  .ibx-primaryBtn:active { transform: scale(0.98); }
  .ibx-ghostBtn {
    padding: 10px 18px;
    background: transparent;
    color: #0504AA;
    border: 1.5px solid #C7CCFF;
    border-radius: 12px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .ibx-ghostBtn:hover { background: #F4F5FF; }

  /* ── Skeleton ───────────────────────────────────────────── */
  .ibx-skeletonGroup {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ibx-skeletonRow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 16px;
  }
  .ibx-skeletonBody { flex: 1; min-width: 0; }
  .ibx-skel {
    background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
    background-size: 800px 100%;
    animation: ibxShimmer 1.4s infinite linear;
    border-radius: 8px;
  }
  .ibx-skelAvatar {
    width: 50px;
    height: 50px;
    flex: 0 0 50px;
    border-radius: 15px;
  }
  .ibx-skelLine { height: 12px; }
  .ibx-skelSection {
    height: 12px;
    width: 90px;
    border-radius: 4px;
    margin-left: 6px;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;