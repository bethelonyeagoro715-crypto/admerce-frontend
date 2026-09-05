'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  MdCameraAlt,
  MdPhotoLibrary,
  MdInsertDriveFile,
  MdContentCopy,
  MdRefresh,
  MdThumbUp,
  MdThumbDown,
  MdChevronRight,
  MdImage,
} from 'react-icons/md';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

// ─── Brand colors (Admerce CTA) ──────────────────────────────────
const Brand = {
  bg: '#FAFAFA',
  cardBg: '#FFFFFF',
  sidebarBg: '#F5F5F5',
  textPrimary: '#171717',
  textSecondary: '#666666',
  textMuted: '#999999',
  accent: '#0504AA',          // Admerce primary
  accentLight: '#3D3BFF',     // lighter shade for gradients
  accentBg: '#EEEDFF',        // light background tint
  border: '#E5E5E5',
  shadowColor: 'rgba(0,0,0,0.1)',
};

// ─── Types ────────────────────────────────────────────────────────
type Role = 'user' | 'seai';

interface Message {
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
  title?: string;
  price?: number;
  distance_km?: number;
  image_url?: string;
  listing_id?: string;
  service_id?: string;
  store_id?: string;
  [key: string]: unknown;
}

interface Conversation {
  id: string;
  title: string;
}

const suggestions = [
  { emoji: '🛍️', text: 'Find items near me' },
  { emoji: '🏪', text: 'Show stores in my area' },
  { emoji: '⭐', text: "What's trending today?" },
  { emoji: '📦', text: 'Track my recent order' },
];

export default function SeaiAskPage() {
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

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
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
        setConversations(data);
      } catch {
        // ignore
      } finally {
        setIsLoadingRecents(false);
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
    setMessages([]);
    setIsStreaming(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const loadConversation = async (id: string) => {
    try {
      const data = (await api.getConversationMessages(id)) as {
        messages: { sender_id: string; text: string }[];
      };
      const loaded: Message[] = data.messages.map((m) => ({
        role: m.sender_id === 'seai' ? 'seai' : 'user',
        text: m.text,
        isThinking: false,
        isStreaming: false,
        timestamp: new Date(),
      }));
      setMessages(loaded);
      setDrawerOpen(false);
      scrollToBottom();
    } catch {
      // ignore
    }
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied');
  };

  const retryMessage = (index: number) => {
    if (index > 0 && messages[index - 1].role === 'user') {
      const userMsg = messages[index - 1];
      const newMessages = messages.slice(0, index - 1);
      setMessages(newMessages);
      sendMessage(userMsg.text);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputRef.current?.value ?? '').trim();
    if (!text || isStreaming) return;

    if (inputRef.current) {
      inputRef.current.value = '';
      setInputHasText(false);
      inputRef.current.blur();
    }

    const userMsg: Message = {
      role: 'user',
      text,
      isThinking: false,
      isStreaming: false,
      timestamp: new Date(),
    };
    const thinkingMsg: Message = {
      role: 'seai',
      text: '',
      isThinking: true,
      isStreaming: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsStreaming(true);
    scrollToBottom();

    const history: { role: string; content: string }[] = [];
    for (const m of [...messages, userMsg]) {
      if (m.role === 'user') {
        history.push({ role: 'user', content: m.text });
      } else if (!m.isThinking && m.text) {
        history.push({ role: 'assistant', content: m.text });
      }
    }

    const idx = messages.length + 1; // index of thinking message

    try {
      const stream = api.seaiAsk(
        text,
        userLat,
        userLng,
        10,
        history,
        isCortexMode ? 'agent' : 'gpt'
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

      for await (const event of stream) {
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
                updated[idx] = {
                  ...updated[idx],
                  text: full,
                  isStreaming: true,
                };
                return updated;
              });
              scrollToBottom();
            } else if (json.type === 'action') {
              const data = json.data as Record<string, unknown>;
              const intent = data.intent as string | undefined;

              if (intent === 'search_results' && data.results) {
                const cards = data.results as ResultCard[];
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[idx] = {
                    ...updated[idx],
                    text: full,
                    isStreaming: false,
                    cards,
                  };
                  return updated;
                });
                setIsStreaming(false);
                scrollToBottom();
                return;
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

      try {
        await api.saveSeaiExchange(text, full);
        const recents = (await api.getRecentConversations()) as unknown as Conversation[];
        setConversations(recents);
      } catch {
        // ignore
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          text: full,
          isStreaming: false,
        };
        return updated;
      });
      setIsStreaming(false);
      scrollToBottom();
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && (updated[lastIdx].isThinking || updated[lastIdx].isStreaming)) {
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
    }
  };

  const inChat = messages.length > 0;

  const handleCardTap = (card: ResultCard) => {
    if (card.type === 'service' && card.service_id) {
      router.push(`/service-detail/${card.service_id}`);
    } else if (card.type === 'store' && card.store_id) {
      router.push(`/store-detail/${card.store_id}`);
    } else if (card.listing_id) {
      router.push(`/item-detail/${card.listing_id}`);
    }
  };

  // ─── UI Components ────────────────────────────────────────────

  const renderWelcome = () => (
    <div style={styles.welcomeContainer}>
      <div style={styles.logo}>
        <MdAutoAwesome size={32} color="#FFFFFF" />
      </div>
      <h2 style={styles.greeting}>Hi there.</h2>
      <p style={styles.subGreeting}>How can I help you today?</p>
      <div style={styles.suggestionsGrid}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => sendMessage(s.text)} style={styles.suggestionChip}>
            <span style={{ marginRight: 8 }}>{s.emoji}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderChat = () => (
    <div style={styles.chatList}>
      {messages.map((msg, i) => (
        <div key={i} style={{ marginBottom: '16px' }}>
          {msg.role === 'user' ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={styles.userBubble}>{msg.text}</div>
            </div>
          ) : (
            <div style={styles.aiMessageRow}>
              <div style={styles.aiAvatar}>
                <MdAutoAwesome size={14} color="#FFFFFF" />
              </div>
              <div style={styles.aiBubble}>
                {msg.isThinking ? (
                  <div style={styles.thinkingDots}>
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                )}
                {msg.isStreaming && <span style={styles.cursor}>|</span>}
                {msg.cards && msg.cards.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {msg.cards.map((card, cIdx) => (
                      <div key={cIdx} style={styles.card} onClick={() => handleCardTap(card)}>
                        <div style={styles.cardImage}>
                          {card.image_url ? (
                            <img
                              src={card.image_url.startsWith('http') ? card.image_url : `${card.image_url}`}
                              alt=""
                              style={{ width: 48, height: 48, objectFit: 'cover' }}
                            />
                          ) : (
                            <MdImage size={24} color="#999" />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={styles.cardTitle}>{card.title}</div>
                          {card.price !== undefined && (
                            <div style={styles.cardPrice}>₦{Number(card.price).toFixed(0)}</div>
                          )}
                          {card.distance_km !== undefined && (
                            <div style={styles.cardDistance}>{Number(card.distance_km).toFixed(1)} km</div>
                          )}
                        </div>
                        <MdChevronRight color="#999" />
                      </div>
                    ))}
                  </div>
                )}
                {!msg.isThinking && !msg.isStreaming && msg.text && (
                  <div style={styles.actionBar}>
                    <button onClick={() => copyMessage(msg.text)} style={styles.actionBtn} title="Copy">
                      <MdContentCopy size={16} color="#666" />
                    </button>
                    <button onClick={() => retryMessage(i)} style={styles.actionBtn} title="Retry">
                      <MdRefresh size={16} color="#666" />
                    </button>
                    <button style={styles.actionBtn} title="Good response">
                      <MdThumbUp size={16} color="#666" />
                    </button>
                    <button style={styles.actionBtn} title="Bad response">
                      <MdThumbDown size={16} color="#666" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );

  const renderInputArea = () => (
    <div style={styles.inputArea}>
      <div style={styles.inputBox}>
        <textarea
          ref={inputRef}
          onChange={handleInputChange}
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
          <button style={styles.inputIconBtn} title="Attach">
            <MdAdd size={20} color="#666" />
          </button>
          <button style={styles.inputIconBtn} title="Voice">
            <MdMic size={20} color="#666" />
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => sendMessage()}
            disabled={!inputHasText || isStreaming}
            style={{
              ...styles.sendBtn,
              backgroundColor: inputHasText ? Brand.accent : Brand.border,
              color: inputHasText ? '#FFFFFF' : Brand.textMuted,
              cursor: inputHasText ? 'pointer' : 'not-allowed',
            }}
          >
            <MdArrowUpward size={18} />
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
      {drawerOpen && <div style={styles.sidebarOverlay} onClick={() => setDrawerOpen(false)} />}
      <div style={{ ...styles.sidebar, transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarLogo}><MdAutoAwesome size={14} color="#FFFFFF" /></div>
          <span style={{ fontWeight: 600 }}>Admerce AI</span>
          <button onClick={() => setDrawerOpen(false)} style={styles.closeBtn}>
            <MdClose size={20} color="#666" />
          </button>
        </div>
        <button
          onClick={() => { clearConversation(); setDrawerOpen(false); }}
          style={styles.newChatBtn}
        >
          <MdEdit size={16} color={Brand.accent} style={{ marginRight: 8 }} />
          New chat
        </button>
        <div style={styles.recentLabel}>Recent</div>
        <div style={styles.conversationList}>
          {isLoadingRecents ? (
            <div style={{ textAlign: 'center', padding: 16 }}>Loading...</div>
          ) : conversations.length === 0 ? (
            <div style={{ color: Brand.textMuted, fontSize: 13, padding: 16 }}>No conversations yet</div>
          ) : (
            conversations.map((c) => (
              <button key={c.id} onClick={() => loadConversation(c.id)} style={styles.conversationItem}>
                {c.title || `Conversation ${c.id}`}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );

  return (
    <main style={styles.container}>
      {renderSidebar()}

      <div style={styles.main}>
        {/* Header */}
        <div style={styles.header}>
          <button onClick={() => setDrawerOpen(!drawerOpen)} style={styles.iconBtn}>
            <MdMenu size={22} color="#666" />
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setIsCortexMode(!isCortexMode)} style={styles.modelToggle}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: isCortexMode ? Brand.accentLight : Brand.accent,
                marginRight: 6,
              }}
            />
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {isCortexMode ? 'SEAI Cortex' : 'SEAI'}
            </span>
            <MdChevronRight size={16} color="#666" />
          </button>
          <div style={{ flex: 1 }} />
          {inChat ? (
            <button onClick={clearConversation} style={styles.iconBtn} title="New chat">
              <MdEdit size={20} color="#666" />
            </button>
          ) : (
            <div style={{ width: 48 }} />
          )}
        </div>

        {/* Body */}
        <div style={styles.body}>
          {inChat ? renderChat() : renderWelcome()}
        </div>

        {/* Input area */}
        {renderInputArea()}
      </div>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: Brand.bg,
    position: 'relative',
    overflow: 'hidden',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: Brand.sidebarBg,
    padding: '16px',
    zIndex: 20,
    transition: 'transform 0.24s ease-out',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 15,
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sidebarLogo: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: Brand.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
  },
  newChatBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: Brand.cardBg,
    border: `1px solid ${Brand.border}`,
    borderRadius: 10,
    boxShadow: `0 2px 4px ${Brand.shadowColor}`,
    cursor: 'pointer',
    fontSize: 14,
    color: Brand.textPrimary,
    width: '100%',
    marginBottom: 12,
  },
  recentLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: Brand.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  conversationList: {
    flex: 1,
    overflowY: 'auto',
  },
  conversationItem: {
    display: 'block',
    width: '100%',
    padding: '10px 8px',
    borderRadius: 8,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    fontSize: 13,
    color: Brand.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: Brand.bg,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelToggle: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 10px',
    backgroundColor: Brand.cardBg,
    border: `1px solid ${Brand.border}`,
    borderRadius: 20,
    boxShadow: `0 2px 4px ${Brand.shadowColor}`,
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
  },
  welcomeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '0 24px',
    textAlign: 'center',
  },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 20,
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    boxShadow: `0 8px 20px rgba(5,4,170,0.3)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 600,
    color: Brand.textPrimary,
    letterSpacing: -0.5,
    margin: 0,
  },
  subGreeting: {
    fontSize: 20,
    color: Brand.textSecondary,
    margin: '6px 0 40px',
  },
  suggestionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    width: '100%',
    maxWidth: 500,
  },
  suggestionChip: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 14px',
    backgroundColor: Brand.cardBg,
    border: `1px solid ${Brand.border}`,
    borderRadius: 12,
    boxShadow: `0 2px 8px ${Brand.shadowColor}`,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: Brand.textPrimary,
    textAlign: 'left',
  },
  chatList: {
    padding: '16px',
  },
  userBubble: {
    maxWidth: '75%',
    padding: '12px 16px',
    borderRadius: 18,
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 1.5,
    boxShadow: `0 4px 10px rgba(5,4,170,0.2)`,
    wordBreak: 'break-word',
  },
  aiMessageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    // spacing handled by parent wrapper
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
    marginTop: 2,
  },
  aiBubble: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    boxShadow: 'none',
    color: Brand.textPrimary,
    fontSize: 15,
    lineHeight: 1.65,
    wordBreak: 'break-word',
  },
  thinkingDots: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
    height: 24,
  },
  cursor: {
    display: 'inline-block',
    width: 2,
    height: 18,
    backgroundColor: Brand.accent,
    animation: 'blink 0.8s infinite',
    marginLeft: 2,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    border: `1px solid ${Brand.border}`,
    cursor: 'pointer',
    boxShadow: `0 1px 3px ${Brand.shadowColor}`,
  },
  cardImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: 14,
    color: Brand.textPrimary,
  },
  cardPrice: {
    color: Brand.accent,
    fontSize: 13,
  },
  cardDistance: {
    fontSize: 12,
    color: Brand.textMuted,
  },
  actionBar: {
    display: 'flex',
    gap: 4,
    marginTop: 8,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputArea: {
    padding: '8px 16px 12px',
    backgroundColor: Brand.bg,
  },
  inputBox: {
    backgroundColor: Brand.cardBg,
    borderRadius: 20,
    border: `1px solid ${Brand.border}`,
    boxShadow: `0 2px 8px ${Brand.shadowColor}`,
    padding: '8px 8px 0',
  },
  textarea: {
    width: '100%',
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: 15,
    lineHeight: 1.5,
    color: Brand.textPrimary,
    padding: '14px 18px 0',
    background: 'transparent',
    fontFamily: 'inherit',
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px 8px',
  },
  inputIconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.18s',
  },
  disclaimer: {
    fontSize: 11,
    color: Brand.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
};

// Inject keyframes for cursor blink and thinking dots
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes blink { 0%,100% {opacity:1} 50% {opacity:0} }
    .dot { width: 6px; height: 6px; border-radius: 50%; background-color: #999; animation: bounce 1.2s infinite; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
  `;
  document.head.appendChild(style);
}