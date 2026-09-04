'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import {
  MdNotifications,
  MdNotificationsOff,
  MdErrorOutline,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface NotificationItem {
  id: number;
  title?: string;
  body?: string;
  created_at?: string;
  is_read?: boolean;
  [key: string]: unknown;
}

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

// ─── Normalize API response ────────────────────────────────────────
function extractNotifications(data: unknown): NotificationItem[] {
  if (Array.isArray(data)) {
    return data as NotificationItem[];
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.notifications)) {
      return obj.notifications as NotificationItem[];
    }
    if (Array.isArray(obj.items)) {
      return obj.items as NotificationItem[];
    }
    if (Array.isArray(obj.results)) {
      return obj.results as NotificationItem[];
    }
  }

  return [];
}

export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getNotifications();
      const list = extractNotifications(data);
      setNotifications(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // ignore
    }
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <span style={{ fontSize: 22 }}>←</span>
        </button>
        <h1 style={styles.title}>Notifications</h1>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {isLoading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : error ? (
          <div style={styles.center}>
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p style={{ color: '#666', margin: '8px 0 16px' }}>Failed to load notifications</p>
            <button onClick={loadNotifications} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div style={styles.center}>
            <MdNotifications size={48} color="#ccc" />
            <p style={{ color: '#888', marginTop: 8 }}>No notifications yet</p>
          </div>
        ) : (
          <div style={styles.list}>
            {notifications.map((notif) => {
              const isRead = notif.is_read ?? false;
              const title = notif.title || '';
              const body = notif.body || '';
              const timeText = notif.created_at ? timeAgo(notif.created_at) : '';

              return (
                <div
                  key={notif.id}
                  style={{
                    ...styles.notificationItem,
                    backgroundColor: isRead ? '#fff' : '#f0edff',
                    borderLeft: isRead ? '4px solid transparent' : '4px solid #0504AA',
                  }}
                  onClick={() => {
                    if (!isRead) markAsRead(notif.id);
                  }}
                >
                  <div style={styles.notificationIcon}>
                    {isRead ? (
                      <MdNotificationsOff size={24} color="#999" />
                    ) : (
                      <MdNotifications size={24} color="#0504AA" />
                    )}
                  </div>
                  <div style={styles.notificationContent}>
                    <div
                      style={{
                        fontWeight: isRead ? 400 : 700,
                        color: '#1A1A1A',
                      }}
                    >
                      {title}
                    </div>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{body}</div>
                    {timeText && (
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{timeText}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginRight: 12,
    color: '#333',
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    padding: '8px 20px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  notificationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '12px',
    marginBottom: 8,
    borderRadius: 12,
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    cursor: 'pointer',
  },
  notificationIcon: {
    marginRight: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#f5f5f5',
  },
  notificationContent: {
    flex: 1,
  },
};