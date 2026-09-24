'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../../services/api';
import {
  MdMenu,
  MdAutoAwesome,
  MdEdit,
  MdClose,
  MdAdd,
  MdMic,
  MdArrowUpward,
  MdContentCopy,
  MdRefresh,
  MdThumbUp,
  MdThumbDown,
  MdChevronRight,
  MdImage,
  MdStore,
  MdLocationOn,
  MdBuild,
  MdNavigation,
  MdCheck,
  MdChatBubbleOutline,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

const Brand = {
  bg: '#FAFAFA',
  bgWarm: '#F8F9FC',
  cardBg: '#FFFFFF',
  sidebarBg: '#F6F7FB',
  textPrimary: '#0F0F1A',
  textSecondary: '#5A6178',
  textMuted: '#9AA1B2',
  accent: '#0504AA',
  accentLight: '#3D3BFF',
  accentBg: '#EEEDFF',
  border: '#E6E8F0',
  borderSoft: '#EEF0F7',
  shadowSm: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.04)',
  shadowMd: '0 2px 6px rgba(15,23,42,0.05), 0 6px 20px rgba(15,23,42,0.06)',
  shadowLg: '0 8px 24px rgba(5,4,170,0.10), 0 2px 6px rgba(15,23,42,0.05)',
  shadowBloom: '0 0 0 4px rgba(5,4,170,0.10), 0 8px 24px rgba(5,4,170,0.14)',
};

type Role = 'user' | 'seai';

interface Message {
  clientId: string;
  role: Role;
  text: string;
  isThinking: boolean;
  isStreaming: boolean;
  timestamp: Date;
  error?: string;
  cards?: ResultCard[];
}

interface ResultCard {
  type?: 'item' | 'service' | 'store';
  listing_id?: string;
  store_name?: string;
  store_id?: string;
  store_image_url?: string;
  service_id?: string;
  provider_name?: string;
  provider_image_url?: string;
  provider_id?: string;
  description?: string;
  title?: string;
  price?: number;
  distance_km?: number;
  travel_minutes?: number;
  image_url?: string | null;
  address?: string;
  latitude?: number;
  longitude?: number;
  directions_url?: string;
  [key: string]: unknown;
}

interface Conversation {
  id: string;
  title: string;
}

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

const suggestions = [
  { emoji: '🛍️', text: 'Find items near me' },
  { emoji: '🏪', text: 'Show stores in my area' },
  { emoji: '⭐', text: "What's trending today?" },
  { emoji: '📦', text: 'Track my recent order' },
];

let _msgSeq = 0;
function nextClientId(): string {
  _msgSeq += 1;
  return `m_${Date.now().toString(36)}_${_msgSeq.toString(36)}`;
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

function typeBadgeColor(type: string | undefined): string {
  if (type === 'service') return '#7C3AED';
  if (type === 'store') return '#059669';
  return '#0504AA';
}

function typeBadgeLabel(type: string | undefined): string {
  if (type === 'service') return 'SERVICE';
  if (type === 'store') return 'STORE';
  return 'ITEM';
}

function SeaiCursor() {
  return <span className="seai-cursor" aria-hidden />;
}

function SeaiResultCard({
  card,
  onTap,
}: {
  card: ResultCard;
  onTap: () => void;
}) {
  const isItem = card.type === 'item' || (!card.type && !!card.listing_id);
  const isService = card.type === 'service' || !!card.service_id;
  const isStore = card.type === 'store' || (!!card.store_id && !card.listing_id);

  const image = resolveImageUrl(
    (card.image_url as string | undefined) || card.provider_image_url
  );

  let subtitle = '';
  if (isItem) subtitle = (card.store_name as string) || '';
  else if (isService) subtitle = (card.provider_name as string) || '';
  else if (isStore) subtitle = (card.address as string) || (card.description as string) || '';

  const showPrice =
    (isItem || isService) &&
    typeof card.price === 'number' &&
    card.price > 0;

  const travel = card.travel_minutes as number | undefined;
  const directions = card.directions_url as string | undefined;
  const distance = card.distance_km as number | undefined;

  const handleDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (directions) window.open(directions, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="seai-tile" style={styles.tile}>
      <button
        type="button"
        onClick={onTap}
        style={styles.tileTap}
        aria-label={`Open ${card.title || 'result'}`}
      >
        <div style={styles.tileImageWrap}>
          {image ? (
            <img src={image} alt="" style={styles.tileImage} />
          ) : (
            <div style={styles.tilePlaceholder}>
              {isStore ? (
                <MdStore size={48} color="#C7D2FE" />
              ) : isService ? (
                <MdBuild size={48} color="#C7D2FE" />
              ) : (
                <MdImage size={48} color="#C7D2FE" />
              )}
            </div>
          )}
          <div style={styles.tileImageOverlay} />
          <span
            style={{
              ...styles.tileBadge,
              backgroundColor: typeBadgeColor(card.type),
            }}
          >
            {typeBadgeLabel(card.type)}
          </span>
          {showPrice && (
            <span style={styles.tilePriceChip}>
              ₦{Number(card.price).toLocaleString('en-NG')}
            </span>
          )}
          {typeof distance === 'number' && (
            <span style={styles.tileDistancePill}>
              <MdLocationOn size={11} color="#fff" />
              <span style={{ marginLeft: 3 }}>{distance.toFixed(1)} km</span>
            </span>
          )}
        </div>

        <div style={styles.tileBody}>
          <div style={styles.tileTitle} title={card.title || ''}>
            {card.title || 'Untitled'}
          </div>
          {subtitle && (
            <div style={styles.tileSubtitle} title={subtitle}>
              <MdStore size={12} color="#94A3B8" />
              <span style={{ marginLeft: 4 }}>{subtitle}</span>
            </div>
          )}
          {travel !== undefined && (
            <div style={styles.tileTravel}>
              <span style={styles.tileTravelDot} />
              ~{travel} min away
            </div>
          )}
        </div>
      </button>

      {directions && (
        <button type="button" onClick={handleDirections} style={styles.directionsBtn}>
          <MdNavigation size={14} color={Brand.accent} />
          <span style={{ marginLeft: 4 }}>Directions</span>
        </button>
      )}
    </div>
  );
}

function SeaiAskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get('query') || '';
  const userLat = parseFloat(searchParams.get('lat') || '') || 5.5103;
  const userLng = parseFloat(searchParams.get('lng') || '') || 7.0265;

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoadingRecents, setIsLoadingRecents] = useState(false);
  const [inputHasText, setInputHasText] = useState(false);
  const [isCortexMode, setIsCortexMode] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [editing, setEditing] = useState<{
    index: number;
    text: string;
    role: Role;
  } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const messagesRef = useRef<Message[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const atBottomRef = useRef(true);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      streamAbortRef.current?.abort();
    };
  }, []);

  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }].slice(-3));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distance < 120;
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (!force && !atBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const loadConversations = async () => {
      setIsLoadingRecents(true);
      try {
        const data = (await api.getRecentConversations()) as unknown as Conversation[];
        if (isMountedRef.current) setConversations(data);
      } catch {
        // ignore
      } finally {
        if (isMountedRef.current) setIsLoadingRecents(false);
      }
    };
    loadConversations();
  }, []);

  useEffect(() => {
    if (initialQuery) {
      sendMessage(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputHasText(e.target.value.trim().length > 0);
  };

  const clearConversation = () => {
    streamAbortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
    setEditing(null);
    atBottomRef.current = true;
    if (inputRef.current) inputRef.current.focus();
  };

  const loadConversation = async (id: string) => {
    try {
      const data = (await api.getConversationMessages(id)) as {
        messages: { sender_id: string; text: string }[];
      };
      const loaded: Message[] = data.messages.map((m) => ({
        clientId: nextClientId(),
        role: m.sender_id === 'seai' ? 'seai' : 'user',
        text: m.text,
        isThinking: false,
        isStreaming: false,
        timestamp: new Date(),
      }));
      if (!isMountedRef.current) return;
      setMessages(loaded);
      setDrawerOpen(false);
      atBottomRef.current = true;
      setTimeout(() => scrollToBottom(true), 0);
    } catch {
      // ignore
    }
  };

  const copyText = useCallback(
    async (text: string, index: number) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => {
          setCopiedIndex((curr) => (curr === index ? null : curr));
        }, 1600);
      } catch {
        pushToast('error', 'Could not copy');
      }
    },
    [pushToast],
  );

  const retryMessage = (index: number) => {
    if (index > 0 && messages[index - 1].role === 'user') {
      const userMsg = messages[index - 1];
      const newMessages = messages.slice(0, index - 1);
      setMessages(newMessages);
      sendMessage(userMsg.text, newMessages);
    }
  };

  const startEdit = (index: number) => {
    const m = messages[index];
    setEditing({ index, text: m.text, role: m.role });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = () => {
    if (!editing) return;
    const { index, text, role } = editing;

    if (role === 'seai') {
      setEditing(null);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    const truncated = messages.slice(0, index);
    setMessages(truncated);
    setEditing(null);
    setTimeout(() => sendMessage(trimmed, truncated), 0);
  };

  const sendMessage = async (overrideText?: string, overrideHistory?: Message[]) => {
    const text = (overrideText ?? inputRef.current?.value ?? '').trim();
    if (!text || isStreaming) return;

    if (inputRef.current) {
      inputRef.current.value = '';
      setInputHasText(false);
      inputRef.current.blur();
      setInputFocused(false);
    }

    const baseMessages = overrideHistory ?? messagesRef.current;

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    const userMsg: Message = {
      clientId: nextClientId(),
      role: 'user',
      text,
      isThinking: false,
      isStreaming: false,
      timestamp: new Date(),
    };
    const thinkingMsg: Message = {
      clientId: nextClientId(),
      role: 'seai',
      text: '',
      isThinking: true,
      isStreaming: false,
      timestamp: new Date(),
    };

    setMessages([...baseMessages, userMsg, thinkingMsg]);
    setIsStreaming(true);
    atBottomRef.current = true;
    scrollToBottom(true);

    const history: { role: string; content: string }[] = [];
    for (const m of [...baseMessages, userMsg]) {
      if (m.role === 'user') {
        history.push({ role: 'user', content: m.text });
      } else if (!m.isThinking && m.text) {
        history.push({ role: 'assistant', content: m.text });
      }
    }

    const idx = baseMessages.length + 1;

    try {
      const stream = api.seaiAsk(
        text,
        userLat,
        userLng,
        10,
        history,
        isCortexMode ? 'agent' : 'gpt',
        controller.signal,
      );

      setMessages((prev) => {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          isThinking: false,
          isStreaming: true,
          text: '',
        };
        return updated;
      });

      let full = '';
      let done = false;
      let cardsReceived: ResultCard[] | null = null;

      for await (const event of stream) {
        if (!isMountedRef.current || controller.signal.aborted) return;

        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.substring(5).trim();
          if (payload === '[DONE]') {
            done = true;
            break;
          }
          try {
            const json = JSON.parse(payload);

            if (json.text) {
              full += json.text as string;
              setMessages((prev) => {
                const updated = [...prev];
                if (idx < updated.length) {
                  updated[idx] = {
                    ...updated[idx],
                    text: full,
                    isStreaming: true,
                  };
                }
                return updated;
              });
              scrollToBottom();
              continue;
            }

            if (json.type === 'action') {
              const data = (json.data || {}) as Record<string, unknown>;

              const intent =
                (json.intent as string | undefined) ||
                (data.intent as string | undefined);
              const hasResults =
                Array.isArray(data.results) &&
                (data.results as unknown[]).length > 0;

              if (intent === 'search_results' || hasResults) {
                cardsReceived = (data.results as ResultCard[]) || [];
                setMessages((prev) => {
                  const updated = [...prev];
                  if (idx < updated.length) {
                    updated[idx] = {
                      ...updated[idx],
                      text: full,
                      isStreaming: false,
                      cards: cardsReceived || [],
                    };
                  }
                  return updated;
                });
                scrollToBottom();
                continue;
              }

              if (intent === 'open_chat') {
                const userId = data.user_id as string | undefined;
                if (userId) router.push(`/chat/${userId}`);
              } else if (intent === 'open_shelf_editor') {
                router.push('/storekeeper/arrange-store');
              } else if (intent === 'book_service') {
                const serviceId = data.service_id as string | undefined;
                if (serviceId) router.push(`/service-detail/${serviceId}`);
              } else if (intent === 'get_store_info') {
                const storeId = data.store_id as string | undefined;
                if (storeId) router.push(`/store-detail/${storeId}`);
              }
            }
          } catch {
            // ignore malformed JSON
          }
        }
        if (done) break;
      }

      if (!isMountedRef.current) return;

      if (full.trim().length > 0) {
        try {
          await api.saveSeaiExchange(text, full);
          const recents = (await api.getRecentConversations()) as unknown as Conversation[];
          if (isMountedRef.current) setConversations(recents);
        } catch {
          // ignore — persistence is best-effort
        }
      }

      if (!isMountedRef.current) return;

      setMessages((prev) => {
        const updated = [...prev];
        if (idx < updated.length) {
          updated[idx] = {
            ...updated[idx],
            text: full,
            isStreaming: false,
            cards: cardsReceived ?? updated[idx].cards,
          };
        }
        return updated;
      });
      setIsStreaming(false);
      scrollToBottom();
    } catch (err) {
      if (!isMountedRef.current) return;
      if ((err as { name?: string })?.name === 'AbortError') return;

      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (
          lastIdx >= 0 &&
          (updated[lastIdx].isThinking || updated[lastIdx].isStreaming)
        ) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            isThinking: false,
            isStreaming: false,
            text: 'Something went wrong. Tap retry to try again.',
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
        return updated;
      });
      setIsStreaming(false);
      pushToast('error', 'Response failed. Tap retry.');
    }
  };

  const inChat = messages.length > 0;

  const handleCardTap = (card: ResultCard) => {
    if (card.service_id) {
      router.push(`/service-detail/${card.service_id}`);
    } else if (card.store_id && !card.listing_id) {
      router.push(`/store-detail/${card.store_id}`);
    } else if (card.listing_id) {
      router.push(`/item-detail/${card.listing_id}`);
    }
  };

  const renderWelcome = () => (
    <div style={styles.welcomeContainer}>
      <div className="seai-orb seai-orb-a" aria-hidden />
      <div className="seai-orb seai-orb-b" aria-hidden />

      <div style={styles.welcomeContent}>
        <div style={styles.logoWrap}>
          <div className="seai-logo-glow" style={styles.logoGlow} aria-hidden />
          <div style={styles.logo}>
            <MdAutoAwesome size={34} color="#FFFFFF" />
          </div>
        </div>

        <div style={styles.brandTag}>SEAI · Intelligent search</div>

        <h2 style={styles.greeting}>Hi there.</h2>
        <p style={styles.subGreeting}>What can I help you find today?</p>

        <div className="seai-suggestions" style={styles.suggestionsGrid}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s.text)}
              className="seai-chip"
              style={{
                ...styles.suggestionChip,
                animationDelay: `${120 + i * 70}ms`,
              }}
            >
              <span style={styles.chipEmoji}>{s.emoji}</span>
              <span style={styles.chipText}>{s.text}</span>
              <MdChevronRight size={16} color="#B6BCCB" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEditable = (msg: Message) => (
    <div style={styles.editWrap}>
      <textarea
        value={editing?.text ?? ''}
        onChange={(e) =>
          setEditing((prev) => (prev ? { ...prev, text: e.target.value } : prev))
        }
        style={styles.editTextarea}
        rows={3}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancelEdit();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
        }}
      />
      <div style={styles.editActions}>
        <button onClick={cancelEdit} style={styles.editCancel}>
          Cancel
        </button>
        <button onClick={saveEdit} style={styles.editSave}>
          <MdCheck size={16} color="#fff" />
          <span style={{ marginLeft: 4 }}>
            {msg.role === 'user' ? 'Save & resend' : 'Save'}
          </span>
        </button>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="seai-chat-list" style={styles.chatList}>
      {messages.map((msg, i) => {
        const isEditing = editing?.index === i;

        return (
          <div key={msg.clientId} className="seai-msg-row" style={styles.msgRow}>
            {msg.role === 'user' ? (
              <div className="seai-user-wrap" style={styles.userWrap}>
                {isEditing ? (
                  renderEditable(msg)
                ) : (
                  <div className="seai-user-bubble" style={styles.userBubble}>
                    {msg.text}
                  </div>
                )}
                {!isEditing && !msg.isStreaming && msg.text && (
                  <div style={{ ...styles.actionBar, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => copyText(msg.text, i)}
                      style={styles.actionBtn}
                      title="Copy"
                      aria-label="Copy message"
                    >
                      {copiedIndex === i ? (
                        <MdCheck size={14} color={Brand.accent} />
                      ) : (
                        <MdContentCopy size={14} color="#666" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(i)}
                      style={styles.actionBtn}
                      title="Edit"
                      aria-label="Edit message"
                    >
                      <MdEdit size={14} color="#666" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.aiMessageRow}>
                <div style={styles.aiAvatarWrap}>
                  <div className="seai-ai-ring" style={styles.aiAvatarRing} aria-hidden />
                  <div style={styles.aiAvatar}>
                    <MdAutoAwesome size={14} color="#FFFFFF" />
                  </div>
                </div>
                <div style={styles.aiBubble} aria-live="polite">
                  {msg.isThinking ? (
                    <div style={styles.thinkingWrap}>
                      <span className="seai-thinking-dot" aria-hidden />
                      <span style={styles.thinkingText}>Thinking</span>
                    </div>
                  ) : msg.text ? (
                    <div style={styles.aiText}>
                      {msg.text}
                      {msg.isStreaming && <SeaiCursor />}
                    </div>
                  ) : null}

                  {msg.error && !msg.isStreaming && (
                    <div style={styles.errorLine}>{msg.error}</div>
                  )}

                  {msg.cards && msg.cards.length > 0 && (
                    <div className="seai-card-stack" style={styles.cardStack}>
                      {msg.cards.map((card, cIdx) => (
                        <SeaiResultCard
                          key={cIdx}
                          card={card}
                          onTap={() => handleCardTap(card)}
                        />
                      ))}
                    </div>
                  )}

                  {!msg.isThinking && !msg.isStreaming && msg.text && !isEditing && (
                    <div style={styles.actionBar}>
                      <button
                        onClick={() => copyText(msg.text, i)}
                        style={styles.actionBtn}
                        title="Copy"
                        aria-label="Copy response"
                      >
                        {copiedIndex === i ? (
                          <MdCheck size={15} color={Brand.accent} />
                        ) : (
                          <MdContentCopy size={15} color="#666" />
                        )}
                      </button>
                      <button
                        onClick={() => retryMessage(i)}
                        style={styles.actionBtn}
                        title="Retry"
                        aria-label="Retry"
                      >
                        <MdRefresh size={15} color="#666" />
                      </button>
                      <button
                        style={styles.actionBtn}
                        title="Good response"
                        aria-label="Good response"
                      >
                        <MdThumbUp size={15} color="#666" />
                      </button>
                      <button
                        style={styles.actionBtn}
                        title="Bad response"
                        aria-label="Bad response"
                      >
                        <MdThumbDown size={15} color="#666" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );

  const renderInputArea = () => (
    <div className="seai-input-area" style={styles.inputArea}>
      <div
        style={{
          ...styles.inputBox,
          ...(inputFocused ? styles.inputBoxFocused : null),
        }}
      >
        <textarea
          ref={inputRef}
          onChange={handleInputChange}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={`Message ${isCortexMode ? 'SEAI Cortex' : 'SEAI'}...`}
          style={styles.textarea}
          rows={1}
        />
        <div style={styles.inputActions}>
          <button style={styles.inputIconBtn} title="Attach" aria-label="Attach">
            <MdAdd size={20} color="#666" />
          </button>
          <button style={styles.inputIconBtn} title="Voice" aria-label="Voice">
            <MdMic size={20} color="#666" />
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => sendMessage()}
            disabled={!inputHasText || isStreaming}
            className="seai-send"
            style={{
              ...styles.sendBtn,
              ...(inputHasText && !isStreaming
                ? styles.sendBtnActive
                : styles.sendBtnDisabled),
            }}
            aria-label="Send"
          >
            <MdArrowUpward size={18} color={inputHasText ? '#fff' : Brand.textMuted} />
          </button>
        </div>
      </div>
      <p style={styles.disclaimer}>
        Admerce AI can make mistakes. Consider checking important info.
      </p>
    </div>
  );

  const renderSidebar = () => (
    <>
      {drawerOpen && (
        <div
          className="seai-drawer-overlay"
          style={styles.sidebarOverlay}
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div
        className="seai-sidebar"
        style={{
          ...styles.sidebar,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarLogo}>
            <MdAutoAwesome size={14} color="#FFFFFF" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: Brand.textPrimary }}>
            Admerce AI
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            style={styles.closeBtn}
            aria-label="Close drawer"
          >
            <MdClose size={20} color="#666" />
          </button>
        </div>

        <button
          onClick={() => {
            clearConversation();
            setDrawerOpen(false);
          }}
          style={styles.newChatBtn}
        >
          <MdEdit size={16} color={Brand.accent} style={{ marginRight: 8 }} />
          New chat
        </button>

        <div style={styles.recentLabel}>Recent</div>
        <div style={styles.conversationList}>
          {isLoadingRecents ? (
            <div style={styles.skelStack}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="seai-skel"
                  style={{ height: 38, width: `${70 + (i % 3) * 10}%` }}
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div style={styles.emptyRecents}>
              <div style={styles.emptyRecentsIcon}>
                <MdChatBubbleOutline size={18} color={Brand.accent} />
              </div>
              <div style={styles.emptyRecentsTitle}>No conversations yet</div>
              <div style={styles.emptyRecentsSub}>
                Start a chat and it&rsquo;ll show up here
              </div>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className="seai-recent-item"
                style={styles.conversationItem}
              >
                <MdChatBubbleOutline
                  size={14}
                  color={Brand.textMuted}
                  style={{ flexShrink: 0, marginRight: 8 }}
                />
                <span style={styles.conversationItemText}>
                  {c.title || `Conversation ${c.id}`}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );

  return (
    <main className="seai-container" style={styles.container}>
      <div style={styles.topHairline} aria-hidden />

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

      {renderSidebar()}

      <div className="seai-main" style={styles.main}>
        <div className="seai-header" style={styles.header}>
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            style={styles.iconBtn}
            aria-label="Open menu"
          >
            <MdMenu size={22} color="#666" />
          </button>

          <div style={styles.headerBrand}>
            <div style={styles.headerBrandMark}>
              <MdAutoAwesome size={12} color="#fff" />
            </div>
            <span style={styles.headerBrandText}>Admerce AI</span>
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setIsCortexMode(!isCortexMode)}
            style={styles.modelToggle}
            aria-label={`Switch to ${isCortexMode ? 'SEAI' : 'SEAI Cortex'}`}
          >
            <span
              className="seai-model-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isCortexMode ? Brand.accentLight : Brand.accent,
                marginRight: 7,
              }}
            />
            <span style={{ fontWeight: 600, fontSize: 12.5 }}>
              {isCortexMode ? 'Cortex' : 'SEAI'}
            </span>
          </button>

          {inChat ? (
            <button
              onClick={clearConversation}
              style={styles.iconBtn}
              title="New chat"
              aria-label="New chat"
            >
              <MdEdit size={20} color="#666" />
            </button>
          ) : (
            <div style={{ width: 40 }} />
          )}
        </div>

        <div
          className="seai-body"
          style={styles.body}
          onScroll={onScroll}
          ref={scrollContainerRef}
        >
          {inChat ? renderChat() : renderWelcome()}
        </div>

        {renderInputArea()}
      </div>
    </main>
  );
}

export default function SeaiAskPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: Brand.bg,
          }}
        >
          <div style={styles.spinner} />
        </div>
      }
    >
      <SeaiAskContent />
    </Suspense>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    maxWidth: '100vw',
    backgroundColor: Brand.bg,
    position: 'relative',
    overflow: 'hidden',
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background:
      'linear-gradient(90deg, rgba(5,4,170,0) 0%, rgba(5,4,170,0.55) 20%, rgba(61,59,255,0.95) 50%, rgba(5,4,170,0.55) 80%, rgba(5,4,170,0) 100%)',
    zIndex: 30,
    pointerEvents: 'none',
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '3px solid #E6E8F0',
    borderTopColor: Brand.accent,
    animation: 'seaiSpin 0.9s linear infinite',
  },

  // ── Sidebar
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: Brand.sidebarBg,
    padding: '16px',
    zIndex: 20,
    transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    display: 'flex',
    flexDirection: 'column',
    borderRight: `1px solid ${Brand.borderSoft}`,
  },
  sidebarOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.38)',
    zIndex: 15,
    animation: 'seaiFade 200ms ease-out both',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  sidebarLogo: {
    width: 28,
    height: 28,
    borderRadius: 10,
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(5,4,170,0.28)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    marginLeft: 'auto',
  },
  newChatBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 12px',
    backgroundColor: Brand.cardBg,
    border: `1px solid ${Brand.border}`,
    borderRadius: 12,
    boxShadow: Brand.shadowSm,
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 600,
    color: Brand.textPrimary,
    width: '100%',
    marginBottom: 14,
    transition: 'box-shadow 180ms, transform 180ms',
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: Brand.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  conversationList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  conversationItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '10px 10px',
    borderRadius: 10,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    fontSize: 13,
    color: Brand.textSecondary,
    overflow: 'hidden',
    transition: 'background-color 140ms',
  },
  conversationItemText: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  skelStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 4,
  },
  emptyRecents: {
    padding: '24px 12px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  emptyRecentsIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: Brand.accentBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyRecentsTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: Brand.textPrimary,
  },
  emptyRecentsSub: {
    fontSize: 11.5,
    color: Brand.textMuted,
    marginTop: 4,
    lineHeight: 1.5,
    maxWidth: 200,
  },

  // ── Main
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    width: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    backgroundColor: Brand.bg,
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  headerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 4px 4px 4px',
  },
  headerBrandMark: {
    width: 22,
    height: 22,
    borderRadius: 7,
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(5,4,170,0.28)',
  },
  headerBrandText: {
    fontSize: 13.5,
    fontWeight: 700,
    color: Brand.textPrimary,
    letterSpacing: -0.1,
  },
  modelToggle: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: Brand.cardBg,
    border: `1px solid ${Brand.border}`,
    borderRadius: 20,
    boxShadow: Brand.shadowSm,
    cursor: 'pointer',
    transition: 'box-shadow 180ms',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    minHeight: 0,
    width: '100%',
  },

  // ── Welcome
  welcomeContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '0 24px',
    textAlign: 'center',
    overflow: 'hidden',
  },
  welcomeContent: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
  },
  logoWrap: {
    position: 'relative',
    width: 96,
    height: 96,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoGlow: {
    position: 'absolute',
    inset: -8,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(5,4,170,0.28) 0%, rgba(5,4,170,0.10) 40%, rgba(5,4,170,0) 70%)',
    pointerEvents: 'none',
  },
  logo: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 22,
    background: `linear-gradient(135deg, ${Brand.accent} 0%, ${Brand.accentLight} 100%)`,
    boxShadow:
      '0 12px 32px rgba(5,4,170,0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTag: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Brand.accent,
    background: Brand.accentBg,
    padding: '5px 12px',
    borderRadius: 999,
    marginBottom: 18,
  },
  greeting: {
    fontSize: 34,
    fontWeight: 700,
    color: Brand.textPrimary,
    letterSpacing: -0.9,
    margin: 0,
    lineHeight: 1.05,
  },
  subGreeting: {
    fontSize: 17,
    color: Brand.textSecondary,
    margin: '10px 0 36px',
    lineHeight: 1.4,
    maxWidth: 380,
  },
  suggestionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    width: '100%',
    maxWidth: 480,
  },
  suggestionChip: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 14px',
    backgroundColor: Brand.cardBg,
    border: `1px solid ${Brand.border}`,
    borderRadius: 14,
    boxShadow: Brand.shadowSm,
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 500,
    color: Brand.textPrimary,
    textAlign: 'left',
    gap: 10,
    transition: 'transform 200ms, box-shadow 200ms, border-color 200ms',
  },
  chipEmoji: {
    fontSize: 18,
    lineHeight: 1,
    flexShrink: 0,
  },
  chipText: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // ── Chat list
  chatList: {
    padding: '16px',
    maxWidth: 900,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  msgRow: {
    width: '100%',
    maxWidth: '100%',
    marginBottom: 22,
  },
  userWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    width: '100%',
    maxWidth: '100%',
  },
  userBubble: {
    maxWidth: '85%',
    padding: '12px 16px',
    borderRadius: 18,
    borderTopRightRadius: 6,
    background: `linear-gradient(135deg, ${Brand.accent} 0%, ${Brand.accentLight} 100%)`,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 1.55,
    boxShadow:
      '0 6px 16px rgba(5,4,170,0.22), inset 0 1px 0 rgba(255,255,255,0.14)',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
    boxSizing: 'border-box',
  },
  aiMessageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    maxWidth: '100%',
  },
  aiAvatarWrap: {
    position: 'relative',
    width: 30,
    height: 30,
    flexShrink: 0,
    marginTop: 2,
  },
  aiAvatarRing: {
    position: 'absolute',
    inset: -3,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(5,4,170,0.24) 0%, rgba(5,4,170,0) 70%)',
    pointerEvents: 'none',
  },
  aiAvatar: {
    position: 'relative',
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 8px rgba(5,4,170,0.28)',
  },
  aiBubble: {
    flex: 1,
    position: 'relative',
    paddingLeft: 14,
    color: Brand.textPrimary,
    fontSize: 15,
    lineHeight: 1.68,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    minWidth: 0,
    maxWidth: '100%',
  },
  aiText: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  thinkingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 26,
  },
  thinkingText: {
    fontSize: 13,
    color: Brand.textMuted,
    fontWeight: 500,
    letterSpacing: 0.1,
  },
  errorLine: {
    marginTop: 10,
    padding: '9px 12px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    color: '#991B1B',
    fontSize: 12,
    fontWeight: 500,
  },

  // ── Edit
  editWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  editTextarea: {
    width: '100%',
    padding: 12,
    fontSize: 15,
    lineHeight: 1.5,
    borderRadius: 12,
    border: `1.5px solid ${Brand.accent}`,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    color: Brand.textPrimary,
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    boxShadow: '0 0 0 4px rgba(5,4,170,0.08)',
  },
  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  editCancel: {
    padding: '8px 14px',
    borderRadius: 10,
    border: `1px solid ${Brand.border}`,
    backgroundColor: '#fff',
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  editSave: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 10,
    border: 'none',
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(5,4,170,0.25)',
  },

  // ── Result cards
  cardStack: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 14,
    marginTop: 16,
    width: '100%',
    maxWidth: '100%',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    border: `1px solid ${Brand.borderSoft}`,
    boxShadow: Brand.shadowSm,
    width: '100%',
    transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms',
  },
  tileTap: {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    width: '100%',
  },
  tileImageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    backgroundColor: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  tileImageOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(180deg, rgba(15,23,42,0) 45%, rgba(15,23,42,0.42) 100%)',
    pointerEvents: 'none',
  },
  tilePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  tileBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.7,
    color: '#fff',
    padding: '4px 8px',
    borderRadius: 7,
    textTransform: 'uppercase',
    boxShadow: '0 2px 6px rgba(15,23,42,0.15)',
  },
  tilePriceChip: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    padding: '5px 10px',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(6px)',
    color: Brand.accent,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: -0.1,
    boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
  },
  tileDistancePill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.72)',
    backdropFilter: 'blur(6px)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
  },
  tileBody: {
    padding: '12px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: Brand.textPrimary,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    letterSpacing: -0.1,
  },
  tileSubtitle: {
    fontSize: 12,
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: 2,
  },
  tileTravel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  tileTravelDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: '#10B981',
  },
  directionsBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '10px 10px',
    backgroundColor: '#F8FAFC',
    border: 'none',
    borderTop: `1px solid ${Brand.borderSoft}`,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    color: Brand.accent,
  },

  // ── Action bar
  actionBar: {
    display: 'flex',
    gap: 2,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    transition: 'background-color 140ms',
  },

  // ── Input
  inputArea: {
    padding: '8px 16px 12px',
    backgroundColor: Brand.bg,
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  inputBox: {
    backgroundColor: Brand.cardBg,
    borderRadius: 22,
    border: `1px solid ${Brand.border}`,
    boxShadow: Brand.shadowMd,
    padding: '4px 6px 0',
    transition: 'box-shadow 220ms, border-color 220ms',
  },
  inputBoxFocused: {
    borderColor: '#C7CCFF',
    boxShadow: Brand.shadowBloom,
  },
  textarea: {
    width: '100%',
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: 15,
    lineHeight: 1.55,
    color: Brand.textPrimary,
    padding: '14px 16px 0',
    background: 'transparent',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 6px 6px',
  },
  inputIconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 160ms, box-shadow 200ms, background 200ms',
  },
  sendBtnActive: {
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    boxShadow: '0 6px 16px rgba(5,4,170,0.30)',
    cursor: 'pointer',
  },
  sendBtnDisabled: {
    backgroundColor: '#E6E8F0',
    cursor: 'not-allowed',
  },
  disclaimer: {
    fontSize: 11,
    color: Brand.textMuted,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.1,
  },

  // ── Toasts
  toastStack: {
    position: 'fixed',
    top: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 300,
    pointerEvents: 'none',
  },
  toast: {
    pointerEvents: 'auto',
    padding: '10px 16px',
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid transparent',
    boxShadow: '0 6px 18px rgba(15,23,42,0.10)',
    cursor: 'pointer',
    maxWidth: 320,
    animation: 'seaiToastIn 220ms ease-out both',
  },
  toastSuccess: { backgroundColor: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' },
  toastError: { backgroundColor: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' },
};

// ─── Global keyframes + responsive rules ─────────────────────────
const GLOBAL_CSS = `
  html, body {
    overflow-x: hidden;
    max-width: 100vw;
  }

  /* ── Ambient orbs behind welcome state ─────────────────── */
  .seai-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    pointer-events: none;
    will-change: transform, opacity;
    opacity: 0.55;
    z-index: 0;
  }
  .seai-orb-a {
    width: 340px;
    height: 340px;
    top: -100px;
    left: -100px;
    background: radial-gradient(circle, rgba(5,4,170,0.22) 0%, rgba(5,4,170,0) 68%);
    animation: seaiFloatOrb 24s ease-in-out infinite;
  }
  .seai-orb-b {
    width: 420px;
    height: 420px;
    bottom: -140px;
    right: -140px;
    background: radial-gradient(circle, rgba(61,59,255,0.18) 0%, rgba(61,59,255,0) 68%);
    animation: seaiFloatOrb 30s ease-in-out infinite reverse;
  }
  @keyframes seaiFloatOrb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%      { transform: translate(28px, -22px) scale(1.08); }
    66%      { transform: translate(-22px, 26px) scale(0.96); }
  }

  /* ── Logo glow breathing ───────────────────────────────── */
  .seai-logo-glow {
    animation: seaiLogoBreathe 3.4s ease-in-out infinite;
  }
  @keyframes seaiLogoBreathe {
    0%, 100% { transform: scale(1);    opacity: 0.55; }
    50%      { transform: scale(1.18); opacity: 0.9; }
  }

  /* ── Suggestion chips ──────────────────────────────────── */
  .seai-chip {
    animation: seaiChipIn 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .seai-chip:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 26px rgba(5,4,170,0.10), 0 2px 6px rgba(15,23,42,0.05);
    border-color: #C7CCFF;
  }
  .seai-chip:active {
    transform: translateY(0) scale(0.985);
  }
  @keyframes seaiChipIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Message arrival ───────────────────────────────────── */
  .seai-msg-row {
    animation: seaiMsgIn 340ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes seaiMsgIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── AI thinking dot ───────────────────────────────────── */
  .seai-thinking-dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%);
    box-shadow:
      0 0 0 4px rgba(5,4,170,0.10),
      0 0 12px rgba(5,4,170,0.45);
    animation: seaiThinkPulse 1.5s ease-in-out infinite;
  }
  @keyframes seaiThinkPulse {
    0%, 100% { transform: scale(0.8); opacity: 0.55; }
    50%      { transform: scale(1.15); opacity: 1; }
  }

  /* ── Branded SEAI streaming cursor ─────────────────────── */
  @keyframes seaiPulse {
    0%, 100% { transform: scale(0.85) rotate(0deg); opacity: 0.7; }
    50%      { transform: scale(1.15) rotate(45deg); opacity: 1; }
  }
  .seai-cursor {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-left: 4px;
    vertical-align: middle;
    background: linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%);
    box-shadow: 0 0 10px rgba(5,4,170,0.55), inset 0 0 4px rgba(255,255,255,0.35);
    animation: seaiPulse 1.1s ease-in-out infinite;
  }

  /* ── Tile cards (hover lift on desktop) ────────────────── */
  .seai-tile:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 30px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06);
    border-color: #DDE3F5;
  }
  .seai-tile:active {
    transform: translateY(-1px);
  }

  /* ── Send button ───────────────────────────────────────── */
  .seai-send:hover {
    transform: scale(1.06);
  }
  .seai-send:active {
    transform: scale(0.96);
  }

  /* ── Sidebar recents ───────────────────────────────────── */
  .seai-recent-item:hover {
    background-color: #EEEDFF;
    color: #0504AA;
  }
  .seai-recent-item:active {
    background-color: #E2E1FF;
  }

  /* ── Skeleton shimmer ──────────────────────────────────── */
  .seai-skel {
    background: linear-gradient(90deg, #E9ECF3 25%, #F4F6FB 50%, #E9ECF3 75%);
    background-size: 200% 100%;
    animation: seaiShimmer 1.4s linear infinite;
    border-radius: 8px;
  }
  @keyframes seaiShimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Model dot pulse ───────────────────────────────────── */
  .seai-model-dot {
    animation: seaiModelPulse 2.2s ease-in-out infinite;
  }
  @keyframes seaiModelPulse {
    0%, 100% { transform: scale(1);   opacity: 0.9; }
    50%      { transform: scale(1.2); opacity: 0.5; }
  }

  /* ── Toast + fade + spinner ────────────────────────────── */
  @keyframes seaiToastIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes seaiFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes seaiSpin {
    to { transform: rotate(360deg); }
  }

  /* ─── Mobile responsiveness ─────────────────────────────── */
  @media (max-width: 640px) {
    .seai-chat-list {
      padding: 12px !important;
    }

    .seai-card-stack {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }

    .seai-sidebar {
      width: 82% !important;
      max-width: 320px;
    }

    .seai-suggestions {
      grid-template-columns: 1fr !important;
      max-width: 100% !important;
    }

    .seai-header {
      padding: 6px 8px !important;
    }

    .seai-header-brand-text {
      display: none;
    }

    .seai-input-area {
      padding: 6px 10px 10px !important;
    }

    .seai-container {
      width: 100vw !important;
      max-width: 100vw !important;
    }

    .seai-body {
      width: 100% !important;
      max-width: 100vw !important;
      overflow-x: hidden !important;
    }

    .seai-msg-row,
    .seai-user-wrap,
    .seai-main {
      width: 100% !important;
      max-width: 100% !important;
    }

    .seai-user-bubble {
      max-width: 88% !important;
    }
  }

  @media (max-width: 380px) {
    .seai-chat-list {
      padding: 10px !important;
    }
  }
`;

if (typeof document !== 'undefined') {
  const existing = document.getElementById('seai-global-css');
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'seai-global-css';
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
}