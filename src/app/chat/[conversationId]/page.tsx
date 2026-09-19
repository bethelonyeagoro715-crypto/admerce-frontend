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
  MdReply,
  MdContentCopy,
  MdEdit,
  MdDelete,
  MdClose,
  MdCheck,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

interface ChatMessage {
  id?: string | number;
  sender_id?: string;
  receiver_id?: string;
  text?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  created_at?: string;
  edited_at?: string | null;
  deleted_for_everyone?: boolean;
  reply_to_id?: number | null;
  reply_to_text?: string | null;
  reply_to_sender_name?: string | null;
  reply_to_deleted?: boolean;
}

interface ReplyDraft {
  id: string | number;
  senderName: string;
  previewText: string;
}

interface EditDraft {
  id: string | number;
  originalText: string;
}

interface ContextMenuState {
  messageId: string | number;
  isMine: boolean;
  hasText: boolean;
  isDeleted: boolean;
  x: number;
  y: number;
}

interface ConfirmDeleteState {
  messageId: string | number;
  scope: 'me' | 'all';
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  return `${base}${url}`;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const LONG_PRESS_MS = 500;

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

  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSeaiConversation =
    otherUserId.toLowerCase() === 'seai' || conversationId.includes('_seai');
  const hasRecipient = Boolean(otherUserId);
  const displayError = !hasRecipient
    ? 'Missing recipient information. Please open this chat from your inbox.'
    : error;
  const showLoading = hasRecipient && isLoading;

  useEffect(() => {
    if (isSeaiConversation) {
      router.replace('/seai/ask');
      return;
    }
    if (!hasRecipient) return;

    const timer = setTimeout(async () => {
      try {
        const profile = (await api.getMyProfile()) as Record<string, unknown>;
        setCurrentUserId((profile.id as string) || null);
      } catch {
        // ignore
      }

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
    }, 0);

    return () => clearTimeout(timer);
  }, [conversationId, otherUserId, isSeaiConversation, hasRecipient, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('touchstart', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('touchstart', close, true);
    };
  }, [contextMenu]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    if (!hasRecipient) {
      alert('Cannot send: missing recipient.');
      return;
    }

    if (editDraft) {
      setSending(true);
      try {
        const result = (await api.editMessage(editDraft.id, text)) as {
          text: string;
          edited_at: string;
        };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editDraft.id
              ? { ...m, text: result.text, edited_at: result.edited_at }
              : m,
          ),
        );
        setEditDraft(null);
        setInputText('');
      } catch (err: unknown) {
        alert('Failed to edit: ' + (err instanceof Error ? err.message : ''));
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      const replyId = replyDraft ? Number(replyDraft.id) : undefined;
      const result = (await api.sendMessage(otherUserId, text, replyId)) as {
        id?: string | number;
        created_at?: string;
        reply_to_id?: number | null;
      };

      const newMsg: ChatMessage = {
        id: result.id || Date.now(),
        sender_id: currentUserId || 'me',
        receiver_id: otherUserId,
        text,
        created_at: result.created_at || new Date().toISOString(),
        reply_to_id: result.reply_to_id ?? null,
        reply_to_text: replyDraft?.previewText ?? null,
        reply_to_sender_name: replyDraft?.senderName ?? null,
        reply_to_deleted: false,
      };

      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setReplyDraft(null);
    } catch (err: unknown) {
      alert('Failed to send: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSending(false);
    }
  };

  const openContextMenu = (
    e: React.MouseEvent | React.TouchEvent,
    msg: ChatMessage,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const isMine = msg.sender_id === currentUserId;
    const text = msg.text || '';
    const isDeleted = !!msg.deleted_for_everyone;

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    setContextMenu({
      messageId: msg.id!,
      isMine,
      hasText: Boolean(text) && !isDeleted,
      isDeleted,
      x: clientX,
      y: clientY,
    });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: ChatMessage) => {
    if (msg.deleted_for_everyone) return;
    longPressTimer.current = setTimeout(() => {
      openContextMenu(e, msg);
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleReply = () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.messageId);
    if (!msg) return;
    const senderName = msg.sender_id === currentUserId ? 'You' : otherUserName;
    let previewText = msg.text || '';
    if (!previewText && msg.audio_url) previewText = 'Voice note';
    if (!previewText && msg.image_url) previewText = 'Photo';
    setReplyDraft({ id: contextMenu.messageId, senderName, previewText });
    setEditDraft(null);
    setInputText('');
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCopy = async () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.messageId);
    if (!msg?.text) {
      setContextMenu(null);
      return;
    }
    try {
      await navigator.clipboard.writeText(msg.text);
    } catch {
      alert('Could not copy');
    }
    setContextMenu(null);
  };

  const handleEdit = () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.messageId);
    if (!msg) return;
    setEditDraft({ id: contextMenu.messageId, originalText: msg.text || '' });
    setInputText(msg.text || '');
    setReplyDraft(null);
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const requestDeleteMe = () => {
    if (!contextMenu) return;
    setConfirmDelete({ messageId: contextMenu.messageId, scope: 'me' });
    setContextMenu(null);
  };

  const requestDeleteAll = () => {
    if (!contextMenu) return;
    setConfirmDelete({ messageId: contextMenu.messageId, scope: 'all' });
    setContextMenu(null);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    const { messageId, scope } = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.deleteMessage(messageId, scope);
      if (scope === 'all') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, text: null, image_url: null, audio_url: null, deleted_for_everyone: true }
              : m,
          ),
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (err: unknown) {
      alert('Failed to delete: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const startCall = (video: boolean) => {
    if (!hasRecipient) {
      alert('Cannot start a call without a recipient.');
      return;
    }
    const qs = new URLSearchParams();
    qs.set('video', video ? '1' : '0');
    qs.set('name', otherUserName);
    if (otherUserAvatar) qs.set('avatar', otherUserAvatar);
    router.push(`/chat/${conversationId}/call?${qs.toString()}`);
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
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <MdArrowBack size={24} color="#1A1A1A" />
        </button>
        <div style={styles.avatar}>
          {otherUserAvatar ? (
            <img src={resolveImageUrl(otherUserAvatar) || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={styles.avatarText}>{otherUserName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <span style={styles.headerName}>{otherUserName}</span>
        <div style={{ flex: 1 }} />
        <button style={styles.iconBtn} onClick={() => startCall(false)} title="Voice call">
          <MdPhone size={22} color="#0504AA" />
        </button>
        <button style={styles.iconBtn} onClick={() => startCall(true)} title="Video call">
          <MdVideocam size={22} color="#0504AA" />
        </button>
        <button style={styles.iconBtn} onClick={() => window.location.reload()} title="Refresh">
          <MdRefresh size={22} color="#0504AA" />
        </button>
      </div>

      <div ref={scrollContainerRef} style={styles.messagesContainer}>
        {showLoading ? (
          <div style={styles.center}><div style={styles.spinner} /></div>
        ) : displayError ? (
          <div style={styles.center}>
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p style={{ color: '#666', margin: '8px 0 16px', textAlign: 'center' }}>{displayError}</p>
            {hasRecipient ? (
              <button onClick={() => window.location.reload()} style={styles.retryBtn}>Retry</button>
            ) : (
              <button onClick={() => router.push('/shopper/inbox')} style={styles.retryBtn}>Back to Inbox</button>
            )}
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
              const isDeleted = !!msg.deleted_for_everyone;

              return (
                <div key={msg.id ?? idx} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  {!isMine && (
                    <div style={styles.messageAvatar}>
                      {avatar ? (
                        <img src={resolveImageUrl(avatar) || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#0504AA' }}>{senderName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: '78%',
                      padding: '10px 14px',
                      borderRadius: 16,
                      backgroundColor: isMine ? '#0504AA' : '#f0f0f0',
                      color: isMine ? '#fff' : '#1A1A1A',
                      marginLeft: isMine ? 8 : 0,
                      marginRight: isMine ? 0 : 8,
                      opacity: isDeleted ? 0.7 : 1,
                      cursor: isDeleted ? 'default' : 'pointer',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      touchAction: 'pan-y',
                    }}
                    onContextMenu={(e) => !isDeleted && openContextMenu(e, msg)}
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                  >
                    {msg.reply_to_id && (
                      <div style={{
                        borderLeft: `3px solid ${isMine ? 'rgba(255,255,255,0.5)' : '#0504AA'}`,
                        paddingLeft: 8,
                        marginBottom: 6,
                        opacity: 0.9,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                          {msg.reply_to_sender_name || 'Reply'}
                        </div>
                        <div style={{
                          fontSize: 12,
                          fontStyle: msg.reply_to_deleted ? 'italic' : 'normal',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {msg.reply_to_deleted ? 'This message was deleted' : (msg.reply_to_text || '').slice(0, 80)}
                        </div>
                      </div>
                    )}

                    {!isMine && !isDeleted && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#0504AA', marginBottom: 4 }}>
                        {senderName}
                      </div>
                    )}

                    {isDeleted ? (
                      <div style={{ fontStyle: 'italic', opacity: 0.65, fontSize: 14 }}>
                        This message was deleted
                      </div>
                    ) : (
                      <>
                        {msg.audio_url && (
                          <audio controls src={resolveImageUrl(msg.audio_url) || undefined} style={{ width: 220, marginBottom: msg.text ? 6 : 0 }} />
                        )}
                        {msg.image_url && (
                          <img src={resolveImageUrl(msg.image_url) || ''} alt="" style={{ maxWidth: 220, borderRadius: 8, marginBottom: msg.text ? 6 : 0 }} />
                        )}
                        {msg.text && (
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</div>
                        )}
                      </>
                    )}

                    <div style={{
                      fontSize: 10,
                      opacity: 0.7,
                      marginTop: 4,
                      display: 'flex',
                      gap: 6,
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                    }}>
                      {msg.edited_at && !isDeleted && <span style={{ fontStyle: 'italic' }}>(edited)</span>}
                      <span>{time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {(replyDraft || editDraft) && (
        <div style={styles.previewBar}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.previewLabel}>
              {editDraft ? 'Editing message' : `Replying to ${replyDraft?.senderName}`}
            </div>
            <div style={styles.previewText}>
              {editDraft ? editDraft.originalText : replyDraft?.previewText}
            </div>
          </div>
          <button
            style={styles.previewCloseBtn}
            onClick={() => {
              setReplyDraft(null);
              setEditDraft(null);
              setInputText('');
            }}
          >
            <MdClose size={20} color="#666" />
          </button>
        </div>
      )}

      <div style={styles.inputArea}>
        <input
          ref={inputRef}
          type="text"
          placeholder={hasRecipient ? 'Type a message...' : 'Missing recipient'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
            if (e.key === 'Escape' && (replyDraft || editDraft)) {
              setReplyDraft(null);
              setEditDraft(null);
              setInputText('');
            }
          }}
          style={styles.input}
          disabled={!hasRecipient}
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim() || sending || !hasRecipient}
          style={{
            ...styles.sendBtn,
            backgroundColor: inputText.trim() && hasRecipient ? '#0504AA' : '#e0e0e0',
            cursor: inputText.trim() && hasRecipient ? 'pointer' : 'not-allowed',
          }}
        >
          {editDraft ? <MdCheck size={20} color="#fff" /> : <MdSend size={20} color="#fff" />}
        </button>
      </div>

      {contextMenu && (
        <div
          style={{
            ...styles.contextMenu,
            left: Math.max(8, Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 360) - 200)),
            top: Math.max(8, Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 640) - 280)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button style={styles.contextItem} onClick={handleReply}>
            <MdReply size={18} />
            <span>Reply</span>
          </button>
          {contextMenu.hasText && (
            <button style={styles.contextItem} onClick={handleCopy}>
              <MdContentCopy size={18} />
              <span>Copy</span>
            </button>
          )}
          {contextMenu.isMine && contextMenu.hasText && (
            <button style={styles.contextItem} onClick={handleEdit}>
              <MdEdit size={18} />
              <span>Edit</span>
            </button>
          )}
          {contextMenu.isMine && (
            <button style={{ ...styles.contextItem, color: '#DC2626' }} onClick={requestDeleteAll}>
              <MdDelete size={18} />
              <span>Delete for everyone</span>
            </button>
          )}
          <button style={{ ...styles.contextItem, color: '#DC2626' }} onClick={requestDeleteMe}>
            <MdDelete size={18} />
            <span>Delete for me</span>
          </button>
        </div>
      )}

      {confirmDelete && (
        <div style={styles.confirmOverlay} onClick={() => setConfirmDelete(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Delete message?</div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
              {confirmDelete.scope === 'all'
                ? 'This will delete the message for everyone in this chat. This cannot be undone.'
                : 'This will remove the message from your view only.'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button style={styles.deleteBtn} onClick={confirmDeleteAction}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' },
  header: { display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #eee', backgroundColor: '#fff' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#0504AA10', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#0504AA' },
  headerName: { fontSize: 16, fontWeight: 600, color: '#1A1A1A', marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' },
  messagesContainer: { flex: 1, overflowY: 'auto', padding: '16px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' },
  spinner: { width: 36, height: 36, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  retryBtn: { padding: '8px 20px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  messageAvatar: { width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#0504AA10', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 },
  inputArea: { display: 'flex', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid #eee', backgroundColor: '#fff' },
  input: { flex: 1, padding: '10px 16px', borderRadius: 24, border: '1px solid #e0e0e0', outline: 'none', fontSize: 14, backgroundColor: '#f5f5f5' },
  sendBtn: { width: 40, height: 40, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8, flexShrink: 0 },
  previewBar: { display: 'flex', alignItems: 'center', padding: '8px 12px', backgroundColor: '#F5F3FF', borderTop: '1px solid #E0D7FF', gap: 8 },
  previewLabel: { fontSize: 11, fontWeight: 700, color: '#0504AA', marginBottom: 2 },
  previewText: { fontSize: 13, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  previewCloseBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  contextMenu: { position: 'fixed', zIndex: 1000, backgroundColor: '#fff', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: 4, minWidth: 180 },
  contextItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#1A1A1A', textAlign: 'left' },
  confirmOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 },
  confirmDialog: { backgroundColor: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' },
  cancelBtn: { flex: 1, padding: 12, backgroundColor: '#f0f0f0', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  deleteBtn: { flex: 1, padding: 12, backgroundColor: '#DC2626', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
};