'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import api from '../../../services/api';
import {
  MdArrowBack,
  MdPhone,
  MdVideocam,
  MdMoreVert,
  MdSend,
  MdMic,
  MdErrorOutline,
  MdChatBubbleOutline,
  MdReply,
  MdContentCopy,
  MdEdit,
  MdDelete,
  MdClose,
  MdCheck,
  MdAttachFile,
  MdEmojiEmotions,
  MdDoneAll,
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

const BRAND = {
  primary: '#0504AA',
  primaryDark: '#03037A',
  bubbleMine: '#0504AA',       // ✅ sender bubble = full primary brand blue
  bubbleTheirs: '#FFFFFF',
  bg: '#EEF0FF',
  datePill: '#E4E3FF',
  statusText: '#C7C6F5',
  muted: '#8696A0',
  danger: '#DC2626',
};

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

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const date = msg.created_at ? formatDate(msg.created_at) : '';
    if (date !== lastDate) {
      groups.push({ date, messages: [msg] });
      lastDate = date;
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

const DOUBLE_TAP_MS = 300;
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
  const [copyToast, setCopyToast] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<{ id: string | number; time: number } | null>(null);

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
      } catch { }

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

  const handleDoubleTap = useCallback(
    (msg: ChatMessage) => {
      if (msg.deleted_for_everyone) return;
      const senderName = msg.sender_id === currentUserId ? 'You' : otherUserName;
      let previewText = msg.text || '';
      if (!previewText && msg.audio_url) previewText = 'Voice note';
      if (!previewText && msg.image_url) previewText = 'Photo';
      setReplyDraft({ id: msg.id!, senderName, previewText });
      setEditDraft(null);
      setInputText('');
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [currentUserId, otherUserName, setReplyDraft, setEditDraft, setInputText],
  );

  const handleBubbleTap = useCallback(
    (msg: ChatMessage) => {
      if (msg.deleted_for_everyone) return;
      const now = Date.now();
      if (
        lastTapRef.current &&
        lastTapRef.current.id === msg.id &&
        now - lastTapRef.current.time < DOUBLE_TAP_MS
      ) {
        lastTapRef.current = null;
        handleDoubleTap(msg);
      } else {
        lastTapRef.current = { id: msg.id!, time: now };
      }
    },
    [handleDoubleTap],
  );

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    if (!hasRecipient) { alert('Cannot send: missing recipient.'); return; }

    if (editDraft) {
      setSending(true);
      try {
        const result = (await api.editMessage(editDraft.id, text)) as {
          text: string; edited_at: string;
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
        id?: string | number; created_at?: string; reply_to_id?: number | null;
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

  const openContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: ChatMessage) => {
    e.preventDefault();
    e.stopPropagation();
    const isMine = msg.sender_id === currentUserId;
    const isDeleted = !!msg.deleted_for_everyone;
    let clientX = 0, clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
    }
    setContextMenu({
      messageId: msg.id!,
      isMine,
      hasText: Boolean(msg.text) && !isDeleted,
      isDeleted,
      x: clientX,
      y: clientY,
    });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: ChatMessage) => {
    if (msg.deleted_for_everyone) return;
    longPressTimer.current = setTimeout(() => { openContextMenu(e, msg); }, LONG_PRESS_MS);
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleTouchEnd = (e: React.TouchEvent, msg: ChatMessage) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      handleBubbleTap(msg);
    }
  };

  const handleReply = () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.messageId);
    if (!msg) return;
    handleDoubleTap(msg);
    setContextMenu(null);
  };

  const handleCopy = async () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.messageId);
    if (!msg?.text) { setContextMenu(null); return; }
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = msg.text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
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
    if (!hasRecipient) { alert('Cannot start a call without a recipient.'); return; }
    const qs = new URLSearchParams();
    qs.set('video', video ? '1' : '0');
    qs.set('name', otherUserName);
    if (otherUserAvatar) qs.set('avatar', otherUserAvatar);
    router.push(`/chat/${conversationId}/call?${qs.toString()}`);
  };

  const groupedMessages = groupMessagesByDate(messages);

  if (isSeaiConversation) {
    return (
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: BRAND.bg }}>
        <p style={{ color: '#555' }}>Redirecting to SEAI...</p>
      </main>
    );
  }

  const showMicButton = !inputText.trim();

  return (
    <main style={s.root}>
      {/* ── Header ─────────────────────────────────── */}
      <div style={s.header}>
        <button style={s.iconBtn} onClick={() => router.back()}>
          <MdArrowBack size={24} color="#fff" />
        </button>
        <div style={s.avatarWrap}>
          {otherUserAvatar ? (
            <img src={resolveImageUrl(otherUserAvatar) || ''} alt="" style={s.avatarImg} />
          ) : (
            <span style={s.avatarInitial}>{otherUserName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div style={s.headerInfo}>
          <span style={s.headerName}>{otherUserName}</span>
          <span style={s.headerStatus}>online</span>
        </div>
        <div style={{ flex: 1 }} />
        <button style={s.iconBtn} onClick={() => startCall(false)} title="Voice call">
          <MdPhone size={22} color="#fff" />
        </button>
        <button style={s.iconBtn} onClick={() => startCall(true)} title="Video call">
          <MdVideocam size={22} color="#fff" />
        </button>
        <button style={s.iconBtn} title="More">
          <MdMoreVert size={22} color="#fff" />
        </button>
      </div>

      <div style={s.wallpaper} />

      {/* ── Messages ───────────────────────────────── */}
      <div ref={scrollContainerRef} style={s.messages}>
        {showLoading ? (
          <div style={s.center}><div style={s.spinner} /></div>
        ) : displayError ? (
          <div style={s.center}>
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p style={{ color: '#555', margin: '8px 0 16px', textAlign: 'center' }}>{displayError}</p>
            {hasRecipient ? (
              <button onClick={() => window.location.reload()} style={s.retryBtn}>Retry</button>
            ) : (
              <button onClick={() => router.push('/shopper/inbox')} style={s.retryBtn}>Back to Inbox</button>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div style={s.center}>
            <MdChatBubbleOutline size={48} color="#ccc" />
            <p style={{ color: '#888', marginTop: 8 }}>No messages yet</p>
            <p style={{ color: '#aaa', fontSize: 12 }}>Double-tap a message to reply</p>
          </div>
        ) : (
          <>
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div style={s.datePill}><span style={s.datePillText}>{group.date}</span></div>

                {group.messages.map((msg, idx) => {
                  const isMine = msg.sender_id === currentUserId;
                  const time = msg.created_at ? formatTime(msg.created_at) : '';
                  const isDeleted = !!msg.deleted_for_everyone;

                  return (
                    <div
                      key={msg.id ?? idx}
                      style={{
                        display: 'flex',
                        justifyContent: isMine ? 'flex-end' : 'flex-start',
                        marginBottom: 2,
                        paddingLeft: isMine ? 60 : 0,
                        paddingRight: isMine ? 0 : 60,
                      }}
                    >
                      <div
                        style={{
                          ...s.bubble,
                          backgroundColor: isMine ? BRAND.bubbleMine : BRAND.bubbleTheirs,
                          color: isMine ? '#fff' : '#111',
                          borderTopLeftRadius: isMine ? 16 : 4,
                          borderTopRightRadius: isMine ? 4 : 16,
                          borderBottomLeftRadius: 16,
                          borderBottomRightRadius: 16,
                        }}
                        onClick={() => handleBubbleTap(msg)}
                        onDoubleClick={() => handleDoubleTap(msg)}
                        onContextMenu={(e) => !isDeleted && openContextMenu(e, msg)}
                        onTouchStart={(e) => handleTouchStart(e, msg)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={(e) => handleTouchEnd(e, msg)}
                        onTouchCancel={handleTouchMove}
                      >
                        {msg.reply_to_id && (
                          <div
                            style={{
                              ...s.replyQuote,
                              backgroundColor: isMine
                                ? 'rgba(255,255,255,0.15)'
                                : 'rgba(5,4,170,0.06)',
                              borderLeftColor: isMine ? '#fff' : BRAND.primary,
                            }}
                          >
                            <div
                              style={{
                                ...s.replyQuoteName,
                                color: isMine ? '#fff' : BRAND.primary,
                              }}
                            >
                              {msg.reply_to_sender_name || 'Reply'}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: isMine ? 'rgba(255,255,255,0.85)' : '#555',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {msg.reply_to_deleted ? 'This message was deleted' : (msg.reply_to_text || '').slice(0, 80)}
                            </div>
                          </div>
                        )}

                        {isDeleted ? (
                          <div
                            style={{
                              ...s.deletedText,
                              color: isMine ? 'rgba(255,255,255,0.7)' : '#999',
                            }}
                          >
                            <MdClose size={14} style={{ marginRight: 4 }} />
                            {isMine ? 'You deleted this message' : 'This message was deleted'}
                          </div>
                        ) : (
                          <>
                            {msg.audio_url && (
                              <audio controls src={resolveImageUrl(msg.audio_url) || undefined} style={{ width: 220, marginBottom: msg.text ? 4 : 0 }} />
                            )}
                            {msg.image_url && (
                              <img src={resolveImageUrl(msg.image_url) || ''} alt="" style={{ maxWidth: 220, borderRadius: 8, marginBottom: msg.text ? 4 : 0, display: 'block' }} />
                            )}
                            {msg.text && (
                              <div
                                style={{
                                  ...s.msgText,
                                  color: isMine ? '#fff' : '#111',
                                }}
                              >
                                {msg.text}
                              </div>
                            )}
                          </>
                        )}

                        <div style={s.metaRow}>
                          {msg.edited_at && !isDeleted && (
                            <span
                              style={{
                                ...s.editedLabel,
                                color: isMine ? 'rgba(255,255,255,0.7)' : BRAND.muted,
                              }}
                            >
                              edited
                            </span>
                          )}
                          <span
                            style={{
                              ...s.timeText,
                              color: isMine ? 'rgba(255,255,255,0.7)' : BRAND.muted,
                            }}
                          >
                            {time}
                          </span>
                          {isMine && !isDeleted && (
                            <MdDoneAll size={14} color="rgba(255,255,255,0.9)" style={{ marginLeft: 2 }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} style={{ height: 8 }} />
          </>
        )}
      </div>

      {(replyDraft || editDraft) && (
        <div style={s.previewBar}>
          <div style={{ width: 4, borderRadius: 2, backgroundColor: BRAND.primary, alignSelf: 'stretch', marginRight: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.previewLabel}>
              {editDraft ? (
                <><MdEdit size={13} style={{ marginRight: 4 }} />Editing message</>
              ) : (
                <><MdReply size={13} style={{ marginRight: 4 }} />Replying to {replyDraft?.senderName}</>
              )}
            </div>
            <div style={s.previewText}>
              {editDraft ? editDraft.originalText : replyDraft?.previewText}
            </div>
          </div>
          <button style={s.previewClose} onClick={() => { setReplyDraft(null); setEditDraft(null); setInputText(''); }}>
            <MdClose size={20} color="#666" />
          </button>
        </div>
      )}

      <div style={s.inputBar}>
        <div style={s.inputRow}>
          <button style={s.inputIcon}><MdEmojiEmotions size={24} color={BRAND.muted} /></button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              if (e.key === 'Escape' && (replyDraft || editDraft)) { setReplyDraft(null); setEditDraft(null); setInputText(''); }
            }}
            style={s.input}
            disabled={!hasRecipient}
          />
          <button style={s.inputIcon}><MdAttachFile size={24} color={BRAND.muted} /></button>
        </div>
        <button
          style={{ ...s.sendCircle, backgroundColor: BRAND.primary }}
          onClick={showMicButton ? () => setIsRecording((r) => !r) : sendMessage}
          disabled={!hasRecipient}
          title={showMicButton ? 'Voice note' : (editDraft ? 'Save edit' : 'Send')}
        >
          {showMicButton ? (
            <MdMic size={22} color="#fff" />
          ) : editDraft ? (
            <MdCheck size={22} color="#fff" />
          ) : (
            <MdSend size={22} color="#fff" />
          )}
        </button>
      </div>

      {copyToast && (
        <div style={s.toast}>
          <MdCheck size={16} color="#fff" style={{ marginRight: 6 }} />
          Text copied to clipboard
        </div>
      )}

      {contextMenu && (
        <div
          style={{
            ...s.ctxMenu,
            left: Math.max(8, Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 360) - 200)),
            top: Math.max(8, Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 640) - 300)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button style={s.ctxItem} onClick={handleReply}>
            <MdReply size={18} color={BRAND.primary} /><span>Reply</span>
          </button>
          {contextMenu.hasText && (
            <button style={s.ctxItem} onClick={handleCopy}>
              <MdContentCopy size={18} color={BRAND.muted} /><span>Copy</span>
            </button>
          )}
          {contextMenu.isMine && contextMenu.hasText && (
            <button style={s.ctxItem} onClick={handleEdit}>
              <MdEdit size={18} color={BRAND.muted} /><span>Edit</span>
            </button>
          )}
          {contextMenu.isMine && (
            <button style={{ ...s.ctxItem, color: BRAND.danger }} onClick={requestDeleteAll}>
              <MdDelete size={18} color={BRAND.danger} /><span>Delete for everyone</span>
            </button>
          )}
          <button style={{ ...s.ctxItem, color: BRAND.danger }} onClick={requestDeleteMe}>
            <MdDelete size={18} color={BRAND.danger} /><span>Delete for me</span>
          </button>
        </div>
      )}

      {confirmDelete && (
        <div style={s.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={s.dialogTitle}>Delete message?</div>
            <div style={s.dialogBody}>
              {confirmDelete.scope === 'all'
                ? 'This will delete the message for everyone. This cannot be undone.'
                : 'This will remove the message from your view only.'}
            </div>
            <div style={s.dialogActions}>
              <button style={s.cancelBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button style={s.deleteBtn} onClick={confirmDeleteAction}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    backgroundColor: BRAND.bg,
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 6px 8px 4px',
    backgroundColor: BRAND.primary,
    zIndex: 10,
    gap: 2,
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 8, display: 'flex', alignItems: 'center', borderRadius: '50%',
  },
  avatarWrap: {
    width: 38, height: 38, borderRadius: '50%',
    backgroundColor: '#ffffff30',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginLeft: 4, flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: 16, fontWeight: 700, color: '#fff' },
  headerInfo: { display: 'flex', flexDirection: 'column', marginLeft: 8 },
  headerName: { fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.2 },
  headerStatus: { fontSize: 12, color: BRAND.statusText },

  wallpaper: {
    position: 'absolute', inset: 0, top: 58,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='1' fill='%230504AA' opacity='0.06'/%3E%3C/svg%3E")`,
    pointerEvents: 'none', zIndex: 0,
  },

  messages: {
    flex: 1, overflowY: 'auto', padding: '8px 12px',
    position: 'relative', zIndex: 1,
  },
  center: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#888',
  },
  spinner: {
    width: 36, height: 36, border: '4px solid #ddd',
    borderTopColor: BRAND.primary, borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    padding: '8px 20px', backgroundColor: BRAND.primary, color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
  },

  datePill: {
    display: 'flex', justifyContent: 'center', margin: '12px 0 6px',
  },
  datePillText: {
    backgroundColor: BRAND.datePill,
    color: '#333', fontSize: 12, fontWeight: 500,
    padding: '3px 12px', borderRadius: 12,
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },

  bubble: {
    maxWidth: '100%',
    padding: '6px 10px 4px',
    boxShadow: '0 1px 2px rgba(5,4,170,0.12)',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'pan-y',
  },
  replyQuote: {
    borderLeftWidth: 4, borderLeftStyle: 'solid',
    paddingLeft: 8, marginBottom: 6,
    borderRadius: 4, padding: '4px 8px',
  },
  replyQuoteName: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  deletedText: {
    fontStyle: 'italic', fontSize: 14,
    display: 'flex', alignItems: 'center',
  },
  msgText: { fontSize: 14.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 },
  metaRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: 3, marginTop: 3,
  },
  editedLabel: { fontSize: 10, fontStyle: 'italic' },
  timeText: { fontSize: 11 },

  previewBar: {
    display: 'flex', alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#fff',
    borderTop: '1px solid #E0E0E0',
    gap: 0, zIndex: 2,
  },
  previewLabel: {
    fontSize: 12, fontWeight: 700, color: BRAND.primary,
    marginBottom: 2, display: 'flex', alignItems: 'center',
  },
  previewText: { fontSize: 13, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  previewClose: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, marginLeft: 8 },

  inputBar: {
    display: 'flex', alignItems: 'center',
    padding: '6px 8px', gap: 8,
    backgroundColor: '#F0F0F5', zIndex: 2,
  },
  inputRow: {
    flex: 1, display: 'flex', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 24,
    padding: '4px 4px 4px 4px',
    boxShadow: '0 1px 3px rgba(5,4,170,0.08)',
  },
  inputIcon: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 8px', display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  input: {
    flex: 1, border: 'none', outline: 'none',
    fontSize: 15, backgroundColor: 'transparent',
    padding: '6px 4px', color: '#111',
  },
  sendCircle: {
    width: 46, height: 46, borderRadius: '50%',
    border: 'none', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    boxShadow: '0 2px 6px rgba(5,4,170,0.3)',
  },

  toast: {
    position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
    backgroundColor: '#333', color: '#fff',
    padding: '8px 16px', borderRadius: 20, fontSize: 13,
    display: 'flex', alignItems: 'center',
    zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    whiteSpace: 'nowrap',
  },

  ctxMenu: {
    position: 'fixed', zIndex: 1000,
    backgroundColor: '#fff', borderRadius: 8,
    boxShadow: '0 6px 24px rgba(5,4,170,0.18)',
    padding: '4px 0', minWidth: 190,
  },
  ctxItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', padding: '12px 16px',
    background: 'none', border: 'none', borderRadius: 0,
    cursor: 'pointer', fontSize: 14.5, color: '#1A1A1A', textAlign: 'left',
  },

  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: 20,
  },
  dialog: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: '24px 20px', maxWidth: 320, width: '100%',
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  },
  dialogTitle: { fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#111' },
  dialogBody: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.5 },
  dialogActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '10px 20px', backgroundColor: 'transparent',
    color: BRAND.primary, border: 'none', borderRadius: 8,
    cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
  deleteBtn: {
    padding: '10px 20px', backgroundColor: BRAND.danger,
    color: '#fff', border: 'none', borderRadius: 8,
    cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
};