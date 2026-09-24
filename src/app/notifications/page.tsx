'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import {
  MdNotifications,
  MdShoppingBag,
  MdChat,
  MdStorefront,
  MdVerified,
  MdFavorite,
  MdErrorOutline,
  MdRefresh,
  MdChevronRight,
  MdDoneAll,
  MdArrowBack,
  MdLocalShipping,
  MdStar,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface NotificationItem {
  id: number;
  title?: string;
  body?: string;
  created_at?: string;
  is_read?: boolean;
  read?: boolean;
  type?: string;
  url?: string;
  data?: Record<string, unknown> | string;
  [key: string]: unknown;
}

type NotificationKind =
  | 'order'
  | 'message'
  | 'store'
  | 'verified'
  | 'favorite'
  | 'delivery'
  | 'review'
  | 'system';

// ─── Time formatting ────────────────────────────────────────────────
function timeAgo(isoString: string): string {
  try {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  } catch {
    return '';
  }
}

function dateGroup(isoString?: string): string {
  if (!isoString) return 'Earlier';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Earlier';
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfNotif = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    const dayDiff = Math.floor((startOfToday - startOfNotif) / 86_400_000);
    if (dayDiff <= 0) return 'Today';
    if (dayDiff === 1) return 'Yesterday';
    if (dayDiff < 7) return 'This week';
    if (dayDiff < 30) return 'This month';
    return 'Older';
  } catch {
    return 'Earlier';
  }
}

// ─── Extract data payload ───────────────────────────────────────────
function extractDataPayload(
  raw: unknown,
): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Classify notification ──────────────────────────────────────────
function classify(n: NotificationItem): NotificationKind {
  const raw = (n.type || '').toLowerCase();
  if (raw) {
    if (raw.includes('order')) return 'order';
    if (raw.includes('message') || raw.includes('chat')) return 'message';
    if (raw.includes('store')) return 'store';
    if (raw.includes('verif')) return 'verified';
    if (raw.includes('favorite') || raw.includes('save')) return 'favorite';
    if (raw.includes('deliver') || raw.includes('ship') || raw.includes('courier'))
      return 'delivery';
    if (raw.includes('review') || raw.includes('rating')) return 'review';
  }
  // Fall back to title keyword sniffing
  const t = (n.title || '').toLowerCase();
  if (t.includes('order')) return 'order';
  if (t.includes('message')) return 'message';
  if (t.includes('deliver')) return 'delivery';
  if (t.includes('verified') || t.includes('verification')) return 'verified';
  if (t.includes('saved') || t.includes('favorite')) return 'favorite';
  if (t.includes('review') || t.includes('rated')) return 'review';
  return 'system';
}

const KIND_META: Record<
  NotificationKind,
  { color: string; soft: string; Icon: React.ComponentType<{ size: number; color: string }> }
> = {
  order: { color: '#0504AA', soft: '#EEF0FF', Icon: MdShoppingBag },
  message: { color: '#0F766E', soft: '#CCFBF1', Icon: MdChat },
  store: { color: '#7C3AED', soft: '#EDE9FE', Icon: MdStorefront },
  verified: { color: '#16A34A', soft: '#DCFCE7', Icon: MdVerified },
  favorite: { color: '#DB2777', soft: '#FCE7F3', Icon: MdFavorite },
  delivery: { color: '#EA580C', soft: '#FFEDD5', Icon: MdLocalShipping },
  review: { color: '#D97706', soft: '#FEF3C7', Icon: MdStar },
  system: { color: '#64748B', soft: '#F1F5F9', Icon: MdNotifications },
};

// ─── Deep link resolution ───────────────────────────────────────────
function resolveDeepLink(n: NotificationItem): string | null {
  if (typeof n.url === 'string' && n.url.trim()) return n.url.trim();
  const data = extractDataPayload(n.data);
  if (!data) return null;

  const fromData =
    (typeof data.url === 'string' && data.url) ||
    (typeof data.link === 'string' && data.link);
  if (fromData) return fromData;

  if (typeof data.order_id === 'string') return `/wallet/order/${data.order_id}`;
  if (typeof data.booking_id === 'string')
    return `/receipt/service/${data.booking_id}`;
  if (typeof data.listing_id === 'string')
    return `/item-detail/${data.listing_id}`;
  if (typeof data.store_id === 'string')
    return `/store-detail/${data.store_id}`;
  if (typeof data.conversation_id === 'string')
    return `/chat/${data.conversation_id}`;

  return null;
}

function isRead(n: NotificationItem): boolean {
  if (typeof n.is_read === 'boolean') return n.is_read;
  if (typeof n.read === 'boolean') return n.read;
  return false;
}

// ─── Response normalizer ────────────────────────────────────────────
function extractNotifications(data: unknown): NotificationItem[] {
  if (Array.isArray(data)) return data as NotificationItem[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['notifications', 'items', 'results', 'data', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as NotificationItem[];
    }
  }
  return [];
}

// ─── Main page ──────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getNotifications();
      setNotifications(extractNotifications(data));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load notifications',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadNotifications(), 0);
    return () => clearTimeout(t);
  }, [loadNotifications]);

  const markAsRead = useCallback(
    async (id: number) => {
      try {
        await api.markNotificationRead(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        );
      } catch {
        // ignore
      }
    },
    [],
  );

  const handleNotificationTap = async (n: NotificationItem) => {
    if (!isRead(n)) {
      await markAsRead(n.id);
    }
    const url = resolveDeepLink(n);
    if (url) {
      router.push(url);
    }
  };

  const handleMarkAll = async () => {
    const unread = notifications.filter((n) => !isRead(n));
    if (unread.length === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      // ✅ Fan-out: no backend bulk endpoint exists yet, so we fire them in
      //    parallel. If the backend later adds `POST /notifications/read-all`,
      //    swap this out for a single call.
      await Promise.all(
        unread.map((n) => api.markNotificationRead(n.id).catch(() => null)),
      );
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true })),
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !isRead(n)).length,
    [notifications],
  );

  // Group by date label, preserving order
  const groups = useMemo(() => {
    const out: { label: string; items: NotificationItem[] }[] = [];
    for (const n of notifications) {
      const label = dateGroup(n.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) {
        last.items.push(n);
      } else {
        out.push({ label, items: [n] });
      }
    }
    return out;
  }, [notifications]);

  return (
    <main className="nf-root">
      <style>{CSS}</style>

      <header className="nf-header">
        <button
          className="nf-backBtn"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <MdArrowBack size={22} color="#0B0B1A" />
        </button>
        <div className="nf-headerText">
          <h1 className="nf-title">Notifications</h1>
          {unreadCount > 0 && (
            <span className="nf-unread">
              {unreadCount} unread
            </span>
          )}
        </div>
        <button
          className="nf-iconBtn"
          onClick={loadNotifications}
          aria-label="Refresh"
          title="Refresh"
          disabled={isLoading}
        >
          <MdRefresh size={20} color="#0504AA" />
        </button>
      </header>

      {unreadCount > 0 && !isLoading && (
        <div className="nf-actionsBar">
          <button
            type="button"
            className="nf-markAllBtn"
            onClick={handleMarkAll}
            disabled={markingAll}
          >
            <MdDoneAll size={18} color="#0504AA" />
            <span>{markingAll ? 'Marking…' : 'Mark all as read'}</span>
          </button>
        </div>
      )}

      <div className="nf-body">
        {isLoading ? (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="nf-skeletonCard" aria-hidden="true">
                <div className="nf-skel nf-skelIcon" />
                <div className="nf-skelBody">
                  <div className="nf-skel nf-skelLine" />
                  <div
                    className="nf-skel nf-skelLine"
                    style={{ width: '65%' }}
                  />
                  <div
                    className="nf-skel nf-skelLineShort"
                    style={{ width: '30%' }}
                  />
                </div>
              </div>
            ))}
          </>
        ) : error ? (
          <div className="nf-center">
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p className="nf-centerText">{error}</p>
            <button
              type="button"
              className="nf-retryBtn"
              onClick={loadNotifications}
            >
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="nf-center">
            <div className="nf-emptyIconWrap" aria-hidden="true">
              <MdNotifications size={40} color="#0504AA" />
            </div>
            <h2 className="nf-centerTitle">You&apos;re all caught up</h2>
            <p className="nf-centerText">
              Order updates, messages, and store activity will appear here.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="nf-group">
              <div className="nf-groupLabel">{group.label}</div>
              {group.items.map((n) => {
                const read = isRead(n);
                const kind = classify(n);
                const meta = KIND_META[kind];
                const Icon = meta.Icon;
                const hasLink = Boolean(resolveDeepLink(n));
                const timeText = n.created_at ? timeAgo(n.created_at) : '';

                return (
                  <button
                    key={n.id}
                    type="button"
                    className={
                      read ? 'nf-card nf-cardRead' : 'nf-card nf-cardUnread'
                    }
                    onClick={() => handleNotificationTap(n)}
                  >
                    <span
                      className="nf-iconWrap"
                      style={{ backgroundColor: meta.soft }}
                      aria-hidden="true"
                    >
                      <Icon size={20} color={meta.color} />
                    </span>

                    <span className="nf-content">
                      <span className="nf-topRow">
                        <span className="nf-titleText">
                          {n.title || 'Notification'}
                        </span>
                        {!read && <span className="nf-dot" aria-hidden="true" />}
                      </span>
                      {n.body && (
                        <span className="nf-bodyText">{n.body}</span>
                      )}
                      {timeText && (
                        <span className="nf-timeText">{timeText}</span>
                      )}
                    </span>

                    {hasLink && (
                      <MdChevronRight
                        size={22}
                        color="#cbd5e1"
                        className="nf-chevron"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
    </main>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes nf-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes nf-fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .nf-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #F4F5FB;
  }

  /* Header */
  .nf-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: #fff;
    border-bottom: 1px solid #EAECF3;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .nf-backBtn {
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
    flex: 0 0 36px;
  }
  .nf-backBtn:hover { background: #F1F3FA; }
  .nf-headerText {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .nf-title {
    font-size: 18px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  .nf-unread {
    padding: 2px 8px;
    border-radius: 999px;
    background: #EEF0FF;
    color: #0504AA;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .nf-iconBtn {
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
    flex: 0 0 36px;
  }
  .nf-iconBtn:hover:not(:disabled) { background: #F1F3FA; }
  .nf-iconBtn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Actions bar */
  .nf-actionsBar {
    display: flex;
    justify-content: flex-end;
    padding: 10px 14px 0;
  }
  .nf-markAllBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid #E5E7EF;
    background: #fff;
    color: #0504AA;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    font-family: inherit;
  }
  .nf-markAllBtn:hover:not(:disabled) {
    background: #EEF0FF;
    border-color: #C9CBFF;
  }
  .nf-markAllBtn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Body */
  .nf-body {
    flex: 1;
    padding: 12px 14px 40px;
  }

  /* Group */
  .nf-group { margin-bottom: 20px; }
  .nf-groupLabel {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #94A3B8;
    text-transform: uppercase;
    padding: 4px 4px 10px;
  }

  /* Card */
  .nf-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 14px;
    margin-bottom: 8px;
    border-radius: 14px;
    border: 1px solid #EAECF3;
    background: #fff;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s, transform 0.12s;
    animation: nf-fadeIn 0.2s ease;
  }
  .nf-card:hover {
    border-color: #C9CBFF;
  }
  .nf-cardUnread {
    border-color: #DDDFFF;
    box-shadow: 0 1px 3px rgba(5, 4, 170, 0.06);
  }
  .nf-cardUnread:hover {
    background: #FAFBFF;
  }

  .nf-iconWrap {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
  }

  .nf-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .nf-topRow {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .nf-titleText {
    font-size: 14px;
    font-weight: 700;
    color: #0B0B1A;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    flex: 1;
    min-width: 0;
  }
  .nf-cardRead .nf-titleText {
    font-weight: 600;
    color: #334155;
  }
  .nf-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0504AA;
    flex: 0 0 8px;
  }
  .nf-bodyText {
    font-size: 13.5px;
    color: #475569;
    line-height: 1.45;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .nf-timeText {
    font-size: 11.5px;
    color: #94A3B8;
    font-weight: 600;
    margin-top: 2px;
  }
  .nf-chevron {
    flex: 0 0 22px;
    align-self: center;
  }

  /* Center states */
  .nf-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px 40px;
    gap: 8px;
    text-align: center;
  }
  .nf-emptyIconWrap {
    width: 76px;
    height: 76px;
    border-radius: 26px;
    background: #EEF0FF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }
  .nf-centerTitle {
    font-size: 18px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .nf-centerText {
    font-size: 13.5px;
    color: #64748B;
    margin: 4px 0 0;
    max-width: 340px;
    line-height: 1.55;
  }
  .nf-retryBtn {
    margin-top: 14px;
    padding: 10px 22px;
    background: #0504AA;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
  }

  /* Skeleton */
  .nf-skeletonCard {
    display: flex;
    gap: 12px;
    padding: 14px;
    margin-bottom: 8px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid #EAECF3;
  }
  .nf-skel {
    background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
    background-size: 800px 100%;
    animation: nf-shimmer 1.4s infinite linear;
    border-radius: 8px;
  }
  .nf-skelIcon { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 12px; }
  .nf-skelBody { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .nf-skelLine { height: 12px; width: 90%; }
  .nf-skelLineShort { height: 10px; }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;