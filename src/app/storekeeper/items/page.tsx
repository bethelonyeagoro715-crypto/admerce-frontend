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

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
    return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
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
      const store = (await api.getMyStore()) as {
        store_id?: string;
      } | null;
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      if (!store?.store_id) {
        setStoreId(null);
        setAllItems([]);
        return;
      }
      setStoreId(store.store_id);
      const items = (await api.getStoreItems(
        store.store_id,
      )) as StoreItem[];
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setAllItems(Array.isArray(items) ? items : []);
    } catch {
      if (seq === reqSeq.current && isMountedRef.current)
        setErrored(true);
    } finally {
      if (seq === reqSeq.current && isMountedRef.current)
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadItems();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadItems]);

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
      if (q && !(item.title || '').toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [allItems, searchQuery, stockFilter]);

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
    const previous = allItems;
    setAllItems((prev) =>
      prev.filter((it) => it.listing_id !== item.listing_id),
    );

    try {
      await api.deleteListing(item.listing_id);
    } catch (err) {
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

  if (errored) {
    return (
      <main style={css.centerRoot}>
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="var(--danger-fg)" />
        </div>
        <h2 style={css.centerTitle}>Couldn&apos;t load your items</h2>
        <p style={css.centerBody}>
          Check your connection and try again. If this keeps happening,
          sign out and back in.
        </p>
        <button onClick={() => void loadItems()} style={css.retryBtn}>
          <MdRefresh size={18} color="var(--brand-on-gradient)" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  if (!storeId && allItems.length === 0) {
    return (
      <main style={css.centerRoot}>
        <style>{CSS}</style>
        <div style={css.setupHalo}>
          <MdStorefront size={40} color="var(--brand-primary)" />
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

  const hasNoItems = allItems.length === 0;
  const hasNoMatches = !hasNoItems && filteredItems.length === 0;

  return (
    <main style={css.root} className="sk-items">
      <style>{CSS}</style>

      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={css.title}>My items</h1>
            <div style={css.subtitle}>
              {hasNoItems
                ? 'List your first product'
                : `${counts.total} item${
                    counts.total === 1 ? '' : 's'
                  } · ${counts.inStock} in stock`}
            </div>
          </div>
          {!hasNoItems && (
            <button
              type="button"
              onClick={goToAddItem}
              style={css.addBtn}
              className="sk-add-btn"
            >
              <MdAdd size={20} color="var(--brand-primary)" />
              <span className="sk-add-label">Add</span>
            </button>
          )}
        </div>
      </div>

      <div style={css.sheet}>
        {hasNoItems ? (
          <div style={css.emptyState}>
            <div style={css.emptyHalo}>
              <MdInventory2 size={44} color="var(--brand-primary)" />
            </div>
            <h2 style={css.emptyTitle}>No items yet</h2>
            <p style={css.emptyBody}>
              Add your first product to start selling on Admerce. It
              takes about 30 seconds — photo, title, price.
            </p>
            <button onClick={goToAddItem} style={css.emptyPrimary}>
              <MdAdd size={20} color="var(--brand-on-gradient)" />
              <span>Add your first item</span>
            </button>
          </div>
        ) : (
          <>
            <div style={css.searchWrap}>
              <MdSearch size={18} color="var(--text-muted)" />
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
                  <MdClose size={14} color="var(--text-tertiary)" />
                </button>
              )}
            </div>

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
                tint={{
                  bg: 'var(--success-bg)',
                  color: 'var(--success-fg)',
                }}
                onClick={() => setStockFilter('in')}
              />
              <FilterPill
                label="Low"
                count={counts.low}
                active={stockFilter === 'low'}
                tint={{
                  bg: 'var(--warning-bg)',
                  color: 'var(--warning-fg)',
                }}
                onClick={() => setStockFilter('low')}
              />
              <FilterPill
                label="Out"
                count={counts.out}
                active={stockFilter === 'out'}
                tint={{
                  bg: 'var(--danger-bg)',
                  color: 'var(--danger-fg)',
                }}
                onClick={() => setStockFilter('out')}
              />
            </div>

            {hasNoMatches ? (
              <div style={css.noMatchWrap}>
                <div style={css.noMatchHalo}>
                  <MdSearch size={32} color="var(--text-muted)" />
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
        borderColor: active
          ? 'var(--brand-primary)'
          : 'var(--border-default)',
        backgroundColor: active
          ? 'var(--brand-soft)'
          : 'var(--bg-secondary)',
      }}
    >
      <span
        style={{
          color: active
            ? 'var(--brand-primary)'
            : 'var(--text-secondary)',
          fontWeight: active ? 800 : 700,
          fontSize: 12.5,
        }}
      >
        {label}
      </span>
      <span
        style={{
          ...css.pillCount,
          backgroundColor:
            tint?.bg ??
            (active ? 'var(--bg-secondary)' : 'var(--bg-tertiary)'),
          color: tint?.color ?? (active
            ? 'var(--brand-primary)'
            : 'var(--text-tertiary)'),
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
      ? {
          text: 'Out of stock',
          bg: 'var(--danger-bg)',
          color: 'var(--danger-fg)',
        }
      : state === 'low'
        ? {
            text: `${available} left`,
            bg: 'var(--warning-bg)',
            color: 'var(--warning-fg)',
          }
        : {
            text: `${available} in stock`,
            bg: 'var(--success-bg)',
            color: 'var(--success-fg)',
          };

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
            <img
              src={image}
              alt=""
              style={css.thumbImg}
              loading="lazy"
            />
          ) : (
            <div style={css.thumbPlaceholder}>
              <MdImage size={22} color="var(--text-muted)" />
            </div>
          )}
        </div>

        <div style={css.itemInfo}>
          <div style={css.itemTitle} title={item.title}>
            {item.title || 'Untitled'}
          </div>
          <div style={css.itemMeta}>
            <span style={css.itemPrice}>
              {formatPrice(item.price)}
            </span>
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
          <MdEdit size={18} color="var(--brand-primary)" />
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
            <MdDeleteOutline size={18} color="var(--danger-fg)" />
          )}
        </button>
      </div>
    </div>
  );
}

const CSS = `
  @keyframes skSpin { to { transform: rotate(360deg); } }
  @keyframes skShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  .sk-items, .sk-items *, .sk-items *::before, .sk-items *::after {
    box-sizing: border-box;
  }

  .sk-add-btn {
    transition: transform 0.12s ease, box-shadow 0.15s ease;
  }
  .sk-add-btn:hover {
    box-shadow: 0 12px 24px
      color-mix(in srgb, var(--brand-on-gradient) 32%, transparent);
  }
  .sk-add-btn:active { transform: scale(0.97); }

  .sk-item-card {
    transition: box-shadow 0.15s ease, transform 0.12s ease,
      background-color 0.18s ease, border-color 0.18s ease;
  }
  .sk-item-card:hover {
    box-shadow: 0 10px 24px rgba(15,23,42,0.06) !important;
  }

  @media (min-width: 1024px) {
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

const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    overflowX: 'hidden',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },

  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--brand-gradient)',
    padding: '14px 20px',
    transition: 'background 0.18s ease',
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
    color: 'var(--brand-on-gradient)',
    margin: 0,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 78%, transparent)',
    fontWeight: 600,
    marginTop: 3,
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    borderRadius: 14,
    backgroundColor: 'var(--bg-secondary)',
    border: 'none',
    color: 'var(--brand-primary)',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-md)',
  },

  sheet: {
    flex: 1,
    padding: '16px 20px 40px',
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },

  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 14,
    border: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14.5,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  searchClear: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'var(--bg-tertiary)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 16,
  },

  itemCard: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
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
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-default)',
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
    backgroundColor: 'var(--bg-tertiary)',
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
    color: 'var(--text-primary)',
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
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  stockChip: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.2,
    padding: '3px 8px',
    borderRadius: 999,
  },

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
    backgroundColor: 'var(--brand-soft)',
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
    backgroundColor: 'var(--danger-bg)',
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
    border: '2px solid var(--danger-strong)',
    borderTopColor: 'var(--danger-fg)',
    borderRadius: '50%',
    animation: 'skSpin 0.7s linear infinite',
  },

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
    backgroundColor: 'var(--brand-soft)',
    border: '1px solid var(--brand-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },

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
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noMatchTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  noMatchBody: {
    fontSize: 13.5,
    color: 'var(--text-tertiary)',
    marginTop: 4,
    lineHeight: 1.5,
  },
  clearAllBtn: {
    marginTop: 16,
    padding: '10px 18px',
    borderRadius: 12,
    backgroundColor: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
    border: 'none',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  centerRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: 24,
    textAlign: 'center',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  errorHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  setupHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'var(--brand-soft)',
    border: '1px solid var(--brand-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  centerBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },

  skelLine: {
    height: 14,
    width: 180,
    borderRadius: 7,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 22%, transparent)',
  },
  searchSkeleton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  pillRowSkeleton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    marginTop: 12,
    maxWidth: 400,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  itemSkeleton: {
    height: 100,
    borderRadius: 18,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    marginTop: 10,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
};