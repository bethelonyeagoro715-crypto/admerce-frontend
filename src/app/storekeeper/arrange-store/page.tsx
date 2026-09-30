'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../../services/api';
import {
  MdDevicesOther,
  MdBakeryDining,
  MdHealthAndSafety,
  MdCheckroom,
  MdBuild,
  MdChair,
  MdToys,
  MdSportsSoccer,
  MdDirectionsCar,
  MdMenuBook,
  MdCategory,
  MdImage,
  MdArrowBack,
  MdArrowForward,
  MdSave,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

export const dynamic = 'force-dynamic';

// ─── Types ─────────────────────────────────────────────────────────
interface StoreItem {
  listing_id: string;
  title?: string;
  price?: number | string;
  image_url?: string;
  category?: string;
  sort_order?: number;
  [key: string]: unknown;
}

interface CategoryStyle {
  label: string;
  icon: IconType;
  accentVar: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  tech_electronics: {
    label: 'Tech & Electronics',
    icon: MdDevicesOther,
    accentVar: '--cat-tech',
  },
  food_beverage: {
    label: 'Food & Drinks',
    icon: MdBakeryDining,
    accentVar: '--cat-food',
  },
  health_beauty: {
    label: 'Health & Beauty',
    icon: MdHealthAndSafety,
    accentVar: '--cat-health',
  },
  health_wellness: {
    label: 'Health & Beauty',
    icon: MdHealthAndSafety,
    accentVar: '--cat-health',
  },
  fashion_apparel: {
    label: 'Fashion & Apparel',
    icon: MdCheckroom,
    accentVar: '--cat-fashion',
  },
  building_industrial: {
    label: 'Building & Hardware',
    icon: MdBuild,
    accentVar: '--cat-building',
  },
  home_garden: {
    label: 'Home & Garden',
    icon: MdChair,
    accentVar: '--cat-home',
  },
  kids_toys: {
    label: 'Kids & Toys',
    icon: MdToys,
    accentVar: '--cat-toys',
  },
  sports_outdoors: {
    label: 'Sports & Outdoors',
    icon: MdSportsSoccer,
    accentVar: '--cat-sports',
  },
  automotive: {
    label: 'Automotive',
    icon: MdDirectionsCar,
    accentVar: '--cat-auto',
  },
  media_office: {
    label: 'Media & Office',
    icon: MdMenuBook,
    accentVar: '--cat-media',
  },
};

const DEFAULT_STYLE: CategoryStyle = {
  label: 'Other',
  icon: MdCategory,
  accentVar: '--cat-other',
};

function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function isStoreItem(v: unknown): v is StoreItem {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as StoreItem).listing_id === 'string'
  );
}

// ─── Content ──────────────────────────────────────────────────────
function ArrangeStoreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('store_id') || '';

  const [items, setItems] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState('');

  const loadItems = async () => {
    setIsLoading(true);
    try {
      let sid = storeId;
      if (!sid) {
        const s = (await api.getMyStore()) as {
          store_id?: string;
        } | null;
        sid = s?.store_id || '';
      }
      if (sid) {
        const d = await api.getStoreItems(sid);
        setItems(Array.isArray(d) ? d.filter(isStoreItem) : []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadItems, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const saveOrder = async (ids: string[]) => {
    try {
      await api.updateItemOrder(ids);
      showToast('Shelf saved ✓');
    } catch {
      showToast('Failed to save');
    }
  };

  const moveItem = async (index: number, dir: 'left' | 'right') => {
    const next = dir === 'left' ? index - 1 : index + 1;
    if (next < 0 || next >= items.length) return;
    const arr = [...items];
    const [moved] = arr.splice(index, 1);
    arr.splice(next, 0, moved);
    setItems(arr);
    await saveOrder(arr.map((i) => i.listing_id));
  };

  const goBack = () => {
    if (
      typeof window !== 'undefined' &&
      window.history.length > 1
    ) {
      router.back();
    } else {
      router.push('/storekeeper/home');
    }
  };

  const shelves: { category: string; items: StoreItem[] }[] = [];
  const seenIndex: Record<string, number> = {};
  for (const it of items) {
    const cat = it.category || '';
    if (seenIndex[cat] === undefined) {
      seenIndex[cat] = shelves.length;
      shelves.push({ category: cat, items: [] });
    }
    shelves[seenIndex[cat]].items.push(it);
  }

  if (isLoading) {
    return (
      <main style={S.root} className="sk-arrange">
        <style>{CSS}</style>
        <div style={S.centerFill}>
          <div style={S.spinner} />
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main style={S.root} className="sk-arrange">
        <style>{CSS}</style>
        <Header onBack={goBack} onSave={() => saveOrder([])} hideSave />
        <div style={S.centerFill}>
          <div style={S.emptyHalo}>
            <MdImage size={34} color="var(--text-muted)" />
          </div>
          <p style={S.emptyTitle}>No items yet</p>
          <p style={S.emptyBody}>
            Add items to your store and they&apos;ll appear here, arranged
            by category.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={S.root} className="sk-arrange">
      <style>{CSS}</style>

      <Header
        onBack={goBack}
        onSave={() => saveOrder(items.map((i) => i.listing_id))}
      />

      <div style={S.scrollArea}>
        <p style={S.helper}>
          Use the ‹ › arrows on each item to move it along the shelf.
          Changes save automatically.
        </p>

        {shelves.map(({ category, items: catItems }) => {
          const sh = CATEGORY_STYLES[category] || DEFAULT_STYLE;
          return (
            <section
              key={category || 'uncategorized'}
              style={{
                ...S.shelfSection,
                ['--shelf-accent' as string]: `var(${sh.accentVar})`,
              }}
            >
              <div style={S.shelfTag}>
                <span style={S.shelfTagIcon}>
                  <sh.icon size={14} />
                </span>
                <span style={S.shelfTagLabel}>{sh.label}</span>
                <span style={S.shelfTagCount}>
                  {catItems.length}
                </span>
              </div>

              <div style={S.shelfRowWrap}>
                <div style={S.shelfRow}>
                  {catItems.map((item, localIdx) => {
                    const globalIdx = items.findIndex(
                      (x) => x.listing_id === item.listing_id,
                    );
                    const imgUrl = resolveImageUrl(item.image_url);
                    const title = item.title || 'Untitled';
                    const price =
                      item.price != null
                        ? `₦${Number(item.price).toLocaleString(
                            'en-NG',
                            { maximumFractionDigits: 0 },
                          )}`
                        : '';

                    const prevItem =
                      globalIdx > 0 ? items[globalIdx - 1] : null;
                    const nextItem =
                      globalIdx < items.length - 1
                        ? items[globalIdx + 1]
                        : null;

                    const canLeft =
                      prevItem !== null &&
                      (prevItem.category || '') === category;
                    const canRight =
                      nextItem !== null &&
                      (nextItem.category || '') === category;

                    return (
                      <article
                        key={item.listing_id}
                        style={S.shelfItem}
                        className="sk-shelf-item"
                      >
                        <div style={S.shelfItemImgWrap}>
                          {imgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imgUrl}
                              alt={title}
                              style={S.shelfItemImg}
                            />
                          ) : (
                            <div style={S.shelfItemImgFallback}>
                              <MdImage
                                size={26}
                                color="var(--text-muted)"
                              />
                            </div>
                          )}
                          <span style={S.shelfItemIndexBadge}>
                            {localIdx + 1}
                          </span>
                        </div>

                        <div style={S.shelfItemBody}>
                          <p
                            style={S.shelfItemTitle}
                            title={title}
                          >
                            {title}
                          </p>
                          {price && (
                            <p style={S.shelfItemPrice}>{price}</p>
                          )}
                        </div>

                        <div style={S.moveBar}>
                          <button
                            type="button"
                            onClick={() =>
                              canLeft && moveItem(globalIdx, 'left')
                            }
                            disabled={!canLeft}
                            style={{
                              ...S.moveBtn,
                              opacity: canLeft ? 1 : 0.3,
                              cursor: canLeft
                                ? 'pointer'
                                : 'not-allowed',
                            }}
                            aria-label="Move left"
                            title="Move left"
                          >
                            <MdArrowBack
                              size={16}
                              color={
                                canLeft
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)'
                              }
                            />
                          </button>
                          <span style={S.moveDivider} aria-hidden />
                          <button
                            type="button"
                            onClick={() =>
                              canRight &&
                              moveItem(globalIdx, 'right')
                            }
                            disabled={!canRight}
                            style={{
                              ...S.moveBtn,
                              opacity: canRight ? 1 : 0.3,
                              cursor: canRight
                                ? 'pointer'
                                : 'not-allowed',
                            }}
                            aria-label="Move right"
                            title="Move right"
                          >
                            <MdArrowForward
                              size={16}
                              color={
                                canRight
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)'
                              }
                            />
                          </button>
                        </div>

                        <span
                          style={S.shelfItemBase}
                          aria-hidden
                        />
                      </article>
                    );
                  })}
                </div>
                <div style={S.shelfEdge} aria-hidden>
                  <span style={S.shelfEdgeBracketLeft} />
                  <span style={S.shelfEdgeBracketRight} />
                </div>
              </div>
            </section>
          );
        })}

        <div style={{ height: 40 }} />
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </main>
  );
}

function Header({
  onBack,
  onSave,
  hideSave,
}: {
  onBack: () => void;
  onSave: () => void;
  hideSave?: boolean;
}) {
  return (
    <header style={S.header}>
      <button
        type="button"
        onClick={onBack}
        style={S.backBtn}
        aria-label="Back"
      >
        <MdArrowBack size={20} color="var(--brand-on-gradient)" />
      </button>
      <div style={S.headerText}>
        <h1 style={S.headerTitle}>Arrange store</h1>
        <div style={S.headerSub}>Customize your shelf layout</div>
      </div>
      {!hideSave && (
        <button
          type="button"
          onClick={onSave}
          style={S.saveBtn}
          aria-label="Save layout"
        >
          <MdSave size={16} color="var(--brand-on-gradient)" />
          <span style={S.saveLabel}>Save</span>
        </button>
      )}
    </header>
  );
}

export default function ArrangeStorePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
          }}
        >
          Loading store arrangement…
        </div>
      }
    >
      <ArrangeStoreContent />
    </Suspense>
  );
}

const CSS = `
  @keyframes skSpin { to { transform: rotate(360deg); } }
  @keyframes skFadeInUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes skToastIn {
    from { opacity: 0; transform: translate(-50%, 6px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  .sk-arrange, .sk-arrange *, .sk-arrange *::before, .sk-arrange *::after {
    box-sizing: border-box;
  }

  /* Shelf wood: light theme (oak) */
  .sk-arrange {
    --shelf-highlight: #E8C9A0;
    --shelf-face: #B8885C;
    --shelf-shadow: #7A5230;
    --shelf-bevel: rgba(255, 255, 255, 0.35);
    --shelf-drop: rgba(0, 0, 0, 0.22);

    --cat-tech:      #1A73E8;
    --cat-food:      #D84315;
    --cat-health:    #7B1FA2;
    --cat-fashion:   #E91E63;
    --cat-building:  #607D8B;
    --cat-home:      #388E3C;
    --cat-toys:      #F57C00;
    --cat-sports:    #2E7D32;
    --cat-auto:      #455A64;
    --cat-media:     #5D4037;
    --cat-other:     #7A7A7A;
  }

  [data-theme='dark'] .sk-arrange {
    --shelf-highlight: #3E3E42;
    --shelf-face: #26262A;
    --shelf-shadow: #141417;
    --shelf-bevel: rgba(232, 232, 236, 0.14);
    --shelf-drop: rgba(0, 0, 0, 0.55);

    --cat-tech:      #60A5FA;
    --cat-food:      #FB923C;
    --cat-health:    #C084FC;
    --cat-fashion:   #F472B6;
    --cat-building:  #94A3B8;
    --cat-home:      #4ADE80;
    --cat-toys:      #FBBF24;
    --cat-sports:    #34D399;
    --cat-auto:      #94A3B8;
    --cat-media:     #D6A97C;
    --cat-other:     #A1A1AA;
  }

  .sk-shelf-item {
    transition: transform 0.18s ease, box-shadow 0.22s ease;
    animation: skFadeInUp 0.24s ease both;
  }
  .sk-shelf-item:hover {
    transform: translateY(-4px);
  }
`;

const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },

  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'var(--brand-gradient)',
    boxShadow: 'var(--shadow-brand)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 12%, transparent)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    margin: 0,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)',
    fontWeight: 600,
    letterSpacing: 0.2,
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 15%, transparent)',
    border: 'none',
    borderRadius: 12,
    padding: '9px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  saveLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    letterSpacing: 0.2,
  },

  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 16px 32px',
    maxWidth: 960,
    margin: '0 auto',
    width: '100%',
  },
  helper: {
    fontSize: 12.5,
    color: 'var(--text-tertiary)',
    lineHeight: 1.5,
    margin: '0 0 18px',
    fontWeight: 500,
  },

  shelfSection: {
    marginBottom: 22,
  },
  shelfTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px 6px 8px',
    borderRadius: 999,
    backgroundColor:
      'color-mix(in srgb, var(--shelf-accent) 15%, var(--bg-secondary))',
    border:
      '1px solid color-mix(in srgb, var(--shelf-accent) 40%, transparent)',
    marginBottom: 6,
    marginLeft: 4,
  },
  shelfTagIcon: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: 'var(--shelf-accent)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
  },
  shelfTagLabel: {
    fontSize: 12.5,
    fontWeight: 800,
    color: 'var(--shelf-accent)',
    letterSpacing: 0.2,
  },
  shelfTagCount: {
    fontSize: 11,
    fontWeight: 800,
    color:
      'color-mix(in srgb, var(--shelf-accent) 70%, transparent)',
    paddingLeft: 2,
  },

  shelfRowWrap: {
    position: 'relative',
    paddingTop: 6,
  },
  shelfRow: {
    display: 'flex',
    gap: 12,
    overflowX: 'auto',
    padding: '8px 12px 6px',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
  },

  shelfEdge: {
    height: 16,
    marginLeft: 4,
    marginRight: 4,
    borderRadius: '2px 2px 4px 4px',
    background: `
      linear-gradient(to bottom,
        var(--shelf-highlight) 0%,
        var(--shelf-highlight) 18%,
        var(--shelf-face) 55%,
        var(--shelf-face) 82%,
        var(--shelf-shadow) 100%
      )`,
    boxShadow: `
      inset 0 1px 0 var(--shelf-bevel),
      inset 0 -1px 0 rgba(0, 0, 0, 0.15),
      0 4px 8px -2px var(--shelf-drop),
      0 10px 18px -12px var(--shelf-drop)
    `,
    position: 'relative',
  },
  shelfEdgeBracketLeft: {
    position: 'absolute',
    left: -4,
    top: 0,
    bottom: 0,
    width: 6,
    background:
      'linear-gradient(to right, var(--shelf-shadow), var(--shelf-face))',
    borderRadius: '4px 0 0 4px',
  },
  shelfEdgeBracketRight: {
    position: 'absolute',
    right: -4,
    top: 0,
    bottom: 0,
    width: 6,
    background:
      'linear-gradient(to left, var(--shelf-shadow), var(--shelf-face))',
    borderRadius: '0 4px 4px 0',
  },

  // ── Item card ────────────────────────────────────────────
  shelfItem: {
    position: 'relative',
    flex: '0 0 132px',
    width: 132,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 12,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    overflow: 'visible',
    boxShadow:
      '0 10px 16px -10px var(--shelf-drop), 0 2px 4px rgba(0,0,0,0.05)',
  },
  shelfItemImgWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    overflow: 'hidden',
    backgroundColor: 'var(--bg-tertiary)',
  },
  shelfItemImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  shelfItemImgFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfItemIndexBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontVariantNumeric: 'tabular-nums',
    pointerEvents: 'none',
  },
  shelfItemBody: {
    padding: '8px 10px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minHeight: 44,
  },
  shelfItemTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  shelfItemPrice: {
    fontSize: 12.5,
    fontWeight: 800,
    color: 'var(--shelf-accent)',
    margin: 0,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: -0.1,
  },

  // ── Always-visible move bar ──────────────────────────────
  moveBar: {
    display: 'flex',
    alignItems: 'stretch',
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-tertiary)',
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    overflow: 'hidden',
  },
  moveBtn: {
    flex: 1,
    height: 34,
    border: 'none',
    backgroundColor: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'background-color 0.12s ease, transform 0.1s ease',
  },
  moveDivider: {
    width: 1,
    backgroundColor: 'var(--border-default)',
    alignSelf: 'stretch',
  },

  shelfItemBase: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: -3,
    height: 4,
    borderRadius: 999,
    background:
      'radial-gradient(ellipse at center, var(--shelf-drop) 0%, transparent 75%)',
    opacity: 0.7,
    pointerEvents: 'none',
  },

  centerFill: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    gap: 6,
    textAlign: 'center',
  },
  spinner: {
    width: 34,
    height: 34,
    border: '4px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'skSpin 0.8s linear infinite',
  },
  emptyHalo: {
    width: 72,
    height: 72,
    borderRadius: 24,
    background: 'var(--brand-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 13.5,
    color: 'var(--text-tertiary)',
    margin: '4px 0 0',
    maxWidth: 300,
    lineHeight: 1.5,
  },

  toast: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
    padding: '10px 18px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    zIndex: 99,
    whiteSpace: 'nowrap',
    boxShadow: 'var(--shadow-lg)',
    animation: 'skToastIn 0.2s ease',
  },
};