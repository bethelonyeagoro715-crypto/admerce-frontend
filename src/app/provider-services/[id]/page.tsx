'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  MdArrowBack,
  MdBuild,
  MdRefresh,
  MdSearch,
  MdVerified,
  MdChatBubbleOutline,
  MdShare,
  MdCheck,
  MdStar,
  MdStarBorder,
  MdGridOn,
  MdInfoOutline,
  MdStarOutline,
} from 'react-icons/md';
import api from '../../../services/api';
import ServiceReelCard, {
  ServiceReel,
} from '../../../components/ServiceReelCard';

interface ProviderServiceResponse {
  service_id?: string | null;
  title?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  video_url?: string | null;
  description?: string | null;
  business_name?: string | null;
  username?: string | null;
  real_name?: string | null;
  nickname?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  business_image_url?: string | null;
  avatar_url?: string | null;
  category?: string | null;
  verification_status?: string | null;
  business_verification_status?: string | null;
  provider_verification_status?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

type Tab = 'services' | 'about' | 'reviews';

function formatPrice(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return 'Free';
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Free';
  return `₦${numeric.toLocaleString('en-NG', {
    maximumFractionDigits: 0,
  })}`;
}

function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^blob:/i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    '';
  const clean = base.replace(/\/+$/, '');
  if (t.startsWith('/')) return clean ? `${clean}${t}` : t;
  return clean ? `${clean}/${t}` : t;
}

function memberSince(iso?: string | null): string {
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

function providerHandle(name: string, id: string): string {
  const base = (name || 'provider')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
  return base || id.slice(0, 8);
}

function ServiceSkeleton() {
  return <div className="pp-skel" aria-hidden="true" />;
}

function ProviderServicesContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const rawId = params?.id;
  const providerId = Array.isArray(rawId) ? rawId[0] : rawId || '';
  const urlName = searchParams.get('name')?.trim() || '';

  const [providerName, setProviderName] = useState(
    urlName || 'Service Provider',
  );
  const [providerMeta, setProviderMeta] =
    useState<ProviderServiceResponse | null>(null);
  const [services, setServices] = useState<ServiceReel[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState<Tab>('services');
  const [searchOpen, setSearchOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Follow + patronizer state ────────────────────────────
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [patronizerCount, setPatronizerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      if (!providerId) {
        setError('Provider not found.');
        setServices([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const raw = await api.getProviderServicesByUserId(providerId);
        if (cancelled) return;

        if (!Array.isArray(raw)) {
          setServices([]);
          return;
        }

        const rawList = raw as ProviderServiceResponse[];
        const firstRaw = rawList.find((item) => item?.service_id);
        const apiName =
          firstRaw?.business_name?.trim() ||
          firstRaw?.username?.trim() ||
          firstRaw?.real_name?.trim() ||
          firstRaw?.nickname?.trim() ||
          [firstRaw?.first_name, firstRaw?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          '';

        const list: ServiceReel[] = rawList
          .filter(
            (item): item is ProviderServiceResponse =>
              Boolean(item?.service_id),
          )
          .map((item) => ({
            id: String(item.service_id),
            title: item.title?.trim() || 'Service',
            price: formatPrice(item.price),
            videoUrl: item.video_url?.trim() ? item.video_url : null,
            imageUrl: item.image_url?.trim() ? item.image_url : null,
            providerName: apiName || undefined,
          }));

        setServices(list);
        if (firstRaw) setProviderMeta(firstRaw);

        if (apiName) {
          setProviderName(apiName);
        } else if (!urlName) {
          setProviderName('Service Provider');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Could not load services. Please try again.';
        setError(message);
        setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadServices();

    return () => {
      cancelled = true;
    };
  }, [providerId, retryKey, urlName]);

  // ── Fetch follow status once we know the provider id ─────
  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await api.getUserFollowStatus(providerId);
        if (cancelled) return;
        setIsFollowing(!!data.is_following);
        setFollowersCount(Number(data.followers_count) || 0);
        setIsSelf(!!data.is_self);
      } catch {
        if (!cancelled) {
          setIsFollowing(false);
          setFollowersCount(0);
          setIsSelf(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  // ── Fetch patronizer count (unique customers who completed) ─
  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await api.getProviderPatronizerCount(providerId);
        if (cancelled) return;
        setPatronizerCount(Number(data?.patronizer_count) || 0);
      } catch {
        if (!cancelled) setPatronizerCount(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.providerName ?? '').toLowerCase().includes(q),
    );
  }, [search, services]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/shopper/home');
  }, [router]);

  const handleOpenService = useCallback(
    (serviceId: string) => {
      router.push(`/service-detail/${encodeURIComponent(serviceId)}`);
    },
    [router],
  );

  const handleRetry = () => setRetryKey((n) => n + 1);

  const toggleFollow = async () => {
    if (followLoading || !providerId || isSelf) return;
    setFollowLoading(true);
    // Optimistic
    const prevFollowing = isFollowing;
    const prevCount = followersCount;
    setIsFollowing(!prevFollowing);
    setFollowersCount(prevCount + (prevFollowing ? -1 : 1));

    try {
      if (prevFollowing) {
        const res = await api.unfollowUser(providerId);
        setFollowersCount(Number(res.followers_count) || 0);
        setIsFollowing(false);
      } else {
        const res = await api.followUser(providerId);
        setFollowersCount(Number(res.followers_count) || 0);
        setIsFollowing(true);
      }
    } catch {
      // Roll back
      setIsFollowing(prevFollowing);
      setFollowersCount(prevCount);
    } finally {
      setFollowLoading(false);
    }
  };

  const isVerified =
    providerMeta?.verification_status === 'verified' ||
    providerMeta?.business_verification_status === 'verified' ||
    providerMeta?.provider_verification_status === 'verified';

  const avatarRaw =
    providerMeta?.business_image_url ||
    providerMeta?.avatar_url ||
    null;
  const avatarUrl = resolveMediaUrl(avatarRaw as string | null);
  const handle = providerHandle(providerName, providerId);
  const since = memberSince(
    (providerMeta?.created_at as string | null) ?? null,
  );
  const bio = (providerMeta?.description as string | null) || '';

  const shareProvider = async () => {
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://admerce.com/provider-services/${providerId}`;
    const message = `Check out ${providerName} on Admerce!`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Check out ${providerName} on Admerce!`,
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
    if (!providerId) return;
    const name = encodeURIComponent(providerName);
    router.push(
      `/chat/user_${providerId}?otherUserId=${providerId}&otherUserName=${name}`,
    );
  };

  const countLabel = `${services.length} ${
    services.length === 1 ? 'service' : 'services'
  }`;

  return (
    <main className="pp-page">
      <style>{CSS}</style>

      <header className="pp-topbar">
        <div className="pp-topbarInner">
          <button
            type="button"
            className="pp-iconBtn"
            onClick={handleBack}
            aria-label="Go back"
          >
            <MdArrowBack size={20} />
          </button>

          <div className="pp-topbarTitle">
            <div className="pp-topbarNameRow">
              <span className="pp-topbarName">{providerName}</span>
              {isVerified && (
                <MdVerified
                  size={15}
                  color="var(--brand-primary)"
                  aria-label="Verified"
                />
              )}
            </div>
            <span className="pp-topbarMeta">
              {loading ? 'Loading…' : countLabel}
            </span>
          </div>

          <button
            type="button"
            className="pp-iconBtn"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search services"
            disabled={loading || services.length === 0}
          >
            <MdSearch size={20} />
          </button>
        </div>

        {searchOpen && (
          <div className="pp-searchBar">
            <MdSearch size={18} aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services"
              aria-label="Search services"
              type="search"
              autoFocus
            />
          </div>
        )}
      </header>

      <div className="pp-shell">
        <aside className="pp-left">
          <div className="pp-profileCard">
            <div className="pp-banner">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="pp-bannerImg" />
              ) : (
                <div className="pp-bannerFallback" aria-hidden>
                  <MdBuild size={52} />
                </div>
              )}
              <div className="pp-bannerGradient" aria-hidden />
            </div>

            <div className="pp-identityRow">
              <div className="pp-avatarWrap">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="pp-avatarImg" />
                ) : (
                  <div className="pp-avatarFallback">
                    {providerName.charAt(0).toUpperCase()}
                  </div>
                )}
                {isVerified && (
                  <span className="pp-avatarBadge" aria-hidden>
                    <MdVerified size={16} color="#FFFFFF" />
                  </span>
                )}
              </div>

              <div className="pp-actionRow">
                {!isSelf && (
                  <button
                    type="button"
                    onClick={toggleFollow}
                    disabled={followLoading || loading}
                    className={
                      isFollowing
                        ? 'pp-followBtn pp-followBtnFollowing'
                        : 'pp-followBtn'
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
                )}

                <button
                  type="button"
                  onClick={openChat}
                  disabled={loading || !providerId || isSelf}
                  className="pp-iconBtn pp-iconBtnSmall"
                  aria-label="Message provider"
                  title="Message"
                >
                  <MdChatBubbleOutline size={18} />
                </button>

                <button
                  type="button"
                  onClick={shareProvider}
                  disabled={loading}
                  className="pp-iconBtn pp-iconBtnSmall"
                  aria-label="Share provider"
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

            <div className="pp-identityText">
              <div className="pp-nameRow">
                <h1 className="pp-displayName">{providerName}</h1>
                {isVerified && (
                  <MdVerified
                    size={18}
                    color="var(--brand-primary)"
                    aria-label="Verified"
                  />
                )}
              </div>

              <span className="pp-handle">@{handle}</span>

              {bio && <p className="pp-bio">{bio}</p>}

              <div className="pp-metaRow">
                <span className="pp-rolePill">🛠️ Service Provider</span>
                {since && (
                  <span className="pp-metaItem">· Since {since}</span>
                )}
              </div>
            </div>

            <div className="pp-stats">
              <button
                type="button"
                className="pp-stat"
                onClick={() => setTab('services')}
              >
                <span className="pp-statNum">{services.length}</span>
                <span className="pp-statLabel">Services</span>
              </button>
              <div className="pp-stat pp-statStatic">
                <span className="pp-statNum">{patronizerCount}</span>
                <span className="pp-statLabel">Patronizers</span>
              </div>
              <div className="pp-stat pp-statStatic">
                <span className="pp-statNum">{followersCount}</span>
                <span className="pp-statLabel">Followers</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="pp-right">
          <nav className="pp-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'services'}
              className={
                tab === 'services' ? 'pp-tab pp-tabActive' : 'pp-tab'
              }
              onClick={() => setTab('services')}
            >
              <MdGridOn size={16} />
              <span>Services</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'about'}
              className={
                tab === 'about' ? 'pp-tab pp-tabActive' : 'pp-tab'
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
                tab === 'reviews' ? 'pp-tab pp-tabActive' : 'pp-tab'
              }
              onClick={() => setTab('reviews')}
            >
              <MdStarOutline size={16} />
              <span>Reviews</span>
            </button>
          </nav>

          <section className="pp-content">
            {tab === 'services' && (
              <>
                {loading ? (
                  <div className="pp-grid" aria-busy="true">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <ServiceSkeleton key={i} />
                    ))}
                  </div>
                ) : error ? (
                  <div className="pp-empty">
                    <div className="pp-emptyIcon" aria-hidden>
                      <MdBuild size={28} />
                    </div>
                    <h2 className="pp-emptyTitle">
                      We couldn&apos;t load these services
                    </h2>
                    <p className="pp-emptyBody">{error}</p>
                    <button
                      type="button"
                      className="pp-retry"
                      onClick={handleRetry}
                    >
                      <MdRefresh size={17} />
                      Try again
                    </button>
                  </div>
                ) : services.length === 0 ? (
                  <div className="pp-empty">
                    <div className="pp-emptyIcon" aria-hidden>
                      <MdBuild size={28} />
                    </div>
                    <h2 className="pp-emptyTitle">No services yet</h2>
                    <p className="pp-emptyBody">
                      This provider hasn&apos;t published any services
                      yet.
                    </p>
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className="pp-empty">
                    <p className="pp-emptyBody">
                      No services match{' '}
                      <strong>&quot;{search.trim()}&quot;</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="pp-grid">
                    {filteredServices.map((service) => (
                      <ServiceReelCard
                        key={service.id}
                        service={service}
                        onOpen={handleOpenService}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'about' && (
              <div className="pp-about">
                <div className="pp-aboutRow">
                  <span className="pp-aboutLabel">Name</span>
                  <span className="pp-aboutValue">{providerName}</span>
                </div>
                <div className="pp-aboutRow">
                  <span className="pp-aboutLabel">Handle</span>
                  <span className="pp-aboutValue">@{handle}</span>
                </div>
                <div className="pp-aboutRow">
                  <span className="pp-aboutLabel">Role</span>
                  <span className="pp-aboutValue">Service Provider</span>
                </div>
                <div className="pp-aboutRow">
                  <span className="pp-aboutLabel">Patronizers</span>
                  <span className="pp-aboutValue">{patronizerCount}</span>
                </div>
                <div className="pp-aboutRow">
                  <span className="pp-aboutLabel">Followers</span>
                  <span className="pp-aboutValue">{followersCount}</span>
                </div>
                {since && (
                  <div className="pp-aboutRow">
                    <span className="pp-aboutLabel">Member since</span>
                    <span className="pp-aboutValue">{since}</span>
                  </div>
                )}
                <div className="pp-aboutRow">
                  <span className="pp-aboutLabel">Status</span>
                  <span className="pp-aboutValue">
                    {isVerified ? 'Verified provider' : 'Unverified'}
                  </span>
                </div>
                {bio && (
                  <div className="pp-aboutRow pp-aboutRowBlock">
                    <span className="pp-aboutLabel">Bio</span>
                    <span className="pp-aboutValue pp-aboutValueLeft">
                      {bio}
                    </span>
                  </div>
                )}
              </div>
            )}

            {tab === 'reviews' && (
              <div className="pp-empty">
                <div className="pp-emptyIcon" aria-hidden>
                  <MdStarOutline size={28} />
                </div>
                <h2 className="pp-emptyTitle">Reviews coming soon</h2>
                <p className="pp-emptyBody">
                  We&rsquo;re building a reviews system so customers can
                  rate providers and services. It&rsquo;ll be live in a
                  future update.
                </p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

export default function ProviderServicesPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
          }}
        >
          <div
            aria-label="Loading"
            style={{
              width: 36,
              height: 36,
              border: '3px solid var(--border-default)',
              borderTopColor: 'var(--brand-primary)',
              borderRadius: '50%',
            }}
          />
        </main>
      }
    >
      <ProviderServicesContent />
    </Suspense>
  );
}

const CSS = `
  .pp-page {
    min-height: 100dvh;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    overflow-x: hidden;
    transition: background-color 0.18s ease, color 0.18s ease;
    padding-bottom: 40px;
  }
  .pp-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--bg-secondary) 94%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border-default);
    transition: background-color 0.18s ease, border-color 0.18s ease;
  }
  .pp-topbarInner {
    width: min(720px, 100%);
    margin: 0 auto;
    min-height: 56px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-sizing: border-box;
  }
  .pp-topbarTitle {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .pp-topbarNameRow {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .pp-topbarName {
    font-size: 15.5px;
    font-weight: 800;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pp-topbarMeta {
    font-size: 12px;
    color: var(--text-tertiary);
    font-weight: 600;
  }
  .pp-iconBtn {
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
  .pp-iconBtn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--brand-primary);
  }
  .pp-iconBtn:disabled { opacity: 0.45; cursor: not-allowed; }
  .pp-iconBtnSmall {
    border: 1.5px solid var(--border-default);
    background: var(--bg-secondary);
  }
  .pp-searchBar {
    width: min(720px, 100%);
    margin: 0 auto;
    padding: 0 12px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
  }
  .pp-searchBar input {
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
  .pp-searchBar input:focus {
    border-color: var(--brand-primary);
    background: var(--bg-secondary);
  }
  .pp-shell {
    display: flex;
    flex-direction: column;
    width: min(720px, 100%);
    margin: 0 auto;
    padding: 0 14px;
    box-sizing: border-box;
  }
  .pp-left,
  .pp-right {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .pp-profileCard {
    display: flex;
    flex-direction: column;
    margin-top: 14px;
  }
  .pp-banner {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 6;
    border-radius: 20px;
    overflow: hidden;
    background: var(--brand-gradient);
    box-shadow: var(--shadow-sm);
  }
  .pp-bannerImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .pp-bannerFallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: color-mix(in srgb, var(--brand-on-gradient) 55%, transparent);
  }
  .pp-bannerGradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--bg-primary) 40%, transparent) 0%,
      transparent 55%
    );
    pointer-events: none;
  }
  .pp-identityRow {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    margin-top: -34px;
    padding: 0 6px;
    position: relative;
    z-index: 1;
  }
  .pp-avatarWrap {
    position: relative;
    width: 84px;
    height: 84px;
    flex: 0 0 84px;
  }
  .pp-avatarImg {
    width: 100%;
    height: 100%;
    border-radius: 24px;
    object-fit: cover;
    display: block;
    border: 4px solid var(--bg-primary);
    background: var(--bg-secondary);
    box-sizing: border-box;
  }
  .pp-avatarFallback {
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
  .pp-avatarBadge {
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
  .pp-actionRow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 4px;
  }
  .pp-followBtn {
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
  .pp-followBtn:hover:not(:disabled) { opacity: 0.94; }
  .pp-followBtn:active { transform: scale(0.97); }
  .pp-followBtn:disabled { opacity: 0.5; cursor: not-allowed; }
  .pp-followBtnFollowing {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-color: var(--border-default);
    box-shadow: none;
  }
  .pp-identityText {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 6px 0;
  }
  .pp-nameRow {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .pp-displayName {
    margin: 0;
    font-size: 22px;
    line-height: 1.15;
    font-weight: 850;
    letter-spacing: -0.03em;
  }
  .pp-handle {
    color: var(--text-tertiary);
    font-size: 13.5px;
    font-weight: 600;
  }
  .pp-bio {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .pp-metaRow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
  }
  .pp-rolePill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--brand-soft);
    color: var(--brand-primary);
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .pp-metaItem {
    font-size: 12.5px;
    color: var(--text-tertiary);
    font-weight: 600;
  }
  .pp-stats {
    display: flex;
    margin-top: 14px;
    padding: 12px 4px;
    border-top: 1px solid var(--border-default);
    border-bottom: 1px solid var(--border-default);
  }
  .pp-stat {
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
  .pp-statStatic { cursor: default; }
  .pp-stat:hover { opacity: 0.85; }
  .pp-statNum {
    font-size: 16px;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .pp-statLabel {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-tertiary);
    letter-spacing: 0.02em;
  }
  .pp-tabs {
    display: flex;
    margin-top: 14px;
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-primary);
    transition: background-color 0.18s ease, border-color 0.18s ease;
  }
  .pp-tab {
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
  .pp-tab:hover { color: var(--text-primary); }
  .pp-tabActive {
    color: var(--brand-primary);
    border-bottom-color: var(--brand-primary);
  }
  .pp-content {
    padding-top: 14px;
    padding-bottom: 40px;
    min-height: 240px;
  }
  .pp-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .pp-skel {
    width: 100%;
    aspect-ratio: 9 / 16;
    border-radius: 16px;
    background: var(--bg-tertiary);
    animation: ppShimmer 1.4s ease-in-out infinite;
  }
  .pp-about {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-default);
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-secondary);
  }
  .pp-aboutRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-default);
  }
  .pp-aboutRow:last-child { border-bottom: none; }
  .pp-aboutRowBlock {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .pp-aboutLabel {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-tertiary);
  }
  .pp-aboutValue {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    text-align: right;
    word-break: break-word;
  }
  .pp-aboutValueLeft {
    text-align: left;
    font-weight: 500;
    line-height: 1.5;
  }
  .pp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    gap: 6px;
  }
  .pp-emptyIcon {
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
  .pp-emptyTitle {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: var(--text-primary);
  }
  .pp-emptyBody {
    margin: 4px 0 0;
    font-size: 13.5px;
    color: var(--text-tertiary);
    line-height: 1.5;
    max-width: 340px;
  }
  .pp-retry {
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
  .pp-retry:hover { opacity: 0.94; }
  .pp-retry:active { transform: scale(0.97); }
  @keyframes ppShimmer {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  @media (min-width: 1024px) {
    .pp-page { padding-bottom: 60px; }
    .pp-topbarInner {
      width: min(960px, 100%);
      padding: 8px 32px;
    }
    .pp-searchBar {
      width: min(960px, 100%);
      padding: 0 32px 10px;
    }
    .pp-shell {
      display: flex;
      flex-direction: column;
      width: min(960px, 100%);
      padding: 24px 32px 0;
      gap: 20px;
    }
    .pp-profileCard {
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: 22px;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      margin-top: 0;
    }
    .pp-banner {
      border-radius: 0;
      box-shadow: none;
      aspect-ratio: 16 / 6;
    }
    .pp-identityRow {
      padding: 0 22px;
      margin-top: -34px;
    }
    .pp-identityText { padding: 14px 22px 0; }
    .pp-displayName { font-size: 24px; }
    .pp-stats {
      margin-top: 18px;
      padding: 14px 22px;
      border-top: 1px solid var(--border-default);
      border-bottom: none;
    }
    .pp-right {
      border-radius: 22px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      overflow: hidden;
      padding-bottom: 8px;
    }
    .pp-tabs {
      margin-top: 0;
      padding: 4px 12px 0;
      background: transparent;
    }
    .pp-tab { padding: 16px 12px; font-size: 13px; }
    .pp-content { padding: 20px 20px 24px; }
    .pp-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 14px;
    }
  }

  @media (min-width: 1440px) {
    .pp-topbarInner,
    .pp-searchBar,
    .pp-shell {
      width: min(1100px, 100%);
    }
    .pp-grid {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
  }
`;