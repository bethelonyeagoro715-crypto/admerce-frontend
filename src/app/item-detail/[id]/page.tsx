'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import PickTimeBottomSheet, {
  pickupValueToHours,
} from '../../../components/PickTimeBottomSheet';
import { getToken } from '../../../services/localStorage';
import {
  MdArrowBack,
  MdShare,
  MdFavorite,
  MdFavoriteBorder,
  MdRemove,
  MdAdd,
  MdLocationOn,
  MdStar,
  MdChatBubbleOutline,
  MdImage,
  MdStorefront,
  MdLocalShipping,
  MdCheckCircle,
  MdErrorOutline,
  MdClose,
  MdRefresh,
} from 'react-icons/md';

function LensIcon({
  size = 18,
  color = 'currentColor',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.25" y="2.25" width="17" height="17" rx="4.25" stroke={color} strokeWidth="2.2" />
      <circle cx="10.75" cy="10.75" r="5" stroke={color} strokeWidth="2.2" />
      <rect x="18.25" y="9.25" width="3.5" height="3" rx="1.2" stroke={color} strokeWidth="2.2" />
    </svg>
  );
}

type FulfillmentType = 'pickup' | 'delivery';
type PickupTiming = 'now' | 'reserve' | 'basket';

interface Listing {
  listing_id: string;
  title: string;
  price: number;
  image_url: string;
  description?: string;
  store_id: string;
  quantity_available?: number | null;
  [key: string]: unknown;
}

interface Store {
  store_id: string;
  name: string;
  store_image_url?: string;
  owner_id: string;
  address?: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviews_count?: number;
  [key: string]: unknown;
}

interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

type ConfirmKind = 'pickup-now' | null;

const UNKNOWN_STOCK_MAX = 99;

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function formatNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

function buildConversationId(myUserId: string, otherUserId: string): string {
  const pair = [myUserId || 'me', otherUserId].sort();
  return `${pair[0]}_${pair[1]}`;
}

function deriveStock(raw: number | null | undefined): {
  known: boolean;
  count: number;
  label: string;
  tone: 'ok' | 'low' | 'out' | 'unknown';
} {
  const isKnown = typeof raw === 'number' && Number.isFinite(raw);
  if (!isKnown) return { known: false, count: UNKNOWN_STOCK_MAX, label: 'In stock', tone: 'unknown' };
  const n = Math.max(0, Math.floor(raw as number));
  if (n === 0) return { known: true, count: 0, label: 'Out of stock', tone: 'out' };
  if (n <= 5) return { known: true, count: n, label: `Only ${n} left`, tone: 'low' };
  return { known: true, count: n, label: `${n} in stock`, tone: 'ok' };
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const color =
    toast.kind === 'success'
      ? { bg: 'var(--success-bg)', border: 'var(--success-strong)', text: 'var(--success-fg)', icon: 'var(--success-fg)' }
      : toast.kind === 'error'
      ? { bg: 'var(--danger-bg)', border: 'var(--danger-strong)', text: 'var(--danger-fg)', icon: 'var(--danger-fg)' }
      : { bg: 'var(--brand-soft)', border: 'var(--brand-primary)', text: 'var(--brand-on-soft)', icon: 'var(--brand-on-soft)' };

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', marginBottom: 8, borderRadius: 14,
        border: `1px solid ${color.border}`, background: color.bg,
        color: color.text, fontSize: 13.5, fontWeight: 600, lineHeight: 1.4,
        cursor: 'pointer', boxShadow: 'var(--shadow-md)',
        animation: 'idToastIn 0.2s ease',
      }}
    >
      {toast.kind === 'success' && <MdCheckCircle size={18} color={color.icon} />}
      {toast.kind === 'error' && <MdErrorOutline size={18} color={color.icon} />}
      <span style={{ flex: 1 }}>{toast.text}</span>
    </div>
  );
}

function FullscreenViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="idt-viewerOverlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Image viewer">
      <button
        type="button"
        className="idt-viewerClose"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close viewer"
      >
        <MdClose size={22} color="#fff" />
      </button>
      <img src={src} alt={alt} className="idt-viewerImg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="idt-grid">
      <div className="idt-heroCol">
        <div style={skeletonBlock({ aspectRatio: '1 / 1', borderRadius: 20 })} />
      </div>
      <div className="idt-infoCol">
        <div style={skeletonBlock({ height: 24, width: '70%' })} />
        <div style={{ ...skeletonBlock({ height: 24, width: '40%' }), marginTop: 10 }} />
        <div style={{ ...skeletonBlock({ height: 56, width: '100%', borderRadius: 14 }), marginTop: 20 }} />
        <div style={{ ...skeletonBlock({ height: 120, width: '100%', borderRadius: 16 }), marginTop: 20 }} />
      </div>
    </div>
  );
}

function skeletonBlock(extra: React.CSSProperties): React.CSSProperties {
  return {
    background: 'var(--skeleton)',
    backgroundSize: '800px 100%',
    animation: 'idShimmer 1.4s infinite linear',
    ...extra,
  };
}

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [enableDelivery, setEnableDelivery] = useState(true);

  const [isSaved, setIsSaved] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('pickup');
  const [pickupTiming, setPickupTiming] = useState<PickupTiming>('now');

  const [rawStock, setRawStock] = useState<number | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  const [isPickTimeOpen, setIsPickTimeOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [retryKey, setRetryKey] = useState(0);

  const showToast = useCallback((kind: ToastMessage['kind'], text: string) => {
    const toastId = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id: toastId, kind, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 3600);
  }, []);

  const dismissToast = useCallback((toastId: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const requireAuth = useCallback((): boolean => {
    if (!getToken()) {
      router.push('/login');
      return false;
    }
    return true;
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const listingData = (await api.getListing(id)) as unknown as Listing;
      if (!listingData || !listingData.store_id) {
        setLoadError('This item is no longer available.');
        setLoading(false);
        return;
      }
      const storeData = (await api.getStoreById(listingData.store_id)) as unknown as Store;
      setListing(listingData);
      setStore(storeData);
      setRawStock(listingData.quantity_available);
      setRating(storeData?.rating ?? 0);
      setReviewCount(storeData?.reviews_count ?? 0);
      if (getToken()) {
        const saveStatus = await api.getSaveStatus(listingData.listing_id).catch(() => false);
        setIsSaved(saveStatus);
      }
    } catch (err) {
      setLoadError(extractErrorDetail(err, 'Could not load this item.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => loadData(), 0);
    return () => clearTimeout(t);
  }, [loadData, retryKey]);

  useEffect(() => {
    (async () => {
      try {
        const flags = await api.getFeatureFlags();
        setEnableDelivery((flags.enable_delivery as boolean) ?? true);
      } catch {
        setEnableDelivery(true);
      }
    })();
  }, []);

  const stock = useMemo(() => deriveStock(rawStock), [rawStock]);
  const outOfStock = stock.known && stock.count === 0;
  const maxQty = stock.known ? stock.count : UNKNOWN_STOCK_MAX;

  // ✅ CHANGED — route to instant receipt on success
  const confirmInstantPickup = useCallback(async () => {
    if (!listing || !store) return;
    const total = listing.price * quantity;
    setIsLoading(true);
    try {
      const response = (await api.instantPickup(
        listing.listing_id,
        store.owner_id,
        total,
        quantity,
      )) as { transaction_id?: string; amount?: number };

      const txnId = response?.transaction_id || `pickup_${Date.now()}`;
      const paidAmount = Number(response?.amount ?? total);

      const q = new URLSearchParams({
        kind: 'item',
        amount: String(paidAmount),
        quantity: String(quantity),
        unit_price: String(listing.price),
        title: listing.title,
        counterparty: store.name || 'Store',
        created_at: new Date().toISOString(),
      });

            router.replace(`/receipt/instant/${txnId}?${q.toString()}`);
    } catch (err) {
      showToast('error', extractErrorDetail(err, 'Payment failed'));
      setIsLoading(false);
    }
  }, [listing, store, quantity, showToast, router]);

  const reserveNow = useCallback(
    async (pickupTime: string) => {
      if (!listing || !store) return;
      setIsLoading(true);
      try {
        const orderId = 'ord_' + Date.now();
        const total = listing.price * quantity;
        const balance = (await api.getWalletBalance()) as { balance: number };
        if (balance.balance < total) {
          showToast('error', 'Insufficient balance. Top up your wallet.');
          return;
        }
        const windowHours = pickupValueToHours(pickupTime);
        const response = (await api.reserveItem(
          orderId,
          store.owner_id,
          total,
          listing.listing_id,
          undefined,
          0,
          quantity,
          windowHours,
        )) as { status?: string };

        if (response.status === 'locked') {
          const query = new URLSearchParams({
            store_lat: String(store.latitude),
            store_lng: String(store.longitude),
            store_name: store.name,
            order_id: orderId,
            total: String(total),
            quantity: String(quantity),
            pickup_time: pickupTime,
          });
          router.push(`/reservation-confirmed?${query.toString()}`);
        }
      } catch (err) {
        showToast('error', extractErrorDetail(err, 'Reservation failed'));
      } finally {
        setIsLoading(false);
      }
    },
    [listing, store, quantity, router, showToast],
  );

  const addToBasket = useCallback(async () => {
    if (!listing) return;
    setIsLoading(true);
    try {
      await api.addToBasket(listing.listing_id, listing.store_id, quantity);
      showToast('success', `Added ${quantity} item${quantity > 1 ? 's' : ''} to basket`);
    } catch (err) {
      showToast('error', extractErrorDetail(err, 'Could not add to basket'));
    } finally {
      setIsLoading(false);
    }
  }, [listing, quantity, showToast]);

  const proceedToDelivery = useCallback(async () => {
    if (!listing || !store) return;
    setIsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }),
      );
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const orderId = 'ord_' + Date.now();
      const total = listing.price * quantity;
      await api.reserveItem(orderId, store.owner_id, total, listing.listing_id, undefined, 0, quantity, 3);
      const match = (await api.matchCourier(
        orderId,
        store.owner_id,
        store.latitude,
        store.longitude,
        userLat,
        userLng,
      )) as {
        delivery_fee?: number;
        courier_name?: string;
        estimated_package_time_min?: number;
      };
      const deliveryFee = match.delivery_fee ?? 0;
      const courierName = match.courier_name ?? 'Courier';
      const estimatedTime = match.estimated_package_time_min ?? 0;
      showToast(
        'success',
        `Delivery confirmed · ${courierName} · ETA ${estimatedTime} min · Total ${formatNaira(total + deliveryFee)}`,
      );
    } catch (err) {
      showToast('error', extractErrorDetail(err, 'Delivery failed'));
    } finally {
      setIsLoading(false);
    }
  }, [listing, store, quantity, showToast]);

  const openChatWithStore = useCallback(async () => {
    if (!store) return;
    if (!requireAuth()) return;
    const otherUserId = store.owner_id;
    if (!otherUserId) {
      showToast('error', 'Seller information is unavailable');
      return;
    }
    try {
      const me = (await api.getMyProfile()) as { id?: string };
      const myId = me?.id || '';
      const conversationId = buildConversationId(myId, otherUserId);
      const qs = new URLSearchParams();
      qs.set('otherUserId', otherUserId);
      qs.set('otherUserName', store.name || 'Store');
      if (store.store_image_url) qs.set('otherUserAvatar', store.store_image_url);
      router.push(`/chat/${conversationId}?${qs.toString()}`);
    } catch {
      showToast('error', 'Could not open chat');
    }
  }, [store, router, requireAuth, showToast]);

  const openStore = useCallback(() => {
    if (!store?.store_id) return;
    router.push(`/store-detail/${store.store_id}`);
  }, [store, router]);

  const toggleSave = useCallback(async () => {
    if (!listing || isSaveLoading) return;
    if (!requireAuth()) return;
    setIsSaveLoading(true);
    try {
      if (isSaved) {
        await api.unsaveListing(listing.listing_id);
        setIsSaved(false);
        showToast('info', 'Removed from saved');
      } else {
        await api.saveListing(listing.listing_id);
        setIsSaved(true);
        showToast('success', 'Saved to your list');
      }
    } catch (err) {
      showToast('error', extractErrorDetail(err, 'Could not save'));
    } finally {
      setIsSaveLoading(false);
    }
  }, [listing, isSaved, isSaveLoading, requireAuth, showToast]);

  const shareListing = useCallback(async () => {
    if (!listing) return;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const payload = {
      title: listing.title,
      text: `${listing.title} — ${formatNaira(listing.price)} on Admerce`,
      url,
    };
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) { await nav.share(payload); return; }
      if (navigator.clipboard) { await navigator.clipboard.writeText(url); showToast('info', 'Link copied'); return; }
      showToast('info', url);
    } catch { /* user cancelled */ }
  }, [listing, showToast]);

  const handleCTAClick = useCallback(() => {
    if (outOfStock) { showToast('info', 'This item is out of stock'); return; }
    if (!requireAuth()) return;
    if (!listing || !store) return;

    if (fulfillmentType === 'delivery') {
      if (!enableDelivery) { showToast('info', 'Delivery is coming soon'); return; }
      void proceedToDelivery();
      return;
    }
    switch (pickupTiming) {
      case 'now': setConfirmKind('pickup-now'); break;
      case 'reserve': setIsPickTimeOpen(true); break;
      case 'basket': void addToBasket(); break;
    }
  }, [
    outOfStock, requireAuth, listing, store, fulfillmentType, enableDelivery,
    pickupTiming, proceedToDelivery, addToBasket, showToast,
  ]);

  const totalPrice = useMemo(() => (listing ? listing.price * quantity : 0), [listing, quantity]);

  const ctaLabel = useMemo(() => {
    if (outOfStock) return 'Out of stock';
    if (fulfillmentType === 'delivery') return enableDelivery ? 'Deliver to Me' : 'Coming Soon';
    const qtySuffix = quantity > 1 ? ` (${quantity})` : '';
    switch (pickupTiming) {
      case 'now': return `Pick Up Now${qtySuffix}`;
      case 'reserve': return `Reserve & Pick Up${qtySuffix}`;
      case 'basket': return `Add to Basket${qtySuffix}`;
    }
  }, [outOfStock, fulfillmentType, enableDelivery, pickupTiming, quantity]);

  if (loading) {
    return (
      <main className="idt-root">
        <style>{CSS}</style>
        <div className="idt-shell">
          <header className="idt-header">
            <button className="idt-iconBtn" onClick={() => router.back()} aria-label="Back">
              <MdArrowBack size={22} color="currentColor" />
            </button>
            <h1 className="idt-title">Item</h1>
            <div style={{ width: 36 }} />
          </header>
          <div className="idt-scroll"><DetailSkeleton /></div>
        </div>
      </main>
    );
  }

  if (loadError || !listing) {
    return (
      <main className="idt-root">
        <style>{CSS}</style>
        <div className="idt-shell">
          <header className="idt-header">
            <button className="idt-iconBtn" onClick={() => router.back()} aria-label="Back">
              <MdArrowBack size={22} color="currentColor" />
            </button>
            <h1 className="idt-title">Item</h1>
            <div style={{ width: 36 }} />
          </header>
          <div className="idt-scroll">
            <div className="idt-center">
              <div className="idt-stateIcon" aria-hidden="true">
                <MdErrorOutline size={32} color="var(--danger-fg)" />
              </div>
              <h2 className="idt-stateTitle">Something went wrong</h2>
              <p className="idt-stateBody">{loadError || 'This item is no longer available.'}</p>
              <button className="idt-primaryBtn" onClick={() => setRetryKey((k) => k + 1)}>
                <MdRefresh size={18} color="currentColor" />
                Try again
              </button>
              <button className="idt-ghostBtn" onClick={() => router.push('/shopper/home')}>
                Back to home
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const imageUrl = resolveImageUrl(listing.image_url);
  const storeImage = store ? resolveImageUrl(store.store_image_url) : null;
  const deliveryDisabled = fulfillmentType === 'delivery' && !enableDelivery;
  const ctaDisabled = isLoading || deliveryDisabled || outOfStock;

  return (
    <main className="idt-root">
      <style>{CSS}</style>

      {toasts.length > 0 && (
        <div className="idt-toastStack">
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
          ))}
        </div>
      )}

      {viewerOpen && imageUrl && (
        <FullscreenViewer src={imageUrl} alt={listing.title} onClose={() => setViewerOpen(false)} />
      )}

      <div className="idt-shell">
        <header className="idt-header">
          <button className="idt-iconBtn" onClick={() => router.back()} aria-label="Back">
            <MdArrowBack size={22} color="currentColor" />
          </button>
          <h1 className="idt-title">Item</h1>
          <div className="idt-actions">
            <button className="idt-iconBtn" onClick={shareListing} aria-label="Share" title="Share">
              <MdShare size={20} color="currentColor" />
            </button>
            <button className="idt-iconBtn" onClick={toggleSave} disabled={isSaveLoading} aria-label={isSaved ? 'Unsave' : 'Save'} title={isSaved ? 'Unsave' : 'Save'}>
              {isSaved ? <MdFavorite size={20} color="var(--brand-primary)" /> : <MdFavoriteBorder size={20} color="currentColor" />}
            </button>
          </div>
        </header>

        <div className="idt-scroll">
          <div className="idt-grid">
            <div className="idt-heroCol">
              <button
                type="button"
                className="idt-hero idt-heroButton"
                onClick={() => { if (imageUrl) setViewerOpen(true); }}
                aria-label={imageUrl ? 'View full image' : 'No image available'}
                disabled={!imageUrl}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt={listing.title} className="idt-heroImg" />
                ) : (
                  <div className="idt-heroFallback" aria-hidden="true">
                    <MdImage size={48} color="var(--text-muted)" />
                  </div>
                )}

                {imageUrl && (
                  <div
                    className="idt-lensBtn"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); router.push(`/seai-lens?image=${encodeURIComponent(imageUrl)}`); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/seai-lens?image=${encodeURIComponent(imageUrl)}`);
                      }
                    }}
                    aria-label="Visual search"
                    title="Search by photo"
                  >
                    <LensIcon size={20} color="#0504AA" />
                  </div>
                )}
              </button>
            </div>

            <div className="idt-infoCol">
              <h2 className="idt-itemTitle">{listing.title}</h2>
              <div className="idt-priceBlock">
                <div className="idt-priceValue">{formatNaira(totalPrice)}</div>
                {quantity > 1 && (
                  <div className="idt-priceMeta">{quantity} × {formatNaira(listing.price)}</div>
                )}
              </div>

              <div className="idt-storeRow">
                <button type="button" className="idt-storeTapArea" onClick={openStore} aria-label={`Open ${store?.name ?? 'store'}`}>
                  <div className="idt-avatarWrap">
                    {storeImage ? <img src={storeImage} alt="" className="idt-avatarImg" /> : <span className="idt-avatarText">{store?.name?.charAt(0) ?? '?'}</span>}
                  </div>
                  <div className="idt-storeMeta">
                    <div className="idt-storeName" title={store?.name}>{store?.name ?? 'Unknown Store'}</div>
                    <div className="idt-storeRating">
                      {rating > 0 ? (
                        <>
                          <MdStar size={13} color="#FFA000" />
                          <span>{rating.toFixed(1)}</span>
                          <span className="idt-storeReviews">({reviewCount})</span>
                        </>
                      ) : (
                        <span className="idt-storeReviews">New seller</span>
                      )}
                    </div>
                  </div>
                </button>

                <button type="button" className="idt-iconBtn idt-iconBtnFilled" onClick={openChatWithStore} aria-label="Message store" title="Message store">
                  <MdChatBubbleOutline size={20} color="var(--brand-on-soft)" />
                </button>
              </div>

              {store?.address && (
                <div className="idt-addressRow">
                  <MdLocationOn size={16} color="var(--text-tertiary)" />
                  <span className="idt-addressText" title={store.address}>{store.address}</span>
                  <button
                    type="button"
                    className="idt-mapLink"
                    onClick={() => router.push(`/map?lat=${store.latitude}&lng=${store.longitude}&destination=${encodeURIComponent(store.name)}`)}
                  >
                    View on map
                  </button>
                </div>
              )}

              <section className="idt-qtySection">
                <div className="idt-qtyText">
                  <span className="idt-qtyLabel">Quantity</span>
                  <span className={stock.tone === 'out' ? 'idt-stockLine idt-stockOut' : stock.tone === 'low' ? 'idt-stockLine idt-stockLow' : 'idt-stockLine'}>
                    {stock.label}
                  </span>
                </div>
                <div className="idt-qtyControl">
                  <button
                    type="button"
                    className="idt-qtyBtn"
                    onClick={() => quantity > 1 && setQuantity((q) => q - 1)}
                    disabled={quantity <= 1 || outOfStock}
                    aria-label="Decrease quantity"
                  >
                    <MdRemove size={18} color={quantity <= 1 || outOfStock ? 'var(--text-muted)' : 'currentColor'} />
                  </button>
                  <span className="idt-qtyValue">{quantity}</span>
                  <button
                    type="button"
                    className="idt-qtyBtn"
                    onClick={() => quantity < maxQty && setQuantity((q) => q + 1)}
                    disabled={quantity >= maxQty || outOfStock}
                    aria-label="Increase quantity"
                  >
                    <MdAdd size={18} color={quantity >= maxQty || outOfStock ? 'var(--text-muted)' : 'currentColor'} />
                  </button>
                </div>
              </section>

              <section className="idt-section">
                <span className="idt-sectionLabel">How would you like it?</span>
                <div className="idt-segment">
                  <button
                    type="button"
                    className={fulfillmentType === 'pickup' ? 'idt-segBtn idt-segBtnActive' : 'idt-segBtn'}
                    onClick={() => setFulfillmentType('pickup')}
                    disabled={outOfStock}
                  >
                    <MdStorefront size={18} />
                    Pickup
                  </button>
                  <button
                    type="button"
                    className={fulfillmentType === 'delivery' ? 'idt-segBtn idt-segBtnActive' : 'idt-segBtn'}
                    onClick={() => setFulfillmentType('delivery')}
                    disabled={!enableDelivery || outOfStock}
                  >
                    <MdLocalShipping size={18} />
                    Delivery
                  </button>
                </div>

                {fulfillmentType === 'pickup' && (
                  <div className="idt-chipRow">
                    {(['now', 'reserve', 'basket'] as PickupTiming[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={pickupTiming === t ? 'idt-chip idt-chipActive' : 'idt-chip'}
                        onClick={() => setPickupTiming(t)}
                        disabled={outOfStock}
                      >
                        {t === 'now' ? 'Get it now' : t === 'reserve' ? 'Reserve Now' : 'Add to Basket'}
                      </button>
                    ))}
                  </div>
                )}

                {deliveryDisabled && !outOfStock && (
                  <p className="idt-hint idt-hintWarn">Delivery is temporarily unavailable. Pickup works as normal.</p>
                )}
              </section>

              <section className="idt-summary">
                <div className="idt-summaryRow">
                  <span className="idt-summaryLabel">Subtotal</span>
                  <span className="idt-summaryValue">{formatNaira(totalPrice)}</span>
                </div>
                {fulfillmentType === 'delivery' && enableDelivery && !outOfStock && (
                  <div className="idt-summaryRow">
                    <span className="idt-summaryLabel">Delivery</span>
                    <span className="idt-summaryValue">Calculated on confirm</span>
                  </div>
                )}
                <div className="idt-summaryRow idt-summaryTotal">
                  <span className="idt-summaryLabel">Total</span>
                  <span className="idt-summaryValue idt-summaryGrand">{formatNaira(totalPrice)}</span>
                </div>
              </section>

              {listing.description && (
                <section className="idt-section">
                  <span className="idt-sectionLabel">Description</span>
                  <p className="idt-description">{listing.description}</p>
                </section>
              )}
            </div>
          </div>
          <div className="idt-scrollSpacer" />
        </div>

        <div className="idt-ctaWrap">
          <button
            type="button"
            className={ctaDisabled ? 'idt-ctaBtn idt-ctaBtnDisabled' : 'idt-ctaBtn'}
            onClick={handleCTAClick}
            disabled={ctaDisabled}
          >
            {isLoading ? <span className="idt-ctaSpinner" aria-hidden="true" /> : ctaLabel}
          </button>
        </div>
      </div>

      {confirmKind === 'pickup-now' && (
        <div className="idt-modalOverlay" onClick={() => setConfirmKind(null)} role="dialog" aria-modal="true">
          <div className="idt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="idt-modalIcon">
              <MdStorefront size={28} color="var(--brand-on-soft)" />
            </div>
            <h3 className="idt-modalTitle">Are you at the store?</h3>
            <p className="idt-modalBody">
              This pays {formatNaira(totalPrice)} directly to{' '}
              <strong>{store?.name ?? 'the store'}</strong>
              {quantity > 1 && (<> for <strong>{quantity} items</strong></>)}.
              No escrow, no booking — money moves immediately.
            </p>
            <div className="idt-modalActions">
              <button type="button" className="idt-modalCancel" onClick={() => setConfirmKind(null)} disabled={isLoading}>
                Cancel
              </button>
              <button
                type="button"
                className="idt-modalConfirm"
                onClick={() => { setConfirmKind(null); void confirmInstantPickup(); }}
                disabled={isLoading}
              >
                {isLoading ? 'Paying…' : `Pay ${formatNaira(totalPrice)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <PickTimeBottomSheet
        isOpen={isPickTimeOpen}
        onClose={() => setIsPickTimeOpen(false)}
        onSelect={(pickupTime) => { setIsPickTimeOpen(false); void reserveNow(pickupTime); }}
      />
    </main>
  );
}

// CSS unchanged from source
const CSS = `
  @keyframes idShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  @keyframes idToastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes idSpin { to { transform: rotate(360deg); } }

  .idt-root { display: flex; flex-direction: column; height: 100dvh; background: var(--bg-primary); color: var(--text-primary); position: relative; transition: background-color 0.18s ease, color 0.18s ease; }
  .idt-shell { flex: 1; min-height: 0; display: flex; flex-direction: column; width: 100%; max-width: 1180px; margin: 0 auto; }
  .idt-toastStack { position: fixed; top: 12px; left: 16px; right: 16px; z-index: 2000; max-width: 480px; margin: 0 auto; pointer-events: none; }
  .idt-toastStack > * { pointer-events: auto; }
  .idt-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg-secondary); color: var(--text-primary); border-bottom: 1px solid var(--border-default); z-index: 10; transition: background-color 0.18s ease, border-color 0.18s ease; }
  .idt-title { flex: 1; font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; text-align: center; letter-spacing: -0.01em; }
  .idt-actions { display: flex; gap: 2px; }
  .idt-iconBtn { width: 36px; height: 36px; border-radius: 10px; border: none; background: transparent; color: var(--text-primary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; font-family: inherit; }
  .idt-iconBtn:hover:not(:disabled) { background: var(--bg-hover); }
  .idt-iconBtn:disabled { opacity: 0.5; cursor: not-allowed; }
  .idt-iconBtnFilled { background: var(--brand-soft); }
  .idt-iconBtnFilled:hover { background: var(--brand-soft-strong); }
  .idt-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 16px 0; -webkit-overflow-scrolling: touch; }
  .idt-grid { display: flex; flex-direction: column; }
  .idt-heroCol { width: 100%; }
  .idt-infoCol { width: 100%; min-width: 0; }
  .idt-hero { position: relative; width: 100%; aspect-ratio: 1 / 1; border-radius: 20px; overflow: hidden; background: var(--bg-tertiary); margin-bottom: 18px; display: block; }
  .idt-heroButton { border: none; padding: 0; cursor: zoom-in; font-family: inherit; text-align: left; transition: transform 0.15s; }
  .idt-heroButton:hover:not(:disabled) { transform: scale(1.005); }
  .idt-heroButton:active:not(:disabled) { transform: scale(0.995); }
  .idt-heroButton:disabled { cursor: default; }
  .idt-heroImg { width: 100%; height: 100%; object-fit: cover; display: block; }
  .idt-heroFallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--bg-tertiary); }
  .idt-lensBtn { position: absolute; bottom: 12px; right: 12px; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.95); border: none; box-shadow: 0 4px 14px rgba(11,11,26,0.18); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 2; }
  .idt-lensBtn:focus-visible { outline: 3px solid var(--brand-primary); outline-offset: 3px; }
  .idt-viewerOverlay { position: fixed; inset: 0; z-index: 5000; background: rgba(11, 11, 26, 0.95); display: flex; align-items: center; justify-content: center; padding: 20px; cursor: zoom-out; animation: idToastIn 0.18s ease; }
  .idt-viewerImg { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; cursor: default; user-select: none; -webkit-user-select: none; }
  .idt-viewerClose { position: absolute; top: 16px; right: 16px; width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,0.15); border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  .idt-itemTitle { font-size: 22px; font-weight: 800; color: var(--text-primary); line-height: 1.25; letter-spacing: -0.02em; margin: 0 0 10px; }
  .idt-priceBlock { display: flex; align-items: baseline; gap: 10px; margin-bottom: 18px; }
  .idt-priceValue { font-size: 26px; font-weight: 800; color: var(--brand-primary); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .idt-priceMeta { font-size: 13.5px; color: var(--text-tertiary); font-weight: 600; }
  .idt-storeRow { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; background: var(--bg-secondary); border: 1px solid var(--border-default); border-radius: 14px; margin-bottom: 10px; transition: background-color 0.18s ease, border-color 0.18s ease; }
  .idt-storeTapArea { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 4px; border: none; background: transparent; cursor: pointer; text-align: left; font-family: inherit; border-radius: 10px; transition: background 0.15s; }
  .idt-storeTapArea:hover { background: var(--bg-hover); }
  .idt-avatarWrap { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 12px; overflow: hidden; background: var(--brand-soft); display: flex; align-items: center; justify-content: center; }
  .idt-avatarImg { width: 100%; height: 100%; object-fit: cover; }
  .idt-avatarText { color: var(--brand-on-soft); font-weight: 800; font-size: 18px; }
  .idt-storeMeta { flex: 1; min-width: 0; }
  .idt-storeName { font-size: 14.5px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .idt-storeRating { display: flex; align-items: center; gap: 4px; margin-top: 2px; font-size: 12.5px; color: var(--text-secondary); font-weight: 700; }
  .idt-storeReviews { color: var(--text-muted); font-weight: 500; }
  .idt-addressRow { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg-secondary); border: 1px solid var(--border-default); border-radius: 14px; margin-bottom: 18px; transition: background-color 0.18s ease, border-color 0.18s ease; }
  .idt-addressText { flex: 1; min-width: 0; font-size: 13.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .idt-mapLink { background: none; border: none; color: var(--brand-primary); font-size: 12.5px; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 2px; font-family: inherit; }
  .idt-qtySection { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; background: var(--bg-secondary); border: 1px solid var(--border-default); border-radius: 14px; margin-bottom: 20px; transition: background-color 0.18s ease, border-color 0.18s ease; }
  .idt-qtyText { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .idt-qtyLabel { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; }
  .idt-stockLine { font-size: 13px; font-weight: 700; color: var(--text-secondary); line-height: 1.35; }
  .idt-stockLow { color: var(--warning-fg); }
  .idt-stockOut { color: var(--danger-fg); }
  .idt-section { margin-bottom: 20px; }
  .idt-sectionLabel { display: block; font-size: 11px; font-weight: 800; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; }
  .idt-qtyControl { display: inline-flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid var(--border-default); border-radius: 12px; background: var(--bg-tertiary); flex: 0 0 auto; }
  .idt-qtyBtn { width: 34px; height: 34px; border-radius: 9px; border: none; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .idt-qtyBtn:hover:not(:disabled) { background: var(--brand-soft); }
  .idt-qtyBtn:disabled { cursor: not-allowed; }
  .idt-qtyValue { min-width: 36px; text-align: center; font-weight: 800; font-size: 15px; color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .idt-segment { display: flex; gap: 8px; margin-bottom: 12px; }
  .idt-segBtn { flex: 1; padding: 12px 10px; border-radius: 12px; border: 1px solid var(--border-default); background: var(--bg-secondary); color: var(--text-secondary); font-weight: 700; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; transition: background 0.15s, border-color 0.15s, color 0.15s; }
  .idt-segBtn:hover:not(:disabled) { border-color: var(--brand-primary); }
  .idt-segBtn:disabled { opacity: 0.5; cursor: not-allowed; }
  .idt-segBtnActive { background: var(--brand-soft); border-color: var(--brand-primary); color: var(--brand-primary); }
  .idt-chipRow { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
  .idt-chip { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border-default); background: var(--bg-secondary); color: var(--text-secondary); font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; transition: background 0.15s, border-color 0.15s, color 0.15s; }
  .idt-chip:hover:not(:disabled) { border-color: var(--brand-primary); }
  .idt-chip:disabled { opacity: 0.5; cursor: not-allowed; }
  .idt-chipActive { background: var(--brand-primary); border-color: var(--brand-primary); color: var(--brand-on-primary); }
  .idt-hint { margin: 8px 0 0; font-size: 12.5px; font-weight: 600; line-height: 1.5; color: var(--text-tertiary); }
  .idt-hintWarn { color: var(--warning-fg); }
  .idt-summary { padding: 14px 16px; background: var(--bg-secondary); border: 1px solid var(--border-default); border-radius: 14px; margin-bottom: 20px; transition: background-color 0.18s ease, border-color 0.18s ease; }
  .idt-summaryRow { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; }
  .idt-summaryLabel { color: var(--text-tertiary); font-weight: 600; }
  .idt-summaryValue { color: var(--text-primary); font-weight: 700; font-variant-numeric: tabular-nums; }
  .idt-summaryTotal { padding-top: 12px; margin-top: 8px; border-top: 1px solid var(--border-subtle); }
  .idt-summaryGrand { color: var(--brand-primary); font-size: 17px; font-weight: 800; letter-spacing: -0.01em; }
  .idt-description { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin: 0; white-space: pre-wrap; }
  .idt-scrollSpacer { height: 24px; }
  .idt-ctaWrap { padding: 12px 16px calc(14px + env(safe-area-inset-bottom)); background: linear-gradient(to top, var(--bg-primary) 65%, transparent); }
  .idt-ctaBtn { width: 100%; padding: 16px; border-radius: 14px; border: none; background: var(--brand-gradient); color: var(--brand-on-gradient); font-size: 15.5px; font-weight: 800; letter-spacing: -0.01em; cursor: pointer; font-family: inherit; box-shadow: var(--shadow-brand); transition: opacity 0.15s, transform 0.15s; display: flex; align-items: center; justify-content: center; min-height: 54px; }
  .idt-ctaBtn:hover:not(:disabled) { opacity: 0.94; }
  .idt-ctaBtn:disabled { cursor: not-allowed; opacity: 0.6; }
  .idt-ctaBtnDisabled { background: var(--bg-tertiary); color: var(--text-muted); box-shadow: none; }
  .idt-ctaSpinner { width: 20px; height: 20px; border: 2.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: idSpin 0.7s linear infinite; opacity: 0.85; }
  .idt-modalOverlay { position: fixed; inset: 0; background: var(--overlay); display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 20px; animation: idToastIn 0.15s ease; }
  .idt-modal { background: var(--bg-elevated); color: var(--text-primary); border-radius: 20px; padding: 24px 22px; max-width: 400px; width: 100%; box-shadow: var(--shadow-lg); text-align: center; transition: background-color 0.18s ease, color 0.18s ease; }
  .idt-modalIcon { width: 60px; height: 60px; border-radius: 20px; background: var(--brand-soft); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; }
  .idt-modalTitle { font-size: 19px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px; letter-spacing: -0.01em; }
  .idt-modalBody { font-size: 14px; color: var(--text-secondary); line-height: 1.55; margin: 0 0 22px; }
  .idt-modalActions { display: flex; gap: 10px; }
  .idt-modalCancel { flex: 1; padding: 14px; border-radius: 12px; border: 1px solid var(--border-default); background: var(--bg-secondary); color: var(--text-secondary); font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .idt-modalCancel:hover:not(:disabled) { background: var(--bg-hover); }
  .idt-modalConfirm { flex: 2; padding: 14px; border-radius: 12px; border: none; background: var(--brand-gradient); color: var(--brand-on-gradient); font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
  .idt-modalConfirm:hover:not(:disabled) { opacity: 0.92; }
  .idt-modalConfirm:disabled, .idt-modalCancel:disabled { opacity: 0.6; cursor: not-allowed; }
  .idt-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; text-align: center; gap: 8px; }
  .idt-stateIcon { width: 72px; height: 72px; border-radius: 24px; background: var(--danger-bg); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .idt-stateTitle { font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 0; letter-spacing: -0.01em; }
  .idt-stateBody { font-size: 13.5px; color: var(--text-tertiary); margin: 4px 0 18px; max-width: 340px; line-height: 1.55; }
  .idt-primaryBtn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; background: var(--brand-gradient); color: var(--brand-on-gradient); border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
  .idt-primaryBtn:hover { opacity: 0.92; }
  .idt-ghostBtn { margin-top: 10px; padding: 10px 18px; background: transparent; border: none; color: var(--brand-primary); font-weight: 700; font-size: 13.5px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; font-family: inherit; }
  @media (min-width: 900px) {
    .idt-scroll { padding: 28px 28px 0; }
    .idt-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 40px; align-items: start; }
    .idt-heroCol { position: sticky; top: 0; }
    .idt-hero { aspect-ratio: 1 / 1; margin-bottom: 0; }
    .idt-itemTitle { font-size: 28px; line-height: 1.2; margin-bottom: 12px; }
    .idt-priceBlock { margin-bottom: 22px; }
    .idt-priceValue { font-size: 32px; }
    .idt-priceMeta { font-size: 14px; }
    .idt-storeRow { padding: 10px 14px 10px 10px; border-radius: 16px; }
    .idt-qtySection { padding: 16px 18px; }
    .idt-summary { padding: 18px 20px; }
    .idt-segBtn { padding: 14px 16px; font-size: 14.5px; }
    .idt-chip { padding: 9px 16px; font-size: 13.5px; }
    .idt-description { font-size: 15px; line-height: 1.7; }
    .idt-ctaWrap { padding: 18px 28px calc(22px + env(safe-area-inset-bottom)); background: var(--bg-primary); border-top: 1px solid var(--border-default); }
    .idt-ctaBtn { max-width: 520px; margin: 0 auto; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
`;