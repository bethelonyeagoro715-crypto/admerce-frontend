'use client';

import {
  Suspense,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../../services/api';
import {
  MdMenu,
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
  MdBookmarkBorder,
  MdBookmark,
  MdShare,
  MdSearch,
  MdLocalOffer,
  MdTrendingUp,
  MdSchedule,
  MdVerified,
  MdHistory,
  MdStop,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

const Brand = {
  bg: '#FBFAF7',
  bgWarm: '#F8F9FC',
  cardBg: '#FFFFFF',
  sidebarBg: '#F6F7FB',
  textPrimary: '#0A0A14',
  textSecondary: '#545B6E',
  textMuted: '#8F96A8',
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
  saved?: boolean;
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
  verification_status?: string;
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

function greetingForHour(h: number): string {
  if (h < 5) return 'Working late.';
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  if (h < 21) return 'Good evening.';
  return 'Good evening.';
}

const THINKING_VERBS = [
  'Searching nearby stores',
  'Comparing prices',
  'Checking stock',
  'Looking at what\'s close',
  'Finding the best match',
  'Reading descriptions',
];

const REFINE_CHIPS = [
  { label: 'Cheaper options', icon: MdLocalOffer, query: 'Show me cheaper options' },
  { label: 'Within 2 km', icon: MdLocationOn, query: 'Only show results within 2 km' },
  { label: 'Highest rated', icon: MdTrendingUp, query: 'Show the highest rated ones' },
  { label: 'Open now', icon: MdSchedule, query: 'Which ones are open right now?' },
];

const welcomeSuggestions = [
  { icon: MdSearch, text: 'Find items near me' },
  { icon: MdStore, text: 'Show stores in my area' },
  { icon: MdTrendingUp, text: "What's trending today?" },
  { icon: MdSchedule, text: 'Track my recent order' },
];

let _msgSeq = 0;
function nextClientId(): string {
  _msgSeq += 1;
  return `m_${Date.now().toString(36)}_${_msgSeq.toString(36)}`;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  if (!base) return url;
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
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

// ─── Inline markdown renderer ───────────────────────────────────────
interface MdToken {
  kind: 'text' | 'bold' | 'italic' | 'code' | 'price';
  value: string;
  key: string;
}

function tokenizeInline(input: string): MdToken[] {
  const tokens: MdToken[] = [];
  let i = 0;
  let keyCounter = 0;
  const nextKey = () => `t_${keyCounter++}`;

  while (i < input.length) {
    if (input[i] === '*' && input[i + 1] === '*') {
      const end = input.indexOf('**', i + 2);
      if (end !== -1) {
        tokens.push({ kind: 'bold', value: input.slice(i + 2, end), key: nextKey() });
        i = end + 2;
        continue;
      }
    }
    if (input[i] === '`') {
      const end = input.indexOf('`', i + 1);
      if (end !== -1) {
        tokens.push({ kind: 'code', value: input.slice(i + 1, end), key: nextKey() });
        i = end + 1;
        continue;
      }
    }
    if (input[i] === '*' && input[i + 1] !== '*' && input[i - 1] !== '*') {
      const end = input.indexOf('*', i + 1);
      if (end !== -1 && input[end + 1] !== '*') {
        tokens.push({ kind: 'italic', value: input.slice(i + 1, end), key: nextKey() });
        i = end + 1;
        continue;
      }
    }
    if (input[i] === '₦') {
      const m = input.slice(i).match(/^₦\s?[\d,]+(?:\.\d+)?/);
      if (m) {
        tokens.push({ kind: 'price', value: m[0], key: nextKey() });
        i += m[0].length;
        continue;
      }
    }
    let j = i + 1;
    while (j < input.length && input[j] !== '*' && input[j] !== '`' && input[j] !== '₦') {
      j++;
    }
    tokens.push({ kind: 'text', value: input.slice(i, j), key: nextKey() });
    i = j;
  }
  return tokens;
}

function renderInline(text: string): React.ReactNode {
  const tokens = tokenizeInline(text);
  return tokens.map((tok) => {
    switch (tok.kind) {
      case 'bold':
        return <strong key={tok.key} className="seai-md-bold">{tok.value}</strong>;
      case 'italic':
        return <em key={tok.key} className="seai-md-italic">{tok.value}</em>;
      case 'code':
        return <code key={tok.key} className="seai-md-code">{tok.value}</code>;
      case 'price':
        return <span key={tok.key} className="seai-md-price">{tok.value}</span>;
      default:
        return <span key={tok.key}>{tok.value}</span>;
    }
  });
}

function SeaiCursor() {
  return <span className="seai-cursor" aria-hidden />;
}

function ThinkingIndicator() {
  const [verbIdx, setVerbIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setVerbIdx((i) => (i + 1) % THINKING_VERBS.length);
    }, 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="seai-thinking">
      <span className="seai-thinking-orb" aria-hidden>
        <span className="seai-thinking-orbInner" />
      </span>
      <span key={verbIdx} className="seai-thinking-text">
        {THINKING_VERBS[verbIdx]}…
      </span>
    </div>
  );
}

function SeaiResultCard({
  card,
  saved,
  onTap,
  onSave,
}: {
  card: ResultCard;
  saved: boolean;
  onTap: () => void;
  onSave: () => void;
}) {
  const isService = card.type === 'service' || !!card.service_id;
  const isStore = card.type === 'store' || (!!card.store_id && !card.listing_id);
  const image = resolveImageUrl(
    (card.image_url as string | undefined) || card.provider_image_url,
  );

  let subtitle = '';
  if (!isService && !isStore) subtitle = (card.store_name as string) || '';
  else if (isService) subtitle = (card.provider_name as string) || '';
  else if (isStore) subtitle = (card.address as string) || '';

  const showPrice =
    (isService || (!isStore && !!card.listing_id)) &&
    typeof card.price === 'number' &&
    card.price > 0;

  const travel = card.travel_minutes as number | undefined;
  const distance = card.distance_km as number | undefined;
  const directions = card.directions_url as string | undefined;
  const verified = card.verification_status === 'verified';

  const handleDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (directions) window.open(directions, '_blank', 'noopener,noreferrer');
  };
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave();
  };

  return (
    <div className="seai-tile" style={styles.tile}>
      <button type="button" onClick={onTap} style={styles.tileTap} aria-label={`Open ${card.title || 'result'}`}>
        <div style={styles.tileImageWrap}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" style={styles.tileImage} />
          ) : (
            <div style={styles.tilePlaceholder}>
              {isStore ? <MdStore size={40} color="#C7D2FE" />
                : isService ? <MdBuild size={40} color="#C7D2FE" />
                : <MdImage size={40} color="#C7D2FE" />}
            </div>
          )}
          <div style={styles.tileImageOverlay} />
          <span style={{ ...styles.tileBadge, backgroundColor: typeBadgeColor(card.type) }}>
            {typeBadgeLabel(card.type)}
          </span>
          {verified && (
            <span style={styles.tileVerified} title="Verified">
              <MdVerified size={14} color="#0504AA" />
            </span>
          )}
          {showPrice && (
            <span style={styles.tilePriceChip}>
              ₦{Number(card.price).toLocaleString('en-NG')}
            </span>
          )}
          {typeof distance === 'number' && (
            <span style={styles.tileDistancePill}>
              <MdLocationOn size={10} color="#fff" />
              <span style={{ marginLeft: 3 }}>{distance.toFixed(1)} km</span>
            </span>
          )}
        </div>

        <div style={styles.tileBody}>
          <div style={styles.tileTitle} title={card.title || ''}>{card.title || 'Untitled'}</div>
          {subtitle && (
            <div style={styles.tileSubtitle} title={subtitle}>
              <MdStore size={11} color="#94A3B8" />
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

      <div style={styles.tileFooter}>
        {directions && (
          <button type="button" onClick={handleDirections} style={styles.tileFooterBtn} aria-label="Directions">
            <MdNavigation size={14} color={Brand.accent} />
            <span>Directions</span>
          </button>
        )}
        <button type="button" onClick={handleSave} style={styles.tileFooterBtn} aria-label={saved ? 'Remove from saved' : 'Save'}>
          {saved ? (
            <>
              <MdBookmark size={14} color={Brand.accent} />
              <span>Saved</span>
            </>
          ) : (
            <>
              <MdBookmarkBorder size={14} color={Brand.accent} />
              <span>Save</span>
            </>
          )}
        </button>
      </div>
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
  const [savedCards, setSavedCards] = useState<Set<string>>(new Set());

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [editing, setEditing] = useState<{ index: number; text: string; role: Role } | null>(null);
  const [greeting, setGreeting] = useState('');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  const messagesRef = useRef<Message[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const atBottomRef = useRef(true);
  const initialQuerySentRef = useRef(false);

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      streamAbortRef.current?.abort();
      if (mediaRecorderRef.current?.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      }
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
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
      } catch { /* ignore */ } finally {
        if (isMountedRef.current) setIsLoadingRecents(false);
      }
    };
    loadConversations();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputHasText(e.target.value.trim().length > 0);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const setInputValue = (text: string) => {
    if (!inputRef.current) return;
    inputRef.current.value = text;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
    setInputHasText(text.trim().length > 0);
    inputRef.current.focus();
    setInputFocused(true);
  };

  const clearConversation = () => {
    streamAbortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
    setEditing(null);
    atBottomRef.current = true;
    initialQuerySentRef.current = false;
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
      setInputHasText(false);
      inputRef.current.focus();
    }
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
    } catch { /* ignore */ }
  };

  const copyText = useCallback(
    async (text: string, index: number) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        pushToast('success', 'Copied');
        setTimeout(() => {
          setCopiedIndex((curr) => (curr === index ? null : curr));
        }, 1600);
      } catch {
        pushToast('error', 'Could not copy');
      }
    },
    [pushToast],
  );

  const toggleSave = useCallback((cardId: string) => {
    setSavedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  // ── Voice ───────────────────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording || isTranscribing) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      pushToast('error', 'Recording not supported on this device');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType =
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : typeof MediaRecorder !== 'undefined' &&
              MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (!chunks.length) { setIsRecording(false); return; }

        const blobType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: blobType });
        const ext = blobType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice.${ext}`, { type: blobType });

        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const res = (await api.transcribeAudio(file)) as { text?: string; transcript?: string };
          const text = (res?.text || res?.transcript || '').trim();
          if (!isMountedRef.current) return;
          if (text) setInputValue(text);
          else pushToast('error', "Couldn't hear that. Try again.");
        } catch {
          if (isMountedRef.current) pushToast('error', 'Transcription failed. Try again.');
        } finally {
          if (isMountedRef.current) setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      pushToast('error', 'Microphone access denied');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'recording') {
      try { rec.stop(); } catch { /* ignore */ }
    } else {
      setIsRecording(false);
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    }
  };

  const handleMicClick = () => {
    if (isTranscribing) return;
    if (isRecording) stopRecording();
    else void startRecording();
  };

  // ── Attach ──────────────────────────────────────────────────────
  const handleAttachClick = () => {
    if (isUploadingImage) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      pushToast('error', 'Only images are supported');
      return;
    }

    setIsUploadingImage(true);

    const localUrl = URL.createObjectURL(file);
    const userMsg: Message = {
      clientId: nextClientId(),
      role: 'user',
      text: `📷 Looking for what's in this photo…`,
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

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    atBottomRef.current = true;
    scrollToBottom(true);

    const idx = messagesRef.current.length + 1;

    try {
      const res = (await api.seaiLensWithFile(file, userLat, userLng, 50)) as {
        results?: ResultCard[];
        items?: ResultCard[];
        message?: string;
        text?: string;
        hint?: string;
        description?: string;
        method?: string;
        diagnostics?: { description?: string };
      };

      if (!isMountedRef.current) return;

      const results =
        (Array.isArray(res?.results) && res.results) ||
        (Array.isArray(res?.items) && res.items) ||
        [];

      // Build the best possible intro message from whatever the
      // backend returned. Priority order reflects how specific each
      // field is.
      const description = res?.description || res?.diagnostics?.description;

      let intro = '';
      if (res?.message) {
        intro = res.message;
      } else if (results.length > 0) {
        intro = description
          ? `That looks like ${description}. Here's what I found nearby:`
          : "Here\u2019s what I found:";
      } else if (res?.hint) {
        intro = res.hint;
      } else if (description) {
        intro = `That looks like ${description}, but I couldn't find a close match nearby.`;
      } else {
        intro = "I couldn\u2019t identify anything useful in that photo.";
      }

      setMessages((prev) => {
        const updated = [...prev];
        if (idx < updated.length) {
          updated[idx] = {
            ...updated[idx],
            isThinking: false,
            isStreaming: false,
            text: intro,
            cards: results.length > 0 ? results : undefined,
          };
        }
        return updated;
      });

      setTimeout(() => URL.revokeObjectURL(localUrl), 1000);
    } catch (err) {
      if (!isMountedRef.current) return;
      setMessages((prev) => {
        const updated = [...prev];
        if (idx < updated.length) {
          updated[idx] = {
            ...updated[idx],
            isThinking: false,
            isStreaming: false,
            text: 'I couldn\u2019t read that image. Try another one.',
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
        return updated;
      });
      URL.revokeObjectURL(localUrl);
      pushToast('error', 'Image analysis failed');
    } finally {
      if (isMountedRef.current) setIsUploadingImage(false);
    }
  };

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
    if (role === 'seai') { setEditing(null); return; }
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
      inputRef.current.style.height = 'auto';
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
      if (m.role === 'user') history.push({ role: 'user', content: m.text });
      else if (!m.isThinking && m.text) history.push({ role: 'assistant', content: m.text });
    }

    const idx = baseMessages.length + 1;

    try {
      const stream = api.seaiAsk(
        text, userLat, userLng, 10, history,
        isCortexMode ? 'agent' : 'gpt',
        controller.signal,
      );

      setMessages((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], isThinking: false, isStreaming: true, text: '' };
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
          if (payload === '[DONE]') { done = true; break; }
          try {
            const json = JSON.parse(payload);

            if (json.text) {
              full += json.text as string;
              setMessages((prev) => {
                const updated = [...prev];
                if (idx < updated.length) {
                  updated[idx] = { ...updated[idx], text: full, isStreaming: true };
                }
                return updated;
              });
              scrollToBottom();
              continue;
            }

            if (json.type === 'action') {
              const data = (json.data || {}) as Record<string, unknown>;
              const intent = (json.intent as string | undefined) || (data.intent as string | undefined);
              const resultsArr = Array.isArray(data.results)
                ? (data.results as ResultCard[])
                : Array.isArray(data.items)
                  ? (data.items as ResultCard[])
                  : Array.isArray(json.results)
                    ? (json.results as ResultCard[])
                    : null;

              if (intent === 'search_results' || (resultsArr && resultsArr.length > 0)) {
                cardsReceived = resultsArr || [];
                setMessages((prev) => {
                  const updated = [...prev];
                  if (idx < updated.length) {
                    updated[idx] = { ...updated[idx], text: full, isStreaming: false, cards: cardsReceived || [] };
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
              } else if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.debug('[seai] unknown action', { intent, data, json });
              }
            }
          } catch { /* ignore malformed JSON */ }
        }
        if (done) break;
      }

      if (!isMountedRef.current) return;

      if (full.trim().length > 0) {
        try {
          await api.saveSeaiExchange(text, full);
          const recents = (await api.getRecentConversations()) as unknown as Conversation[];
          if (isMountedRef.current) setConversations(recents);
        } catch { /* best-effort */ }
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
        if (lastIdx >= 0 && (updated[lastIdx].isThinking || updated[lastIdx].isStreaming)) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            isThinking: false,
            isStreaming: false,
            text: 'I couldn\'t complete that. Tap retry to try again.',
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
        return updated;
      });
      setIsStreaming(false);
      pushToast('error', 'Response failed. Tap retry.');
    }
  };

  useEffect(() => {
    if (!initialQuery || initialQuerySentRef.current) return;
    initialQuerySentRef.current = true;
    const t = setTimeout(() => {
      void sendMessage(initialQuery);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const inChat = messages.length > 0;

  const handleCardTap = (card: ResultCard) => {
    if (card.service_id) router.push(`/service-detail/${card.service_id}`);
    else if (card.store_id && !card.listing_id) router.push(`/store-detail/${card.store_id}`);
    else if (card.listing_id) router.push(`/item-detail/${card.listing_id}`);
  };

  const lastAiMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'seai' && !m.isThinking && !m.isStreaming && m.text);

  const showRefineChips =
    !isStreaming && lastAiMessage && lastAiMessage.cards && lastAiMessage.cards.length > 0;

  const renderWelcome = () => (
    <div className="seai-welcome" style={styles.welcomeContainer}>
      <div className="seai-orb seai-orb-a" aria-hidden />
      <div className="seai-orb seai-orb-b" aria-hidden />

      <div style={styles.welcomeContent}>
        <div style={styles.logoWrap}>
          <div className="seai-logo-glow" style={styles.logoGlow} aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admerce_symbol.png" alt="Admerce" className="seai-logo-img" style={styles.logoImg} />
        </div>

        <h2 className="seai-greeting" style={styles.greeting}>{greeting || 'Welcome.'}</h2>
        <p style={styles.subGreeting}>
          Ask me to find anything on Admerce — items, stores, or services near you.
        </p>

        <div className="seai-suggestions" style={styles.suggestionsGrid}>
          {welcomeSuggestions.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={i}
                onClick={() => sendMessage(s.text)}
                className="seai-chip"
                style={{ ...styles.suggestionChip, animationDelay: `${120 + i * 70}ms` }}
              >
                <span style={styles.chipIconWrap}>
                  <Icon size={16} color={Brand.accent} />
                </span>
                <span style={styles.chipText}>{s.text}</span>
                <MdChevronRight size={16} color="#B6BCCB" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderEditable = (msg: Message) => (
    <div style={styles.editWrap}>
      <textarea
        value={editing?.text ?? ''}
        onChange={(e) => setEditing((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
        style={styles.editTextarea}
        rows={3}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancelEdit();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
        }}
      />
      <div style={styles.editActions}>
        <button onClick={cancelEdit} style={styles.editCancel}>Cancel</button>
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
                {isEditing ? renderEditable(msg) : (
                  <div className="seai-user-bubble" style={styles.userBubble}>{msg.text}</div>
                )}
                {!isEditing && !msg.isStreaming && msg.text && (
                  <div style={{ ...styles.actionBar, justifyContent: 'flex-end' }}>
                    <button onClick={() => copyText(msg.text, i)} style={styles.actionBtn} title="Copy" aria-label="Copy message">
                      {copiedIndex === i ? <MdCheck size={14} color={Brand.accent} /> : <MdContentCopy size={14} color="#666" />}
                    </button>
                    <button onClick={() => startEdit(i)} style={styles.actionBtn} title="Edit" aria-label="Edit message">
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
                    <MdSearch size={14} color="#FFFFFF" />
                  </div>
                </div>
                <div style={styles.aiBubble} aria-live="polite">
                  {msg.isThinking ? <ThinkingIndicator /> : msg.text ? (
                    <div style={styles.aiText}>
                      {renderInline(msg.text)}
                      {msg.isStreaming && <SeaiCursor />}
                    </div>
                  ) : null}

                  {msg.error && !msg.isStreaming && (
                    <div style={styles.errorLine}>{msg.error}</div>
                  )}

                  {msg.cards && msg.cards.length > 0 && (
                    <div className="seai-card-stack" style={styles.cardStack}>
                      {msg.cards.map((card, cIdx) => {
                        const cardId = card.listing_id || card.service_id || card.store_id || `card-${i}-${cIdx}`;
                        return (
                          <SeaiResultCard
                            key={cardId}
                            card={card}
                            saved={savedCards.has(cardId)}
                            onTap={() => handleCardTap(card)}
                            onSave={() => toggleSave(cardId)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {!msg.isThinking && !msg.isStreaming && msg.text && !isEditing && (
                    <div style={styles.actionBar}>
                      <button onClick={() => copyText(msg.text, i)} style={styles.actionBtn} title="Copy" aria-label="Copy response">
                        {copiedIndex === i ? <MdCheck size={15} color={Brand.accent} /> : <MdContentCopy size={15} color="#666" />}
                      </button>
                      <button onClick={() => retryMessage(i)} style={styles.actionBtn} title="Retry" aria-label="Retry">
                        <MdRefresh size={15} color="#666" />
                      </button>
                      <button
                        onClick={() => {
                          if (navigator.share) void navigator.share({ text: msg.text }).catch(() => {});
                          else void copyText(msg.text, i);
                        }}
                        style={styles.actionBtn}
                        title="Share"
                        aria-label="Share response"
                      >
                        <MdShare size={15} color="#666" />
                      </button>
                      <button style={styles.actionBtn} title="Good response" aria-label="Good response">
                        <MdThumbUp size={15} color="#666" />
                      </button>
                      <button style={styles.actionBtn} title="Bad response" aria-label="Bad response">
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

      {showRefineChips && (
        <div className="seai-refine-row" style={styles.refineRow}>
          {REFINE_CHIPS.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.label}
                type="button"
                className="seai-refine-chip"
                style={styles.refineChip}
                onClick={() => sendMessage(r.query)}
                disabled={isStreaming}
              >
                <Icon size={13} color={Brand.accent} />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );

  const renderInputArea = () => (
    <div className="seai-input-area" style={styles.inputArea}>
      <div style={{ ...styles.inputBox, ...(inputFocused ? styles.inputBoxFocused : null) }}>
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
          placeholder={
            isRecording ? 'Listening…'
              : isTranscribing ? 'Transcribing…'
              : `Ask ${isCortexMode ? 'SEAI Cortex' : 'SEAI'} anything…`
          }
          style={styles.textarea}
          rows={1}
          disabled={isRecording || isTranscribing}
        />
        <div style={styles.inputActions}>
          <button
            style={styles.inputIconBtn}
            onClick={handleAttachClick}
            disabled={isUploadingImage || isRecording || isTranscribing}
            title={isUploadingImage ? 'Analyzing…' : 'Attach an image'}
            aria-label="Attach an image"
          >
            {isUploadingImage ? <span className="seai-mini-spinner" /> : <MdAdd size={20} color="#666" />}
          </button>

          <button
            style={{ ...styles.inputIconBtn, ...(isRecording ? styles.inputIconBtnRecording : null) }}
            onClick={handleMicClick}
            disabled={isTranscribing}
            title={isTranscribing ? 'Transcribing…' : isRecording ? 'Stop recording' : 'Voice input'}
            aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isTranscribing ? <span className="seai-mini-spinner" /> : isRecording ? <MdStop size={20} color="#fff" /> : <MdMic size={20} color="#666" />}
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => sendMessage()}
            disabled={!inputHasText || isStreaming || isRecording || isTranscribing}
            className="seai-send"
            style={{
              ...styles.sendBtn,
              ...(inputHasText && !isStreaming ? styles.sendBtnActive : styles.sendBtnDisabled),
            }}
            aria-label="Send"
          >
            <MdArrowUpward size={18} color={inputHasText && !isStreaming ? '#fff' : Brand.textMuted} />
          </button>
        </div>
      </div>
      <p style={styles.disclaimer}>
        {isRecording ? 'Recording — tap the square to stop'
          : isTranscribing ? 'Transcribing your voice…'
          : isUploadingImage ? 'Analyzing image…'
          : 'SEAI can make mistakes. Double-check important details.'}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );

  const renderSidebar = () => (
    <>
      {drawerOpen && (
        <div className="seai-drawer-overlay" style={styles.sidebarOverlay} onClick={() => setDrawerOpen(false)} />
      )}
      <div
        className="seai-sidebar"
        style={{ ...styles.sidebar, transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div style={styles.sidebarHeader}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admerce_symbol.png" alt="" className="seai-sidebar-logo" style={styles.sidebarLogo} />
          <span style={{ fontWeight: 700, fontSize: 14, color: Brand.textPrimary }}>SEAI</span>
          <button onClick={() => setDrawerOpen(false)} style={styles.closeBtn} aria-label="Close drawer">
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

        <div style={styles.recentLabel}>
          <MdHistory size={12} color={Brand.textMuted} />
          <span style={{ marginLeft: 6 }}>Recent</span>
        </div>
        <div style={styles.conversationList}>
          {isLoadingRecents ? (
            <div style={styles.skelStack}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="seai-skel" style={{ height: 38, width: `${70 + (i % 3) * 10}%` }} />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div style={styles.emptyRecents}>
              <div style={styles.emptyRecentsIcon}>
                <MdChatBubbleOutline size={18} color={Brand.accent} />
              </div>
              <div style={styles.emptyRecentsTitle}>No conversations yet</div>
              <div style={styles.emptyRecentsSub}>Your chat history will live here.</div>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className="seai-recent-item"
                style={styles.conversationItem}
              >
                <MdChatBubbleOutline size={14} color={Brand.textMuted} style={{ flexShrink: 0, marginRight: 8 }} />
                <span style={styles.conversationItemText}>{c.title || `Conversation ${c.id}`}</span>
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
          <button onClick={() => setDrawerOpen(!drawerOpen)} style={styles.iconBtn} aria-label="Open menu">
            <MdMenu size={22} color="#666" />
          </button>

          <div style={styles.headerBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/admerce_symbol.png" alt="" className="seai-header-logo" style={styles.headerBrandMark} />
            <span className="seai-header-brand-text" style={styles.headerBrandText}>SEAI</span>
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
            <button onClick={clearConversation} style={styles.iconBtn} title="New chat" aria-label="New chat">
              <MdEdit size={20} color="#666" />
            </button>
          ) : (
            <div style={{ width: 40 }} />
          )}
        </div>

        <div className="seai-body" style={styles.body} onScroll={onScroll} ref={scrollContainerRef}>
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

// ─── Styles ──────────────────────────────────────────────────────────
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
  sidebar: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
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
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 },
  sidebarLogo: { width: 30, height: 30, display: 'block', objectFit: 'contain' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 'auto' },
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
    fontFamily: 'inherit',
  },
  recentLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: Brand.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  conversationList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 },
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
    fontFamily: 'inherit',
  },
  conversationItemText: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  skelStack: { display: 'flex', flexDirection: 'column', gap: 8, padding: 4 },
  emptyRecents: { padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  emptyRecentsIcon: {
    width: 44, height: 44, borderRadius: 14,
    background: Brand.accentBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  emptyRecentsTitle: { fontSize: 13, fontWeight: 700, color: Brand.textPrimary },
  emptyRecentsSub: { fontSize: 11.5, color: Brand.textMuted, marginTop: 4, lineHeight: 1.5, maxWidth: 200 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    backgroundColor: Brand.bg,
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
    borderBottom: `1px solid ${Brand.borderSoft}`,
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
  headerBrand: { display: 'flex', alignItems: 'center', gap: 8 },
  headerBrandMark: { width: 26, height: 26, display: 'block', objectFit: 'contain' },
  headerBrandText: { fontSize: 14, fontWeight: 800, color: Brand.textPrimary, letterSpacing: -0.2 },
  modelToggle: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: Brand.cardBg,
    border: `1px solid ${Brand.border}`,
    borderRadius: 20,
    boxShadow: Brand.shadowSm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  body: { flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, width: '100%' },
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
    width: 108, height: 108,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  logoGlow: {
    position: 'absolute',
    inset: -12,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(5,4,170,0.24) 0%, rgba(5,4,170,0.08) 45%, rgba(5,4,170,0) 72%)',
    pointerEvents: 'none',
  },
  logoImg: { position: 'relative', width: 96, height: 96, display: 'block', objectFit: 'contain' },
  greeting: {
    fontSize: 34,
    fontWeight: 600,
    color: Brand.textPrimary,
    letterSpacing: -1,
    margin: 0,
    lineHeight: 1.1,
    fontFamily: 'inherit',
  },
  subGreeting: {
    fontSize: 16,
    color: Brand.textSecondary,
    margin: '12px 0 40px',
    lineHeight: 1.5,
    maxWidth: 400,
  },
  suggestionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 480 },
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
    fontFamily: 'inherit',
  },
  chipIconWrap: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: Brand.accentBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  chipText: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chatList: { padding: '20px 16px 8px', maxWidth: 860, margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  msgRow: { width: '100%', maxWidth: '100%', marginBottom: 26 },
  userWrap: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%', maxWidth: '100%' },
  userBubble: {
    maxWidth: '82%',
    padding: '12px 16px',
    borderRadius: 18,
    borderTopRightRadius: 6,
    background: `linear-gradient(135deg, ${Brand.accent} 0%, ${Brand.accentLight} 100%)`,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 1.55,
    boxShadow: '0 6px 16px rgba(5,4,170,0.22), inset 0 1px 0 rgba(255,255,255,0.14)',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
    boxSizing: 'border-box',
  },
  aiMessageRow: { display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', maxWidth: '100%' },
  aiAvatarWrap: { position: 'relative', width: 30, height: 30, flexShrink: 0, marginTop: 2 },
  aiAvatarRing: {
    position: 'absolute',
    inset: -3,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(5,4,170,0.24) 0%, rgba(5,4,170,0) 70%)',
    pointerEvents: 'none',
  },
  aiAvatar: {
    position: 'relative',
    width: 30, height: 30,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
  aiText: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' },
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
  editWrap: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: '100%', boxSizing: 'border-box' },
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
  editActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  editCancel: {
    padding: '8px 14px',
    borderRadius: 10,
    border: `1px solid ${Brand.border}`,
    backgroundColor: '#fff',
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
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
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(5,4,170,0.25)',
  },
  cardStack: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
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
    display: 'flex', flexDirection: 'column', textAlign: 'left',
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%',
    fontFamily: 'inherit',
  },
  tileImageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    backgroundColor: '#EEF2FF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  tileImage: { width: '100%', height: '100%', objectFit: 'cover' },
  tileImageOverlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(180deg, rgba(15,23,42,0) 45%, rgba(15,23,42,0.42) 100%)',
    pointerEvents: 'none',
  },
  tilePlaceholder: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  tileBadge: {
    position: 'absolute', top: 10, left: 10,
    fontSize: 9, fontWeight: 800, letterSpacing: 0.7,
    color: '#fff', padding: '4px 8px', borderRadius: 7,
    textTransform: 'uppercase',
    boxShadow: '0 2px 6px rgba(15,23,42,0.15)',
  },
  tileVerified: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(15,23,42,0.15)',
  },
  tilePriceChip: {
    position: 'absolute', bottom: 10, right: 10,
    padding: '5px 10px', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(6px)',
    color: Brand.accent, fontSize: 12, fontWeight: 800, letterSpacing: -0.1,
    boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
  },
  tileDistancePill: {
    position: 'absolute', bottom: 10, left: 10,
    display: 'flex', alignItems: 'center',
    padding: '4px 8px', borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.72)',
    backdropFilter: 'blur(6px)',
    color: '#fff', fontSize: 10, fontWeight: 700,
  },
  tileBody: { padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', gap: 5 },
  tileTitle: {
    fontSize: 14, fontWeight: 700, color: Brand.textPrimary, lineHeight: 1.3,
    overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    letterSpacing: -0.1,
  },
  tileSubtitle: {
    fontSize: 12, color: '#64748B',
    display: 'flex', alignItems: 'center',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    marginTop: 2,
  },
  tileTravel: {
    fontSize: 11, color: '#94A3B8', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
  },
  tileTravelDot: { width: 5, height: 5, borderRadius: '50%', backgroundColor: '#10B981' },
  tileFooter: { display: 'flex', borderTop: `1px solid ${Brand.borderSoft}` },
  tileFooterBtn: {
    flex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 4,
    padding: '10px 8px',
    backgroundColor: 'transparent',
    border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, color: Brand.accent,
    fontFamily: 'inherit',
  },
  refineRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 42,
  },
  refineChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 999,
    border: `1px solid ${Brand.border}`,
    backgroundColor: Brand.cardBg,
    color: Brand.textPrimary,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: Brand.shadowSm,
  },
  actionBar: { display: 'flex', gap: 2, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6,
  },
  inputArea: {
    padding: '8px 16px 12px',
    backgroundColor: Brand.bg,
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  inputBox: {
    maxWidth: 860,
    margin: '0 auto',
    backgroundColor: Brand.cardBg,
    borderRadius: 22,
    border: `1px solid ${Brand.border}`,
    boxShadow: Brand.shadowMd,
    padding: '4px 6px 0',
    transition: 'box-shadow 220ms, border-color 220ms',
  },
  inputBoxFocused: { borderColor: '#C7CCFF', boxShadow: Brand.shadowBloom },
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
    maxHeight: 160,
  },
  inputActions: { display: 'flex', alignItems: 'center', padding: '4px 6px 6px' },
  inputIconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
    transition: 'background 0.15s',
  },
  inputIconBtnRecording: { background: '#DC2626' },
  sendBtn: {
    width: 38, height: 38, borderRadius: 12, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 160ms, box-shadow 200ms, background 200ms',
    cursor: 'pointer',
  },
  sendBtnActive: {
    background: `linear-gradient(135deg, ${Brand.accent}, ${Brand.accentLight})`,
    boxShadow: '0 6px 16px rgba(5,4,170,0.30)',
  },
  sendBtnDisabled: { backgroundColor: '#E6E8F0', cursor: 'not-allowed' },
  disclaimer: {
    fontSize: 11,
    color: Brand.textMuted,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.1,
    maxWidth: 860,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  toastStack: {
    position: 'fixed',
    top: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', flexDirection: 'column', gap: 8,
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
    fontFamily: 'inherit',
    animation: 'seaiToastIn 220ms ease-out both',
  },
  toastSuccess: { backgroundColor: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' },
  toastError: { backgroundColor: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' },
};

// ─── Global CSS ─────────────────────────────────────────────────────
const GLOBAL_CSS = `
  html, body { overflow-x: hidden; max-width: 100vw; }

  .seai-md-bold { font-weight: 700; color: #0A0A14; letter-spacing: -0.01em; }
  .seai-md-italic { font-style: italic; color: #545B6E; }
  .seai-md-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
    padding: 1px 6px;
    border-radius: 6px;
    background: #F1F5F9;
    color: #0504AA;
    border: 1px solid #E2E8F0;
  }
  .seai-md-price {
    font-weight: 800;
    color: #0504AA;
    background: linear-gradient(180deg, #EEEDFF 0%, #E0DFFF 100%);
    padding: 1px 7px;
    border-radius: 6px;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .seai-mini-spinner {
    display: inline-block;
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid #E2E8F0;
    border-top-color: #0504AA;
    animation: seaiSpin 0.7s linear infinite;
  }

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
    width: 340px; height: 340px; top: -100px; left: -100px;
    background: radial-gradient(circle, rgba(5,4,170,0.22) 0%, rgba(5,4,170,0) 68%);
    animation: seaiFloatOrb 24s ease-in-out infinite;
  }
  .seai-orb-b {
    width: 420px; height: 420px; bottom: -140px; right: -140px;
    background: radial-gradient(circle, rgba(61,59,255,0.18) 0%, rgba(61,59,255,0) 68%);
    animation: seaiFloatOrb 30s ease-in-out infinite reverse;
  }
  @keyframes seaiFloatOrb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%      { transform: translate(28px, -22px) scale(1.08); }
    66%      { transform: translate(-22px, 26px) scale(0.96); }
  }

  .seai-logo-glow { animation: seaiLogoBreathe 3.6s ease-in-out infinite; }
  @keyframes seaiLogoBreathe {
    0%, 100% { transform: scale(1);    opacity: 0.5; }
    50%      { transform: scale(1.14); opacity: 0.9; }
  }

  .seai-greeting { animation: seaiGreet 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @keyframes seaiGreet {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .seai-chip {
    animation: seaiChipIn 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: transform 220ms, box-shadow 220ms, border-color 220ms;
  }
  .seai-chip:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 26px rgba(5,4,170,0.10), 0 2px 6px rgba(15,23,42,0.05);
    border-color: #C7CCFF;
  }
  .seai-chip:active { transform: translateY(0) scale(0.985); }
  @keyframes seaiChipIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .seai-msg-row { animation: seaiMsgIn 340ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @keyframes seaiMsgIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .seai-thinking {
    display: inline-flex; align-items: center; gap: 12px;
    padding: 4px 0; height: 28px;
  }
  .seai-thinking-orb {
    position: relative;
    width: 18px; height: 18px; border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #3D3BFF 0%, #0504AA 70%);
    box-shadow: 0 0 12px rgba(5,4,170,0.45);
    flex-shrink: 0;
  }
  .seai-thinking-orbInner {
    position: absolute; inset: -4px;
    border-radius: 50%;
    border: 1.5px solid rgba(5,4,170,0.35);
    animation: seaiOrbPulse 1.6s ease-out infinite;
  }
  @keyframes seaiOrbPulse {
    0%   { transform: scale(0.8); opacity: 0.8; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  .seai-thinking-text {
    display: inline-block;
    font-size: 14px; font-weight: 500;
    color: #5A6178; letter-spacing: 0.01em;
    animation: seaiVerbSwap 420ms ease both;
  }
  @keyframes seaiVerbSwap {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes seaiCursorPulse {
    0%, 100% { transform: scale(0.85); opacity: 0.7; }
    50%      { transform: scale(1.15); opacity: 1; }
  }
  .seai-cursor {
    display: inline-block;
    width: 8px; height: 18px;
    border-radius: 3px;
    margin-left: 4px;
    vertical-align: text-bottom;
    background: linear-gradient(180deg, #3D3BFF 0%, #0504AA 100%);
    box-shadow: 0 0 10px rgba(5,4,170,0.5);
    animation: seaiCursorPulse 1.05s ease-in-out infinite;
  }

  .seai-tile:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 30px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06);
    border-color: #DDE3F5;
  }
  .seai-tile:active { transform: translateY(-1px); }

  .seai-refine-chip { transition: background 150ms, border-color 150ms, transform 120ms; }
  .seai-refine-chip:hover { border-color: #C7CCFF; background: #FAFAFF; }
  .seai-refine-chip:active { transform: scale(0.97); }
  .seai-refine-chip:disabled { opacity: 0.5; cursor: not-allowed; }

  .seai-send:hover:not(:disabled) { transform: scale(1.06); }
  .seai-send:active:not(:disabled) { transform: scale(0.96); }

  .seai-recent-item { transition: background-color 140ms, color 140ms; }
  .seai-recent-item:hover { background-color: #EEEDFF; color: #0504AA; }
  .seai-recent-item:active { background-color: #E2E1FF; }

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

  .seai-model-dot { animation: seaiModelPulse 2.2s ease-in-out infinite; }
  @keyframes seaiModelPulse {
    0%, 100% { transform: scale(1);   opacity: 0.9; }
    50%      { transform: scale(1.2); opacity: 0.5; }
  }

  @keyframes seaiToastIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes seaiFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes seaiSpin { to { transform: rotate(360deg); } }

  @media (max-width: 640px) {
    .seai-chat-list { padding: 12px !important; }
    .seai-card-stack { grid-template-columns: 1fr !important; gap: 12px !important; }
    .seai-sidebar { width: 82% !important; max-width: 320px; }
    .seai-suggestions { grid-template-columns: 1fr !important; max-width: 100% !important; }
    .seai-header { padding: 6px 8px !important; }
    .seai-header-brand-text { display: none; }
    .seai-input-area { padding: 6px 10px 10px !important; }
    .seai-container { width: 100vw !important; max-width: 100vw !important; }
    .seai-body { width: 100% !important; max-width: 100vw !important; overflow-x: hidden !important; }
    .seai-msg-row, .seai-user-wrap, .seai-main { width: 100% !important; max-width: 100% !important; }
    .seai-user-bubble { max-width: 88% !important; }
    .seai-refine-row { padding-left: 0 !important; }
  }

  @media (max-width: 380px) {
    .seai-chat-list { padding: 10px !important; }
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