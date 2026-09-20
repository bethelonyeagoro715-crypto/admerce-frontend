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
interface ReplyDraft { id: string | number; senderName: string; previewText: string; }
interface EditDraft { id: string | number; originalText: string; }
interface ContextMenuState { messageId: string | number; isMine: boolean; hasText: boolean; isDeleted: boolean; x: number; y: number; }
interface ConfirmDeleteState { messageId: string | number; scope: 'me' | 'all'; }

const BRAND = {
  primary: '#0504AA',
  bubbleMine: '#0504AA',
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
  return `${process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || ''}${url}`;
}
function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function formatDate(iso: string): string {
  try {
    const d = new Date(iso), today = new Date(), yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}
function groupByDate(msgs: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  let last = '';
  for (const m of msgs) {
    const d = m.created_at ? formatDate(m.created_at) : '';
    if (d !== last) { groups.push({ date: d, messages: [m] }); last = d; }
    else groups[groups.length - 1].messages.push(m);
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
  const [toastMsg, setToastMsg] = useState('');

  // ✅ Voice recording — tap to start, tap ✓ to send, ✕ to cancel
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressFired = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<{ id: string | number; time: number } | null>(null);

  const isSeaiConversation = otherUserId.toLowerCase() === 'seai' || conversationId.includes('_seai');
  const hasRecipient = Boolean(otherUserId);
  const displayError = !hasRecipient ? 'Missing recipient. Please open this chat from your inbox.' : error;
  const showLoading = hasRecipient && isLoading;

  useEffect(() => {
    if (isSeaiConversation) { router.replace('/seai/ask'); return; }
    if (!hasRecipient) return;
    const t = setTimeout(async () => {
      try { const p = await api.getMyProfile() as Record<string, unknown>; setCurrentUserId((p.id as string) || null); } catch { }
      setIsLoading(true); setError(null);
      try {
        const d = await api.getMessagesByUser(otherUserId) as { messages?: ChatMessage[] };
        setMessages(d.messages || []);
      } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
      finally { setIsLoading(false); }
    }, 0);
    return () => clearTimeout(t);
  }, [conversationId, otherUserId, isSeaiConversation, hasRecipient, router]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const showToast = (msg: string) => {
    setToastMsg(msg); setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  /* ── Voice recording ── */
  const startRecording = async () => {
    if (!hasRecipient || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
      });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      showToast('Microphone permission denied');
    }
  };

  const stopAndSendVoice = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mediaRecorderRef.current = null;

    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      try { mr.stop(); } catch { resolve(); }
      mr.stream.getTracks().forEach((t) => t.stop());
    });

    setIsRecording(false);

    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];
    if (chunks.length === 0) return;

    const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
    const ext = mr.mimeType?.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });

    setSendingVoice(true);
    try {
      const replyId = replyDraft ? Number(replyDraft.id) : undefined;
      const result = await api.sendVoiceNote(otherUserId, file, replyId) as {
        id?: string | number; audio_url?: string; created_at?: string; reply_to_id?: number | null;
      };
      setMessages((prev) => [...prev, {
        id: result.id || Date.now(),
        sender_id: currentUserId || 'me',
        receiver_id: otherUserId,
        audio_url: result.audio_url,
        created_at: result.created_at || new Date().toISOString(),
        reply_to_id: result.reply_to_id ?? null,
        reply_to_text: replyDraft?.previewText ?? null,
        reply_to_sender_name: replyDraft?.senderName ?? null,
      }]);
      setReplyDraft(null);
      showToast('Voice note sent');
    } catch {
      showToast('Failed to send voice note');
    } finally {
      setSendingVoice(false);
      setRecordSeconds(0);
    }
  }, [currentUserId, otherUserId, replyDraft]);

  const cancelRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr) {
      mediaRecorderRef.current = null;
      try { mr.stop(); } catch { /* ignore */ }
      mr.stream.getTracks().forEach((t) => t.stop());
    }
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordSeconds(0);
  };

  /* ── Send text / save edit ── */
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    if (!hasRecipient) { alert('Cannot send: missing recipient.'); return; }

    if (editDraft) {
      setSending(true);
      try {
        const result = await api.editMessage(editDraft.id, text) as { text: string; edited_at: string };
        setMessages((prev) => prev.map((m) => m.id === editDraft.id ? { ...m, text: result.text, edited_at: result.edited_at } : m));
        setEditDraft(null); setInputText('');
        showToast('Message edited');
      } catch (e: unknown) { showToast('Failed to edit: ' + (e instanceof Error ? e.message : '')); }
      finally { setSending(false); }
      return;
    }

    setSending(true);
    try {
      const replyId = replyDraft ? Number(replyDraft.id) : undefined;
      const result = await api.sendMessage(otherUserId, text, replyId) as { id?: string | number; created_at?: string; reply_to_id?: number | null };
      setMessages((prev) => [...prev, {
        id: result.id || Date.now(),
        sender_id: currentUserId || 'me',
        receiver_id: otherUserId,
        text,
        created_at: result.created_at || new Date().toISOString(),
        reply_to_id: result.reply_to_id ?? null,
        reply_to_text: replyDraft?.previewText ?? null,
        reply_to_sender_name: replyDraft?.senderName ?? null,
        reply_to_deleted: false,
      }]);
      setInputText(''); setReplyDraft(null);
    } catch { showToast('Failed to send'); }
    finally { setSending(false); }
  };

  /* ── Double tap to reply ── */
  const handleDoubleTap = useCallback((msg: ChatMessage) => {
    if (msg.deleted_for_everyone) return;
    const senderName = msg.sender_id === currentUserId ? 'You' : otherUserName;
    let previewText = msg.text || '';
    if (!previewText && msg.audio_url) previewText = '🎤 Voice note';
    if (!previewText && msg.image_url) previewText = '📷 Photo';
    setReplyDraft({ id: msg.id!, senderName, previewText });
    setEditDraft(null); setInputText('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [currentUserId, otherUserName, setReplyDraft, setEditDraft, setInputText]);

  const handleBubbleTap = useCallback((msg: ChatMessage) => {
    if (msg.deleted_for_everyone) return;
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === msg.id && now - lastTapRef.current.time < DOUBLE_TAP_MS) {
      lastTapRef.current = null; handleDoubleTap(msg);
    } else { lastTapRef.current = { id: msg.id!, time: now }; }
  }, [handleDoubleTap]);

  /* ── Context menu ── */
  const openContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: ChatMessage) => {
    e.preventDefault(); e.stopPropagation();
    let x = 0, y = 0;
    if ('touches' in e && e.touches.length > 0) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    else if ('changedTouches' in e && e.changedTouches.length > 0) { x = e.changedTouches[0].clientX; y = e.changedTouches[0].clientY; }
    else if ('clientX' in e) { x = (e as React.MouseEvent).clientX; y = (e as React.MouseEvent).clientY; }
    const isMine = msg.sender_id === currentUserId;
    const isDeleted = !!msg.deleted_for_everyone;
    setContextMenu({ messageId: msg.id!, isMine, hasText: Boolean(msg.text) && !isDeleted, isDeleted, x, y });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: ChatMessage) => {
    if (msg.deleted_for_everyone) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true; longPressTimer.current = null;
      openContextMenu(e, msg);
    }, LONG_PRESS_MS);
  };
  const handleTouchMove = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const handleTouchEnd = (e: React.TouchEvent, msg: ChatMessage) => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (!longPressFired.current) handleBubbleTap(msg);
    longPressFired.current = false;
  };

  /* ── Context actions ── */
  const handleReply = () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.messageId);
    if (msg) handleDoubleTap(msg);
    setContextMenu(null);
  };

  const handleCopy = async () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.messageId);
    setContextMenu(null);
    if (!msg?.text) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(msg.text);
      else {
        const el = document.createElement('textarea');
        el.value = msg.text; el.style.position = 'fixed'; el.style.opacity = '0';
        document.body.appendChild(el); el.select();
        try { document.execCommand('copy'); } catch { }
        document.body.removeChild(el);
      }
      showToast('Text copied to clipboard');
    } catch { showToast('Could not copy'); }
  };

  const handleEdit = () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.messageId);
    if (!msg) return;
    setEditDraft({ id: contextMenu.messageId, originalText: msg.text || '' });
    setInputText(msg.text || ''); setReplyDraft(null); setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const requestDeleteMe = () => { if (!contextMenu) return; setConfirmDelete({ messageId: contextMenu.messageId, scope: 'me' }); setContextMenu(null); };
  const requestDeleteAll = () => { if (!contextMenu) return; setConfirmDelete({ messageId: contextMenu.messageId, scope: 'all' }); setContextMenu(null); };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    const { messageId, scope } = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.deleteMessage(messageId, scope);
      if (scope === 'all') {
        setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, text: null, image_url: null, audio_url: null, deleted_for_everyone: true } : m));
        showToast('Deleted for everyone');
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        showToast('Message deleted');
      }
    } catch { showToast('Failed to delete'); }
  };

  const startCall = (video: boolean) => {
    if (!hasRecipient) return;
    const qs = new URLSearchParams({ video: video ? '1' : '0', name: otherUserName });
    if (otherUserAvatar) qs.set('avatar', otherUserAvatar);
    router.push(`/chat/${conversationId}/call?${qs}`);
  };

  const groupedMessages = groupByDate(messages);
  const showMicButton = !inputText.trim() && !editDraft;

  if (isSeaiConversation) return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: BRAND.bg }}>
      <p style={{ color: '#555' }}>Redirecting to SEAI…</p>
    </main>
  );

  return (
    <main style={s.root}>

      {/* ── Header ── */}
      <div style={s.header}>
        <button style={s.iconBtn} onClick={() => router.back()}><MdArrowBack size={24} color="#fff" /></button>
        <div style={s.avatarWrap}>
          {otherUserAvatar
            ? <img src={resolveImageUrl(otherUserAvatar) || ''} alt="" style={s.avatarImg} />
            : <span style={s.avatarInitial}>{otherUserName.charAt(0).toUpperCase()}</span>}
        </div>
        <div style={s.headerInfo}>
          <span style={s.headerName}>{otherUserName}</span>
          <span style={s.headerStatus}>online</span>
        </div>
        <div style={{ flex: 1 }} />
        <button style={s.iconBtn} onClick={() => startCall(false)}><MdPhone size={22} color="#fff" /></button>
        <button style={s.iconBtn} onClick={() => startCall(true)}><MdVideocam size={22} color="#fff" /></button>
        <button style={s.iconBtn}><MdMoreVert size={22} color="#fff" /></button>
      </div>

      <div style={s.wallpaper} />

      {/* ── Messages ── */}
      <div ref={scrollContainerRef} style={s.messages}>
        {showLoading ? (
          <div style={s.center}><div style={s.spinner} /></div>
        ) : displayError ? (
          <div style={s.center}>
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p style={{ color: '#555', margin: '8px 0 16px', textAlign: 'center' }}>{displayError}</p>
            <button onClick={() => window.location.reload()} style={s.retryBtn}>Retry</button>
          </div>
        ) : messages.length === 0 ? (
          <div style={s.center}>
            <MdChatBubbleOutline size={48} color="#ccc" />
            <p style={{ color: '#888', marginTop: 8 }}>No messages yet</p>
            <p style={{ color: '#aaa', fontSize: 12 }}>Double-tap a bubble to reply</p>
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
                    <div key={msg.id ?? idx} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 2, paddingLeft: isMine ? 60 : 0, paddingRight: isMine ? 0 : 60 }}>
                      <div
                        style={{ ...s.bubble, backgroundColor: isMine ? BRAND.bubbleMine : BRAND.bubbleTheirs, color: isMine ? '#fff' : '#111', borderTopLeftRadius: isMine ? 16 : 4, borderTopRightRadius: isMine ? 4 : 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
                        onClick={() => handleBubbleTap(msg)}
                        onDoubleClick={() => handleDoubleTap(msg)}
                        onContextMenu={(e) => !isDeleted && openContextMenu(e, msg)}
                        onTouchStart={(e) => handleTouchStart(e, msg)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={(e) => handleTouchEnd(e, msg)}
                        onTouchCancel={handleTouchMove}
                      >
                        {msg.reply_to_id && (
                          <div style={{ ...s.replyQuote, backgroundColor: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(5,4,170,0.06)', borderLeftColor: isMine ? '#fff' : BRAND.primary }}>
                            <div style={{ ...s.replyQuoteName, color: isMine ? '#fff' : BRAND.primary }}>{msg.reply_to_sender_name || 'Reply'}</div>
                            <div style={{ fontSize: 12, color: isMine ? 'rgba(255,255,255,0.85)' : '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {msg.reply_to_deleted ? 'This message was deleted' : (msg.reply_to_text || '').slice(0, 80)}
                            </div>
                          </div>
                        )}
                        {isDeleted ? (
                          <div style={{ ...s.deletedText, color: isMine ? 'rgba(255,255,255,0.65)' : '#999' }}>
                            <MdClose size={14} style={{ marginRight: 4 }} />
                            {isMine ? 'You deleted this message' : 'This message was deleted'}
                          </div>
                        ) : (
                          <>
                            {msg.audio_url && (
                              <audio controls src={resolveImageUrl(msg.audio_url) || undefined} style={{ width: 220, marginBottom: msg.text ? 4 : 0, display: 'block' }} />
                            )}
                            {msg.image_url && (
                              <img src={resolveImageUrl(msg.image_url) || ''} alt="" style={{ maxWidth: 220, borderRadius: 8, marginBottom: msg.text ? 4 : 0, display: 'block' }} />
                            )}
                            {msg.text && <div style={{ ...s.msgText, color: isMine ? '#fff' : '#111' }}>{msg.text}</div>}
                          </>
                        )}
                        <div style={s.metaRow}>
                          {msg.edited_at && !isDeleted && <span style={{ ...s.editedLabel, color: isMine ? 'rgba(255,255,255,0.65)' : BRAND.muted }}>edited</span>}
                          <span style={{ ...s.timeText, color: isMine ? 'rgba(255,255,255,0.65)' : BRAND.muted }}>{time}</span>
                          {isMine && !isDeleted && <MdDoneAll size={14} color="rgba(255,255,255,0.85)" style={{ marginLeft: 2 }} />}
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

      {/* ── Reply / Edit bar ── */}
      {(replyDraft || editDraft) && (
        <div style={s.previewBar}>
          <div style={{ width: 4, borderRadius: 2, backgroundColor: BRAND.primary, alignSelf: 'stretch', marginRight: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.previewLabel}>
              {editDraft ? <><MdEdit size={13} style={{ marginRight: 4 }} />Editing message</> : <><MdReply size={13} style={{ marginRight: 4 }} />Replying to {replyDraft?.senderName}</>}
            </div>
            <div style={s.previewText}>{editDraft ? editDraft.originalText : replyDraft?.previewText}</div>
          </div>
          <button style={s.previewClose} onClick={() => { setReplyDraft(null); setEditDraft(null); setInputText(''); }}>
            <MdClose size={20} color="#666" />
          </button>
        </div>
      )}

      {/* ── Recording bar (replaces input bar while recording) ── */}
      {isRecording && (
        <div style={s.recordingBar}>
          <button style={s.recordCancelBtn} onClick={cancelRecording} title="Cancel recording">
            <MdDelete size={22} color={BRAND.danger} />
          </button>
          <div style={s.recordingPulse} />
          <span style={s.recordingTime}>{formatDuration(recordSeconds)}</span>
          <span style={s.recordingHint}>Tap ✓ to send</span>
          <div style={{ flex: 1 }} />
          <button
            style={{ ...s.sendCircle, backgroundColor: sendingVoice ? '#aaa' : BRAND.primary }}
            onClick={stopAndSendVoice}
            disabled={sendingVoice}
            title="Send voice note"
          >
            {sendingVoice
              ? <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <MdCheck size={22} color="#fff" />}
          </button>
        </div>
      )}

      {/* ── Input bar ── */}
      {!isRecording && (
        <div style={s.inputBar}>
          <div style={s.inputRow}>
            <button style={s.inputIcon}><MdEmojiEmotions size={24} color={BRAND.muted} /></button>
            <input
              ref={inputRef}
              type="text"
              placeholder={editDraft ? 'Edit message…' : 'Type a message'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                if (e.key === 'Escape') { setReplyDraft(null); setEditDraft(null); setInputText(''); }
              }}
              style={s.input}
              disabled={!hasRecipient}
            />
            {!inputText.trim() && !editDraft && (
              <button style={s.inputIcon}><MdAttachFile size={24} color={BRAND.muted} /></button>
            )}
          </div>

          {showMicButton ? (
            /* ✅ FIX: simple tap to start recording. No unmount race. */
            <button
              style={{ ...s.sendCircle, backgroundColor: sendingVoice ? '#aaa' : BRAND.primary }}
              onClick={startRecording}
              disabled={!hasRecipient || sendingVoice}
              title="Tap to record voice note"
            >
              <MdMic size={22} color="#fff" />
            </button>
          ) : (
            <button
              style={{ ...s.sendCircle, backgroundColor: inputText.trim() ? BRAND.primary : '#ccc' }}
              onClick={sendMessage}
              disabled={!inputText.trim() || sending || !hasRecipient}
              title={editDraft ? 'Save edit' : 'Send'}
            >
              {sending
                ? <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                : editDraft ? <MdCheck size={22} color="#fff" /> : <MdSend size={22} color="#fff" />}
            </button>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {copyToast && (
        <div style={s.toast}>
          <MdCheck size={16} color="#fff" style={{ marginRight: 6 }} />
          {toastMsg}
        </div>
      )}

      {/* ── Context menu ── */}
      {contextMenu && (
        <>
          <div style={s.ctxBackdrop} onClick={() => setContextMenu(null)} onTouchStart={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            style={{ ...s.ctxMenu, left: Math.max(8, Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 360) - 200)), top: Math.max(8, Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 640) - 300)) }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button style={s.ctxItem} onClick={handleReply} onTouchEnd={handleReply}><MdReply size={18} color={BRAND.primary} /><span>Reply</span></button>
            {contextMenu.hasText && <button style={s.ctxItem} onClick={handleCopy} onTouchEnd={handleCopy}><MdContentCopy size={18} color={BRAND.muted} /><span>Copy</span></button>}
            {contextMenu.isMine && contextMenu.hasText && <button style={s.ctxItem} onClick={handleEdit} onTouchEnd={handleEdit}><MdEdit size={18} color={BRAND.muted} /><span>Edit</span></button>}
            {contextMenu.isMine && <button style={{ ...s.ctxItem, color: BRAND.danger }} onClick={requestDeleteAll} onTouchEnd={requestDeleteAll}><MdDelete size={18} color={BRAND.danger} /><span>Delete for everyone</span></button>}
            <button style={{ ...s.ctxItem, color: BRAND.danger }} onClick={requestDeleteMe} onTouchEnd={requestDeleteMe}><MdDelete size={18} color={BRAND.danger} /><span>Delete for me</span></button>
          </div>
        </>
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <div style={s.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={s.dialogTitle}>Delete message?</div>
            <div style={s.dialogBody}>{confirmDelete.scope === 'all' ? 'This will delete the message for everyone. This cannot be undone.' : 'This will remove the message from your view only.'}</div>
            <div style={s.dialogActions}>
              <button style={s.cancelBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button style={s.deleteBtn} onClick={confirmDeleteAction}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </main>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: BRAND.bg, position: 'relative', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', padding: '8px 6px 8px 4px', backgroundColor: BRAND.primary, zIndex: 10, gap: 2 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', borderRadius: '50%' },
  avatarWrap: { width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ffffff30', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginLeft: 4, flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: 16, fontWeight: 700, color: '#fff' },
  headerInfo: { display: 'flex', flexDirection: 'column', marginLeft: 8 },
  headerName: { fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.2 },
  headerStatus: { fontSize: 12, color: BRAND.statusText },
  wallpaper: { position: 'absolute', inset: 0, top: 58, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='1' fill='%230504AA' opacity='0.06'/%3E%3C/svg%3E")`, pointerEvents: 'none', zIndex: 0 },
  messages: { flex: 1, overflowY: 'auto', padding: '8px 12px', position: 'relative', zIndex: 1 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' },
  spinner: { width: 36, height: 36, border: '4px solid #ddd', borderTopColor: BRAND.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  retryBtn: { padding: '8px 20px', backgroundColor: BRAND.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  datePill: { display: 'flex', justifyContent: 'center', margin: '12px 0 6px' },
  datePillText: { backgroundColor: BRAND.datePill, color: '#333', fontSize: 12, fontWeight: 500, padding: '3px 12px', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' },
  bubble: { maxWidth: '100%', padding: '6px 10px 4px', boxShadow: '0 1px 2px rgba(5,4,170,0.12)', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'pan-y' },
  replyQuote: { borderLeftWidth: 4, borderLeftStyle: 'solid', paddingLeft: 8, marginBottom: 6, borderRadius: 4, padding: '4px 8px' },
  replyQuoteName: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  deletedText: { fontStyle: 'italic', fontSize: 14, display: 'flex', alignItems: 'center' },
  msgText: { fontSize: 14.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 },
  metaRow: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 },
  editedLabel: { fontSize: 10, fontStyle: 'italic' },
  timeText: { fontSize: 11 },
  previewBar: { display: 'flex', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fff', borderTop: '1px solid #E0E0E0', gap: 0, zIndex: 2 },
  previewLabel: { fontSize: 12, fontWeight: 700, color: BRAND.primary, marginBottom: 2, display: 'flex', alignItems: 'center' },
  previewText: { fontSize: 13, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  previewClose: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, marginLeft: 8 },
  recordingBar: { display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 10, backgroundColor: '#fff', borderTop: '2px solid #fee2e2', zIndex: 2 },
  recordCancelBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%' },
  recordingPulse: { width: 10, height: 10, borderRadius: '50%', backgroundColor: BRAND.danger, animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 },
  recordingTime: { fontSize: 16, fontWeight: 700, color: BRAND.danger, fontVariantNumeric: 'tabular-nums', minWidth: 40 },
  recordingHint: { fontSize: 13, color: '#888' },
  inputBar: { display: 'flex', alignItems: 'center', padding: '6px 8px', gap: 8, backgroundColor: '#F0F0F5', zIndex: 2 },
  inputRow: { flex: 1, display: 'flex', alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, padding: '4px', boxShadow: '0 1px 3px rgba(5,4,170,0.08)' },
  inputIcon: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  input: { flex: 1, border: 'none', outline: 'none', fontSize: 15, backgroundColor: 'transparent', padding: '6px 4px', color: '#111' },
  sendCircle: { width: 46, height: 46, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 6px rgba(5,4,170,0.3)' },
  toast: { position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#222', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' },
  ctxBackdrop: { position: 'fixed', inset: 0, backgroundColor: 'transparent', zIndex: 999 },
  ctxMenu: { position: 'fixed', zIndex: 1000, backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 6px 24px rgba(5,4,170,0.18)', padding: '4px 0', minWidth: 190 },
  ctxItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer', fontSize: 14.5, color: '#1A1A1A', textAlign: 'left' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 },
  dialog: { backgroundColor: '#fff', borderRadius: 12, padding: '24px 20px', maxWidth: 320, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' },
  dialogTitle: { fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#111' },
  dialogBody: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.5 },
  dialogActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: { padding: '10px 20px', backgroundColor: 'transparent', color: BRAND.primary, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  deleteBtn: { padding: '10px 20px', backgroundColor: BRAND.danger, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
};