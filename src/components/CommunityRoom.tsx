'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../services/api';
import {
  MdSend,
  MdEdit,
  MdDeleteOutline,
  MdReply,
  MdClose,
  MdGroups,
  MdArrowBack,
  MdRefresh,
} from 'react-icons/md';

// ─── Types ────────────────────────────────────────────────────────
type CommunityMessage = {
  id: number;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  sender_role: string;
  room: string;
  text: string;
  image_url: string | null;
  reply_to_id: number | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

type Stats = { room: string; total_messages: number; active_senders_7d: number };
type Toast = { id: number; kind: 'success' | 'error'; text: string };

// ─── Constants ────────────────────────────────────────────────────
const ROOM = 'global';
const POLL_MS = 12000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_TEXT_LENGTH = 2000;

const ROLE_META: Record<string, { bg: string; fg: string; label: string; ring: string }> = {
  storekeeper: { bg: '#EEF0FF', fg: '#0504AA', label: 'Store', ring: '#0504AA' },
  service_provider: { bg: '#FEF3C7', fg: '#B45309', label: 'Service', ring: '#F59E0B' },
  admin: { bg: '#F3E8FF', fg: '#7E22CE', label: 'Admin', ring: '#7E22CE' },
};

// ─── Helpers ──────────────────────────────────────────────────────
function resolveImageUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 45) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isWithinEditWindow(m: CommunityMessage): boolean {
  const then = new Date(m.created_at).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < EDIT_WINDOW_MS;
}

// ─── Component ────────────────────────────────────────────────────
export default function CommunityRoom({
  role,
}: {
  role: 'storekeeper' | 'service-provider';
}) {
  const router = useRouter();

  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [replyTarget, setReplyTarget] = useState<CommunityMessage | null>(null);
  const [editing, setEditing] = useState<CommunityMessage | null>(null);
  const [actionTarget, setActionTarget] = useState<CommunityMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CommunityMessage | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const reqSeq = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  // ── Resolve current user ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = (await api.getMyProfile()) as {
          id?: string;
          user_id?: string;
          profile_id?: string;
        } | null;
        if (cancelled) return;
        setCurrentUserId(me?.id || me?.user_id || me?.profile_id || null);
      } catch {
        if (!cancelled) setCurrentUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Toast ───────────────────────────────────────────────────────
  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }].slice(-3));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ── Loaders ─────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    const seq = ++reqSeq.current;
    try {
      const data = (await api.communityGetMessages(ROOM, 50)) as CommunityMessage[];
      if (seq !== reqSeq.current) return;
      // Backend list_messages currently doesn't filter deleted rows — filter client-side
      const clean = (data || []).filter((m) => !m.deleted_at);
      setMessages(clean);
    } catch (err) {
      if (seq !== reqSeq.current) return;
      pushToast('error', extractErrorDetail(err, 'Could not load community'));
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [pushToast]);

  const loadStats = useCallback(async () => {
    try {
      const s = (await api.communityGetStats(ROOM)) as Stats;
      setStats(s);
    } catch {
      /* stats are cosmetic */
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadMessages();
      void loadStats();
    }, 0);
    return () => clearTimeout(id);
  }, [loadMessages, loadStats]);

  // ── Poll every 12s, paused when tab hidden ──────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadMessages();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [loadMessages]);

  // ── Scroll handling ─────────────────────────────────────────────
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distance < 80;
  }, []);

  useEffect(() => {
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // ── Send / Edit ─────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = composerText.trim();
    if (!text || sending) return;

    // Edit mode
    if (editing) {
      if (!isWithinEditWindow(editing)) {
        pushToast('error', 'Edit window expired');
        setEditing(null);
        setComposerText('');
        return;
      }
      setSending(true);
      try {
        const res = (await api.communityEditMessage(editing.id, text)) as {
          id: number;
          text: string;
          edited_at: string;
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === res.id ? { ...m, text: res.text, edited_at: res.edited_at } : m)),
        );
        setComposerText('');
        setEditing(null);
        pushToast('success', 'Message updated');
      } catch (err) {
        pushToast('error', extractErrorDetail(err, 'Could not edit'));
      } finally {
        setSending(false);
      }
      return;
    }

    // Post mode (optimistic)
    const tempId = -Date.now();
    const optimistic: CommunityMessage = {
      id: tempId,
      sender_id: currentUserId || 'self',
      sender_name: 'You',
      sender_avatar: null,
      sender_role: role === 'storekeeper' ? 'storekeeper' : 'service_provider',
      room: ROOM,
      text,
      image_url: null,
      reply_to_id: replyTarget ? replyTarget.id : null,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setComposerText('');
    const replyTo = replyTarget;
    setReplyTarget(null);
    atBottomRef.current = true;
    setSending(true);

    try {
      const res = (await api.communityPostMessage(text, undefined, replyTo?.id, ROOM)) as CommunityMessage;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? res : m)));
      loadStats();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      pushToast('error', extractErrorDetail(err, 'Message failed to send'));
    } finally {
      setSending(false);
    }
  }, [composerText, sending, editing, replyTarget, currentUserId, role, pushToast, loadStats]);

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (m: CommunityMessage) => {
      try {
        await api.communityDeleteMessage(m.id);
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
        setConfirmDelete(null);
        pushToast('success', 'Message deleted');
        loadStats();
      } catch (err) {
        pushToast('error', extractErrorDetail(err, 'Could not delete'));
      }
    },
    [pushToast, loadStats],
  );

  const lookupParent = useCallback(
    (id: number | null): CommunityMessage | null => {
      if (id == null) return null;
      return messages.find((m) => m.id === id) || null;
    },
    [messages],
  );

  const isMine = (m: CommunityMessage) => currentUserId != null && m.sender_id === currentUserId;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <style>{`
        @keyframes commPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.5); }
        }
        @keyframes commSpin { to { transform: rotate(360deg); } }
        @keyframes commFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>

      {/* Toasts */}
      <div style={styles.toastStack}>
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            style={{
              ...styles.toast,
              ...(t.kind === 'success' ? styles.toastSuccess : styles.toastError),
            }}
          >
            {t.text}
          </button>
        ))}
      </div>

      {/* Header */}
      <header style={styles.header}>
        <button
          onClick={() => router.back()}
          style={styles.headerIconBtn}
          aria-label="Back"
        >
          <MdArrowBack size={22} color="#0B0B1A" />
        </button>
        <div style={styles.headerCenter}>
          <div style={styles.headerTitleRow}>
            <h1 style={styles.headerTitle}>Community</h1>
            {stats && stats.active_senders_7d > 0 && (
              <span style={styles.livePill}>
                <span style={styles.liveDot} />
                <span style={styles.liveText}>{stats.active_senders_7d} active</span>
              </span>
            )}
          </div>
          <p style={styles.headerSub}>
            {stats
              ? `${stats.total_messages} message${stats.total_messages === 1 ? '' : 's'} in the sellers' room`
              : "Sellers' room"}
          </p>
        </div>
        <button onClick={loadMessages} style={styles.headerIconBtn} aria-label="Refresh">
          <MdRefresh size={22} color="#0B0B1A" />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} style={styles.scroll}>
        {loading ? (
          <div style={styles.skeletonList}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={styles.skeletonRow}>
                <div style={styles.skeletonAvatar} />
                <div style={styles.skeletonBody}>
                  <div style={{ ...styles.skeletonLine, width: '30%' }} />
                  <div style={{ ...styles.skeletonLine, width: '70%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={styles.emptyWrap}>
            <div style={styles.emptyHalo}>
              <MdGroups size={36} color="#0504AA" />
            </div>
            <h2 style={styles.emptyTitle}>Welcome to the sellers&apos; room</h2>
            <p style={styles.emptyBody}>
              A quiet space for storekeepers and service providers. Ask a question, share a tip,
              or just say hello.
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {messages.map((m) => {
              const mine = isMine(m);
              const parent = lookupParent(m.reply_to_id);
              const meta = ROLE_META[m.sender_role] || ROLE_META.storekeeper;
              const showEditExpired = mine && !isWithinEditWindow(m);

              return (
                <div
                  key={m.id}
                  style={{
                    ...styles.msgRow,
                    ...(m.id < 0 ? styles.msgPending : null),
                    animation: 'commFadeUp 220ms ease-out both',
                  }}
                >
                  <div
                    style={{
                      ...styles.avatar,
                      borderColor: mine ? '#0504AA' : meta.ring,
                    }}
                  >
                    {m.sender_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(m.sender_avatar)}
                        alt=""
                        style={styles.avatarImg}
                      />
                    ) : (
                      <span style={styles.avatarInitials}>{initials(m.sender_name)}</span>
                    )}
                  </div>

                  <div style={styles.msgBody}>
                    <div style={styles.msgMeta}>
                      <span style={styles.msgName}>{mine ? 'You' : m.sender_name}</span>
                      {meta && (
                        <span style={{ ...styles.roleChip, backgroundColor: meta.bg, color: meta.fg }}>
                          {meta.label}
                        </span>
                      )}
                      <span style={styles.msgTime}>
                        {relativeTime(m.created_at)}
                        {m.edited_at ? ' · edited' : ''}
                      </span>
                    </div>

                    {parent && (
                      <div style={styles.replyPreview}>
                        <span style={styles.replyPreviewName}>{parent.sender_name}</span>
                        <span style={styles.replyPreviewText}>{parent.text}</span>
                      </div>
                    )}
                    {!parent && m.reply_to_id && (
                      <div style={styles.replyBroken}>Replying to an earlier message</div>
                    )}

                    <button
                      onClick={() => setActionTarget(m)}
                      style={{
                        ...styles.bubble,
                        ...(mine ? styles.bubbleMine : styles.bubbleOther),
                      }}
                    >
                      <span
                        style={{
                          ...styles.bubbleText,
                          color: mine ? '#0B0B1A' : '#0B0B1A',
                        }}
                      >
                        {m.text}
                      </span>
                      {showEditExpired && (
                        <span style={styles.expiredNote}>edit window closed</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply / edit chip */}
      {(replyTarget || editing) && (
        <div style={styles.chipWrap}>
          <div style={styles.chip}>
            <div style={styles.chipIcon}>
              {editing ? <MdEdit size={16} color="#0504AA" /> : <MdReply size={16} color="#0504AA" />}
            </div>
            <div style={styles.chipBody}>
              <p style={styles.chipTitle}>
                {editing ? 'Editing message' : `Replying to ${replyTarget?.sender_name}`}
              </p>
              <p style={styles.chipText}>
                {editing ? editing.text : replyTarget?.text}
              </p>
            </div>
            <button
              onClick={() => {
                setReplyTarget(null);
                setEditing(null);
                setComposerText('');
              }}
              style={styles.chipClose}
              aria-label="Cancel"
            >
              <MdClose size={16} color="#475569" />
            </button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div style={styles.composerWrap}>
        <div style={styles.composerRow}>
          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
            placeholder={
              editing ? 'Update your message…' : "Message the sellers' room…"
            }
            rows={1}
            style={styles.composerInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!composerText.trim() || sending}
            style={{
              ...styles.sendBtn,
              ...((!composerText.trim() || sending) ? styles.sendBtnDisabled : null),
            }}
            aria-label="Send"
          >
            <MdSend size={18} color="#fff" />
          </button>
        </div>
      </div>

      {/* Action sheet */}
      {actionTarget && (
        <div style={styles.overlay} onClick={() => setActionTarget(null)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHandle} />
            <div style={styles.sheetHeader}>
              <span style={styles.sheetHeaderName}>{actionTarget.sender_name}</span>
              <span style={styles.sheetHeaderTime}>{relativeTime(actionTarget.created_at)}</span>
            </div>
            <button
              onClick={() => {
                setReplyTarget(actionTarget);
                setEditing(null);
                setComposerText('');
                setActionTarget(null);
              }}
              style={styles.sheetItem}
            >
              <MdReply size={18} color="#0504AA" />
              <span style={styles.sheetItemText}>Reply</span>
            </button>

            {isMine(actionTarget) && (
              <button
                onClick={() => {
                  if (!isWithinEditWindow(actionTarget)) {
                    pushToast('error', 'Edit window expired');
                    setActionTarget(null);
                    return;
                  }
                  setEditing(actionTarget);
                  setReplyTarget(null);
                  setComposerText(actionTarget.text);
                  setActionTarget(null);
                }}
                disabled={!isWithinEditWindow(actionTarget)}
                style={{
                  ...styles.sheetItem,
                  ...(!isWithinEditWindow(actionTarget) ? styles.sheetItemDisabled : null),
                }}
              >
                <MdEdit size={18} color="#0504AA" />
                <span style={styles.sheetItemText}>
                  Edit {!isWithinEditWindow(actionTarget) && '(expired)'}
                </span>
              </button>
            )}

            {isMine(actionTarget) && (
              <button
                onClick={() => {
                  setConfirmDelete(actionTarget);
                  setActionTarget(null);
                }}
                style={{ ...styles.sheetItem, ...styles.sheetItemDanger }}
              >
                <MdDeleteOutline size={18} color="#991B1B" />
                <span style={{ ...styles.sheetItemText, color: '#991B1B' }}>Delete</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Delete message?</h3>
            <p style={styles.modalBody}>This cannot be undone from your side.</p>
            <div style={styles.modalActions}>
              <button onClick={() => setConfirmDelete(null)} style={styles.modalCancel}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={styles.modalDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    backgroundColor: '#F4F5FB',
    position: 'relative',
  },

  // ── Toasts
  toastStack: {
    position: 'fixed',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 200,
    pointerEvents: 'none',
  },
  toast: {
    pointerEvents: 'auto',
    padding: '10px 16px',
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid transparent',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
    cursor: 'pointer',
    maxWidth: 320,
  },
  toastSuccess: { backgroundColor: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' },
  toastError: { backgroundColor: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' },

  // ── Header
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #EAECF3',
  },
  headerIconBtn: {
    background: 'none',
    border: 'none',
    padding: 6,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  headerSub: {
    fontSize: 12.5,
    color: '#64748B',
    margin: '2px 0 0 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  livePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    border: '1px solid #A7F3D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#10B981',
    animation: 'commPulse 2s ease-in-out infinite',
  },
  liveText: { fontSize: 11, color: '#065F46', fontWeight: 700 },

  // ── Scroll area
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 12px 4px 12px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },

  // ── Message
  msgRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
  },
  msgPending: { opacity: 0.72 },
  avatar: {
    width: 38,
    height: 38,
    flex: '0 0 38px',
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #0504AA',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitials: { fontSize: 12, fontWeight: 800, color: '#0504AA' },
  msgBody: { flex: 1, minWidth: 0 },
  msgMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  msgName: { fontSize: 13.5, fontWeight: 700, color: '#0B0B1A' },
  roleChip: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.02em',
    padding: '2px 7px',
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  msgTime: { fontSize: 11.5, color: '#94A3B8' },

  replyPreview: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    padding: '6px 10px',
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderLeft: '3px solid #0504AA',
    borderRadius: 8,
    fontSize: 12,
    overflow: 'hidden',
  },
  replyPreviewName: { fontWeight: 700, color: '#0504AA', flex: '0 0 auto' },
  replyPreviewText: {
    color: '#64748B',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  replyBroken: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 6,
    paddingLeft: 6,
  },

  bubble: {
    textAlign: 'left',
    border: 'none',
    borderRadius: 16,
    padding: '10px 12px',
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  bubbleMine: { backgroundColor: '#EEF0FF', border: '1px solid #C7CCFF' },
  bubbleOther: { backgroundColor: '#FFFFFF', border: '1px solid #EAECF3' },
  bubbleText: {
    fontSize: 14,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  expiredNote: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // ── Skeletons
  skeletonList: { display: 'flex', flexDirection: 'column', gap: 14 },
  skeletonRow: { display: 'flex', gap: 10 },
  skeletonAvatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'linear-gradient(90deg, #EEF2F6, #F8FAFC, #EEF2F6)',
  },
  skeletonBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    background: 'linear-gradient(90deg, #EEF2F6, #F8FAFC, #EEF2F6)',
  },

  // ── Empty
  emptyWrap: {
    flex: 1,
    minHeight: '60%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '32px 24px',
  },
  emptyHalo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    background: 'linear-gradient(135deg, #EEF0FF, #E0E7FF)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0 12px 32px rgba(5, 4, 170, 0.10)',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  emptyBody: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 6,
    maxWidth: 300,
    lineHeight: 1.5,
  },

  // ── Reply/edit chip
  chipWrap: { padding: '0 12px 8px 12px' },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7CCFF',
    borderRadius: 14,
  },
  chipIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 30px',
  },
  chipBody: { flex: 1, minWidth: 0 },
  chipTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0504AA',
    margin: 0,
  },
  chipText: {
    fontSize: 12,
    color: '#475569',
    margin: '2px 0 0 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chipClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 8,
  },

  // ── Composer
  composerWrap: {
    backgroundColor: '#FFFFFF',
    borderTop: '1px solid #EAECF3',
    padding: '10px 12px',
    paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
  },
  composerRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1,
    resize: 'none',
    borderRadius: 14,
    border: '1px solid #EAECF3',
    backgroundColor: '#F4F5FB',
    padding: '11px 14px',
    fontSize: 14,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    maxHeight: 128,
    outline: 'none',
    lineHeight: 1.45,
  },
  sendBtn: {
    flex: '0 0 44px',
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0504AA',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 120ms ease',
    boxShadow: '0 6px 16px rgba(5, 4, 170, 0.24)',
  },
  sendBtnDisabled: { opacity: 0.4, cursor: 'not-allowed', boxShadow: 'none' },

  // ── Action sheet
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'flex-end',
    zIndex: 300,
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: '10px 12px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    margin: '0 auto 10px auto',
  },
  sheetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '2px 8px 10px 8px',
    borderBottom: '1px solid #F1F5F9',
    marginBottom: 6,
  },
  sheetHeaderName: { fontSize: 13, fontWeight: 700, color: '#0B0B1A' },
  sheetHeaderTime: { fontSize: 12, color: '#94A3B8' },
  sheetItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 12px',
    borderRadius: 12,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  sheetItemDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  sheetItemDanger: { backgroundColor: '#FEF2F2' },
  sheetItemText: { fontSize: 14, fontWeight: 600, color: '#0B0B1A' },

  // ── Confirm delete
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 400,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  modalBody: { fontSize: 13.5, color: '#475569', marginTop: 6, lineHeight: 1.5 },
  modalActions: { display: 'flex', gap: 10, marginTop: 18 },
  modalCancel: {
    flex: 1,
    padding: '11px 0',
    borderRadius: 14,
    border: '1px solid #EAECF3',
    backgroundColor: '#FFFFFF',
    color: '#475569',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  modalDelete: {
    flex: 1,
    padding: '11px 0',
    borderRadius: 14,
    border: 'none',
    backgroundColor: '#991B1B',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};