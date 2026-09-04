'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdRefresh,
  MdErrorOutline,
  MdInbox,
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
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function StorekeeperInboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = (await api.getConversations()) as Conversation[];
      // Filter out SEAI conversations (conversation_id ends with '_seai')
      const filtered = data.filter(
        (conv) => !String(conv.conversation_id).endsWith('_seai')
      );
      setConversations(filtered);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadConversations();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openChat = (conv: Conversation) => {
    const params = new URLSearchParams();
    if (conv.other_user_id) params.set('otherUserId', conv.other_user_id);
    if (conv.other_user_name) params.set('otherUserName', conv.other_user_name);
    if (conv.other_user_avatar) params.set('otherUserAvatar', conv.other_user_avatar);
    router.push(`/chat/${conv.conversation_id}?${params.toString()}`);
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Inbox</h1>
        <button onClick={loadConversations} style={styles.refreshBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
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
            <p style={{ color: '#666', margin: '8px 0 16px' }}>Failed to load conversations</p>
            <button onClick={loadConversations} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div style={styles.center}>
            <MdInbox size={48} color="#ccc" />
            <p style={{ color: '#888', marginTop: 8 }}>No conversations yet</p>
          </div>
        ) : (
          <div style={styles.list}>
            {conversations.map((conv, index) => {
              const name = conv.other_user_name || 'User';
              const avatar = resolveImageUrl(conv.other_user_avatar);
              const lastMessage = conv.last_message || '';
              const unreadCount = conv.unread_count ?? 0;
              const lastTime = conv.last_time ? formatTime(conv.last_time) : null;

              return (
                <div key={index} style={styles.conversationItem} onClick={() => openChat(conv)}>
                  {/* Avatar */}
                  <div style={styles.avatar}>
                    {avatar ? (
                      <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={styles.avatarText}>{name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  {/* Text content */}
                  <div style={styles.itemContent}>
                    <div style={styles.nameRow}>
                      <span style={styles.name}>{name}</span>
                      {unreadCount > 0 && (
                        <span style={styles.unreadBadge}>{unreadCount}</span>
                      )}
                    </div>
                    <div style={styles.lastMessage}>{lastMessage}</div>
                  </div>

                  {/* Time */}
                  {lastTime && <span style={styles.time}>{lastTime}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
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
  conversationItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '1px solid #eee',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    cursor: 'pointer',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#0504AA10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0504AA',
  },
  itemContent: {
    flex: 1,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1A1A1A',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  unreadBadge: {
    backgroundColor: '#0504AA',
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: 10,
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  time: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
    whiteSpace: 'nowrap',
  },
};