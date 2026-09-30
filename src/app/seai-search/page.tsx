'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../services/api';
import {
  MdArrowBack,
  MdSearch,
  MdClear,
  MdAutoAwesome,
  MdErrorOutline,
  MdSearchOff,
  MdStore,
  MdBuild,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
  listing_id?: string;
  store_id?: string;
  title?: string;
  price?: number | string;
  image_url?: string;
  store_name?: string;
  type?: 'product' | 'service' | 'store';
  [key: string]: unknown;
}

interface Suggestion {
  label: string;
  type: 'product' | 'service' | 'store';
  listing_id: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
    position: 'relative',
  },
  shell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: 880,
    margin: '0 auto',
    minHeight: 0,
  },
  appBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 8px',
    backgroundColor: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border-subtle)',
    gap: 8,
    zIndex: 10,
  },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 10,
    height: 40,
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 15,
    color: 'var(--text-primary)',
    padding: '0 12px',
  },
  suffixContainer: { position: 'absolute', right: 8, display: 'flex', alignItems: 'center' },
  suffixBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' },
  aiPill: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 16, border: '1px solid', cursor: 'pointer' },
  searchBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' },
  suggestionsDropdown: {
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-md)',
    zIndex: 9,
  },
  suggestionItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    fontSize: 14,
    color: 'var(--text-primary)',
    textAlign: 'left',
  },
  body: { flex: 1, overflowY: 'auto' },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 20,
    textAlign: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    marginTop: 16,
    padding: '10px 20px',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--brand-on-primary)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  resultsList: { padding: '12px 16px' },
  resultItem: {
    display: 'flex',
    gap: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 12,
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer',
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  resultTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--brand-primary)',
    margin: '4px 0 0',
    fontVariantNumeric: 'tabular-nums',
  },
  resultStore: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    margin: '2px 0 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typeBadge: {
    display: 'inline-block',
    marginTop: 4,
    padding: '2px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--text-tertiary)',
    alignSelf: 'flex-start',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}

function SearchResultItem({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  const title = item.title ?? 'Untitled';
  const price = item.price != null ? `₦${Number(item.price).toFixed(0)}` : 'Price N/A';
  const image = resolveImageUrl(item.image_url);
  const storeName = item.store_name ?? '';
  const type = item.type ?? 'product';

  return (
    <div style={styles.resultItem} onClick={onPress}>
      <div style={styles.resultImage}>
        {image
          ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : type === 'service'
            ? <MdBuild size={28} color="var(--text-muted)" />
            : <MdStore size={28} color="var(--text-muted)" />
        }
      </div>
      <div style={styles.resultInfo}>
        <p style={styles.resultTitle}>{title}</p>
        <p style={styles.resultPrice}>{price}</p>
        {storeName ? <p style={styles.resultStore}>{storeName}</p> : null}
        <span style={styles.typeBadge}>{type}</span>
      </div>
    </div>
  );
}

// ─── Page Content ─────────────────────────────────────────────────────────────
function SeaiSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const lat = parseFloat(searchParams.get('lat') || '') || 5.5103;
  const lng = parseFloat(searchParams.get('lng') || '') || 7.0265;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAIMode, setIsAIMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim() || isAIMode) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = (await api.suggest(query.trim(), lat, lng, 500, 10)) as Suggestion[];
        if (!isMountedRef.current) return;
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {
        if (!isMountedRef.current) return;
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isAIMode, lat, lng]);

  const runSearch = async (text: string) => {
    setIsLoading(true);
    setHasSearched(true);
    setError(null);
    try {
      const data = (await api.search(text, lat, lng, 500, 0, 50)) as SearchResult[];
      if (!isMountedRef.current) return;
      setResults(data);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  const performSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setShowSuggestions(false);
    if (isAIMode) {
      router.push(`/seai/ask?query=${encodeURIComponent(trimmed)}&lat=${lat}&lng=${lng}`);
      return;
    }
    await runSearch(trimmed);
  };

  const handleSuggestionTap = (s: Suggestion) => {
    setQuery(s.label);
    setShowSuggestions(false);
    runSearch(s.label);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setHasSearched(false);
    setError(null);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const toggleAIMode = () => {
    setIsAIMode((prev) => !prev);
    setShowSuggestions(false);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleResultPress = (item: SearchResult) => {
    if (item.type === 'service') {
      if (item.listing_id) router.push(`/service-detail/${item.listing_id}`);
    } else if (item.type === 'store') {
      if (item.store_id) router.push(`/store-detail/${item.store_id}`);
    } else {
      if (item.listing_id) router.push(`/item-detail/${item.listing_id}`);
    }
  };

  const renderSuffix = () => {
    if (query) {
      return (
        <button onClick={clearSearch} style={styles.suffixBtn} title="Clear">
          <MdClear size={20} color="var(--text-muted)" />
        </button>
      );
    }
    return (
      <button
        onClick={toggleAIMode}
        style={{
          ...styles.aiPill,
          backgroundColor: isAIMode ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
          borderColor: isAIMode ? 'transparent' : 'var(--border-default)',
        }}
      >
        <MdAutoAwesome size={16} color={isAIMode ? 'var(--brand-on-primary)' : 'var(--brand-primary)'} />
        <span style={{
          color: isAIMode ? 'var(--brand-on-primary)' : 'var(--brand-primary)',
          fontWeight: 500,
          fontSize: 13,
        }}>
          AI Mode
        </span>
      </button>
    );
  };

  const renderBody = () => {
    if (isLoading) return (
      <div style={styles.center}><div style={styles.spinner} /></div>
    );
    if (error) return (
      <div style={styles.center}>
        <MdErrorOutline size={48} color="var(--danger-fg)" />
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Something went wrong</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>{error}</p>
        <button onClick={performSearch} style={styles.retryBtn}>Retry</button>
      </div>
    );
    if (!hasSearched) return (
      <div style={styles.center}>
        <MdSearch size={64} color="var(--border-strong)" />
        <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>Search for anything</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Items, stores, services near you</p>
      </div>
    );
    if (results.length === 0) return (
      <div style={styles.center}>
        <MdSearchOff size={48} color="var(--border-strong)" />
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>No results found</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Try a different keyword or location</p>
      </div>
    );
    return (
      <div style={styles.resultsList}>
        {results.map((item, idx) => (
          <SearchResultItem key={idx} item={item} onPress={() => handleResultPress(item)} />
        ))}
      </div>
    );
  };

  return (
    <main style={styles.container}>
      <div style={styles.shell}>
        {/* App Bar */}
        <div style={styles.appBar}>
          <button style={styles.backBtn} onClick={() => router.back()}>
            <MdArrowBack size={24} color="var(--text-primary)" />
          </button>

          <div style={styles.searchBox}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') performSearch(); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={isAIMode ? 'Ask SEAI anything…' : 'Search items, stores, services…'}
              style={styles.searchInput}
              autoComplete="off"
            />
            <div style={styles.suffixContainer}>{renderSuffix()}</div>
          </div>

          <button style={styles.searchBtn} onClick={performSearch}>
            <MdSearch size={24} color="var(--brand-primary)" />
          </button>
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={styles.suggestionsDropdown}>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                style={styles.suggestionItem}
                onMouseDown={(e) => { e.preventDefault(); handleSuggestionTap(s); }}
              >
                <span style={{ marginRight: 8, display: 'flex', alignItems: 'center' }}>
                  {s.type === 'service' ? <MdBuild size={18} color="var(--text-muted)" /> :
                   s.type === 'store'   ? <MdStore size={18} color="var(--text-muted)" /> :
                                          <MdSearch size={18} color="var(--text-muted)" />}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={styles.body}>{renderBody()}</div>
      </div>
    </main>
  );
}

export default function SeaiSearchPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-primary)' }}>Loading search…</div>}>
      <SeaiSearchContent />
    </Suspense>
  );
}

// Inject the `spin` keyframe — the original file referenced it but never defined it,
// so the spinner never animated. Folded into the dark-theme pass.
if (typeof document !== 'undefined' && !document.getElementById('seai-search-global-css')) {
  const s = document.createElement('style');
  s.id = 'seai-search-global-css';
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
}