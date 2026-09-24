'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import PickTimeBottomSheet from '../../../components/PickTimeBottomSheet';
import { getToken } from '../../../services/localStorage';
import {
  MdArrowBack,
  MdShare,
  MdFavorite,
  MdFavoriteBorder,
  MdSearch,
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

// ─── Types ──────────────────────────────────────────────────────────
type FulfillmentType = 'pickup' | 'delivery';
type PickupTiming = 'now' | 'reserve' | 'basket';

interface Listing {
  listing_id: string;
  title: string;
  price: number;
  image_url: string;
  description?: string;
  store_id: string;
  quantity_available?: number;
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

// ─── Helpers ────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
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

// ─── Toast ──────────────────────────────────────────────────────────
function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  const color =
    toast.kind === 'success'
      ? { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', icon: '#16A34A' }
      : toast.kind === 'error'
      ? { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '#DC2626' }
      : { bg: '#EEF0FF', border: '#C9CBFF', text: '#0504AA', icon: '#0504AA' };

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        marginBottom: 8,
        borderRadius: 14,
        border: `1px solid ${color.border}`,
        background: color.bg,
        color: color.text,
        fontSize: 13.5,
        fontWeight: 600,
        lineHeight: 1.4,
        cursor: 'pointer',
        boxShadow: '0 10px 30px rgba(11, 11, 26, 0.10)',
        animation: 'idToastIn 0.2s ease',
      }}
    >
      {toast.kind === 'success' && (
        <MdCheckCircle size={18} color={color.icon} />
      )}
      {toast.kind === 'error' && (
        <MdErrorOutline size={18} color={color.icon} />
      )}
      <span style={{ flex: 1 }}>{toast.text}</span>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div style={{ padding: '16px' }}>
      <div style={skeletonBlock({ aspectRatio: '1 / 1', borderRadius: 20 })} />
      <div style={{ marginTop: 16 }}>
        <div style={skeletonBlock({ height: 24, width: '70%' })} />
        <div
          style={{
            ...skeletonBlock({ height: 24, width: '40%' }),
            marginTop: 10,
          }}
        />
        <div
          style={{
            ...skeletonBlock({ height: 56, width: '100%', borderRadius: 14 }),
            marginTop: 20,
          }}
        />
        <div
          style={{
            ...skeletonBlock({ height: 120, width: '100%', borderRadius: 16 }),
            marginTop: 20,
          }}
        />
      </div>
    </div>
  );
}

function skeletonBlock(extra: React.CSSProperties): React.CSSProperties {
  return {
    background:
      'linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%)',
    backgroundSize: '800px 100%',
    animation: 'idShimmer 1.4s infinite linear',
    ...extra,
  };
}

// ─── Main page ──────────────────────────────────────────────────────
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

  const [stockAvailable, setStockAvailable] = useState(0);
  const [rating, setRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  const [isPickTimeOpen, setIsPickTimeOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [retryKey, setRetryKey] = useState(0);

  // ── Toast helpers ───────────────────────────────────────────────
  const showToast = useCallback(
    (kind: ToastMessage['kind'], text: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, kind, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    [],
  );

  const dismissToast = useCallback((toastId: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // ── Auth guard ──────────────────────────────────────────────────
  const requireAuth = useCallback((): boolean => {
    if (!getToken()) {
      router.push('/login');
      return false;
    }
    return true;
  }, [router]);

  // ── Load listing + store ────────────────────────────────────────
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

      const storeData = (await api.getStoreById(
        listingData.store_id,
      )) as unknown as Store;

      setListing(listingData);
      setStore(storeData);
      setStockAvailable(listingData.quantity_available ?? 0);
      setRating(storeData?.rating ?? 0);
      setReviewCount(storeData?.reviews_count ?? 0);

      // Save status is best-effort — auth required
      if (getToken()) {
        const saveStatus = await api
          .getSaveStatus(listingData.listing_id)
          .catch(() => false);
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

  // ── Actions ─────────────────────────────────────────────────────
  const confirmInstantPickup = useCallback(async () => {
    if (!listing || !store) return;
    const total = listing.price * quantity;
    setIsLoading(true);
    try {
      await api.instantPickup(
        listing.listing_id,
        store.owner_id,
        total,
        quantity,
      );
      showToast(
        'success',
        `Paid ${formatNaira(total)} · ${quantity} item${quantity > 1 ? 's' : ''}`,
      );
    } catch (err) {
      showToast('error', extractErrorDetail(err, 'Payment failed'));
    } finally {
      setIsLoading(false);
    }
  }, [listing, store, quantity, showToast]);

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

        const response = (await api.reserveItem(
          orderId,
          store.owner_id,
          total,
          listing.listing_id,
          undefined,
          0,
          quantity,
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
      showToast(
        'success',
        `Added ${quantity} item${quantity > 1 ? 's' : ''} to basket`,
      );
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
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
        }),
      );
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;

      const orderId = 'ord_' + Date.now();
      const total = listing.price * quantity;

      await api.reserveItem(
        orderId,
        store.owner_id,
        total,
        listing.listing_id,
        undefined,
        0,
        quantity,
      );

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
      if (store.store_image_url) {
        qs.set('otherUserAvatar', store.store_image_url);
      }

      router.push(`/chat/${conversationId}?${qs.toString()}`);
    } catch {
      showToast('error', 'Could not open chat');
    }
  }, [store, router, requireAuth, showToast]);

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
      const nav = navigator as Navigator & {
        share?: (d: ShareData) => Promise<void>;
      };
      if (nav.share) {
        await nav.share(payload);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('info', 'Link copied');
        return;
      }
      showToast('info', url);
    } catch {
      // user cancelled — silent
    }
  }, [listing, showToast]);

  const handleCTAClick = useCallback(() => {
    if (!requireAuth()) return;
    if (!listing || !store) return;

    if (fulfillmentType === 'delivery') {
      if (!enableDelivery) {
        showToast('info', 'Delivery is coming soon');
        return;
      }
      void proceedToDelivery();
      return;
    }

    switch (pickupTiming) {
      case 'now':
        setConfirmKind('pickup-now');
        break;
      case 'reserve':
        setIsPickTimeOpen(true);
        break;
      case 'basket':
        void addToBasket();
        break;
    }
  }, [
    requireAuth,
    listing,
    store,
    fulfillmentType,
    enableDelivery,
    pickupTiming,
    proceedToDelivery,
    addToBasket,
    showToast,
  ]);

  // ── Derived ─────────────────────────────────────────────────────
  const totalPrice = useMemo(
    () => (listing ? listing.price * quantity : 0),
    [listing, quantity],
  );

  const ctaLabel = useMemo(() => {
    if (fulfillmentType === 'delivery') {
      return enableDelivery ? 'Deliver to Me' : 'Coming Soon';
    }
    const qtySuffix = quantity > 1 ? ` (${quantity})` : '';
    switch (pickupTiming) {
      case 'now':
        return `Pick Up Now${qtySuffix}`;
      case 'reserve':
        return `Reserve & Pick Up${qtySuffix}`;
      case 'basket':
        return `Add to Basket${qtySuffix}`;
    }
  }, [fulfillmentType, enableDelivery, pickupTiming, quantity]);

  // ── Render gates ────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="idt-root">
        <style>{CSS}</style>
        <header className="idt-header">
          <button
            className="idt-iconBtn"
            onClick={() => router.back()}
            aria-label="Back"
          >
            <MdArrowBack size={22} color="#0B0B1A" />
          </button>
          <h1 className="idt-title">Item</h1>
          <div style={{ width: 36 }} />
        </header>
        <DetailSkeleton />
      </main>
    );
  }

  if (loadError || !listing) {
    return (
      <main className="idt-root">
        <style>{CSS}</style>
        <header className="idt-header">
          <button
            className="idt-iconBtn"
            onClick={() => router.back()}
            aria-label="Back"
          >
            <MdArrowBack size={22} color="#0B0B1A" />
          </button>
          <h1 className="idt-title">Item</h1>
          <div style={{ width: 36 }} />
        </header>
        <div className="idt-center">
          <div className="idt-stateIcon" aria-hidden="true">
            <MdErrorOutline size={32} color="#DC2626" />
          </div>
          <h2 className="idt-stateTitle">Something went wrong</h2>
          <p className="idt-stateBody">
            {loadError || 'This item is no longer available.'}
          </p>
          <button
            className="idt-primaryBtn"
            onClick={() => setRetryKey((k) => k + 1)}
          >
            <MdRefresh size={18} color="#fff" />
            Try again
          </button>
          <button
            className="idt-ghostBtn"
            onClick={() => router.push('/shopper/home')}
          >
            Back to home
          </button>
        </div>
      </main>
    );
  }

  const imageUrl = resolveImageUrl(listing.image_url);
  const storeImage = store ? resolveImageUrl(store.store_image_url) : null;
  const hasStock = stockAvailable > 0;
  const deliveryDisabled = fulfillmentType === 'delivery' && !enableDelivery;

  return (
    <main className="idt-root">
      <style>{CSS}</style>

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div className="idt-toastStack">
          {toasts.map((t) => (
            <Toast
              key={t.id}
              toast={t}
              onDismiss={() => dismissToast(t.id)}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <header className="idt-header">
        <button
          className="idt-iconBtn"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <MdArrowBack size={22} color="#0B0B1A" />
        </button>
        <h1 className="idt-title">Item</h1>
        <div className="idt-actions">
          <button
            className="idt-iconBtn"
            onClick={shareListing}
            aria-label="Share"
            title="Share"
          >
            <MdShare size={20} color="#0B0B1A" />
          </button>
          <button
            className="idt-iconBtn"
            onClick={toggleSave}
            disabled={isSaveLoading}
            aria-label={isSaved ? 'Unsave' : 'Save'}
            title={isSaved ? 'Unsave' : 'Save'}
          >
            {isSaved ? (
              <MdFavorite size={20} color="#0504AA" />
            ) : (
              <MdFavoriteBorder size={20} color="#0B0B1A" />
            )}
          </button>
        </div>
      </header>

      <div className="idt-scroll">
        {/* Hero */}
        <div className="idt-hero">
          {imageUrl ? (
            <img src={imageUrl} alt={listing.title} className="idt-heroImg" />
          ) : (
            <div className="idt-heroFallback" aria-hidden="true">
              <MdImage size={48} color="#94a3b8" />
            </div>
          )}
          <button
            type="button"
            className="idt-lensBtn"
            onClick={() => {
              if (imageUrl) {
                router.push(`/seai-lens?image=${encodeURIComponent(imageUrl)}`);
              } else {
                showToast('info', 'No image for visual search');
              }
            }}
            aria-label="Visual search"
            title="Visual search"
          >
            <MdSearch size={20} color="#0504AA" />
          </button>
          {hasStock && stockAvailable <= 5 && (
            <span className="idt-stockBadge">Only {stockAvailable} left</span>
          )}
        </div>

        {/* Title + price */}
        <h2 className="idt-itemTitle">{listing.title}</h2>
        <div className="idt-priceBlock">
          <div className="idt-priceValue">{formatNaira(totalPrice)}</div>
          {quantity > 1 && (
            <div className="idt-priceMeta">
              {quantity} × {formatNaira(listing.price)}
            </div>
          )}
        </div>

        {/* Store row */}
        <div className="idt-storeRow">
          <div className="idt-avatarWrap">
            {storeImage ? (
              <img src={storeImage} alt="" className="idt-avatarImg" />
            ) : (
              <span className="idt-avatarText">
                {store?.name?.charAt(0) ?? '?'}
              </span>
            )}
          </div>
          <div className="idt-storeMeta">
            <div className="idt-storeName" title={store?.name}>
              {store?.name ?? 'Unknown Store'}
            </div>
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
          <button
            type="button"
            className="idt-iconBtn idt-iconBtnFilled"
            onClick={openChatWithStore}
            aria-label="Message store"
            title="Message store"
          >
            <MdChatBubbleOutline size={20} color="#0504AA" />
          </button>
        </div>

        {/* Address */}
        {store?.address && (
          <div className="idt-addressRow">
            <MdLocationOn size={16} color="#64748B" />
            <span className="idt-addressText" title={store.address}>
              {store.address}
            </span>
            <button
              type="button"
              className="idt-mapLink"
              onClick={() =>
                router.push(
                  `/map?lat=${store.latitude}&lng=${store.longitude}&destination=${encodeURIComponent(
                    store.name,
                  )}`,
                )
              }
            >
              View on map
            </button>
          </div>
        )}

        {/* Quantity */}
        <section className="idt-qtySection">
          <span className="idt-sectionLabel">Quantity</span>
          <div className="idt-qtyControl">
            <button
              type="button"
              className="idt-qtyBtn"
              onClick={() => quantity > 1 && setQuantity((q) => q - 1)}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <MdRemove size={18} color={quantity <= 1 ? '#cbd5e1' : '#0B0B1A'} />
            </button>
            <span className="idt-qtyValue">{quantity}</span>
            <button
              type="button"
              className="idt-qtyBtn"
              onClick={() =>
                quantity < stockAvailable && setQuantity((q) => q + 1)
              }
              disabled={quantity >= stockAvailable}
              aria-label="Increase quantity"
            >
              <MdAdd
                size={18}
                color={quantity >= stockAvailable ? '#cbd5e1' : '#0B0B1A'}
              />
            </button>
          </div>
        </section>

        {/* Fulfillment */}
        <section className="idt-section">
          <span className="idt-sectionLabel">How would you like it?</span>

          <div className="idt-segment">
            <button
              type="button"
              className={
                fulfillmentType === 'pickup'
                  ? 'idt-segBtn idt-segBtnActive'
                  : 'idt-segBtn'
              }
              onClick={() => setFulfillmentType('pickup')}
            >
              <MdStorefront size={18} />
              Pickup
            </button>
            <button
              type="button"
              className={
                fulfillmentType === 'delivery'
                  ? 'idt-segBtn idt-segBtnActive'
                  : 'idt-segBtn'
              }
              onClick={() => setFulfillmentType('delivery')}
              disabled={!enableDelivery}
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
                  className={
                    pickupTiming === t
                      ? 'idt-chip idt-chipActive'
                      : 'idt-chip'
                  }
                  onClick={() => setPickupTiming(t)}
                >
                  {t === 'now'
                    ? 'Get it now'
                    : t === 'reserve'
                    ? 'Reserve Now'
                    : 'Add to Basket'}
                </button>
              ))}
            </div>
          )}

          {deliveryDisabled && (
            <p className="idt-hint idt-hintWarn">
              Delivery is temporarily unavailable. Pickup works as normal.
            </p>
          )}
        </section>

        {/* Order summary */}
        <section className="idt-summary">
          <div className="idt-summaryRow">
            <span className="idt-summaryLabel">Subtotal</span>
            <span className="idt-summaryValue">{formatNaira(totalPrice)}</span>
          </div>
          {fulfillmentType === 'delivery' && enableDelivery && (
            <div className="idt-summaryRow">
              <span className="idt-summaryLabel">Delivery</span>
              <span className="idt-summaryValue">Calculated on confirm</span>
            </div>
          )}
          <div className="idt-summaryRow idt-summaryTotal">
            <span className="idt-summaryLabel">Total</span>
            <span className="idt-summaryValue idt-summaryGrand">
              {formatNaira(totalPrice)}
            </span>
          </div>
        </section>

        {/* Description */}
        {listing.description && (
          <section className="idt-section">
            <span className="idt-sectionLabel">Description</span>
            <p className="idt-description">{listing.description}</p>
          </section>
        )}

        {/* Bottom spacer so the sticky CTA never covers the last line of content */}
        <div style={{ height: 120 }} />
      </div>

      {/* Sticky CTA */}
      <div className="idt-ctaWrap">
        <button
          type="button"
          className={
            isLoading || deliveryDisabled
              ? 'idt-ctaBtn idt-ctaBtnDisabled'
              : 'idt-ctaBtn'
          }
          onClick={handleCTAClick}
          disabled={isLoading || deliveryDisabled}
        >
          {isLoading ? (
            <span className="idt-ctaSpinner" aria-hidden="true" />
          ) : (
            ctaLabel
          )}
        </button>
      </div>

      {/* Confirm modal — replaces window.confirm for Pick Up Now */}
      {confirmKind === 'pickup-now' && (
        <div
          className="idt-modalOverlay"
          onClick={() => setConfirmKind(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="idt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="idt-modalIcon">
              <MdStorefront size={28} color="#0504AA" />
            </div>
            <h3 className="idt-modalTitle">Are you at the store?</h3>
            <p className="idt-modalBody">
              This pays {formatNaira(totalPrice)} directly to{' '}
              <strong>{store?.name ?? 'the store'}</strong>
              {quantity > 1 && (
                <>
                  {' '}
                  for <strong>{quantity} items</strong>
                </>
              )}
              . No escrow, no booking — money moves immediately.
            </p>
            <div className="idt-modalActions">
              <button
                type="button"
                className="idt-modalCancel"
                onClick={() => setConfirmKind(null)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="idt-modalConfirm"
                onClick={() => {
                  setConfirmKind(null);
                  void confirmInstantPickup();
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Paying…' : `Pay ${formatNaira(totalPrice)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pick time sheet */}
      <PickTimeBottomSheet
        isOpen={isPickTimeOpen}
        onClose={() => setIsPickTimeOpen(false)}
        onSelect={(pickupTime) => {
          setIsPickTimeOpen(false);
          void reserveNow(pickupTime);
        }}
      />
    </main>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes idShimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes idToastIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes idSpin { to { transform: rotate(360deg); } }

  .idt-root {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: #F4F5FB;
    position: relative;
  }

  /* Toast stack */
  .idt-toastStack {
    position: fixed;
    top: 12px;
    left: 16px;
    right: 16px;
    z-index: 2000;
    max-width: 480px;
    margin: 0 auto;
    pointer-events: none;
  }
  .idt-toastStack > * { pointer-events: auto; }

  /* Header */
  .idt-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #fff;
    border-bottom: 1px solid #EAECF3;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .idt-title {
    flex: 1;
    font-size: 16px;
    font-weight: 700;
    color: #0B0B1A;
    margin: 0;
    text-align: center;
    letter-spacing: -0.01em;
  }
  .idt-actions { display: flex; gap: 2px; }
  .idt-iconBtn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    font-family: inherit;
  }
  .idt-iconBtn:hover:not(:disabled) { background: #F1F3FA; }
  .idt-iconBtn:disabled { opacity: 0.5; cursor: not-allowed; }
  .idt-iconBtnFilled { background: #EEF0FF; }
  .idt-iconBtnFilled:hover { background: #DDE2FF; }

  /* Scroll body */
  .idt-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 0;
    WebkitOverflowScrolling: touch;
  }

  /* Hero */
  .idt-hero {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 20px;
    overflow: hidden;
    background: #E8EAF0;
    margin-bottom: 18px;
  }
  .idt-heroImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .idt-heroFallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #E8EAF0;
  }
  .idt-lensBtn {
    position: absolute;
    bottom: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.95);
    border: none;
    box-shadow: 0 4px 14px rgba(11,11,26,0.18);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .idt-stockBadge {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(220, 38, 38, 0.92);
    color: #fff;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.02em;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  /* Title + price */
  .idt-itemTitle {
    font-size: 22px;
    font-weight: 800;
    color: #0B0B1A;
    line-height: 1.25;
    letter-spacing: -0.02em;
    margin: 0 0 10px;
  }
  .idt-priceBlock {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 18px;
  }
  .idt-priceValue {
    font-size: 26px;
    font-weight: 800;
    color: #0504AA;
    letter-spacing: -0.02em;
  }
  .idt-priceMeta {
    font-size: 13.5px;
    color: #64748B;
    font-weight: 600;
  }

  /* Store row */
  .idt-storeRow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 14px;
    margin-bottom: 10px;
  }
  .idt-avatarWrap {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border-radius: 12px;
    overflow: hidden;
    background: #EEF0FF;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .idt-avatarImg { width: 100%; height: 100%; object-fit: cover; }
  .idt-avatarText {
    color: #0504AA;
    font-weight: 800;
    font-size: 18px;
  }
  .idt-storeMeta { flex: 1; min-width: 0; }
  .idt-storeName {
    font-size: 14.5px;
    font-weight: 700;
    color: #0B0B1A;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .idt-storeRating {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    font-size: 12.5px;
    color: #475569;
    font-weight: 700;
  }
  .idt-storeReviews { color: #94A3B8; font-weight: 500; }

  /* Address */
  .idt-addressRow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 14px;
    margin-bottom: 18px;
  }
  .idt-addressText {
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
    color: #475569;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .idt-mapLink {
    background: none;
    border: none;
    color: #0504AA;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-family: inherit;
  }

  /* Section */
  .idt-section { margin-bottom: 20px; }
  .idt-qtySection {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 14px;
    margin-bottom: 20px;
  }
  .idt-sectionLabel {
    display: block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #94A3B8;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .idt-qtySection .idt-sectionLabel { margin-bottom: 0; }

  /* Qty control */
  .idt-qtyControl {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    background: #F8FAFC;
  }
  .idt-qtyBtn {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    border: none;
    background: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .idt-qtyBtn:hover:not(:disabled) { background: #EEF0FF; }
  .idt-qtyBtn:disabled { cursor: not-allowed; }
  .idt-qtyValue {
    min-width: 36px;
    text-align: center;
    font-weight: 800;
    font-size: 15px;
    color: #0B0B1A;
    font-variant-numeric: tabular-nums;
  }

  /* Segment */
  .idt-segment {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .idt-segBtn {
    flex: 1;
    padding: 12px 10px;
    border-radius: 12px;
    border: 1px solid #E2E8F0;
    background: #fff;
    color: #334155;
    font-weight: 700;
    font-size: 13.5px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .idt-segBtn:hover:not(:disabled) { border-color: #C9CBFF; }
  .idt-segBtn:disabled { opacity: 0.5; cursor: not-allowed; }
  .idt-segBtnActive {
    background: #EEF0FF;
    border-color: #0504AA;
    color: #0504AA;
  }

  /* Chips */
  .idt-chipRow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 6px;
  }
  .idt-chip {
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid #E2E8F0;
    background: #fff;
    color: #334155;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .idt-chip:hover { border-color: #C9CBFF; }
  .idt-chipActive {
    background: #0504AA;
    border-color: #0504AA;
    color: #fff;
  }

  /* Hint */
  .idt-hint {
    margin: 8px 0 0;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.5;
    color: #64748B;
  }
  .idt-hintWarn { color: #B45309; }

  /* Summary */
  .idt-summary {
    padding: 14px 16px;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 14px;
    margin-bottom: 20px;
  }
  .idt-summaryRow {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13.5px;
  }
  .idt-summaryLabel { color: #64748B; font-weight: 600; }
  .idt-summaryValue { color: #0B0B1A; font-weight: 700; }
  .idt-summaryTotal {
    padding-top: 12px;
    margin-top: 8px;
    border-top: 1px solid #F1F5F9;
  }
  .idt-summaryGrand {
    color: #0504AA;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  /* Description */
  .idt-description {
    font-size: 14px;
    color: #475569;
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  /* CTA */
  .idt-ctaWrap {
    position: sticky;
    bottom: 0;
    padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
    background: linear-gradient(to top, #F4F5FB 65%, transparent);
  }
  .idt-ctaBtn {
    width: 100%;
    padding: 16px;
    border-radius: 14px;
    border: none;
    background: #0504AA;
    color: #fff;
    font-size: 15.5px;
    font-weight: 800;
    letter-spacing: -0.01em;
    cursor: pointer;
    font-family: inherit;
    box-shadow: 0 10px 30px rgba(5, 4, 170, 0.25);
    transition: opacity 0.15s, transform 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 54px;
  }
  .idt-ctaBtn:hover:not(:disabled) { opacity: 0.94; }
  .idt-ctaBtn:disabled { cursor: not-allowed; opacity: 0.6; }
  .idt-ctaBtnDisabled {
    background: #cbd5e1;
    box-shadow: none;
  }
  .idt-ctaSpinner {
    width: 20px;
    height: 20px;
    border: 2.5px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: idSpin 0.7s linear infinite;
  }

  /* Modal */
  .idt-modalOverlay {
    position: fixed;
    inset: 0;
    background: rgba(11, 11, 26, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
    padding: 20px;
    animation: idToastIn 0.15s ease;
  }
  .idt-modal {
    background: #fff;
    border-radius: 20px;
    padding: 24px 22px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 24px 70px rgba(11, 11, 26, 0.35);
    text-align: center;
  }
  .idt-modalIcon {
    width: 60px;
    height: 60px;
    border-radius: 20px;
    background: #EEF0FF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }
  .idt-modalTitle {
    font-size: 19px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }
  .idt-modalBody {
    font-size: 14px;
    color: #475569;
    line-height: 1.55;
    margin: 0 0 22px;
  }
  .idt-modalActions {
    display: flex;
    gap: 10px;
  }
  .idt-modalCancel {
    flex: 1;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid #E2E8F0;
    background: #fff;
    color: #334155;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }
  .idt-modalCancel:hover:not(:disabled) { background: #F8FAFC; }
  .idt-modalConfirm {
    flex: 2;
    padding: 14px;
    border-radius: 12px;
    border: none;
    background: #0504AA;
    color: #fff;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .idt-modalConfirm:hover:not(:disabled) { opacity: 0.92; }
  .idt-modalConfirm:disabled, .idt-modalCancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Center states */
  .idt-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    text-align: center;
    gap: 8px;
  }
  .idt-stateIcon {
    width: 72px;
    height: 72px;
    border-radius: 24px;
    background: #FEF2F2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .idt-stateTitle {
    font-size: 18px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .idt-stateBody {
    font-size: 13.5px;
    color: #64748B;
    margin: 4px 0 18px;
    max-width: 340px;
    line-height: 1.55;
  }
  .idt-primaryBtn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 22px;
    background: #0504AA;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .idt-primaryBtn:hover { opacity: 0.92; }
  .idt-ghostBtn {
    margin-top: 10px;
    padding: 10px 18px;
    background: transparent;
    border: none;
    color: #0504AA;
    font-weight: 700;
    font-size: 13.5px;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    font-family: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;