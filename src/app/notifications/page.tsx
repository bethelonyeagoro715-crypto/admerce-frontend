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
  MdClose,
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

// ─── Helpers ────────────────────────────────────────────────────────
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
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfNotif = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
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

function extractDataPayload(raw: unknown): Record<string, unknown> | null {
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

function classify(n: NotificationItem): NotificationKind {
  const raw = (n.type || '').toLowerCase();
  if (raw) {
    if (raw.includes('order')) return 'order';
    if (raw.includes('message') || raw.includes('chat')) return 'message';
    if (raw.includes('store')) return 'store';
    if (raw.includes('verif')) return 'verified';
    if (raw.includes('favorite') || raw.includes('save')) return 'favorite';
    if (raw.includes('deliver') || raw.includes('ship') || raw.includes('courier')) return 'delivery';
    if (raw.includes('review') || raw.includes('rating')) return 'review';
  }
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
  order:    { color: 'var(--brand-primary)',  soft: 'var(--brand-soft)',  Icon: MdShoppingBag },
  message:  { color: 'var(--info-fg)',        soft: 'var(--info-bg)',     Icon: MdChat },
  store:    { color: 'var(--purple-fg)',      soft: 'var(--purple-bg)',   Icon: MdStorefront },
  verified: { color: 'var(--success-fg)',     soft: 'var(--success-bg)',  Icon: MdVerified },
  favorite: { color: '#DB2777',               soft: 'color-mix(in srgb, #DB2777 15%, transparent)', Icon: MdFavorite },
  delivery: { color: '#EA580C',               soft: 'color-mix(in srgb, #EA580C 15%, transparent)', Icon: MdLocalShipping },
  review:   { color: 'var(--warning-fg)',     soft: 'var(--warning-bg)',  Icon: MdStar },
  system:   { color: 'var(--text-tertiary)',  soft: 'var(--bg-tertiary)', Icon: MdNotifications },
};

function resolveDeepLink(n: NotificationItem): string | null {
  if (typeof n.url === 'string' && n.url.trim()) return n.url.trim();
  const data = extractDataPayload(n.data);
  if (!data) return null;

  const fromData =
    (typeof data.url === 'string' && data.url) ||
    (typeof data.link === 'string' && data.link);
  if (fromData) return fromData;

  if (typeof data.order_id === 'string') return `/wallet/order/${data.order_id}`;
  if (typeof data.booking_id === 'string') return `/receipt/service/${data.booking_id}`;
  if (typeof data.listing_id === 'string') return `/item-detail/${data.listing_id}`;
  if (typeof data.store_id === 'string') return `/store-detail/${data.store_id}`;
  if (typeof data.conversation_id === 'string') return `/chat/${data.conversation_id}`;

  return null;
}

function isRead(n: NotificationItem): boolean {
  if (typeof n.is_read === 'boolean') return n.is_read;
  if (typeof n.read === 'boolean') return n.read;
  return false;
}

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

// ─── Main Component ─────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  // State for the custom Bottom Sheet Modal
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getNotifications();
      setNotifications(extractNotifications(data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadNotifications(), 0);
    return () => clearTimeout(t);
  }, [loadNotifications]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // ignore
    }
  }, []);

  // Opens the custom modal instead of immediate routing
  const handleNotificationTap = async (n: NotificationItem) => {
    if (!isRead(n)) {
      await markAsRead(n.id);
    }
    setSelectedNotif(n);
  };

  // Triggered from inside the modal
  const handleViewContent = () => {
    if (!selectedNotif) return;
    const url = resolveDeepLink(selectedNotif);
    if (url) {
      router.push(url);
    }
    setSelectedNotif(null);
  };

  const handleMarkAll = async () => {
    const unread = notifications.filter((n) => !isRead(n));
    if (unread.length === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await Promise.all(unread.map((n) => api.markNotificationRead(n.id).catch(() => null)));
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !isRead(n)).length, [notifications]);

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
        <button className="nf-backBtn" onClick={() => router.back()} aria-label="Go back">
          <MdArrowBack size={22} color="var(--text-primary)" />
        </button>
        <div className="nf-headerText">
          <h1 className="nf-title">Notifications</h1>
          {unreadCount > 0 && <span className="nf-unread">{unreadCount} unread</span>}
        </div>
        <button className="nf-iconBtn" onClick={loadNotifications} aria-label="Refresh" disabled={isLoading}>
          <MdRefresh size={20} color="var(--brand-primary)" />
        </button>
      </header>

      {unreadCount > 0 && !isLoading && (
        <div className="nf-actionsBar">
          <button type="button" className="nf-markAllBtn" onClick={handleMarkAll} disabled={markingAll}>
            <MdDoneAll size={18} color="var(--brand-primary)" />
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
                  <div className="nf-skel nf-skelLine" style={{ width: '65%' }} />
                  <div className="nf-skel nf-skelLineShort" style={{ width: '30%' }} />
                </div>
              </div>
            ))}
          </>
        ) : error ? (
          <div className="nf-center">
            <MdErrorOutline size={48} color="var(--danger-fg)" />
            <p className="nf-centerText">{error}</p>
            <button type="button" className="nf-retryBtn" onClick={loadNotifications}>Retry</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="nf-center">
            <div className="nf-emptyIconWrap" aria-hidden="true">
              <MdNotifications size={40} color="var(--brand-primary)" />
            </div>
            <h2 className="nf-centerTitle">You&apos;re all caught up</h2>
            <p className="nf-centerText">Order updates, messages, and store activity will appear here.</p>
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
                    className={read ? 'nf-card nf-cardRead' : 'nf-card nf-cardUnread'}
                    onClick={() => handleNotificationTap(n)}
                  >
                    <span className="nf-iconWrap" style={{ backgroundColor: meta.soft }} aria-hidden="true">
                      <Icon size={20} color={meta.color} />
                    </span>
                    <span className="nf-content">
                      <span className="nf-topRow">
                        <span className="nf-titleText">{n.title || 'Notification'}</span>
                        {!read && <span className="nf-dot" aria-hidden="true" />}
                      </span>
                      {n.body && <span className="nf-bodyText">{n.body}</span>}
                      {timeText && <span className="nf-timeText">{timeText}</span>}
                    </span>
                    {hasLink && <MdChevronRight size={22} color="var(--border-strong)" className="nf-chevron" aria-hidden="true" />}
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>

      {/* ─── Beautiful Custom Bottom Sheet Modal ─── */}
      {selectedNotif && (
        <div className="nf-modalOverlay" onClick={() => setSelectedNotif(null)}>
          <div className="nf-modalSheet" onClick={(e) => e.stopPropagation()}>
            <div className="nf-modalGrabber" />
            
            <button className="nf-modalClose" onClick={() => setSelectedNotif(null)}>
              <MdClose size={24} color="var(--text-muted)" />
            </button>

            {(() => {
              const kind = classify(selectedNotif);
              const meta = KIND_META[kind];
              const Icon = meta.Icon;
              return (
                <div className="nf-modalContent">
                  <div className="nf-modalIconWrap" style={{ backgroundColor: meta.soft }}>
                    <Icon size={36} color={meta.color} />
                  </div>
                  
                  <h2 className="nf-modalTitle">{selectedNotif.title || 'Notification'}</h2>
                  
                  {selectedNotif.created_at && (
                    <span className="nf-modalTime">{timeAgo(selectedNotif.created_at)}</span>
                  )}

                  <div className="nf-modalBody">
                    {selectedNotif.body || 'No further details provided.'}
                  </div>

                  {/* Show Action Button only if there's somewhere to go */}
                  {resolveDeepLink(selectedNotif) ? (
                    <button className="nf-modalActionBtn" onClick={handleViewContent}>
                      View Details <MdChevronRight size={20} />
                    </button>
                  ) : (
                    <button className="nf-modalActionBtnSecondary" onClick={() => setSelectedNotif(null)}>
                      Done
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
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
  @keyframes nf-slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @keyframes nf-modalFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .nf-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-primary);
  }

  .nf-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-default);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .nf-backBtn {
    width: 36px; height: 36px; border-radius: 10px; border: none;
    background: transparent; cursor: pointer; display: inline-flex;
    align-items: center; justify-content: center; flex: 0 0 36px;
  }
  .nf-backBtn:hover { background: var(--bg-hover); }
  .nf-headerText { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; }
  .nf-title { font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 0; letter-spacing: -0.02em; }
  .nf-unread { padding: 2px 8px; border-radius: 999px; background: var(--brand-soft); color: var(--brand-primary); font-size: 11px; font-weight: 800; }
  .nf-iconBtn { width: 36px; height: 36px; border-radius: 10px; border: none; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 36px; }
  .nf-iconBtn:disabled { opacity: 0.5; }

  .nf-actionsBar { display: flex; justify-content: flex-end; padding: 10px 14px 0; }
  .nf-markAllBtn {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px;
    border: 1px solid var(--border-default); background: var(--bg-secondary); color: var(--brand-primary);
    font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
  }
  .nf-body { flex: 1; padding: 12px 14px 40px; }
  .nf-group { margin-bottom: 20px; }
  .nf-groupLabel { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; padding: 4px 4px 10px; }

  .nf-card {
    display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 14px; margin-bottom: 8px;
    border-radius: 14px; border: 1px solid var(--border-default); background: var(--bg-secondary);
    cursor: pointer; text-align: left; font-family: inherit; animation: nf-fadeIn 0.2s ease;
  }
  .nf-cardUnread { border-color: color-mix(in srgb, var(--brand-primary) 28%, transparent); box-shadow: var(--shadow-sm); }
  .nf-iconWrap { width: 40px; height: 40px; flex: 0 0 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; }
  .nf-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .nf-topRow { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .nf-titleText { font-size: 14px; font-weight: 700; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nf-cardRead .nf-titleText { font-weight: 600; color: var(--text-secondary); }
  .nf-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--brand-primary); flex: 0 0 8px; }
  .nf-bodyText { font-size: 13.5px; color: var(--text-secondary); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .nf-timeText { font-size: 11.5px; color: var(--text-muted); font-weight: 600; margin-top: 2px; }
  .nf-chevron { flex: 0 0 22px; align-self: center; }

  .nf-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; text-align: center; }
  .nf-emptyIconWrap { width: 76px; height: 76px; border-radius: 26px; background: var(--brand-soft); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  .nf-centerTitle { font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 0; }
  .nf-centerText { font-size: 13.5px; color: var(--text-tertiary); margin-top: 4px; }
  
  .nf-skeletonCard { display: flex; gap: 14px; padding: 14px; margin-bottom: 8px; border-radius: 14px; background: var(--bg-secondary); border: 1px solid var(--border-default); }
  .nf-skel { background: var(--skeleton); background-size: 800px 100%; animation: nf-shimmer 1.4s infinite linear; border-radius: 8px; }
  .nf-skelIcon { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 12px; }
  .nf-skelBody { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .nf-skelLine { height: 12px; width: 90%; }
  .nf-skelLineShort { height: 10px; }

  /* Modal Styles */
  .nf-modalOverlay {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px); z-index: 100; display: flex;
    align-items: flex-end; justify-content: center;
    animation: nf-modalFade 0.2s ease-out;
  }
  .nf-modalSheet {
    width: 100%; max-width: 600px; background: var(--bg-secondary);
    border-top-left-radius: 28px; border-top-right-radius: 28px;
    padding: 12px 24px 40px; position: relative;
    animation: nf-slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: 0 -4px 24px rgba(0,0,0,0.1);
  }
  .nf-modalGrabber {
    width: 44px; height: 5px; background: var(--border-strong);
    border-radius: 10px; margin: 0 auto 20px;
  }
  .nf-modalClose {
    position: absolute; top: 20px; right: 20px;
    background: var(--bg-tertiary); border: none; border-radius: 50%;
    width: 36px; height: 36px; display: flex; align-items: center;
    justify-content: center; cursor: pointer; transition: background 0.2s;
  }
  .nf-modalClose:hover { background: var(--border-default); }
  .nf-modalContent { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .nf-modalIconWrap {
    width: 80px; height: 80px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px; box-shadow: var(--shadow-sm);
  }
  .nf-modalTitle {
    font-size: 22px; font-weight: 800; color: var(--text-primary);
    margin: 0 0 8px; letter-spacing: -0.02em; line-height: 1.2;
  }
  .nf-modalTime {
    font-size: 13px; font-weight: 600; color: var(--text-muted);
    margin-bottom: 24px; background: var(--bg-tertiary);
    padding: 4px 12px; border-radius: 999px;
  }
  .nf-modalBody {
    font-size: 15px; line-height: 1.6; color: var(--text-secondary);
    margin-bottom: 32px; width: 100%; text-align: left;
    background: var(--bg-primary); padding: 16px;
    border-radius: 16px; border: 1px solid var(--border-subtle);
  }
  .nf-modalActionBtn {
    width: 100%; padding: 16px; border-radius: 16px; border: none;
    background: var(--brand-gradient); color: var(--brand-on-gradient);
    font-size: 16px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: var(--shadow-brand); transition: transform 0.1s;
  }
  .nf-modalActionBtn:active { transform: scale(0.98); }
  .nf-modalActionBtnSecondary {
    width: 100%; padding: 16px; border-radius: 16px;
    background: var(--bg-tertiary); color: var(--text-primary);
    border: 1px solid var(--border-default);
    font-size: 16px; font-weight: 700; cursor: pointer;
  }

  @media (min-width: 1024px) {
    .nf-modalOverlay { align-items: center; }
    .nf-modalSheet { border-radius: 28px; padding-bottom: 32px; }
  }
`;