'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import api from '../../../services/api';
import {
  MdArrowBack,
  MdPhone,
  MdVideocam,
  MdRefresh,
  MdSend,
  MdErrorOutline,
  MdChatBubbleOutline,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface ChatMessage {
  id?: string | number;
  sender_id?: string;
  receiver_id?: string;
  text?: string;
  created_at?: string;
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

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const searchParams = useSearchParams();

  const conversationId = params.conversationId;
  const otherUserId = searchParams.get('otherUserId') || '';
  const otherUserName = searchParams.get('otherUserName') || 'User';
  const otherUserAvatar = searchParams.get('otherUserAvatar') || '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // SEAI detection
  const isSeaiConversation =
    otherUserId.toLowerCase() === 'seai' || conversationId.includes('_seai');

  useEffect(() => {
    if (isSeaiConversation) {
      router.replace('/seai/ask');
      return;
    }

    // Load current user
    const getCurrentUser = async () => {
      try {
        const profile = (await api.getMyProfile()) as Record<string, unknown>;
        setCurrentUserId((profile.id as string) || null);
      } catch {
        // ignore
      }
    };

    // Load messages
    const loadMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = (await api.getMessagesByUser(otherUserId)) as {
          messages?: ChatMessage[];
        };
        setMessages(data.messages || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    // Defer to avoid lint
    const timer = setTimeout(() => {
      getCurrentUser();
      loadMessages();
    }, 0);

    return () => clearTimeout(timer);
  }, [conversationId, otherUserId, isSeaiConversation, router]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      await api.sendMessage(otherUserId || conversationId, text);
      const newMsg: ChatMessage = {
        id: Date.now(),
        sender_id: currentUserId || 'me',
        receiver_id: otherUserId,
        text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
    } catch (err: unknown) {
      alert('Failed to send: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSending(false);
    }
  };

  const startVoiceCall = () => {
    alert('Voice call coming soon!');
  };

  const startVideoCall = () => {
    alert('Video call coming soon!');
  };

  if (isSeaiConversation) {
    return (
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <MdChatBubbleOutline size={48} color="#ccc" />
          <p>Redirecting to SEAI...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <MdArrowBack size={24} color="#1A1A1A" />
        </button>
        <div style={styles.avatar}>
          {otherUserAvatar ? (
            <img
              src={resolveImageUrl(otherUserAvatar) || ''}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={styles.avatarText}>{otherUserName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <span style={styles.headerName}>{otherUserName}</span>
        <div style={{ flex: 1 }} />
        <button style={styles.iconBtn} onClick={startVoiceCall} title="Voice call">
          <MdPhone size={22} color="#0504AA" />
        </button>
        <button style={styles.iconBtn} onClick={startVideoCall} title="Video call">
          <MdVideocam size={22} color="#0504AA" />
        </button>
        <button style={styles.iconBtn} onClick={() => window.location.reload()} title="Refresh">
          <MdRefresh size={22} color="#0504AA" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} style={styles.messagesContainer}>
        {isLoading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : error ? (
          <div style={styles.center}>
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p style={{ color: '#666', margin: '8px 0 16px' }}>Failed to load messages</p>
            <button onClick={() => window.location.reload()} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div style={styles.center}>
            <MdChatBubbleOutline size={48} color="#ccc" />
            <p style={{ color: '#888', marginTop: 8 }}>No messages yet</p>
            <p style={{ color: '#aaa', fontSize: 12 }}>Say hello!</p>
          </div>
        ) : (
          <div>
            {messages.map((msg, idx) => {
              const isMine = msg.sender_id === currentUserId;
              const senderName = isMine ? 'You' : otherUserName;
              const avatar = isMine ? null : otherUserAvatar;
              const time = msg.created_at ? formatTime(msg.created_at) : '';

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  {!isMine && (
                    <div style={styles.messageAvatar}>
                      {avatar ? (
                        <img
                          src={resolveImageUrl(avatar) || ''}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#0504AA' }}>
                          {senderName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: '75%',
                      padding: '10px 14px',
                      borderRadius: 16,
                      backgroundColor: isMine ? '#0504AA' : '#f0f0f0',
                      color: isMine ? '#fff' : '#1A1A1A',
                      marginLeft: isMine ? 8 : 0,
                      marginRight: isMine ? 0 : 8,
                    }}
                  >
                    {!isMine && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#0504AA', marginBottom: 4 }}>
                        {senderName}
                      </div>
                    )}
                    <div>{msg.text}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{time}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage();
          }}
          style={styles.input}
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim() || sending}
          style={{
            ...styles.sendBtn,
            backgroundColor: inputText.trim() ? '#0504AA' : '#e0e0e0',
            cursor: inputText.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <MdSend size={20} color="#fff" />
        </button>
      </div>
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
    padding: '10px 12px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#fff',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#0504AA10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0504AA',
  },
  headerName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1A1A1A',
    marginLeft: 8,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
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
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#0504AA10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderTop: '1px solid #eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 24,
    border: '1px solid #e0e0e0',
    outline: 'none',
    fontSize: 14,
    backgroundColor: '#f5f5f5',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
};