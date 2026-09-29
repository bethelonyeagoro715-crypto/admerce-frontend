'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { confirmDialog, alertDialog } from '../../../components/ui/dialogs';
import {
  MdSearch,
  MdInventory2,
  MdEdit,
  MdDeleteOutline,
  MdAdd,
  MdClose,
  MdRefresh,
  MdErrorOutline,
  MdImage,
  MdStorefront,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface StoreItem {
  listing_id: string;
  title?: string;
  price?: number | string;
  image_url?: string;
  image_width?: number | null;
  image_height?: number | null;
  category?: string | null;
  quantity_total?: number | null;
  quantity_available?: number | null;
  created_at?: string;
  [key: string]: unknown;
}

type StockFilter = 'all' | 'in' | 'low' | 'out';

// ─── Helpers ────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
    return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function formatPrice(raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return '₦0';
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

function stockState(item: StoreItem): 'in' | 'low' | 'out' {
  const available = item.quantity_available ?? 0;
  const total = item.quantity_total ?? available;
  if (available <= 0) return 'out';
  if (total > 0 && available <= Math.max(1, Math.floor(total * 0.2))) {
    return 'low';
  }
  return 'in';
}

// ─── Component ──────────────────────────────────────────────────────
export default function StorekeeperItemsPage() {
  useAuthGuard();
  const router = useRouter();

  const [allItems, setAllItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadItems = useCallback(async (showSpinner = true) => {
    const seq = ++reqSeq.current;
    if (showSpinner) setLoading(true);
    setErrored(false);
    try {
      const store = (await api.getMyStore()) as { store_id?: string } | null;
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      if (!store?.store_id) {
        setStoreId(null);
        setAllItems([]);
        return;
      }
      setStoreId(store.store_id);
      const items = (await api.getStoreItems(store.store_id)) as StoreItem[];
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setAllItems(Array.isArray(items) ? items : []);
    } catch {
      if (seq === reqSeq.current && isMountedRef.current) setErrored(true);
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadItems();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadItems]);

  // ── Derived ────────────────────────────────────────────────────
  const counts = useMemo(() => {
    let inStock = 0;
    let low = 0;
    let out = 0;
    for (const it of allItems) {
      const s = stockState(it);
      if (s === 'in') inStock++;
      else if (s === 'low') low++;
      else out++;
    }
    return { inStock, low, out, total: allItems.length };
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allItems.filter((item) => {
      if (stockFilter !== 'all') {
        const s = stockState(item);
        if (stockFilter === 'in' && s !== 'in') return false;
        if (stockFilter === 'low' && s !== 'low') return false;
        if (stockFilter === 'out' && s !== 'out') return false;
      }
      if (q && !(item.title || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allItems, searchQuery, stockFilter]);

  // ── Actions ────────────────────────────────────────────────────
  const handleEdit = (id: string) => {
    router.push(`/storekeeper/edit-item/${id}`);
  };

  const handleDelete = async (item: StoreItem) => {
    const ok = await confirmDialog({
      title: 'Delete item?',
      body: `"${item.title || 'Untitled'}" will be removed permanently. This can't be undone.`,
      kind: 'danger',
    });
    if (!ok) return;

    setDeletingId(item.listing_id);
    // Optimistic removal
    const previous = allItems;
    setAllItems((prev) =>
      prev.filter((it) => it.listing_id !== item.listing_id),
    );

    try {
      await api.deleteListing(item.listing_id);
    } catch (err) {
      // Roll back
      if (isMountedRef.current) setAllItems(previous);
      await alertDialog({
        title: 'Could not delete',
        body: extractErrorDetail(
          err,
          'Something went wrong. Please try again.',
        ),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setDeletingId(null);
    }
  };

  const goToAddItem = () => router.push('/storekeeper/add-item');

  // ── Loading skeleton ───────────────────────────────────────────
  if (loading) {
    return (
      <main style={css.root} className="sk-items">
        <style>{CSS}</style>
        <div style={css.headerWrap}>
          <div style={css.headerInner}>
            <div style={css.skelLine} />
            <div style={{ ...css.skelLine, width: 100 }} />
          </div>
        </div>
        <div style={css.sheet}>
          <div style={css.searchSkeleton} />
          <div style={css.pillRowSkeleton} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={css.itemSkeleton} />
          ))}
        </div>
      </main>
    );
  }

  // ── Error ──────────────────────────────────────────────────────
  if (errored) {
    return (
      <main style={css.centerRoot}>
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="#B91C1C" />
        </div>
        <h2 style={css.centerTitle}>Couldn&apos;t load your items</h2>
        <p style={css.centerBody}>
          Check your connection and try again. If this keeps happening, sign
          out and back in.
        </p>
        <button onClick={() => void loadItems()} style={css.retryBtn}>
          <MdRefresh size={18} color="#fff" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  // ── No store yet ───────────────────────────────────────────────
  if (!storeId && allItems.length === 0) {
    return (
      <main style={css.centerRoot}>
        <style>{CSS}</style>
        <div style={css.setupHalo}>
          <MdStorefront size={40} color="#0504AA" />
        </div>
        <h2 style={css.centerTitle}>No store yet</h2>
        <p style={css.centerBody}>
          Create your store first, then you can start listing items.
        </p>
        <button
          onClick={() => router.push('/storekeeper/onboarding')}
          style={css.retryBtn}
        >
          <span>Set up store</span>
        </button>
      </main>
    );
  }

  // ── Main ───────────────────────────────────────────────────────
  const hasNoItems = allItems.length === 0;
  const hasNoMatches = !hasNoItems && filteredItems.length === 0;

  return (
    <main style={css.root} className="sk-items">
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={css.title}>My items</h1>
            <div style={css.subtitle}>
              {hasNoItems
                ? 'List your first product'
                : `${counts.total} item${counts.total === 1 ? '' : 's'} · ${
                    counts.inStock
                  } in stock`}
            </div>
          </div>
          {!hasNoItems && (
            <button
              type="button"
              onClick={goToAddItem}
              style={css.addBtn}
              className="sk-add-btn"
            >
              <MdAdd size={20} color="#fff" />
              <span className="sk-add-label">Add</span>
            </button>
          )}
        </div>
      </div>

      <div style={css.sheet}>
        {hasNoItems ? (
          // ── EMPTY STATE ──────────────────────────────────────
          <div style={css.emptyState}>
            <div style={css.emptyHalo}>
              <MdInventory2 size={44} color="#0504AA" />
            </div>
            <h2 style={css.emptyTitle}>No items yet</h2>
            <p style={css.emptyBody}>
              Add your first product to start selling on Admerce. It takes
              about 30 seconds — photo, title, price.
            </p>
            <button onClick={goToAddItem} style={css.emptyPrimary}>
              <MdAdd size={20} color="#fff" />
              <span>Add your first item</span>
            </button>
          </div>
        ) : (
          <>
            {/* SEARCH */}
            <div style={css.searchWrap}>
              <MdSearch size={18} color="#94A3B8" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search your items"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                style={css.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={css.searchClear}
                  aria-label="Clear search"
                >
                  <MdClose size={14} color="#64748B" />
                </button>
              )}
            </div>

            {/* STOCK FILTER PILLS */}
            <div style={css.pillRow}>
              <FilterPill
                label="All"
                count={counts.total}
                active={stockFilter === 'all'}
                onClick={() => setStockFilter('all')}
              />
              <FilterPill
                label="In stock"
                count={counts.inStock}
                active={stockFilter === 'in'}
                tint={{ bg: '#DCFCE7', color: '#166534' }}
                onClick={() => setStockFilter('in')}
              />
              <FilterPill
                label="Low"
                count={counts.low}
                active={stockFilter === 'low'}
                tint={{ bg: '#FEF3C7', color: '#92400E' }}
                onClick={() => setStockFilter('low')}
              />
              <FilterPill
                label="Out"
                count={counts.out}
                active={stockFilter === 'out'}
                tint={{ bg: '#FEE2E2', color: '#991B1B' }}
                onClick={() => setStockFilter('out')}
              />
            </div>

            {/* LIST */}
            {hasNoMatches ? (
              <div style={css.noMatchWrap}>
                <div style={css.noMatchHalo}>
                  <MdSearch size={32} color="#94A3B8" />
                </div>
                <div style={css.noMatchTitle}>No matches</div>
                <div style={css.noMatchBody}>
                  Try a different word, or clear the filters.
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStockFilter('all');
                  }}
                  style={css.clearAllBtn}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div style={css.list} className="sk-item-list">
                {filteredItems.map((item) => (
                  <ItemRow
                    key={item.listing_id}
                    item={item}
                    isDeleting={deletingId === item.listing_id}
                    onEdit={() => handleEdit(item.listing_id)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ height: 32 }} />
      </div>
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────
function FilterPill({
  label,
  count,
  active,
  tint,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tint?: { bg: string; color: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...css.pill,
        borderColor: active ? '#0504AA' : '#E6E8F0',
        backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
      }}
    >
      <span
        style={{
          color: active ? '#0504AA' : '#475569',
          fontWeight: active ? 800 : 700,
          fontSize: 12.5,
        }}
      >
        {label}
      </span>
      <span
        style={{
          ...css.pillCount,
          backgroundColor: tint?.bg ?? (active ? '#FFFFFF' : '#F1F5F9'),
          color: tint?.color ?? (active ? '#0504AA' : '#64748B'),
        }}
      >
        {count}
      </span>
    </button>
  );
}

function ItemRow({
  item,
  isDeleting,
  onEdit,
  onDelete,
}: {
  item: StoreItem;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const image = resolveImageUrl(item.image_url);
  const state = stockState(item);
  const available = item.quantity_available ?? 0;

  const stockBadge =
    state === 'out'
      ? { text: 'Out of stock', bg: '#FEE2E2', color: '#991B1B' }
      : state === 'low'
        ? { text: `${available} left`, bg: '#FEF3C7', color: '#92400E' }
        : { text: `${available} in stock`, bg: '#DCFCE7', color: '#166534' };

  return (
    <div
      style={{
        ...css.itemCard,
        opacity: isDeleting ? 0.5 : 1,
      }}
      className="sk-item-card"
    >
      <button
        type="button"
        onClick={onEdit}
        style={css.itemMain}
        aria-label={`Edit ${item.title || 'item'}`}
      >
        <div style={css.thumb}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" style={css.thumbImg} loading="lazy" />
          ) : (
            <div style={css.thumbPlaceholder}>
              <MdImage size={22} color="#94A3B8" />
            </div>
          )}
        </div>

        <div style={css.itemInfo}>
          <div style={css.itemTitle} title={item.title}>
            {item.title || 'Untitled'}
          </div>
          <div style={css.itemMeta}>
            <span style={css.itemPrice}>{formatPrice(item.price)}</span>
            <span
              style={{
                ...css.stockChip,
                backgroundColor: stockBadge.bg,
                color: stockBadge.color,
              }}
            >
              {stockBadge.text}
            </span>
          </div>
        </div>
      </button>

      <div style={css.itemActions}>
        <button
          type="button"
          onClick={onEdit}
          style={css.iconBtn}
          disabled={isDeleting}
          title="Edit"
          aria-label="Edit"
        >
          <MdEdit size={18} color="#0504AA" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={css.iconBtnDanger}
          disabled={isDeleting}
          title="Delete"
          aria-label="Delete"
        >
          {isDeleting ? (
            <div style={css.smallSpinner} />
          ) : (
            <MdDeleteOutline size={18} color="#DC2626" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Interaction CSS + desktop layout ───────────────────────────────
const CSS = `
  @keyframes skSpin { to { transform: rotate(360deg); } }
  @keyframes skShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  .sk-items,
  .sk-items *,
  .sk-items *::before,
  .sk-items *::after {
    box-sizing: border-box;
  }

  .sk-add-btn {
    transition: transform 0.12s ease, box-shadow 0.15s ease;
  }
  .sk-add-btn:hover {
    box-shadow: 0 12px 24px rgba(5,4,170,0.32);
  }
  .sk-add-btn:active {
    transform: scale(0.97);
  }

  .sk-item-card {
    transition: box-shadow 0.15s ease, transform 0.12s ease;
  }
  .sk-item-card:hover {
    box-shadow: 0 10px 24px rgba(15,23,42,0.06) !important;
  }

  /* Desktop: wider column, 2-col grid, tighter add button */
  @media (min-width: 1024px) {
    .sk-items .sk-items-inner {
      max-width: 1080px;
    }
    .sk-item-list {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .sk-item-list > div {
      margin-bottom: 0 !important;
    }
  }
`;

// ─── Styles ─────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    overflowX: 'hidden',
  },

  // HEADER
  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    backgroundColor: '#0504AA',
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    padding: '14px 20px',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: 600,
    marginTop: 3,
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    border: 'none',
    color: '#0504AA',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
  },

  // SHEET
  sheet: {
    flex: 1,
    padding: '16px 20px 40px',
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },

  // SEARCH
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    border: '1px solid #EAECF3',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14.5,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  searchClear: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // PILLS
  pillRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 8px 7px 14px',
    borderRadius: 999,
    border: '1.5px solid',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s, border-color 0.15s',
  },
  pillCount: {
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontVariantNumeric: 'tabular-nums',
  },

  // LIST
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 16,
  },

  // ITEM CARD
  itemCard: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
  },
  itemMain: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 4px 12px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    minWidth: 0,
  },
  thumb: {
    width: 72,
    height: 72,
    flexShrink: 0,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F4F5FB',
    border: '1px solid #EAECF3',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.3,
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0504AA',
    fontVariantNumeric: 'tabular-nums',
  },
  stockChip: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.2,
    padding: '3px 8px',
    borderRadius: 999,
  },

  // ACTIONS
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '0 8px',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EEF0FF',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s',
  },
  iconBtnDanger: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s',
  },
  smallSpinner: {
    width: 16,
    height: 16,
    border: '2px solid #FECACA',
    borderTopColor: '#DC2626',
    borderRadius: '50%',
    animation: 'skSpin 0.7s linear infinite',
  },

  // EMPTY
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '56px 24px',
    textAlign: 'center',
  },
  emptyHalo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7D2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
    margin: '8px 0 24px',
    maxWidth: 340,
    lineHeight: 1.55,
  },
  emptyPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 22px',
    borderRadius: 14,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 12px 24px rgba(5,4,170,0.28)',
  },

  // NO MATCHES
  noMatchWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  noMatchHalo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noMatchTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0B0B1A',
  },
  noMatchBody: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 1.5,
  },
  clearAllBtn: {
    marginTop: 16,
    padding: '10px 18px',
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    border: 'none',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // CENTER SCREENS (error / no store)
  centerRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    padding: 24,
    textAlign: 'center',
  },
  errorHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  setupHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7D2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  centerBody: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    maxWidth: 340,
    lineHeight: 1.55,
  },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: '13px 24px',
    borderRadius: 14,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
  },

  // SKELETONS
  skelLine: {
    height: 14,
    width: 180,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  searchSkeleton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  pillRowSkeleton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 12,
    maxWidth: 400,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  itemSkeleton: {
    height: 100,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 10,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
};