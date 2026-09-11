'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '../../../services/api';
import PickTimeBottomSheet from '../../../components/PickTimeBottomSheet';
import { getToken } from '../../../services/localStorage';   // ✅ added auth helper

// ---------- Types ----------
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

// ─── Image URL helper ─────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}

// Build a stable conversation URL segment for the (me, peer) pair.
// The chat page uses `otherUserId` to load messages, so this segment
// just needs to be deterministic and stable per pair.
function buildConversationId(myUserId: string, otherUserId: string): string {
  const pair = [myUserId || 'me', otherUserId].sort();
  return `${pair[0]}_${pair[1]}`;
}

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  // ── State ───────────────────────────────────
  const [listing, setListing] = useState<Listing | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
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

  // NEW: state for bottom sheet
  const [isPickTimeOpen, setIsPickTimeOpen] = useState(false);

  // ✅ Auth check helper – redirects to login if no token
  const requireAuth = () => {
    if (!getToken()) {
      router.push('/login');
      return false;
    }
    return true;
  };

  // ── Helper functions (must be defined before they are called) ──

  // ── Error helper ─────────────────────────
  const extractErrorMessage = (err: unknown) => {
    if (err && typeof err === 'object' && 'response' in err) {
      const e = err as { response?: { data?: unknown } };
      const data = e.response?.data;
      if (typeof data === 'object' && data !== null) {
        const detail = (data as Record<string, unknown>).detail as string | undefined;
        if (detail) {
          const lower = detail.toLowerCase();
          if (lower.includes('insufficient balance') || lower.includes('wallet'))
            return 'Your wallet balance is insufficient. Please top up.';
          if (lower.includes('courier') || lower.includes('no courier'))
            return 'No couriers available for delivery right now.';
          if (lower.includes('store') || lower.includes('not found'))
            return 'The store is currently unavailable.';
          return detail;
        }
      }
    }
    return 'Something went wrong. Please try again later.';
  };

  // ── Pickup flow ──────────────────────────
  const confirmInstantPickup = async () => {
    if (!listing || !store) return;
    try {
      await api.instantPickup(listing.listing_id, store.owner_id, listing.price);
      alert('Payment successful! Pick up your item.');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      alert(msg);
    }
  };

  const pickUpNow = () => {
    if (!listing) return;
    const confirmed = window.confirm(`Are you at the store?\nPay ₦${listing.price.toFixed(0)} directly?`);
    if (confirmed) confirmInstantPickup();
  };

  // ── Reserve flow (now accepts a pickup time) ─────────────────────────
  const reserveNow = async (pickupTime: string) => {
    if (!listing || !store) return;
    try {
      const orderId = 'ord_' + Date.now();
      const total = listing.price * quantity;

      const balance = await api.getWalletBalance() as { balance: number };
      if (balance.balance < total) {
        alert('Insufficient balance. Please top up your wallet.');
        return;
      }

      const response = await api.reserveItem(
        orderId,
        store.owner_id,
        total,
        listing.listing_id,
        undefined,
        0
      ) as { status?: string };

      if (response.status === 'locked') {
        const query = new URLSearchParams({
          store_lat: String(store.latitude),
          store_lng: String(store.longitude),
          store_name: store.name,
          order_id: orderId,
          total: String(total),
          pickup_time: pickupTime, // <-- include selected time
        });
        router.push(`/reservation-confirmed?${query.toString()}`);
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      alert(msg);
    }
  };

  // ── Basket flow ──────────────────────────
  const addToBasket = async () => {
    if (!listing) return;
    try {
      await api.addToBasket(listing.listing_id, listing.store_id, quantity);
      alert('Added to basket!');
    } catch (err: unknown) {
      alert('Failed to add: ' + (err instanceof Error ? err.message : ''));
    }
  };

  // ── Delivery flow ────────────────────────
  const proceedToDelivery = async () => {
    if (!listing || !store) return;
    setIsLoading(true);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;

      const orderId = 'ord_' + Date.now();

      // 1. Reserve item
      await api.reserveItem(
        orderId,
        store.owner_id,
        listing.price,
        listing.listing_id,
        undefined,
        0
      );

      // 2. Match courier
      const match = await api.matchCourier(
        orderId,
        store.owner_id,
        store.latitude,
        store.longitude,
        userLat,
        userLng
      ) as {
        delivery_fee?: number;
        courier_name?: string;
        estimated_package_time_min?: number;
      };

      setIsLoading(false);

      const deliveryFee = match.delivery_fee ?? 0;
      const courierName = match.courier_name ?? 'Courier';
      const estimatedTime = match.estimated_package_time_min ?? 0;

      alert(
        `Delivery confirmed!\n\nItem: ${listing.title}\nPrice: ₦${listing.price.toFixed(0)}\nDelivery fee: ₦${deliveryFee.toFixed(0)}\nCourier: ${courierName}\nEstimated: ${estimatedTime} min`
      );
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Chat with storekeeper ────────────────
  // Opens the chat screen with the seller's user ID and display info
  // carried through as query params, so the chat page can load messages
  // and render the header correctly.
  const openChatWithStore = async () => {
    if (!store) return;
    if (!requireAuth()) return;

    const otherUserId = store.owner_id;
    if (!otherUserId) {
      alert('Seller information is unavailable.');
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
      alert('Could not open chat. Please try again.');
    }
  };

  // ── CTA Label ─────────────────────────────
  const ctaLabel = () => {
    if (fulfillmentType === 'delivery') {
      return enableDelivery ? 'Deliver to Me' : '🚧 Coming Soon';
    }
    switch (pickupTiming) {
      case 'now': return 'Pick Up Now';
      case 'reserve': return 'Reserve & Pick Up';
      case 'basket': return 'Add to Basket';
    }
  };

  // ── Confirm action ────────────────────────
  const onConfirm = async () => {
    // ✅ Authentication gate: if no token, redirect to login
    if (!requireAuth()) return;

    if (!listing || !store) return;

    if (fulfillmentType === 'delivery') {
      if (!enableDelivery) {
        alert('🚧 Delivery is coming soon! Please choose "Pickup" for now.');
        return;
      }
      await proceedToDelivery();
      return;
    }

    switch (pickupTiming) {
      case 'now':
        pickUpNow();
        break;
      case 'reserve':
        // Open bottom sheet to pick time instead of directly reserving
        setIsPickTimeOpen(true);
        break;
      case 'basket':
        addToBasket();
        break;
    }
  };

  // ── Save / Unsave ─────────────────────────
  const toggleSave = async () => {
    if (!listing || isSaveLoading) return;
    setIsSaveLoading(true);
    try {
      if (isSaved) {
        await api.unsaveListing(listing.listing_id);
      } else {
        await api.saveListing(listing.listing_id);
      }
      setIsSaved(!isSaved);
      alert(isSaved ? 'Removed from saved' : 'Saved to your list');
    } catch (err) {
      alert('Failed to save: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsSaveLoading(false);
    }
  };

  // ── Load data functions ──────────────────
  const loadFeatureFlags = async () => {
    try {
      const flags = await api.getFeatureFlags();
      setEnableDelivery(flags.enable_delivery as boolean ?? true);
    } catch {
      setEnableDelivery(true);
    }
  };

  const loadListing = async () => {
    try {
      const listingData = await api.getListing(id) as unknown as Listing;
      if (!listingData || !listingData.store_id) {
        setLoading(false);
        return;
      }

      const storeId = listingData.store_id;
      const storeData = await api.getStoreById(storeId) as unknown as Store;

      setListing(listingData);
      setStore(storeData);
      setStockAvailable(listingData.quantity_available ?? 0);
      setRating(storeData?.rating ?? 0);
      setReviewCount(storeData?.reviews_count ?? 0);

      const saveStatus = await api.getSaveStatus(listingData.listing_id).catch(() => false);
      setIsSaved(saveStatus);

      setLoading(false);
    } catch (err) {
      console.error('Error loading listing:', err);
      setLoading(false);
    }
  };

  // ── useEffect (after all functions) ──────
  useEffect(() => {
    (async () => {
      await loadListing();
      await loadFeatureFlags();
    })();
  }, []);

  // ── Render ───────────────────────────────
  if (loading) {
    return (
      <main style={styles.loadingContainer}>
        <p>Loading item...</p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main style={styles.loadingContainer}>
        <p>Item not found.</p>
      </main>
    );
  }

  const imageUrl = resolveImageUrl(listing.image_url);
  const storeImage = store ? resolveImageUrl(store.store_image_url) : null;

  return (
    <main style={styles.container}>
      {/* App Bar */}
      <div style={styles.appBar}>
        <button onClick={() => router.back()} style={styles.backBtn}>←</button>
        <h1 style={styles.title}>Item Detail</h1>
        <div style={styles.actions}>
          <button onClick={() => alert('Share coming soon!')} style={styles.iconBtn} title="Share">📤</button>
          <button
            onClick={toggleSave}
            disabled={isSaveLoading}
            style={{ ...styles.iconBtn, color: isSaved ? '#0504AA' : '#666' }}
            title={isSaved ? 'Unsave' : 'Save'}
          >
            {isSaved ? '❤️' : '🤍'}
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div style={styles.overlay}>
          <div style={styles.spinner}>Processing...</div>
        </div>
      )}

      {/* Content */}
      <div style={styles.scrollArea}>
        {/* Image with Lens button */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{
            borderRadius: 20,
            overflow: 'hidden',
            height: 280,
            backgroundColor: '#eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {imageUrl ? (
              <img src={imageUrl} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 48, color: '#999' }}>📷</span>
            )}
          </div>
          <button
            style={styles.lensBtn}
            onClick={() => {
              if (imageUrl) {
                router.push(`/seai-lens?image=${encodeURIComponent(imageUrl)}`);
              } else {
                alert('No image available for visual search.');
              }
            }}
            title="Visual Search"
          >
            🔍
          </button>
        </div>

        {/* Title & Price */}
        <h2 style={styles.itemTitle}>{listing.title}</h2>
        <div style={styles.priceRow}>
          <span style={styles.price}>₦{listing.price.toFixed(0)}</span>
          <div style={styles.qtyControl}>
            <button onClick={() => quantity > 1 && setQuantity(q => q - 1)} disabled={quantity <= 1}>−</button>
            <span style={styles.qtyValue}>{quantity}</span>
            <button onClick={() => quantity < stockAvailable && setQuantity(q => q + 1)} disabled={quantity >= stockAvailable}>+</button>
          </div>
        </div>

        {/* Store info */}
        <div style={styles.storeRow}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
            backgroundColor: '#0504AA20', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 10,
          }}>
            {storeImage ? (
              <img src={storeImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#0504AA', fontWeight: 'bold' }}>{store?.name?.charAt(0) ?? '?'}</span>
            )}
          </div>
          <span style={{ color: '#666', flex: 1 }}>
            Sold by {store?.name ?? 'Unknown Store'}
          </span>
          <button
            onClick={openChatWithStore}
            style={styles.iconBtn}
            title="Message Storekeeper"
          >
            💬
          </button>
        </div>

        {/* Address + Map link */}
        {store?.address && (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
            <span style={{ marginRight: 4, color: '#888' }}>📍</span>
            <span style={{ fontSize: 14, color: '#888', flex: 1 }}>{store.address}</span>
            <button
              onClick={() => router.push(`/map?lat=${store.latitude}&lng=${store.longitude}&destination=${encodeURIComponent(store.name)}`)}
              style={{ color: '#0504AA', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              View on Map
            </button>
          </div>
        )}

        {/* Rating & stock */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
          {rating > 0 && (
            <>
              <span style={{ color: '#FFA000', marginRight: 4 }}>⭐</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{rating.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>({reviewCount} reviews)</span>
            </>
          )}
          <div style={{ flex: 1 }} />
          {stockAvailable > 0 && (
            <span style={{ backgroundColor: '#E8F5E9', color: '#2E7D32', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>
              {stockAvailable} in stock
            </span>
          )}
        </div>

        {/* Fulfillment section */}
        <div style={styles.fulfillmentSection}>
          <h3 style={{ marginBottom: 12 }}>How would you like this?</h3>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setFulfillmentType('pickup')}
              style={{
                ...styles.segmentBtn,
                backgroundColor: fulfillmentType === 'pickup' ? '#0504AA10' : 'transparent',
                borderColor: fulfillmentType === 'pickup' ? '#0504AA' : '#ccc',
                color: fulfillmentType === 'pickup' ? '#0504AA' : '#333',
              }}
            >
              🏪 Pickup
            </button>
            <button
              onClick={() => setFulfillmentType('delivery')}
              style={{
                ...styles.segmentBtn,
                backgroundColor: fulfillmentType === 'delivery' ? '#0504AA10' : 'transparent',
                borderColor: fulfillmentType === 'delivery' ? '#0504AA' : '#ccc',
                color: fulfillmentType === 'delivery' ? '#0504AA' : '#333',
              }}
              disabled={!enableDelivery}
            >
              🚚 Delivery
            </button>
          </div>

          {fulfillmentType === 'pickup' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {(['now', 'reserve', 'basket'] as PickupTiming[]).map((timing) => (
                <button
                  key={timing}
                  onClick={() => setPickupTiming(timing)}
                  style={{
                    ...styles.chip,
                    backgroundColor: pickupTiming === timing ? '#0504AA15' : 'transparent',
                    borderColor: pickupTiming === timing ? '#0504AA' : '#ccc',
                    color: pickupTiming === timing ? '#0504AA' : '#333',
                  }}
                >
                  {timing === 'now' ? 'Get it now' : timing === 'reserve' ? 'Reserve Now' : 'Add to Basket'}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={onConfirm}
            disabled={isLoading || (fulfillmentType === 'delivery' && !enableDelivery)}
            style={{
              ...styles.ctaBtn,
              backgroundColor: isLoading ? '#999' : (fulfillmentType === 'delivery' && !enableDelivery ? '#ccc' : '#0504AA'),
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Processing...' : ctaLabel()}
          </button>

          {fulfillmentType === 'delivery' && !enableDelivery && (
            <p style={{ color: '#E65100', fontSize: 12, marginTop: 8 }}>
              🚧 Delivery is temporarily unavailable. Please select &quot;Pickup&quot;.
            </p>
          )}
        </div>

        {/* Description */}
        {listing.description && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontWeight: 600 }}>Description</h3>
            <p style={{ color: '#555', lineHeight: 1.5 }}>{listing.description}</p>
          </div>
        )}
      </div>

      {/* Pick Time Bottom Sheet */}
      <PickTimeBottomSheet
        isOpen={isPickTimeOpen}
        onClose={() => setIsPickTimeOpen(false)}
        onSelect={(pickupTime) => {
          setIsPickTimeOpen(false);
          reserveNow(pickupTime);
        }}
      />
    </main>
  );
}

// ─── Styles (unchanged) ─────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#fff',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#fff',
  },
  appBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
    position: 'sticky',
    top: 0,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    marginRight: 12,
    color: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
    flex: 1,
  },
  actions: {
    display: 'flex',
    gap: 12,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    padding: 4,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  spinner: {
    backgroundColor: '#fff',
    padding: '20px 30px',
    borderRadius: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    paddingBottom: 32,
  },
  lensBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    border: 'none',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  itemTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
    lineHeight: 1.3,
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: 700,
    color: '#0504AA',
  },
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyValue: {
    width: 32,
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 16,
  },
  storeRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 8,
  },
  fulfillmentSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    border: '1px solid #eee',
  },
  segmentBtn: {
    flex: 1,
    padding: '12px 8px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chip: {
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid #ccc',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  ctaBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 14,
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    marginTop: 12,
  },
};