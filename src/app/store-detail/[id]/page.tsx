'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MdArrowBack,
  MdShare,
  MdStar,
  MdStarBorder,
  MdStorefront,
  MdImage,
  MdImageNotSupported,
  MdRefresh,
  MdSearch,
  MdLocationOn,
  MdVerified,
  MdChatBubbleOutline,
  MdGridOn,
  MdInfoOutline,
  MdStarOutline,
  MdCheck,
} from 'react-icons/md';
import api from '../../../services/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '';

interface Store {
  store_id: string;
  name: string;
  store_image_url?: string;
  description?: string;
  address?: string;
  category?: string[] | string;
  verification_status?: string;
  owner_id?: string;
  created_at?: string;
  patronizer_count?: number;
  [key: string]: unknown;
}

interface RawItem {
  listing_id?: string | null;
  title?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  category?: string | null;
  quantity_available?: number | null;
}

interface Item {
  id: string;
  title: string;
  price: string;
  image: string;
  category: string;
  inStock: boolean;
}

type Tab = 'items' | 'about' | 'reviews';

function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^blob:/i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  const base = API_BASE.replace(/\/+$/, '');
  if (trimmed.startsWith('/')) {
    return base ? `${base}${trimmed}` : trimmed;
  }
  return base ? `${base}/${trimmed}` : trimmed;
}

function formatPrice(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return 'Free';
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Free';
  return `₦${numeric.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function normalizeCategories(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c).trim()).filter(Boolean);
      }
    } catch {
      // not JSON
    }
    return raw
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return [];
}

function storeHandle(store: Store | null): string {
  if (!store) return '';
  const base = (store.name || 'store')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
  return base || store.store_id.slice(0, 8);
}

function memberSince(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function ItemCard({
  item,
  onOpen,
}: {
  item: Item;
  onOpen: (itemId: string) => void;
}) {
  const [mediaError, setMediaError] = useState(false);

  return (
    <article
      className="sp-item"
      role="button"
      tabIndex={0}
      aria-label={`Open ${item.title}`}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item.id);
        }
      }}
    >
      <div className="sp-itemMedia">
        {!mediaError && item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="sp-itemAsset"
            src={item.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setMediaError(true)}
          />
        ) : (
          <div className="sp-itemFallback" aria-hidden="true">
            {mediaError ? (
              <MdImageNotSupported size={28} />
            ) : (
              <MdImage size={28} />
            )}
          </div>
        )}

        {!item.inStock && (
          <span className="sp-outBadge">Sold out</span>
        )}

        <span className="sp-itemPrice">{item.price}</span>
      </div>
      <div className="sp-itemBody">
        <h3 className="sp-itemTitle" title={item.title}>
          {item.title}
        </h3>
        {item.category && (
          <span className="sp-itemCat">{item.category}</span>
        )}
      </div>
    </article>
  );
}

function ItemSkeleton() {
  return (
    <div className="sp-item sp-skeleton" aria-hidden="true">
      <div className="sp-skelMedia" />
      <div className="sp-itemBody">
        <div className="sp-skelLine" />
        <div className="sp-skelLine sp-skelLineShort" />
      </div>
    </div>
  );
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const rawId = params?.id;
  const storeId = Array.isArray(rawId) ? rawId[0] : rawId || '';

  const [store, setStore] = useState<Store | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState<Tab>('items');
  const [searchOpen, setSearchOpen] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [patronizerCount, setPatronizerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStore() {
      if (!storeId) {
        setError('Store not found.');
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [storeData, itemsData, followData] = await Promise.all([
          api.getStoreById(storeId) as unknown as Store,
          api.getStoreItems(storeId) as unknown as RawItem[],
          api.getFollowStatus(storeId).catch(() => ({
            is_following: false,
            followers_count: 0,
          })),
        ]);

        if (cancelled) return;

        setStore(storeData);
        setPatronizerCount(
          Number(
            (storeData as Record<string, unknown>).patronizer_count,
          ) || 0,
        );
        setIsFollowing(Boolean(followData?.is_following));
        setFollowersCount(Number(followData?.followers_count) || 0);

        if (!Array.isArray(itemsData)) {
          setItems([]);
          return;
        }

        const list: Item[] = itemsData
          .filter((raw): raw is RawItem => Boolean(raw && raw.listing_id))
          .map((raw) => {
            const id = String(raw.listing_id);
            const title = (raw.title || '').trim() || 'Item';
            const qty =
              typeof raw.quantity_available === 'number'
                ? raw.quantity_available
                : null;

            return {
              id,
              title,
              price: formatPrice(raw.price),
              image: resolveMediaUrl(raw.image_url),
              category: (raw.category || '').trim(),
              inStock: qty === null ? true : qty > 0,
            };
          });

        setItems(list);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Could not load this store. Please try again.';
        setError(message);
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStore();

    return () => {
      cancelled = true;
    };
  }, [storeId, retryKey]);

  const storeImage = store ? resolveMediaUrl(store.store_image_url) : '';
  const categories = useMemo(
    () => (store ? normalizeCategories(store.category) : []),
    [store],
  );
  const isVerified = store?.verification_status === 'verified';
  const handle = storeHandle(store);
  const since = store ? memberSince(store.created_at as string) : '';

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q),
    );
  }, [search, items]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/shopper/home');
  }, [router]);

  const handleOpenItem = useCallback(
    (itemId: string) => {
      router.push(`/item-detail/${encodeURIComponent(itemId)}`);
    },
    [router],
  );

  const handleRetry = () => setRetryKey((k) => k + 1);

  const toggleFollow = async () => {
    if (followLoading || !storeId) return;
    setFollowLoading(true);

    const prevFollowing = isFollowing;
    const prevCount = followersCount;
    setIsFollowing(!prevFollowing);
    setFollowersCount(prevCount + (prevFollowing ? -1 : 1));

    try {
      const res = prevFollowing
        ? await api.unfollowStore(storeId)
        : await api.followStore(storeId);
      setIsFollowing(Boolean(res?.is_following ?? !prevFollowing));
      setFollowersCount(Number(res?.followers_count ?? 0));
    } catch (err) {
      setIsFollowing(prevFollowing);
      setFollowersCount(prevCount);
      alert('Error: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setFollowLoading(false);
    }
  };

  const shareStore = async () => {
    if (!store) return;
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://admerce.com/store/${storeId}`;
    const message = `Check out ${store.name} on Admerce!`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Check out ${store.name} on Admerce!`,
          text: message,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(`${message}\n${url}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      /* user cancelled */
    }
  };

  const openChat = () => {
    if (!store?.owner_id) return;
    const name = encodeURIComponent(store.name || 'Store');
    router.push(
      `/chat/store_${storeId}?otherUserId=${store.owner_id}&otherUserName=${name}`,
    );
  };

  const storeName = store?.name?.trim() || 'Store';
  const itemCountLabel = `${items.length} ${
    items.length === 1 ? 'item' : 'items'
  }`;

  return (
    <main className="sp-page">
      <style>{CSS}</style>

      <header className="sp-topbar">
        <div className="sp-topbarInner">
          <button
            type="button"
            className="sp-iconBtn"
            onClick={handleBack}
            aria-label="Go back"
          >
            <MdArrowBack size={20} />
          </button>

          <div className="sp-topbarTitle">
            <div className="sp-topbarNameRow">
              <span className="sp-topbarName">{storeName}</span>
              {isVerified && (
                <MdVerified
                  size={15}
                  color="var(--brand-primary)"
                  aria-label="Verified"
                />
              )}
            </div>
            <span className="sp-topbarMeta">
              {loading ? 'Loading…' : itemCountLabel}
            </span>
          </div>

          <button
            type="button"
            className="sp-iconBtn"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search items"
            disabled={loading || items.length === 0}
          >
            <MdSearch size={20} />
          </button>
        </div>

        {searchOpen && (
          <div className="sp-searchBar">
            <MdSearch size={18} aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in this store"
              aria-label="Search items"
              type="search"
              autoFocus
            />
          </div>
        )}
      </header>

      <div className="sp-shell">
        <aside className="sp-left">
          <div className="sp-profileCard">
            <div className="sp-banner">
              {storeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storeImage} alt="" className="sp-bannerImg" />
              ) : (
                <div className="sp-bannerFallback" aria-hidden>
                  <MdStorefront size={56} />
                </div>
              )}
              <div className="sp-bannerGradient" aria-hidden />
            </div>

            <div className="sp-identityRow">
              <div className="sp-avatarWrap">
                {storeImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storeImage} alt="" className="sp-avatarImg" />
                ) : (
                  <div className="sp-avatarFallback">
                    {storeName.charAt(0).toUpperCase()}
                  </div>
                )}
                {isVerified && (
                  <span className="sp-avatarBadge" aria-hidden>
                    <MdVerified size={16} color="#FFFFFF" />
                  </span>
                )}
              </div>

              <div className="sp-actionRow">
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={followLoading || loading || !store}
                  className={
                    isFollowing
                      ? 'sp-followBtn sp-followBtnFollowing'
                      : 'sp-followBtn'
                  }
                >
                  {isFollowing ? (
                    <>
                      <MdStar size={15} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <MdStarBorder size={15} />
                      <span>Follow</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={openChat}
                  disabled={loading || !store?.owner_id}
                  className="sp-iconBtn sp-iconBtnSmall"
                  aria-label="Message store"
                  title="Message store"
                >
                  <MdChatBubbleOutline size={18} />
                </button>

                <button
                  type="button"
                  onClick={shareStore}
                  disabled={loading || !store}
                  className="sp-iconBtn sp-iconBtnSmall"
                  aria-label="Share store"
                  title="Share"
                >
                  {linkCopied ? (
                    <MdCheck size={18} color="var(--success-fg)" />
                  ) : (
                    <MdShare size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="sp-identityText">
              <div className="sp-nameRow">
                <h1 className="sp-displayName">{storeName}</h1>
                {isVerified && (
                  <MdVerified
                    size={18}
                    color="var(--brand-primary)"
                    aria-label="Verified"
                  />
                )}
              </div>

              <span className="sp-handle">@{handle}</span>

              {store?.description && (
                <p className="sp-bio">{String(store.description)}</p>
              )}

              <div className="sp-metaRow">
                {store?.address && (
                  <span className="sp-metaItem">
                    <MdLocationOn size={14} aria-hidden />
                    <span>{store.address}</span>
                  </span>
                )}
                {since && (
                  <span className="sp-metaItem">
                    <MdStorefront size={13} aria-hidden />
                    <span>Since {since}</span>
                  </span>
                )}
              </div>

              {categories.length > 0 && (
                <div className="sp-chips">
                  {categories.map((cat, idx) => (
                    <span key={`${cat}-${idx}`} className="sp-chip">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="sp-stats">
              <button
                type="button"
                className="sp-stat"
                onClick={() => setTab('items')}
              >
                <span className="sp-statNum">{items.length}</span>
                <span className="sp-statLabel">Items</span>
              </button>
              <div className="sp-stat sp-statStatic">
                <span className="sp-statNum">{patronizerCount}</span>
                <span className="sp-statLabel">Patronizers</span>
              </div>
              <div className="sp-stat sp-statStatic">
                <span className="sp-statNum">{followersCount}</span>
                <span className="sp-statLabel">Followers</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="sp-right">
          <nav className="sp-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'items'}
              className={
                tab === 'items' ? 'sp-tab sp-tabActive' : 'sp-tab'
              }
              onClick={() => setTab('items')}
            >
              <MdGridOn size={16} />
              <span>Items</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'about'}
              className={
                tab === 'about' ? 'sp-tab sp-tabActive' : 'sp-tab'
              }
              onClick={() => setTab('about')}
            >
              <MdInfoOutline size={16} />
              <span>About</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'reviews'}
              className={
                tab === 'reviews' ? 'sp-tab sp-tabActive' : 'sp-tab'
              }
              onClick={() => setTab('reviews')}
            >
              <MdStarOutline size={16} />
              <span>Reviews</span>
            </button>
          </nav>

          <section className="sp-content">
            {tab === 'items' && (
              <>
                {loading ? (
                  <div className="sp-grid" aria-busy="true">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <ItemSkeleton key={i} />
                    ))}
                  </div>
                ) : error ? (
                  <div className="sp-empty">
                    <div className="sp-emptyIcon" aria-hidden>
                      <MdStorefront size={28} />
                    </div>
                    <h2 className="sp-emptyTitle">
                      We couldn&apos;t load this store
                    </h2>
                    <p className="sp-emptyBody">{error}</p>
                    <button
                      type="button"
                      className="sp-retry"
                      onClick={handleRetry}
                    >
                      <MdRefresh size={17} />
                      Try again
                    </button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="sp-empty">
                    <div className="sp-emptyIcon" aria-hidden>
                      <MdStorefront size={28} />
                    </div>
                    <h2 className="sp-emptyTitle">No items yet</h2>
                    <p className="sp-emptyBody">
                      This store hasn&apos;t listed any items yet.
                    </p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="sp-empty">
                    <p className="sp-emptyBody">
                      No items match{' '}
                      <strong>&quot;{search.trim()}&quot;</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="sp-grid">
                    {filteredItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onOpen={handleOpenItem}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'about' && (
              <div className="sp-about">
                <div className="sp-aboutRow">
                  <span className="sp-aboutLabel">Name</span>
                  <span className="sp-aboutValue">{storeName}</span>
                </div>
                <div className="sp-aboutRow">
                  <span className="sp-aboutLabel">Handle</span>
                  <span className="sp-aboutValue">@{handle}</span>
                </div>
                <div className="sp-aboutRow">
                  <span className="sp-aboutLabel">Patronizers</span>
                  <span className="sp-aboutValue">{patronizerCount}</span>
                </div>
                <div className="sp-aboutRow">
                  <span className="sp-aboutLabel">Followers</span>
                  <span className="sp-aboutValue">{followersCount}</span>
                </div>
                {store?.address && (
                  <div className="sp-aboutRow">
                    <span className="sp-aboutLabel">Address</span>
                    <span className="sp-aboutValue">
                      {String(store.address)}
                    </span>
                  </div>
                )}
                {since && (
                  <div className="sp-aboutRow">
                    <span className="sp-aboutLabel">Member since</span>
                    <span className="sp-aboutValue">{since}</span>
                  </div>
                )}
                <div className="sp-aboutRow">
                  <span className="sp-aboutLabel">Status</span>
                  <span className="sp-aboutValue">
                    {isVerified ? 'Verified store' : 'Unverified'}
                  </span>
                </div>
                {categories.length > 0 && (
                  <div className="sp-aboutRow sp-aboutRowBlock">
                    <span className="sp-aboutLabel">Categories</span>
                    <div className="sp-chips">
                      {categories.map((cat, idx) => (
                        <span key={`${cat}-${idx}`} className="sp-chip">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'reviews' && (
              <div className="sp-empty">
                <div className="sp-emptyIcon" aria-hidden>
                  <MdStarOutline size={28} />
                </div>
                <h2 className="sp-emptyTitle">Reviews coming soon</h2>
                <p className="sp-emptyBody">
                  We&rsquo;re building a reviews system so buyers can
                  rate stores and items. It&apos;ll be live in a future
                  update.
                </p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

const CSS = `
  .sp-page {
    min-height: 100dvh;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    overflow-x: hidden;
    transition: background-color 0.18s ease, color 0.18s ease;
    padding-bottom: 40px;
  }

  .sp-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--bg-secondary) 94%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border-default);
    transition: background-color 0.18s ease, border-color 0.18s ease;
  }
  .sp-topbarInner {
    width: min(720px, 100%);
    margin: 0 auto;
    min-height: 56px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-sizing: border-box;
  }
  .sp-topbarTitle {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .sp-topbarNameRow {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .sp-topbarName {
    font-size: 15.5px;
    font-weight: 800;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sp-topbarMeta {
    font-size: 12px;
    color: var(--text-tertiary);
    font-weight: 600;
  }
  .sp-iconBtn {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.12s;
  }
  .sp-iconBtn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--brand-primary);
  }
  .sp-iconBtn:disabled { opacity: 0.45; cursor: not-allowed; }
  .sp-iconBtnSmall {
    border: 1.5px solid var(--border-default);
    background: var(--bg-secondary);
  }
  .sp-searchBar {
    width: min(720px, 100%);
    margin: 0 auto;
    padding: 0 12px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
  }
  .sp-searchBar input {
    flex: 1;
    min-width: 0;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--border-default);
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font: inherit;
    font-size: 14px;
    outline: none;
  }
  .sp-searchBar input:focus {
    border-color: var(--brand-primary);
    background: var(--bg-secondary);
  }

  .sp-shell {
    display: flex;
    flex-direction: column;
    width: min(720px, 100%);
    margin: 0 auto;
    padding: 0 14px;
    box-sizing: border-box;
  }
  .sp-left,
  .sp-right {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .sp-profileCard {
    display: flex;
    flex-direction: column;
    margin-top: 14px;
  }
  .sp-banner {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 6;
    border-radius: 20px;
    overflow: hidden;
    background: var(--brand-gradient);
    box-shadow: var(--shadow-sm);
  }
  .sp-bannerImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .sp-bannerFallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: color-mix(in srgb, var(--brand-on-gradient) 55%, transparent);
  }
  .sp-bannerGradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--bg-primary) 40%, transparent) 0%,
      transparent 55%
    );
    pointer-events: none;
  }
  .sp-identityRow {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    margin-top: -34px;
    padding: 0 6px;
    position: relative;
    z-index: 1;
  }
  .sp-avatarWrap {
    position: relative;
    width: 84px;
    height: 84px;
    flex: 0 0 84px;
  }
  .sp-avatarImg {
    width: 100%;
    height: 100%;
    border-radius: 24px;
    object-fit: cover;
    display: block;
    border: 4px solid var(--bg-primary);
    background: var(--bg-secondary);
    box-sizing: border-box;
  }
  .sp-avatarFallback {
    width: 100%;
    height: 100%;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--brand-gradient);
    color: var(--brand-on-gradient);
    font-size: 32px;
    font-weight: 800;
    border: 4px solid var(--bg-primary);
    box-sizing: border-box;
  }
  .sp-avatarBadge {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--brand-primary);
    border: 3px solid var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .sp-actionRow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 4px;
  }
  .sp-followBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    border-radius: 999px;
    border: 1.5px solid transparent;
    background: var(--brand-gradient);
    color: var(--brand-on-gradient);
    font: inherit;
    font-size: 13.5px;
    font-weight: 800;
    cursor: pointer;
    transition: transform 0.12s, opacity 0.15s;
    box-shadow: var(--shadow-brand);
  }
  .sp-followBtn:hover:not(:disabled) { opacity: 0.94; }
  .sp-followBtn:active { transform: scale(0.97); }
  .sp-followBtn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sp-followBtnFollowing {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-color: var(--border-default);
    box-shadow: none;
  }
  .sp-identityText {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 6px 0;
  }
  .sp-nameRow {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .sp-displayName {
    margin: 0;
    font-size: 22px;
    line-height: 1.15;
    font-weight: 850;
    letter-spacing: -0.03em;
  }
  .sp-handle {
    color: var(--text-tertiary);
    font-size: 13.5px;
    font-weight: 600;
  }
  .sp-bio {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .sp-metaRow {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 4px;
  }
  .sp-metaItem {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12.5px;
    color: var(--text-tertiary);
    font-weight: 600;
    word-break: break-word;
  }
  .sp-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .sp-chip {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--brand-soft);
    color: var(--brand-primary);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .sp-stats {
    display: flex;
    margin-top: 14px;
    padding: 12px 4px;
    border-top: 1px solid var(--border-default);
    border-bottom: 1px solid var(--border-default);
  }
  .sp-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border: none;
    background: none;
    cursor: pointer;
    font: inherit;
    padding: 4px;
    transition: opacity 0.15s;
  }
  .sp-statStatic { cursor: default; }
  .sp-stat:hover { opacity: 0.85; }
  .sp-statNum {
    font-size: 16px;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .sp-statLabel {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-tertiary);
    letter-spacing: 0.02em;
  }
  .sp-tabs {
    display: flex;
    margin-top: 14px;
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-primary);
    transition: background-color 0.18s ease, border-color 0.18s ease;
  }
  .sp-tab {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 13px 8px;
    border: none;
    background: none;
    cursor: pointer;
    font: inherit;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-tertiary);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
  }
  .sp-tab:hover { color: var(--text-primary); }
  .sp-tabActive {
    color: var(--brand-primary);
    border-bottom-color: var(--brand-primary);
  }
  .sp-content {
    padding-top: 14px;
    padding-bottom: 40px;
    min-height: 240px;
  }
  .sp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .sp-item {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-default);
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }
  .sp-item:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--brand-primary) 30%, transparent);
    box-shadow: var(--shadow-md);
  }
  .sp-item:active { transform: scale(0.99); }
  .sp-itemMedia {
    position: relative;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    background: var(--bg-tertiary);
  }
  .sp-itemAsset {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .sp-itemFallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }
  .sp-outBadge {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 3px 8px;
    border-radius: 7px;
    background: rgba(12, 12, 17, 0.78);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .sp-itemPrice {
    position: absolute;
    bottom: 8px;
    left: 8px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(12, 12, 17, 0.78);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    backdrop-filter: blur(4px);
  }
  .sp-itemBody {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .sp-itemTitle {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.3;
    font-weight: 750;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    word-break: break-word;
  }
  .sp-itemCat {
    font-size: 11px;
    color: var(--text-tertiary);
    font-weight: 600;
  }
  .sp-about {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-default);
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-secondary);
  }
  .sp-aboutRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-default);
  }
  .sp-aboutRow:last-child { border-bottom: none; }
  .sp-aboutRowBlock {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .sp-aboutLabel {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-tertiary);
  }
  .sp-aboutValue {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    text-align: right;
    word-break: break-word;
  }
  .sp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    gap: 6px;
  }
  .sp-emptyIcon {
    width: 62px;
    height: 62px;
    border-radius: 20px;
    background: var(--brand-soft);
    color: var(--brand-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .sp-emptyTitle {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: var(--text-primary);
  }
  .sp-emptyBody {
    margin: 4px 0 0;
    font-size: 13.5px;
    color: var(--text-tertiary);
    line-height: 1.5;
    max-width: 340px;
  }
  .sp-retry {
    margin-top: 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border: none;
    border-radius: 12px;
    background: var(--brand-gradient);
    color: var(--brand-on-gradient);
    font: inherit;
    font-size: 13.5px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: var(--shadow-brand);
    transition: transform 0.12s, opacity 0.15s;
  }
  .sp-retry:hover { opacity: 0.94; }
  .sp-retry:active { transform: scale(0.97); }
  .sp-skeleton { pointer-events: none; cursor: default; }
  .sp-skelMedia {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: var(--bg-tertiary);
    animation: spShimmer 1.4s ease-in-out infinite;
  }
  .sp-skelLine {
    width: 70%;
    height: 10px;
    border-radius: 5px;
    background: var(--bg-tertiary);
    animation: spShimmer 1.4s ease-in-out infinite;
  }
  .sp-skelLineShort { width: 40%; }

  @keyframes spShimmer {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  @media (min-width: 1024px) {
    .sp-page { padding-bottom: 60px; }
    .sp-topbarInner {
      width: min(1180px, 100%);
      padding: 8px 32px;
    }
    .sp-searchBar {
      width: min(1180px, 100%);
      padding: 0 32px 10px;
    }
    .sp-shell {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 32px;
      align-items: flex-start;
      width: min(1180px, 100%);
      padding: 24px 32px 0;
    }
    .sp-profileCard {
      position: sticky;
      top: 76px;
      margin-top: 0;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: 22px;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    .sp-banner {
      border-radius: 0;
      box-shadow: none;
      aspect-ratio: 16 / 7;
    }
    .sp-identityRow {
      padding: 0 22px;
      margin-top: -34px;
    }
    .sp-identityText { padding: 14px 22px 0; }
    .sp-displayName { font-size: 24px; }
    .sp-stats {
      margin-top: 18px;
      padding: 14px 22px;
      border-top: 1px solid var(--border-default);
      border-bottom: none;
    }
    .sp-right {
      border-radius: 22px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      overflow: hidden;
      padding-bottom: 8px;
    }
    .sp-tabs {
      margin-top: 0;
      padding: 4px 12px 0;
      background: transparent;
    }
    .sp-tab { padding: 16px 12px; font-size: 12.5px; }
    .sp-content { padding: 20px 20px 24px; }
    .sp-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 14px;
    }
  }

  @media (min-width: 1440px) {
    .sp-topbarInner,
    .sp-searchBar,
    .sp-shell {
      width: min(1280px, 100%);
    }
    .sp-shell {
      grid-template-columns: 420px 1fr;
      gap: 40px;
    }
    .sp-grid {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-item, .sp-followBtn, .sp-retry, .sp-iconBtn {
      transition: none;
    }
    .sp-skelMedia, .sp-skelLine { animation: none; }
  }
`;