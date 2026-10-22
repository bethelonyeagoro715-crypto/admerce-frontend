'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import {
  MdRefresh,
  MdErrorOutline,
  MdInbox,
  MdSearch,
  MdClose,
  MdStorefront,
  MdEdit,
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
  is_online?: boolean; // <── ADDED
}

interface DecoratedConversation extends Conversation {
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

function formatChatTime(isoString?: string): string {
  if (!isoString) return '';
  const t = parseAsUtc(isoString);
  if (Number.isNaN(t)) return '';
  
  const now = new Date();
  const d = new Date(t);
  
  if (now.toDateString() === d.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === d.toDateString()) {
    return 'Yesterday';
  }
  
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

// ─── Skeleton ───────────────────────────────────────────────────────
function InboxSkeleton() {
  return (
    <div className="ibx-skeletonGroup">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="ibx-skeletonRow">
          <div className="ibx-skel ibx-skelAvatar" />
          <div className="ibx-skeletonBody">
            <div className="ibx-skel ibx-skelLine" style={{ width: '48%' }} />
            <div className="ibx-skel ibx-skelLine" style={{ width: '78%', marginTop: 9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shell ──────────────────────────────────────────────────────────
export function InboxShell() {
  useAuthGuard();

  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = (await api.getMyProfile()) as { id?: string };
        if (!cancelled) setCurrentUserId(me?.id ?? null);
      } catch {
        /* silent */
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

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
    }
  };

  const decorated = useMemo<DecoratedConversation[]>(() => {
    const q = query.trim().toLowerCase();
    const list: DecoratedConversation[] = [];

    for (const conv of conversations) {
      const name = (conv.other_user_name?.trim() || 'User').trim();
      const preview = buildPreview(conv, currentUserId);
      const unread = conv.unread_count ?? 0;

      if (q) {
        const hay = `${name} ${preview}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      list.push({
        ...conv,
        _name: name,
        _preview: preview,
        _unread: unread,
        _avatar: resolveImageUrl(conv.other_user_avatar),
        _sortKey: parseAsUtc(conv.last_time) || 0,
      });
    }

    list.sort((a, b) => b._sortKey - a._sortKey);
    return list;
  }, [conversations, query, currentUserId]);

  const openChat = (conv: Conversation) => {
    const conversationId = conv.conversation_id;
    if (!conversationId) return;
    
    const params = new URLSearchParams();
    if (conv.other_user_id) params.set('otherUserId', conv.other_user_id);
    if (conv.other_user_name) params.set('otherUserName', conv.other_user_name);
    if (conv.other_user_avatar) params.set('otherUserAvatar', conv.other_user_avatar);
    
    const qs = params.toString();
    router.push(`/chat/${conversationId}${qs ? `?${qs}` : ''}`);
  };

  const hasAnyConversations = conversations.length > 0;
  const hasResults = decorated.length > 0;

  return (
    <main className="ibx-root">
      <style>{CSS}</style>

      <header className="ibx-header">
        <h1 className="ibx-title">Chats</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="ibx-iconBtn"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            aria-label="Refresh"
          >
            <MdRefresh
              size={22}
              color="var(--text-primary)"
              style={{
                animation: isRefreshing ? 'ibxSpin 0.8s linear infinite' : 'none',
              }}
            />
          </button>
          <button type="button" className="ibx-iconBtn" aria-label="New chat">
            <MdEdit size={22} color="var(--text-primary)" />
          </button>
        </div>
      </header>

      {hasAnyConversations && (
        <div className="ibx-searchContainer">
          <div className="ibx-searchBox">
            <MdSearch size={20} color="var(--text-muted)" />
            <input
              ref={searchInputRef}
              type="text"
              className="ibx-searchInput"
              placeholder="Search messages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            {query && (
              <button
                type="button"
                className="ibx-searchClear"
                onClick={() => setQuery('')}
              >
                <MdClose size={16} color="var(--text-tertiary)" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="ibx-body">
        {isLoading ? (
          <InboxSkeleton />
        ) : error ? (
          <div className="ibx-center">
            <div className="ibx-stateIconError">
              <MdErrorOutline size={32} color="var(--danger-fg)" />
            </div>
            <h2 className="ibx-stateTitle">Couldn&apos;t load your chats</h2>
            <p className="ibx-stateBody">{error}</p>
            <button type="button" className="ibx-primaryBtn" onClick={handleRefresh}>
              <MdRefresh size={16} color="var(--brand-on-primary)" />
              Try again
            </button>
          </div>
        ) : !hasAnyConversations ? (
          <div className="ibx-center">
            <div className="ibx-stateIconInfo">
              <MdInbox size={34} color="var(--brand-primary)" />
            </div>
            <h2 className="ibx-stateTitle">No conversations yet</h2>
            <p className="ibx-stateBody">
              Message a store or a service provider and your chats will show up here.
            </p>
            <button
              type="button"
              className="ibx-primaryBtn"
              onClick={() => router.push('/shopper/home')}
            >
              <MdStorefront size={16} color="var(--brand-on-primary)" />
              Browse stores
            </button>
          </div>
        ) : !hasResults ? (
          <div className="ibx-center">
            <h2 className="ibx-stateTitle">No matches</h2>
            <p className="ibx-stateBody">Nothing matches “{query.trim()}”.</p>
            <button type="button" className="ibx-ghostBtn" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="ibx-list">
            {decorated.map((conv) => {
              const conversationId = conv.conversation_id!;
              const timeLabel = formatChatTime(conv.last_time);
              const initials = conv._name.charAt(0).toUpperCase();
              const unread = conv._unread;
              
              // USE REAL BACKEND DATA HERE
              const isOnline = conv.is_online === true; 

              return (
                <button
                  type="button"
                  key={conversationId}
                  className="ibx-row"
                  onClick={() => openChat(conv)}
                >
                  <div className="ibx-avatarWrap">
                    {conv._avatar ? (
                      <img src={conv._avatar} alt="" className="ibx-avatarImg" />
                    ) : (
                      <span className="ibx-avatarInitials">{initials}</span>
                    )}
                    {isOnline && <span className="ibx-onlineDot" />}
                  </div>

                  <div className="ibx-itemBody">
                    <div className="ibx-nameRow">
                      <span className={`ibx-name ${unread > 0 ? 'ibx-nameUnread' : ''}`}>
                        {conv._name}
                      </span>
                      <span className={`ibx-time ${unread > 0 ? 'ibx-timeUnread' : ''}`}>
                        {timeLabel}
                      </span>
                    </div>
                    
                    <div className="ibx-previewRow">
                      <span className={`ibx-preview ${unread > 0 ? 'ibx-previewUnread' : ''}`}>
                        {conv._preview}
                      </span>
                      {unread > 0 && (
                        <span className="ibx-badge">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── CSS (WhatsApp Style) ───────────────────────────────────────────
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
    background: var(--bg-primary);
    color: var(--text-primary);
    max-width: 800px;
    margin: 0 auto;
    border-left: 1px solid var(--border-subtle);
    border-right: 1px solid var(--border-subtle);
  }

  .ibx-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: var(--bg-primary);
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .ibx-title {
    font-size: 26px;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.5px;
  }
  .ibx-iconBtn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .ibx-iconBtn:hover:not(:disabled) { background: var(--bg-hover); }

  .ibx-searchContainer {
    padding: 0 20px 12px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-subtle);
  }
  .ibx-searchBox {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 44px;
    background: var(--bg-tertiary);
    border-radius: 12px;
    border: 1.5px solid transparent;
    transition: border-color 0.15s, background 0.15s;
  }
  .ibx-searchBox:focus-within {
    border-color: var(--brand-primary);
    background: var(--bg-secondary);
  }
  .ibx-searchInput {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 15px;
    color: var(--text-primary);
    font-family: inherit;
  }
  .ibx-searchClear {
    background: none;
    border: none;
    padding: 0;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .ibx-body { flex: 1; }
  .ibx-list { display: flex; flex-direction: column; }

  .ibx-row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 14px 20px;
    background: var(--bg-primary);
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.1s;
    animation: ibxFadeIn 0.2s ease both;
  }
  .ibx-row:hover { background: var(--bg-hover); }
  .ibx-row:active { background: var(--bg-tertiary); }

  .ibx-avatarWrap {
    position: relative;
    width: 56px;
    height: 56px;
    flex: 0 0 56px;
    border-radius: 50%;
    background: var(--brand-soft);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ibx-avatarImg {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  .ibx-avatarInitials {
    color: var(--brand-primary);
    font-weight: 700;
    font-size: 20px;
  }
  .ibx-onlineDot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #4ADE80;
    border: 2.5px solid var(--bg-primary);
  }

  .ibx-itemBody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ibx-nameRow {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .ibx-name {
    font-size: 16.5px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ibx-nameUnread { font-weight: 800; }
  
  .ibx-time {
    font-size: 12.5px;
    color: var(--text-muted);
    font-weight: 500;
    white-space: nowrap;
  }
  .ibx-timeUnread {
    color: var(--brand-primary);
    font-weight: 700;
  }

  .ibx-previewRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .ibx-preview {
    flex: 1;
    font-size: 14.5px;
    color: var(--text-muted);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ibx-previewUnread {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .ibx-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--brand-primary);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ibx-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
    text-align: center;
  }
  .ibx-stateIconInfo, .ibx-stateIconError {
    width: 80px; height: 80px; border-radius: 30px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }
  .ibx-stateIconInfo { background: var(--brand-soft); }
  .ibx-stateIconError { background: var(--danger-bg); }
  
  .ibx-stateTitle { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
  .ibx-stateBody { font-size: 14px; color: var(--text-tertiary); margin: 0 0 20px; max-width: 300px; }
  
  .ibx-primaryBtn {
    padding: 12px 24px; border-radius: 12px; background: var(--brand-primary);
    color: #fff; border: none; font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
  }

  .ibx-skeletonGroup { display: flex; flex-direction: column; padding: 0 20px; }
  .ibx-skeletonRow { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border-subtle); }
  .ibx-skeletonBody { flex: 1; }
  .ibx-skel { background: var(--skeleton); border-radius: 8px; animation: ibxShimmer 1.4s infinite linear; }
  .ibx-skelAvatar { width: 56px; height: 56px; border-radius: 50%; }
  .ibx-skelLine { height: 14px; }
`;