'use client';

import {
  Suspense,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
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
  MdDoneAll,
  MdKeyboardArrowDown as MdChevronDown,
  MdLink,
  MdRefresh,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
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
interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

// ─── Brand ──────────────────────────────────────────────────────────
const BRAND = {
  primary: '#0504AA',
  bubbleMine: '#0504AA',
  bubbleTheirs: '#FFFFFF',
  bg: '#EEF0FF',
  datePill: '#E4E3FF',
  statusText: 'rgba(255,255,255,0.62)',
  muted: '#8696A0',
  danger: '#DC2626',
};

const DOUBLE_TAP_MS = 300;
const LONG_PRESS_MS = 500;
const AT_BOTTOM_THRESHOLD_PX = 80;
const MAX_TOASTS = 3;

// ─── Helpers ────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) {
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

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function groupByDate(msgs: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  let last = '';
  for (const m of msgs) {
    const d = m.created_at ? formatDate(m.created_at) : '';
    if (d !== last) {
      groups.push({ date: d, messages: [m] });
      last = d;
    } else {
      groups[groups.length - 1].messages.push(m);
    }
  }
  return groups;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
    } catch {
      /* ignore */
    }
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
}

// ─── Toast ──────────────────────────────────────────────────────────
function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  const c =
    toast.kind === 'success'
      ? { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', icon: '#16A34A' }
      : toast.kind === 'error'
      ? { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '#DC2626' }
      : { bg: '#0B0B1A', border: '#0B0B1A', text: '#fff', icon: '#fff' };

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(11,11,26,0.18)',
        animation: 'chatToastIn 0.2s ease',
        pointerEvents: 'auto',
      }}
    >
      {toast.kind === 'success' && <MdCheck size={16} color={c.icon} />}
      {toast.kind === 'error' && <MdErrorOutline size={16} color={c.icon} />}
      <span>{toast.text}</span>
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────
function ChatSkeleton() {
  const bubble = (mine: boolean, w: number) => (
    <div
      key={`${mine}-${w}`}
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        width: `${w}%`,
        height: 44,
        marginBottom: 8,
        borderRadius: 16,
        background: mine
          ? 'linear-gradient(90deg, #DDE2FF 0%, #EEF0FF 50%, #DDE2FF 100%)'
          : 'linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%)',
        backgroundSize: '400px 100%',
        animation: 'chatShimmer 1.4s infinite linear',
      }}
    />
  );

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: BRAND.bg,
      }}
    >
      <div
        style={{
          height: 58,
          background: BRAND.primary,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            animation: 'chatShimmer 1.4s infinite linear',
          }}
        />
      </div>
      <div
        style={{
          flex: 1,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {bubble(false, 55)}
        {bubble(true, 45)}
        {bubble(true, 60)}
        {bubble(false, 70)}
        {bubble(true, 50)}
        {bubble(false, 40)}
      </div>
    </main>
  );
}

// ─── Content ────────────────────────────────────────────────────────
function ChatContent() {
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

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hasNewWhileScrolled, setHasNewWhileScrolled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const otherUserIdRef = useRef(otherUserId);
  useEffect(() => {
    otherUserIdRef.current = otherUserId;
  }, [otherUserId]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<{ id: string | number; time: number } | null>(
    null,
  );
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  const isSeaiConversation =
    otherUserId.toLowerCase() === 'seai' || conversationId.includes('_seai');
  const hasRecipient = Boolean(otherUserId);
  const displayError = !hasRecipient
    ? 'Missing recipient. Please open this chat from your inbox.'
    : error;
  const showLoading = hasRecipient && isLoading;

  // ── Toasts ──────────────────────────────────────────────────────
  const showToast = useCallback(
    (kind: ToastMessage['kind'], text: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => {
        const next = [...prev, { id, kind, text }];
        return next.slice(-MAX_TOASTS);
      });
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Fetch messages ──────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    const recipientId = otherUserIdRef.current;
    if (!recipientId) return;
    setIsLoading(true);
    setError(null);
    try {
      const d = (await api.getMessagesByUser(recipientId)) as {
        messages?: ChatMessage[];
      };
      setMessages(d.messages || []);
    } catch (e) {
      setError(extractErrorDetail(e, 'Failed to load messages'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSeaiConversation) {
      router.replace('/seai/ask');
      return;
    }
    if (!hasRecipient) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const p = (await api.getMyProfile()) as Record<string, unknown>;
        if (!cancelled) setCurrentUserId((p.id as string) || null);
      } catch {
        /* ignore */
      }
      if (!cancelled) await loadMessages();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [conversationId, otherUserId, isSeaiConversation, hasRecipient, router, loadMessages]);

  // ── Auto-scroll when at bottom; jump pill otherwise ─────────────
  useEffect(() => {
    const count = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = count;

    if (count === 0) return;
    if (count === prevCount) return;

    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setHasNewWhileScrolled(true);
    }
  }, [messages.length]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <
      AT_BOTTOM_THRESHOLD_PX;
    isAtBottomRef.current = atBottom;
    if (atBottom) setHasNewWhileScrolled(false);
  };

  const scrollToBottom = () => {
    isAtBottomRef.current = true;
    setHasNewWhileScrolled(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Voice recording ─────────────────────────────────────────────
  const startRecording = async () => {
    if (!hasRecipient || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg',
      });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(
        () => setRecordSeconds((s) => s + 1),
        1000,
      );
    } catch {
      showToast('error', 'Microphone permission denied');
    }
  };

  const stopAndSendVoice = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mediaRecorderRef.current = null;

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      try {
        mr.stop();
      } catch {
        resolve();
      }
      mr.stream.getTracks().forEach((t) => t.stop());
    });

    setIsRecording(false);

    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];
    if (chunks.length === 0) return;

    const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
    const ext = mr.mimeType?.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice-${Date.now()}.${ext}`, {
      type: blob.type,
    });

    setSendingVoice(true);
    try {
      const replyId = replyDraft ? Number(replyDraft.id) : undefined;
      const result = (await api.sendVoiceNote(
        otherUserId,
        file,
        replyId,
      )) as {
        id?: string | number;
        audio_url?: string;
        created_at?: string;
        reply_to_id?: number | null;
      };
      isAtBottomRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: result.id || Date.now(),
          sender_id: currentUserId || 'me',
          receiver_id: otherUserId,
          audio_url: result.audio_url,
          created_at: result.created_at || new Date().toISOString(),
          reply_to_id: result.reply_to_id ?? null,
          reply_to_text: replyDraft?.previewText ?? null,
          reply_to_sender_name: replyDraft?.senderName ?? null,
        },
      ]);
      setReplyDraft(null);
      showToast('success', 'Voice note sent');
    } catch (e) {
      showToast(
        'error',
        extractErrorDetail(e, 'Failed to send voice note'),
      );
    } finally {
      setSendingVoice(false);
      setRecordSeconds(0);
    }
  }, [currentUserId, otherUserId, replyDraft, setReplyDraft, showToast]);

  const cancelRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr) {
      mediaRecorderRef.current = null;
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
      mr.stream.getTracks().forEach((t) => t.stop());
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordSeconds(0);
  };

  // ── Send / edit ─────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    if (!hasRecipient) {
      showToast('error', 'Cannot send: missing recipient');
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
        showToast('success', 'Message edited');
      } catch (e) {
        const msg = extractErrorDetail(e, '');
        if (msg.includes('403') || msg.toLowerCase().includes('window')) {
          showToast('error', 'Edit window closed — message is too old');
        } else {
          showToast('error', 'Failed to edit');
        }
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      const replyId = replyDraft ? Number(replyDraft.id) : undefined;
      const result = (await api.sendMessage(
        otherUserId,
        text,
        replyId,
      )) as {
        id?: string | number;
        created_at?: string;
        reply_to_id?: number | null;
      };
      isAtBottomRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: result.id || Date.now(),
          sender_id: currentUserId || 'me',
          receiver_id: otherUserId,
          text,
          created_at: result.created_at || new Date().toISOString(),
          reply_to_id: result.reply_to_id ?? null,
          reply_to_text: replyDraft?.previewText ?? null,
          reply_to_sender_name: replyDraft?.senderName ?? null,
          reply_to_deleted: false,
        },
      ]);
      setInputText('');
      setReplyDraft(null);
    } catch (e) {
      showToast('error', extractErrorDetail(e, 'Failed to send'));
    } finally {
      setSending(false);
    }
  };

  // ── Reply / edit drafts ────────────────────────────────────────
  const handleDoubleTap = useCallback(
    (msg: ChatMessage) => {
      if (msg.deleted_for_everyone) return;
      const senderName = msg.sender_id === currentUserId ? 'You' : otherUserName;
      let previewText = msg.text || '';
      if (!previewText && msg.audio_url) previewText = '🎤 Voice note';
      if (!previewText && msg.image_url) previewText = '📷 Photo';
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

  // ── Context menu ────────────────────────────────────────────────
  const openContextMenu = (
    e: React.MouseEvent | React.TouchEvent,
    msg: ChatMessage,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    let x = 0,
      y = 0;
    if ('touches' in e && e.touches.length > 0) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      x = e.changedTouches[0].clientX;
      y = e.changedTouches[0].clientY;
    } else if ('clientX' in e) {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }
    const isMine = msg.sender_id === currentUserId;
    const isDeleted = !!msg.deleted_for_everyone;
    setContextMenu({
      messageId: msg.id!,
      isMine,
      hasText: Boolean(msg.text) && !isDeleted,
      isDeleted,
      x,
      y,
    });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: ChatMessage) => {
    if (msg.deleted_for_everyone) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      longPressTimer.current = null;
      openContextMenu(e, msg);
    }, LONG_PRESS_MS);
  };
  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleTouchEnd = (e: React.TouchEvent, msg: ChatMessage) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressFired.current) handleBubbleTap(msg);
    longPressFired.current = false;
  };

  // ── Context menu actions ────────────────────────────────────────
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
    const ok = await copyTextToClipboard(msg.text);
    showToast(ok ? 'success' : 'error', ok ? 'Text copied' : 'Could not copy');
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
              ? {
                  ...m,
                  text: null,
                  image_url: null,
                  audio_url: null,
                  deleted_for_everyone: true,
                }
              : m,
          ),
        );
        showToast('success', 'Deleted for everyone');
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        showToast('success', 'Message deleted');
      }
    } catch (e) {
      showToast('error', extractErrorDetail(e, 'Failed to delete'));
    }
  };

  // ── Header actions ──────────────────────────────────────────────
  const startCall = (video: boolean) => {
    if (!hasRecipient) return;
    // ✅ Honest stub — the call page doesn't exist yet. Route kept in
    //    a comment so the eventual wiring is obvious.
    // router.push(`/chat/${conversationId}/call?video=${video ? '1' : '0'}&name=${encodeURIComponent(otherUserName)}`);
    showToast('info', `${video ? 'Video' : 'Voice'} calls coming soon`);
  };

  const copyChatId = async () => {
    setMenuOpen(false);
    const ok = await copyTextToClipboard(conversationId);
    showToast(
      ok ? 'success' : 'error',
      ok ? 'Chat ID copied' : 'Could not copy',
    );
  };

  // ── Render ──────────────────────────────────────────────────────
  const groupedMessages = useMemo(() => groupByDate(messages), [messages]);
  const showMicButton = !inputText.trim() && !editDraft;

  if (isSeaiConversation) {
    return (
      <main
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: BRAND.bg,
        }}
      >
        <p style={{ color: '#555' }}>Redirecting to SEAI…</p>
      </main>
    );
  }

  return (
    <main style={s.root}>
      {/* Toast stack */}
      {toasts.length > 0 && (
        <div style={s.toastStack}>
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
          ))}
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <button
          style={s.iconBtn}
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <MdArrowBack size={22} color="#fff" />
        </button>

        <div style={s.avatarWrap}>
          {otherUserAvatar ? (
            <img
              src={resolveImageUrl(otherUserAvatar) || ''}
              alt=""
              style={s.avatarImg}
            />
          ) : (
            <span style={s.avatarInitial}>
              {otherUserName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div style={s.headerInfo}>
          <span style={s.headerName} title={otherUserName}>
            {otherUserName}
          </span>
          <span style={s.headerStatus}>Admerce</span>
        </div>

        <div style={{ flex: 1 }} />

        <button
          style={s.iconBtn}
          onClick={() => startCall(false)}
          aria-label="Voice call"
        >
          <MdPhone size={20} color="#fff" />
        </button>
        <button
          style={s.iconBtn}
          onClick={() => startCall(true)}
          aria-label="Video call"
        >
          <MdVideocam size={20} color="#fff" />
        </button>
        <button
          style={s.iconBtn}
          onClick={() => setMenuOpen(true)}
          aria-label="More options"
        >
          <MdMoreVert size={20} color="#fff" />
        </button>
      </div>

      <div style={s.wallpaper} />

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        style={s.messages}
        onScroll={handleScroll}
      >
        {showLoading ? (
          <div style={s.centerInner}>
            <div style={s.spinner} />
          </div>
        ) : displayError ? (
          <div style={s.centerInner}>
            <div style={s.stateIconError} aria-hidden="true">
              <MdErrorOutline size={32} color="#DC2626" />
            </div>
            <p style={s.stateTitle}>Could not load chat</p>
            <p style={s.stateBody}>{displayError}</p>
            <button
              onClick={loadMessages}
              style={s.retryBtn}
              type="button"
            >
              <MdRefresh size={16} color="#fff" />
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div style={s.centerInner}>
            <div style={s.stateIconInfo} aria-hidden="true">
              <MdChatBubbleOutline size={32} color={BRAND.primary} />
            </div>
            <p style={s.stateTitle}>Say hi to {otherUserName}</p>
            <p style={s.stateBody}>
              Double-tap any bubble to reply. Long-press for more options.
            </p>
          </div>
        ) : (
          <>
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div style={s.datePillWrap}>
                  <span style={s.datePillText}>{group.date}</span>
                </div>
                {group.messages.map((msg, idx) => {
                  const isMine = msg.sender_id === currentUserId;
                  const time = msg.created_at
                    ? formatTime(msg.created_at)
                    : '';
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
                          backgroundColor: isMine
                            ? BRAND.bubbleMine
                            : BRAND.bubbleTheirs,
                          color: isMine ? '#fff' : '#111',
                          borderTopLeftRadius: isMine ? 16 : 4,
                          borderTopRightRadius: isMine ? 4 : 16,
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
                                color: isMine
                                  ? 'rgba(255,255,255,0.85)'
                                  : '#555',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {msg.reply_to_deleted
                                ? 'This message was deleted'
                                : (msg.reply_to_text || '').slice(0, 80)}
                            </div>
                          </div>
                        )}

                        {isDeleted ? (
                          <div
                            style={{
                              ...s.deletedText,
                              color: isMine
                                ? 'rgba(255,255,255,0.65)'
                                : '#999',
                            }}
                          >
                            <MdClose size={14} style={{ marginRight: 4 }} />
                            {isMine
                              ? 'You deleted this message'
                              : 'This message was deleted'}
                          </div>
                        ) : (
                          <>
                            {msg.audio_url && (
                              <audio
                                controls
                                src={
                                  resolveImageUrl(msg.audio_url) || undefined
                                }
                                style={{
                                  width: 220,
                                  marginBottom: msg.text ? 4 : 0,
                                  display: 'block',
                                }}
                              />
                            )}
                            {msg.image_url && (
                              <img
                                src={resolveImageUrl(msg.image_url) || ''}
                                alt=""
                                style={{
                                  maxWidth: 220,
                                  borderRadius: 8,
                                  marginBottom: msg.text ? 4 : 0,
                                  display: 'block',
                                }}
                              />
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
                                color: isMine
                                  ? 'rgba(255,255,255,0.65)'
                                  : BRAND.muted,
                              }}
                            >
                              edited
                            </span>
                          )}
                          <span
                            style={{
                              ...s.timeText,
                              color: isMine
                                ? 'rgba(255,255,255,0.7)'
                                : BRAND.muted,
                            }}
                          >
                            {time}
                          </span>
                          {isMine && !isDeleted && (
                            <MdDoneAll
                              size={14}
                              color="rgba(255,255,255,0.85)"
                              style={{ marginLeft: 2 }}
                            />
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

      {/* Jump-to-latest pill */}
      {hasNewWhileScrolled && (
        <button
          type="button"
          onClick={scrollToBottom}
          style={s.jumpPill}
          aria-label="Jump to new messages"
        >
          <MdChevronDown size={16} color="#fff" />
          <span>New messages</span>
        </button>
      )}

      {/* Reply / Edit preview bar */}
      {(replyDraft || editDraft) && (
        <div style={s.previewBar}>
          <div style={s.previewAccent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.previewLabel}>
              {editDraft ? (
                <>
                  <MdEdit size={13} style={{ marginRight: 4 }} />
                  Editing message
                </>
              ) : (
                <>
                  <MdReply size={13} style={{ marginRight: 4 }} />
                  Replying to {replyDraft?.senderName}
                </>
              )}
            </div>
            <div style={s.previewText}>
              {editDraft ? editDraft.originalText : replyDraft?.previewText}
            </div>
          </div>
          <button
            style={s.previewClose}
            onClick={() => {
              setReplyDraft(null);
              setEditDraft(null);
              setInputText('');
            }}
            aria-label="Cancel"
          >
            <MdClose size={20} color="#666" />
          </button>
        </div>
      )}

      {/* Recording bar */}
      {isRecording && (
        <div style={s.recordingBar}>
          <button
            style={s.recordCancelBtn}
            onClick={cancelRecording}
            title="Cancel recording"
            aria-label="Cancel recording"
          >
            <MdDelete size={22} color={BRAND.danger} />
          </button>
          <div style={s.recordingPulse} />
          <span style={s.recordingTime}>{formatDuration(recordSeconds)}</span>
          <span style={s.recordingHint}>Tap ✓ to send</span>
          <div style={{ flex: 1 }} />
          <button
            style={{
              ...s.sendCircle,
              backgroundColor: sendingVoice ? '#94a3b8' : BRAND.primary,
            }}
            onClick={stopAndSendVoice}
            disabled={sendingVoice}
            title="Send voice note"
            aria-label="Send voice note"
          >
            {sendingVoice ? (
              <div style={s.spinnerMini} />
            ) : (
              <MdCheck size={22} color="#fff" />
            )}
          </button>
        </div>
      )}

      {/* Input bar */}
      {!isRecording && (
        <div style={s.inputBar}>
          <div style={s.inputRow}>
            <input
              ref={inputRef}
              type="text"
              placeholder={editDraft ? 'Edit message…' : 'Type a message'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
                if (e.key === 'Escape') {
                  setReplyDraft(null);
                  setEditDraft(null);
                  setInputText('');
                }
              }}
              style={s.input}
              disabled={!hasRecipient}
              aria-label="Message input"
            />
          </div>

          {showMicButton ? (
            <button
              style={{
                ...s.sendCircle,
                backgroundColor: sendingVoice ? '#94a3b8' : BRAND.primary,
              }}
              onClick={startRecording}
              disabled={!hasRecipient || sendingVoice}
              title="Tap to record voice note"
              aria-label="Start voice recording"
            >
              <MdMic size={22} color="#fff" />
            </button>
          ) : (
            <button
              style={{
                ...s.sendCircle,
                backgroundColor: inputText.trim()
                  ? BRAND.primary
                  : '#cbd5e1',
              }}
              onClick={sendMessage}
              disabled={!inputText.trim() || sending || !hasRecipient}
              title={editDraft ? 'Save edit' : 'Send'}
              aria-label={editDraft ? 'Save edit' : 'Send message'}
            >
              {sending ? (
                <div style={s.spinnerMini} />
              ) : editDraft ? (
                <MdCheck size={22} color="#fff" />
              ) : (
                <MdSend size={22} color="#fff" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            style={s.ctxBackdrop}
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{
              ...s.ctxMenu,
              left: Math.max(
                8,
                Math.min(
                  contextMenu.x,
                  (typeof window !== 'undefined' ? window.innerWidth : 360) -
                    210,
                ),
              ),
              top: Math.max(
                8,
                Math.min(
                  contextMenu.y,
                  (typeof window !== 'undefined'
                    ? window.innerHeight
                    : 640) - 320,
                ),
              ),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              style={s.ctxItem}
              onClick={handleReply}
            >
              <MdReply size={18} color={BRAND.primary} />
              <span>Reply</span>
            </button>
            {contextMenu.hasText && (
              <button
                type="button"
                style={s.ctxItem}
                onClick={handleCopy}
              >
                <MdContentCopy size={18} color={BRAND.muted} />
                <span>Copy</span>
              </button>
            )}
            {contextMenu.isMine && contextMenu.hasText && (
              <button
                type="button"
                style={s.ctxItem}
                onClick={handleEdit}
              >
                <MdEdit size={18} color={BRAND.muted} />
                <span>Edit</span>
              </button>
            )}
            {contextMenu.isMine && (
              <button
                type="button"
                style={{ ...s.ctxItem, color: BRAND.danger }}
                onClick={requestDeleteAll}
              >
                <MdDelete size={18} color={BRAND.danger} />
                <span>Delete for everyone</span>
              </button>
            )}
            <button
              type="button"
              style={{ ...s.ctxItem, color: BRAND.danger }}
              onClick={requestDeleteMe}
            >
              <MdDelete size={18} color={BRAND.danger} />
              <span>Delete for me</span>
            </button>
          </div>
        </>
      )}

      {/* Chat actions menu (top-right ⋯) */}
      {menuOpen && (
        <>
          <div
            style={s.ctxBackdrop}
            onClick={() => setMenuOpen(false)}
          />
          <div
            style={{
              ...s.ctxMenu,
              right: 12,
              top: 62,
              left: 'auto',
              minWidth: 200,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              style={s.ctxItem}
              onClick={copyChatId}
            >
              <MdLink size={18} color={BRAND.muted} />
              <span>Copy chat ID</span>
            </button>
          </div>
        </>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div
          style={s.overlay}
          onClick={() => setConfirmDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={s.dialogIcon}>
              <MdDelete size={28} color={BRAND.danger} />
            </div>
            <div style={s.dialogTitle}>Delete message?</div>
            <div style={s.dialogBody}>
              {confirmDelete.scope === 'all'
                ? 'This will delete the message for everyone. This cannot be undone.'
                : 'This will remove the message from your view only.'}
            </div>
            <div style={s.dialogActions}>
              <button
                type="button"
                style={s.cancelBtn}
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={s.deleteBtn}
                onClick={confirmDeleteAction}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{CSS}</style>
    </main>
  );
}

// ─── Suspense wrapper ───────────────────────────────────────────────
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatContent />
    </Suspense>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
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
    padding: '8px 6px',
    backgroundColor: BRAND.primary,
    zIndex: 10,
    gap: 2,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'background 0.15s',
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.20)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginLeft: 4,
    flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: 16, fontWeight: 700, color: '#fff' },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    marginLeft: 10,
    minWidth: 0,
  },
  headerName: {
    fontSize: 15.5,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 180,
  },
  headerStatus: {
    fontSize: 11.5,
    color: BRAND.statusText,
    fontWeight: 600,
    letterSpacing: 0.02,
  },
  wallpaper: {
    position: 'absolute',
    inset: 0,
    top: 54,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='1' fill='%230504AA' opacity='0.06'/%3E%3C/svg%3E")`,
    pointerEvents: 'none',
    zIndex: 0,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
    position: 'relative',
    zIndex: 1,
  },
  centerInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    padding: '0 24px',
    gap: 4,
  },
  stateIconInfo: {
    width: 72,
    height: 72,
    borderRadius: 24,
    background: '#EEF0FF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stateIconError: {
    width: 72,
    height: 72,
    borderRadius: 24,
    background: '#FEF2F2',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#334155',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  stateBody: {
    fontSize: 13.5,
    color: '#64748B',
    margin: '4px 0 0',
    maxWidth: 320,
    lineHeight: 1.55,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #DDE2FF',
    borderTopColor: BRAND.primary,
    borderRadius: '50%',
    animation: 'chatSpin 0.8s linear infinite',
  },
  spinnerMini: {
    width: 18,
    height: 18,
    border: '2px solid rgba(255,255,255,0.45)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'chatSpin 0.7s linear infinite',
  },
  retryBtn: {
    marginTop: 14,
    padding: '10px 20px',
    backgroundColor: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13.5,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'inherit',
  },
  datePillWrap: {
    display: 'flex',
    justifyContent: 'center',
    margin: '12px 0 8px',
  },
  datePillText: {
    backgroundColor: BRAND.datePill,
    color: '#334155',
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 14px',
    borderRadius: 999,
    letterSpacing: 0.02,
  },
  bubble: {
    maxWidth: '100%',
    padding: '6px 10px 4px',
    boxShadow: '0 1px 2px rgba(5,4,170,0.10)',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'pan-y',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  replyQuote: {
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    paddingLeft: 8,
    marginBottom: 6,
    borderRadius: 4,
    padding: '4px 8px',
  },
  replyQuoteName: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  deletedText: {
    fontStyle: 'italic',
    fontSize: 13.5,
    display: 'flex',
    alignItems: 'center',
  },
  msgText: {
    fontSize: 14.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 1.4,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
  },
  editedLabel: { fontSize: 10, fontStyle: 'italic' },
  timeText: { fontSize: 11 },
  jumpPill: {
    position: 'absolute',
    bottom: 90,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 16px',
    borderRadius: 999,
    backgroundColor: BRAND.primary,
    color: '#fff',
    border: 'none',
    fontWeight: 700,
    fontSize: 12.5,
    cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(5,4,170,0.35)',
    zIndex: 5,
    animation: 'chatToastIn 0.2s ease',
    fontFamily: 'inherit',
  },
  previewBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#fff',
    borderTop: '1px solid #E2E8F0',
    gap: 0,
    zIndex: 2,
  },
  previewAccent: {
    width: 4,
    borderRadius: 2,
    backgroundColor: BRAND.primary,
    alignSelf: 'stretch',
    marginRight: 10,
    flexShrink: 0,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: BRAND.primary,
    marginBottom: 2,
    display: 'flex',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 13,
    color: '#475569',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  previewClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    marginLeft: 8,
  },
  recordingBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    gap: 10,
    backgroundColor: '#fff',
    borderTop: '2px solid #FEE2E2',
    zIndex: 2,
  },
  recordCancelBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
    borderRadius: '50%',
  },
  recordingPulse: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: BRAND.danger,
    animation: 'chatPulse 1s ease-in-out infinite',
    flexShrink: 0,
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: 700,
    color: BRAND.danger,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 40,
  },
  recordingHint: { fontSize: 13, color: '#64748B', fontWeight: 500 },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px calc(8px + env(safe-area-inset-bottom))',
    gap: 8,
    backgroundColor: '#EEF0F8',
    zIndex: 2,
  },
  inputRow: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: '4px 6px 4px 16px',
    boxShadow: '0 1px 3px rgba(5,4,170,0.06)',
    border: '1px solid #E2E8F0',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 15,
    backgroundColor: 'transparent',
    padding: '8px 4px',
    color: '#0B0B1A',
    fontFamily: 'inherit',
  },
  sendCircle: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(5,4,170,0.25)',
    transition: 'background 0.15s',
  },
  toastStack: {
    position: 'fixed',
    top: 68,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
    pointerEvents: 'none',
    maxWidth: '90vw',
  },
  ctxBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  ctxMenu: {
    position: 'fixed',
    zIndex: 1000,
    backgroundColor: '#fff',
    borderRadius: 14,
    boxShadow: '0 12px 40px rgba(11,11,26,0.18)',
    padding: '6px 0',
    minWidth: 210,
    border: '1px solid #EAECF3',
    animation: 'chatToastIn 0.15s ease',
  },
  ctxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14.5,
    color: '#1A1A1A',
    textAlign: 'left',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(11,11,26,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 20,
    animation: 'chatFadeIn 0.15s ease',
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: '24px 22px',
    maxWidth: 380,
    width: '100%',
    boxShadow: '0 24px 70px rgba(11,11,26,0.35)',
    textAlign: 'center',
  },
  dialogIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    background: '#FEF2F2',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 8,
    color: '#0B0B1A',
    letterSpacing: '-0.01em',
  },
  dialogBody: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 22,
    lineHeight: 1.55,
  },
  dialogActions: {
    display: 'flex',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    padding: '13px',
    backgroundColor: 'transparent',
    color: BRAND.primary,
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    fontFamily: 'inherit',
  },
  deleteBtn: {
    flex: 1,
    padding: '13px',
    backgroundColor: BRAND.danger,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 14,
    fontFamily: 'inherit',
  },
};

const CSS = `
  @keyframes chatSpin { to { transform: rotate(360deg); } }
  @keyframes chatPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @keyframes chatShimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes chatToastIn {
    from { opacity: 0; transform: translate(-50%, -6px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes chatFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;