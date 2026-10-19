'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../../../services/api';
import {
  MdArrowBack,
  MdAddPhotoAlternate,
  MdStore,
  MdLocationOn,
  MdPhone,
  MdAccessTime,
  MdGpsFixed,
} from 'react-icons/md';
import {
  setOnboardingStatus,
  setActiveRole,
  setStoreId,
} from '../../../../services/localStorage';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { id: 'tech_electronics', label: '🔌 Tech & Electronics' },
  { id: 'food_beverage', label: '🍏 Food, Beverage & Consumables' },
  { id: 'health_beauty', label: '⚕️ Health, Wellness & Beauty' },
  { id: 'fashion', label: '👗 Fashion, Apparel & Goods' },
  { id: 'building_industrial', label: '🏗️ Building, Industrial & Hardware' },
  { id: 'home_garden', label: '🛋️ Home, Living & Garden' },
  { id: 'kids_toys', label: '🧸 Kids, Toys & Hobbies' },
  { id: 'sports_outdoors', label: '⚽ Sports, Outdoors & Travel' },
  { id: 'automotive', label: '🚗 Automotive & Industrial Vehicles' },
  { id: 'media_office', label: '📚 Media, Office & Education' },
];

function StoreDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [storeImageFile, setStoreImageFile] = useState<File | null>(null);
  const [storeImagePreview, setStoreImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const autoDetectLocation = useCallback(() => {
    if (isDetectingLocation) return;
    setIsDetectingLocation(true);

    if (!navigator.geolocation) {
      setAddress('GPS not supported by this browser');
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const currentLat = pos.coords.latitude;
        const currentLng = pos.coords.longitude;
        setLat(currentLat);
        setLng(currentLng);

        // Fetch exact address from OpenStreetMap (Free)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLat}&lon=${currentLng}&zoom=18&addressdetails=1`);
          const data = await res.json();
          
          if (data && data.address) {
            const addr = data.address;
            
            // Build a clean, short address: "House Number Street Name, Neighborhood"
            const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
            const area = addr.suburb || addr.neighbourhood || addr.city || 'Owerri';
            
            if (street) {
              setAddress(`${street}, ${area}`);
            } else if (addr.road) {
              setAddress(`${addr.road}, ${area}`);
            } else if (addr.suburb || addr.neighbourhood) {
              setAddress(`${area}, ${addr.state || 'Imo'}`);
            } else {
              setAddress(data.display_name || `Lat: ${currentLat.toFixed(4)}, Lng: ${currentLng.toFixed(4)}`);
            }
          } else {
            setAddress(`Lat: ${currentLat.toFixed(4)}, Lng: ${currentLng.toFixed(4)}`);
          }
        } catch {
          setAddress(`Lat: ${currentLat.toFixed(4)}, Lng: ${currentLng.toFixed(4)}`);
        } finally {
          setIsDetectingLocation(false);
        }
      },
      () => {
        setAddress('Owerri, Imo (Please type exact address)');
        setLat(5.5103);
        setLng(7.0265);
        setIsDetectingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [isDetectingLocation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      autoDetectLocation();
    }, 0);
    return () => clearTimeout(timer);
  }, [autoDetectLocation]);

  const handleStoreImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoreImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setStoreImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    if (!storeName.trim() || storeName.trim().length < 3) {
      alert('Please enter your store name (at least 3 characters).');
      return false;
    }
    if (!selectedCategory) {
      alert('Please select a category for your store.');
      return false;
    }
    if (!address.trim()) {
      alert('Please enter your store address.');
      return false;
    }
    const digits = contactPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      alert('Please enter a valid contact phone number.');
      return false;
    }
    if (lat === null || lng === null) {
      alert('Please enable GPS or enter your location manually.');
      return false;
    }
    return true;
  };

  const submitStore = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      let storeImageUrl: string | null = null;
      if (storeImageFile) {
        setIsUploadingImage(true);
        try {
          const uploadResp = await api.uploadStoreImage(storeImageFile);
          if (uploadResp && typeof uploadResp === 'object' && 'image_url' in (uploadResp as Record<string, unknown>)) {
            storeImageUrl = (uploadResp as Record<string, unknown>).image_url as string | null | undefined || null;
          } else {
            storeImageUrl = null;
          }
        } catch (err) {
          alert('Store image upload failed: ' + (err instanceof Error ? err.message : ''));
        } finally {
          setIsUploadingImage(false);
        }
      }

      const category = selectedCategory ?? '';
      const safeLat = lat;
      const safeLng = lng;

      if (safeLat === null || safeLng === null) {
        throw new Error('Store location is missing. Please enable GPS or enter your location manually.');
      }

      const response = await api.createStore(
        storeName.trim(),
        '',
        [category],
        address.trim(),
        safeLat,
        safeLng,
        contactPhone.trim(),
        storeImageUrl || undefined,
        businessHours ? { hours: businessHours.trim() } : undefined,
        'in-app'
      );

      const storeId = (response as Record<string, unknown>).store_id as string | undefined;
      if (storeId) {
        setOnboardingStatus("I'm Selling", true);
        setActiveRole('storekeeper');
        setStoreId(storeId);
        router.replace('/storekeeper/home');
      } else {
        throw new Error('Store creation failed: No store ID returned');
      }
    } catch (err: unknown) {
      alert('Error opening store: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <MdArrowBack size={24} color="var(--text-primary)" />
        </button>
        <h1 style={styles.headerTitle}>Open Your Store</h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={styles.scrollArea}>
        <div style={styles.progressRow}>
          <span style={styles.stepText}>Step 2 of 2</span>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: '100%' }} />
          </div>
        </div>

        <h2 style={styles.heading}>Tell us about your store</h2>
        <p style={styles.subHeading}>
          Shoppers will see this information when they find your store.
        </p>

        <label style={styles.label}>Store Image</label>
        <div style={styles.imageUploadArea} onClick={() => imageInputRef.current?.click()}>
          {storeImagePreview ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img src={storeImagePreview} alt="Store" style={styles.imagePreview} />
              <span style={styles.changeBadge}>Change</span>
              {isUploadingImage && (
                <div style={styles.uploadingOverlay}>
                  <div style={styles.spinnerSmall} />
                </div>
              )}
            </div>
          ) : (
            <div style={styles.imagePlaceholder}>
              <MdAddPhotoAlternate size={40} color="var(--text-muted)" />
              <p>Tap to add store photo</p>
            </div>
          )}
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleStoreImageChange}
        />

        <div style={styles.inputWrapper}>
          <MdStore size={20} color="var(--text-muted)" style={styles.inputIcon} />
          <input
            type="text"
            placeholder="Store Name"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            style={styles.input}
          />
        </div>

        <label style={styles.label}>Category</label>
        <div style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                ...styles.categoryButton,
                backgroundColor: selectedCategory === cat.id ? 'var(--brand-primary)' : 'var(--bg-secondary)',
                color: selectedCategory === cat.id ? 'var(--brand-on-gradient)' : 'var(--text-primary)',
                borderColor: selectedCategory === cat.id ? 'var(--brand-primary)' : 'var(--border-default)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={styles.cityRow}>
          <div style={styles.inputWrapper}>
            <MdLocationOn size={20} color="var(--text-muted)" style={styles.inputIcon} />
            <input
              type="text"
              placeholder="Exact Store Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={styles.input}
            />
          </div>
          <button
            onClick={autoDetectLocation}
            disabled={isDetectingLocation}
            style={styles.gpsBtn}
            title="Detect current location"
          >
            {isDetectingLocation ? (
              <div style={styles.spinnerSmall} />
            ) : (
              <MdGpsFixed size={24} color="var(--brand-primary)" />
            )}
          </button>
        </div>

        <div style={styles.inputWrapper}>
          <MdPhone size={20} color="var(--text-muted)" style={styles.inputIcon} />
          <input
            type="tel"
            placeholder="Contact Phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.inputWrapper}>
          <MdAccessTime size={20} color="var(--text-muted)" style={styles.inputIcon} />
          <input
            type="text"
            placeholder="Business Hours (Optional)"
            value={businessHours}
            onChange={(e) => setBusinessHours(e.target.value)}
            style={styles.input}
          />
        </div>

        <button
          onClick={submitStore}
          disabled={isLoading || isUploadingImage}
          style={{
            ...styles.submitBtn,
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Opening...' : 'Open My Store'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

export default function StorekeeperOnboardingStoreDetailsPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-primary)' }}>Loading store details…</div>}>
      <StoreDetailsContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-default)',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  stepText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  progressBar: {
    width: 100,
    height: 4,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--brand-primary)',
    borderRadius: 2,
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  subHeading: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: 6,
    display: 'block',
  },
  imageUploadArea: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    cursor: 'pointer',
    overflow: 'hidden',
    marginBottom: 20,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  changeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
  },
  uploadingOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerSmall: {
    width: 20,
    height: 20,
    border: '2px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  imagePlaceholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 36px',
    borderRadius: 12,
    border: '1px solid var(--border-default)',
    fontSize: 14,
    outline: 'none',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  cityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  gpsBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
    marginBottom: 20,
  },
  categoryButton: {
    padding: '10px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};