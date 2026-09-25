'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { alertDialog } from '../../../components/ui/dialogs';
import {
  MdAddPhotoAlternate,
  MdAutoAwesome,
  MdClose,
  MdPreview,
  MdWbSunny,
  MdPhotoCamera,
} from 'react-icons/md';

interface Category {
  id: string;
  label: string;
}

const CATEGORIES: Category[] = [
  { id: 'tech_electronics', label: '🔌 Tech & Electronics' },
  { id: 'food_beverage', label: '🍏 Food, Beverage & Consumables' },
  { id: 'health_wellness', label: '⚕️ Health, Wellness & Beauty' },
  { id: 'fashion_apparel', label: '👗 Fashion, Apparel & Goods' },
  { id: 'building_industrial', label: '🏗️ Building, Industrial & Hardware' },
  { id: 'home_garden', label: '🛋️ Home, Living & Garden' },
  { id: 'kids_toys', label: '🧸 Kids, Toys & Hobbies' },
  { id: 'sports_outdoors', label: '⚽ Sports, Outdoors & Travel' },
  { id: 'automotive', label: '🚗 Automotive & Industrial Vehicles' },
  { id: 'media_office', label: '📚 Media, Office & Education' },
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Used', 'Refurbished'];
const STYLES = [
  { label: 'Warm', value: 'warm', icon: <MdWbSunny size={20} /> },
  { label: 'Clean', value: 'clean', icon: <MdAutoAwesome size={20} /> },
  { label: 'Studio', value: 'studio', icon: <MdPhotoCamera size={20} /> },
];

export default function AddItemPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedCondition, setSelectedCondition] = useState('New');
  const [selectedStyle, setSelectedStyle] = useState('warm');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRewritingTitle, setIsRewritingTitle] = useState(false);
  const [isRewritingDescription, setIsRewritingDescription] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [lat, setLat] = useState(5.5103);
  const [lng, setLng] = useState(7.0265);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStoreId = async () => {
    try {
      const store = (await api.getMyStore()) as { store_id?: string } | null;
      if (store?.store_id) setStoreId(store.store_id);
    } catch {
      // ignore
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => {
        // keep defaults
      },
      { timeout: 10000 },
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStoreId();
      getLocation();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setProcessedImageUrl(null);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setProcessedImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── AI scan — looks at the photo, fills title + description + category ──
  const scanImageWithAI = async () => {
    if (!imageFile) {
      await alertDialog({
        title: 'Add a photo first',
        body: 'AI scan needs a product photo to analyse.',
        kind: 'info',
      });
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = (await api.rewriteListingVision(
        imageFile,
        title,
        description,
        selectedCategory?.id || '',
      )) as {
        item_identified?: string;
        title?: string;
        description?: string;
        category_hint?: string;
        condition_hint?: string;
        confidence?: string;
      };

      if (res.title) setTitle(res.title);
      if (res.description) setDescription(res.description);
      if (res.condition_hint && CONDITIONS.includes(res.condition_hint)) {
        setSelectedCondition(res.condition_hint);
      }
      if (res.category_hint) {
        const matched = CATEGORIES.find((c) => c.id === res.category_hint);
        if (matched) setSelectedCategory(matched);
      }

      const identified = res.item_identified || 'your item';
      const confidence = (res.confidence || 'medium').toLowerCase();
      const confidenceNote =
        confidence === 'low'
          ? 'Confidence is low — please review the suggestions carefully.'
          : confidence === 'high'
            ? 'Looks confident about this one.'
            : 'Give the suggestions a quick look before publishing.';

      await alertDialog({
        title: `Detected: ${identified}`,
        body: `AI filled in the title, description, category, and condition. ${confidenceNote}`,
        kind: 'success',
        confirmLabel: 'Review',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't scan the photo",
        body: extractErrorDetail(err, 'Please fill in the details manually.'),
        kind: 'danger',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const rewriteTitle = async () => {
    if (!title.trim()) {
      await alertDialog({
        title: 'Enter a title first',
        body: 'AI rewrite needs a starting title to work from.',
        kind: 'info',
      });
      return;
    }
    setIsRewritingTitle(true);
    try {
      const response = await api.rewriteListing(
        title.trim(),
        selectedCategory?.id,
        'title',
      );
      if (response.rewritten_title) {
        setTitle(response.rewritten_title as string);
        await alertDialog({
          title: 'Title rewritten',
          body: 'The AI version is now in the field. Edit it if you want.',
          kind: 'success',
        });
      }
    } catch (err) {
      await alertDialog({
        title: 'Rewrite failed',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      setIsRewritingTitle(false);
    }
  };

  const rewriteDescription = async () => {
    if (!description.trim()) {
      await alertDialog({
        title: 'Enter a description first',
        body: 'AI rewrite needs a starting description to work from.',
        kind: 'info',
      });
      return;
    }
    setIsRewritingDescription(true);
    try {
      const response = await api.rewriteListing(
        description.trim(),
        selectedCategory?.id,
        'description',
      );
      if (response.rewritten_title) {
        setDescription(response.rewritten_title as string);
        await alertDialog({
          title: 'Description rewritten',
          body: 'The AI version is now in the field. Edit it if you want.',
          kind: 'success',
        });
      }
    } catch (err) {
      await alertDialog({
        title: 'Rewrite failed',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      setIsRewritingDescription(false);
    }
  };

  const previewImageStyle = async () => {
    if (!imageFile) {
      await alertDialog({
        title: 'Add a photo first',
        body: 'Style preview needs a product photo to work with.',
        kind: 'info',
      });
      return;
    }
    setIsAnalyzing(true);
    try {
      const response = await api.previewImage(imageFile, selectedStyle);
      if (response.image_url) {
        setProcessedImageUrl(response.image_url as string);
        setImagePreview(response.image_url as string);
        await alertDialog({
          title: 'Preview ready',
          body: 'This is how your item will look to shoppers.',
          kind: 'success',
        });
      }
    } catch (err) {
      await alertDialog({
        title: "Couldn't preview",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitListing = async () => {
    if (!imageFile) {
      await alertDialog({
        title: 'Product photo required',
        body: 'Every listing needs at least one photo.',
        kind: 'warning',
      });
      return;
    }
    if (!title.trim()) {
      await alertDialog({
        title: 'Title required',
        body: 'Give your item a short, descriptive name.',
        kind: 'warning',
      });
      return;
    }
    if (!selectedCategory) {
      await alertDialog({
        title: 'Category required',
        body: 'Pick the category that best fits this item.',
        kind: 'warning',
      });
      return;
    }
    if (!price.trim()) {
      await alertDialog({
        title: 'Price required',
        body: 'Enter how much this item costs.',
        kind: 'warning',
      });
      return;
    }
    if (!quantity.trim()) {
      await alertDialog({
        title: 'Quantity required',
        body: 'How many of these do you have in stock?',
        kind: 'warning',
      });
      return;
    }
    if (!storeId) {
      await alertDialog({
        title: 'Create a store first',
        body: 'Set up your store before adding items to it.',
        kind: 'warning',
      });
      return;
    }

    setIsLoading(true);
    try {
      await api.createListing(
        storeId,
        title.trim(),
        parseFloat(price.trim()),
        lat,
        lng,
        selectedCategory.id,
        imageFile,
        '',
        selectedStyle,
        parseInt(quantity.trim(), 10),
      );

      await alertDialog({
        title: 'Item published',
        body: `"${title.trim()}" is now live on your store.`,
        kind: 'success',
        confirmLabel: 'View items',
      });
      router.replace('/storekeeper/items');
    } catch (err) {
      await alertDialog({
        title: "Couldn't publish",
        body: extractErrorDetail(err, 'Please check your details and try again.'),
        kind: 'danger',
      });
      setIsLoading(false);
    }
  };

  // Visually-hidden input style — keeps the input in the layout (so
  // `label` clicks trigger it reliably across browsers) while making
  // it invisible to the eye.
  const visuallyHiddenInput: React.CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  };

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Add New Item</h1>
        {isLoading && <div style={styles.spinnerSmall} />}
      </div>

      <div style={styles.scrollArea}>
        {/* Upload area — wrapped in <label> so clicking it opens the
            file picker natively. No JS needed. */}
        <label htmlFor="add-item-image-input" style={styles.imageUpload}>
          <input
            id="add-item-image-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={visuallyHiddenInput}
            onChange={handleFileChange}
          />
          {imagePreview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Product" style={styles.imagePreview} />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scanImageWithAI();
                }}
                disabled={isAnalyzing}
                style={styles.aiScanBtn}
                title="AI auto-fill"
              >
                {isAnalyzing ? (
                  <div style={styles.spinnerSmallWhite} />
                ) : (
                  <MdAutoAwesome size={18} color="#fff" />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeImage();
                }}
                style={styles.removeBtn}
                title="Remove"
              >
                <MdClose size={18} color="#fff" />
              </button>
            </>
          ) : (
            <div style={styles.imagePlaceholder}>
              <MdAddPhotoAlternate size={48} color="#888" />
              <p style={{ fontWeight: 600, marginBottom: 2 }}>
                Tap to add product photo
              </p>
              <p style={{ fontSize: 12, margin: 0, color: '#9A9DA6' }}>
                Then tap ✨ AI to auto-fill
              </p>
            </div>
          )}
        </label>

        <h3 style={styles.sectionTitle}>Image Style</h3>
        <div style={styles.styleRow}>
          {STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => setSelectedStyle(style.value)}
              style={{
                ...styles.styleButton,
                backgroundColor:
                  selectedStyle === style.value ? '#0504AA' : '#f0f0f0',
                color: selectedStyle === style.value ? '#fff' : '#0504AA',
                borderColor: selectedStyle === style.value ? '#0504AA' : '#ccc',
              }}
            >
              {style.icon}
              <span style={{ marginLeft: 8 }}>{style.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={previewImageStyle}
          disabled={!imageFile || isAnalyzing}
          style={{
            ...styles.previewBtn,
            opacity: !imageFile || isAnalyzing ? 0.5 : 1,
            cursor: !imageFile || isAnalyzing ? 'not-allowed' : 'pointer',
          }}
        >
          <MdPreview size={18} color="#0504AA" />
          Preview Style
        </button>

        <div style={styles.fieldRow}>
          <input
            type="text"
            placeholder="Item Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
          />
          <button
            type="button"
            onClick={rewriteTitle}
            disabled={isRewritingTitle}
            style={styles.aiBtn}
            title="AI Rewrite Title"
          >
            {isRewritingTitle ? (
              <div style={styles.spinnerSmall} />
            ) : (
              <MdAutoAwesome size={20} color="#0504AA" />
            )}
          </button>
        </div>

        <div style={styles.fieldRow}>
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
          />
          <button
            type="button"
            onClick={rewriteDescription}
            disabled={isRewritingDescription}
            style={styles.aiBtn}
            title="AI Rewrite Description"
          >
            {isRewritingDescription ? (
              <div style={styles.spinnerSmall} />
            ) : (
              <MdAutoAwesome size={20} color="#0504AA" />
            )}
          </button>
        </div>

        <input
          type="number"
          placeholder="Price (₦)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={styles.input}
        />

        <input
          type="number"
          placeholder="Quantity Available"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={styles.input}
        />

        <h3 style={styles.sectionTitle}>Category</h3>
        <div style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...styles.categoryButton,
                backgroundColor:
                  selectedCategory?.id === cat.id ? '#0504AA' : '#f0f0f0',
                color: selectedCategory?.id === cat.id ? '#fff' : '#333',
                borderColor:
                  selectedCategory?.id === cat.id ? '#0504AA' : '#ccc',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <select
          value={selectedCondition}
          onChange={(e) => setSelectedCondition(e.target.value)}
          style={styles.select}
        >
          {CONDITIONS.map((cond) => (
            <option key={cond} value={cond}>
              {cond}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={submitListing}
          disabled={isLoading}
          style={{
            ...styles.submitBtn,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Publishing…' : 'Publish Item'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#fff' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  headerTitle: { fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 },
  spinnerSmall: {
    width: 20,
    height: 20,
    border: '2px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  spinnerSmallWhite: {
    width: 18,
    height: 18,
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '16px' },
  imageUpload: {
    // `position: relative` so the AI/remove buttons can be absolutely
    // positioned inside. `display: block` so the label fills width.
    position: 'relative',
    display: 'block',
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    cursor: 'pointer',
    overflow: 'hidden',
    marginBottom: 16,
  },
  imagePreview: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  aiScanBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#0504AA',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(5,4,170,0.35)',
    zIndex: 2,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
  },
  imagePlaceholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
    padding: 16,
    textAlign: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#1A1A1A' },
  styleRow: { display: 'flex', gap: 8, marginBottom: 8 },
  styleButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 12,
    border: '2px solid',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  previewBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '10px',
    backgroundColor: '#f0f0f0',
    color: '#0504AA',
    border: '1px solid #ccc',
    borderRadius: 12,
    marginBottom: 16,
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  fieldRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 14,
    outline: 'none',
    marginBottom: 12,
    fontFamily: 'inherit',
  },
  aiBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    padding: '10px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 14,
    outline: 'none',
    marginBottom: 20,
    backgroundColor: '#fff',
    fontFamily: 'inherit',
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};