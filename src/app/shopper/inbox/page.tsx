'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import {
  MdRefresh,
  MdErrorOutline,
  MdInbox,
  MdChevronRight,
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

// ✅ Relative time — matches the notifications page style.
function formatRelativeTime(isoString?: string): string {
  if (!isoString) return '';
  let d: Date;
  try {
    d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
  } catch {
    return '';
  }
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return 'now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  try {
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

// ✅ Preview line — handles empty text (voice note), and prefixes "You: "
//    when the current user sent the last message.
function buildPreview(conv: Conversation, currentUserId: string | null): string {
  const raw = (conv.last_message || '').trim();
  const isMine =
    Boolean(currentUserId) &&
    Boolean(conv.last_sender_id) &&
    conv.last_sender_id === currentUserId;

  // Empty text usually means a voice note (transcription failed or never ran)
  const body = raw || '🎤 Voice note';
  return isMine ? `You: ${body}` : body;
}

// ─── Skeleton ───────────────────────────────────────────────────────
function InboxSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="ibx-skeletonRow" aria-hidden="true">
          <div className="ibx-skel ibx-skelAvatar" />
          <div className="ibx-skeletonBody">
            <div className="ibx-skel ibx-skelLine" style={{ width: '55%' }} />
            <div
              className="ibx-skel ibx-skelLine"
              style={{ width: '80%', marginTop: 8 }}
            />
          </div>
        </div>
      ))}
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
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = (await api.getConversations()) as Conversation[];
      const filtered = (data || []).filter(
        (conv) => !String(conv.conversation_id || '').endsWith('_seai'),
      );
      setConversations(filtered);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load conversations',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch the current user's id once so previews can say "You: …"
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
      void loadConversations();
    }, 0);
    return () => clearTimeout(t);
  }, [loadConversations]);

  const totalUnread = useMemo(
    () =>
      conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
    [conversations],
  );

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

  return (
    <main className="ibx-root">
      <style>{CSS}</style>

      <header className="ibx-header">
        <div className="ibx-headerText">
          <h1 className="ibx-title">Inbox</h1>
          {totalUnread > 0 && (
            <span className="ibx-unreadTotal">
              {totalUnread} unread
            </span>
          )}
        </div>
        <button
          type="button"
          className="ibx-iconBtn"
          onClick={loadConversations}
          disabled={isLoading}
          aria-label="Refresh"
          title="Refresh"
        >
          <MdRefresh size={20} color="#0504AA" />
        </button>
      </header>

      <div className="ibx-body">
        {isLoading ? (
          <InboxSkeleton />
        ) : error ? (
          <div className="ibx-center">
            <div className="ibx-stateIconError" aria-hidden="true">
              <MdErrorOutline size={32} color="#DC2626" />
            </div>
            <h2 className="ibx-stateTitle">Couldn&apos;t load your chats</h2>
            <p className="ibx-stateBody">{error}</p>
            <button
              type="button"
              className="ibx-primaryBtn"
              onClick={loadConversations}
            >
              <MdRefresh size={16} color="#fff" />
              Try again
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="ibx-center">
            <div className="ibx-stateIconInfo" aria-hidden="true">
              <MdInbox size={32} color="#0504AA" />
            </div>
            <h2 className="ibx-stateTitle">No conversations yet</h2>
            <p className="ibx-stateBody">
              When you message a store or a service provider, the chat will
              show up here.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const conversationId = conv.conversation_id!;
            const name = conv.other_user_name?.trim() || 'User';
            const avatar = resolveImageUrl(conv.other_user_avatar);
            const preview = buildPreview(conv, currentUserId);
            const unread = conv.unread_count ?? 0;
            const timeLabel = formatRelativeTime(conv.last_time);
            const initials = name.charAt(0).toUpperCase();

            return (
              <button
                type="button"
                key={conversationId}
                className={
                  unread > 0
                    ? 'ibx-card ibx-cardUnread'
                    : 'ibx-card ibx-cardRead'
                }
                onClick={() => openChat(conv)}
                aria-label={`Open chat with ${name}${
                  unread > 0 ? ` (${unread} unread)` : ''
                }`}
              >
                <span className="ibx-avatarWrap" aria-hidden="true">
                  {avatar ? (
                    <img src={avatar} alt="" className="ibx-avatarImg" />
                  ) : (
                    <span className="ibx-avatarInitials">{initials}</span>
                  )}
                </span>

                <span className="ibx-itemBody">
                  <span className="ibx-nameRow">
                    <span className="ibx-name" title={name}>
                      {name}
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
                      {preview}
                    </span>
                    {unread > 0 && (
                      <span className="ibx-badge">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </span>
                </span>

                <MdChevronRight
                  size={18}
                  color="#cbd5e1"
                  className="ibx-chevron"
                  aria-hidden="true"
                />
              </button>
            );
          })
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

  .ibx-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #F4F5FB;
  }

  /* Header */
  .ibx-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 14px;
    background: #fff;
    border-bottom: 1px solid #EAECF3;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .ibx-headerText {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .ibx-title {
    font-size: 20px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  .ibx-unreadTotal {
    padding: 2px 9px;
    border-radius: 999px;
    background: #EEF0FF;
    color: #0504AA;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .ibx-iconBtn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
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

  /* Body */
  .ibx-body {
    flex: 1;
    padding: 12px 12px 32px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Conversation card */
  .ibx-card {
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
    transition: border-color 0.15s, background 0.15s, transform 0.1s;
    animation: ibxFadeIn 0.2s ease;
  }
  .ibx-card:hover { border-color: #C9CBFF; }
  .ibx-card:active { transform: scale(0.995); }
  .ibx-cardUnread {
    border-color: #DDDFFF;
    box-shadow: 0 1px 3px rgba(5, 4, 170, 0.06);
  }

  /* Avatar */
  .ibx-avatarWrap {
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    border-radius: 14px;
    overflow: hidden;
    background: #EEF0FF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
    letter-spacing: 0.02em;
  }

  /* Text content */
  .ibx-itemBody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
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
    font-weight: 700;
    color: #0B0B1A;
    letter-spacing: -0.01em;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ibx-time {
    flex-shrink: 0;
    font-size: 11.5px;
    color: #94A3B8;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
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
  }

  .ibx-chevron { flex-shrink: 0; }

  /* Center states */
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
  .ibx-stateIconInfo,
  .ibx-stateIconError {
    width: 76px;
    height: 76px;
    border-radius: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }
  .ibx-stateIconInfo { background: #EEF0FF; }
  .ibx-stateIconError { background: #FEF2F2; }
  .ibx-stateTitle {
    font-size: 18px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .ibx-stateBody {
    font-size: 13.5px;
    color: #64748B;
    margin: 4px 0 18px;
    max-width: 340px;
    line-height: 1.55;
  }
  .ibx-primaryBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: #0504AA;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 13.5px;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .ibx-primaryBtn:hover { opacity: 0.92; }

  /* Skeleton */
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
  .ibx-skelAvatar { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 14px; }
  .ibx-skelLine { height: 12px; }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;