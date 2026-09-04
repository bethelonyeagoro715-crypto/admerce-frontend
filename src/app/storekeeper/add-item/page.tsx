'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdAddPhotoAlternate,
  MdAutoAwesome,
  MdClose,
  MdPreview,
  MdTextFields,
  MdDescription,
  MdAttachMoney,
  MdNumbers,
  MdInfoOutline,
  MdCameraAlt,
  MdPhotoLibrary,
  MdWbSunny,
  MdPhotoCamera,
  MdRefresh,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface Category {
  id: string;
  label: string;
}

const CATEGORIES: Category[] = [
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
        // keep default
      },
      { timeout: 10000 }
    );
  };

  // Load store ID and location on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      loadStoreId();
      getLocation();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const showAlert = (message: string, isError = false) => {
    alert(message);
  };

  const pickImage = () => {
    fileInputRef.current?.click();
  };

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

  const scanImageWithAI = async () => {
    if (!imageFile) {
      showAlert('Please select an image first.', true);
      return;
    }
    setIsAnalyzing(true);
    try {
      const data = await api.analyzeImage(imageFile);
      if (data.title) setTitle(data.title as string);
      if (data.category) {
        const cat = CATEGORIES.find((c) => c.label.includes(data.category as string));
        if (cat) setSelectedCategory(cat);
      }
      if (data.condition) setSelectedCondition(data.condition as string);
      if (data.description) setDescription(data.description as string);
      showAlert('AI filled in the details!');
    } catch (err) {
      showAlert('AI scan failed', true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const rewriteTitle = async () => {
    if (!title.trim()) {
      showAlert('Please enter a title first.', true);
      return;
    }
    setIsRewritingTitle(true);
    try {
      const response = await api.rewriteListing(title.trim(), selectedCategory?.id);
      if (response.rewritten_title) {
        setTitle(response.rewritten_title as string);
        showAlert('Title rewritten!');
      }
    } catch {
      showAlert('Rewrite failed', true);
    } finally {
      setIsRewritingTitle(false);
    }
  };

  const rewriteDescription = async () => {
    if (!description.trim()) {
      showAlert('Please enter a description first.', true);
      return;
    }
    setIsRewritingDescription(true);
    try {
      const response = await api.rewriteListing(description.trim(), selectedCategory?.id);
      if (response.rewritten_title) {
        setDescription(response.rewritten_title as string);
        showAlert('Description rewritten!');
      }
    } catch {
      showAlert('Rewrite failed', true);
    } finally {
      setIsRewritingDescription(false);
    }
  };

  const previewImageStyle = async () => {
    if (!imageFile) {
      showAlert('Please select an image first.', true);
      return;
    }
    setIsAnalyzing(true);
    try {
      const response = await api.previewImage(imageFile, selectedStyle);
      if (response.image_url) {
        setProcessedImageUrl(response.image_url as string);
        setImagePreview(response.image_url as string);
        showAlert('Preview ready!');
      }
    } catch {
      showAlert('Preview failed', true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitListing = async () => {
    if (!imageFile) return showAlert('Please add a product image.', true);
    if (!title.trim()) return showAlert('Please enter a title.', true);
    if (!selectedCategory) return showAlert('Please select a category.', true);
    if (!price.trim()) return showAlert('Please enter a price.', true);
    if (!quantity.trim()) return showAlert('Please enter quantity available.', true);
    if (!storeId) return showAlert('Please create a store first.', true);

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
        '',            // barcode
        selectedStyle,
        parseInt(quantity.trim(), 10)
      );
      showAlert('Item published successfully!');
      setTimeout(() => router.replace('/storekeeper/items'), 500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Publishing failed';
      showAlert(message, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Add New Item</h1>
        {isLoading && <div style={styles.spinnerSmall} />}
      </div>

      <div style={styles.scrollArea}>
        {/* Image Upload */}
        <div onClick={pickImage} style={styles.imageUpload}>
          {imagePreview ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img src={imagePreview} alt="Product" style={styles.imagePreview} />
              <button
                onClick={(e) => { e.stopPropagation(); scanImageWithAI(); }}
                disabled={isAnalyzing}
                style={styles.aiScanBtn}
                title="AI auto-fill"
              >
                {isAnalyzing ? <div style={styles.spinnerSmall} /> : <MdAutoAwesome size={18} color="#fff" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(); }}
                style={styles.removeBtn}
                title="Remove"
              >
                <MdClose size={18} color="#fff" />
              </button>
            </div>
          ) : (
            <div style={styles.imagePlaceholder}>
              <MdAddPhotoAlternate size={48} color="#888" />
              <p>Tap to add product photo</p>
              <p style={{ fontSize: 12 }}>Then tap ✨ AI to auto-fill</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Style Picker */}
        <h3 style={styles.sectionTitle}>Image Style</h3>
        <div style={styles.styleRow}>
          {STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => setSelectedStyle(style.value)}
              style={{
                ...styles.styleButton,
                backgroundColor: selectedStyle === style.value ? '#0504AA' : '#f0f0f0',
                color: selectedStyle === style.value ? '#fff' : '#0504AA',
                borderColor: selectedStyle === style.value ? '#0504AA' : '#ccc',
              }}
            >
              {style.icon}
              <span style={{ marginLeft: 8 }}>{style.label}</span>
            </button>
          ))}
        </div>

        {/* Preview Button */}
        <button
          onClick={previewImageStyle}
          disabled={!imageFile}
          style={styles.previewBtn}
        >
          <MdPreview size={18} color="#0504AA" />
          Preview Style
        </button>

        {/* Title */}
        <div style={styles.fieldRow}>
          <input
            type="text"
            placeholder="Item Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
          />
          <button onClick={rewriteTitle} disabled={isRewritingTitle} style={styles.aiBtn} title="AI Rewrite Title">
            {isRewritingTitle ? <div style={styles.spinnerSmall} /> : <MdAutoAwesome size={20} color="#0504AA" />}
          </button>
        </div>

        {/* Description */}
        <div style={styles.fieldRow}>
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
          />
          <button onClick={rewriteDescription} disabled={isRewritingDescription} style={styles.aiBtn} title="AI Rewrite Description">
            {isRewritingDescription ? <div style={styles.spinnerSmall} /> : <MdAutoAwesome size={20} color="#0504AA" />}
          </button>
        </div>

        {/* Price */}
        <input
          type="number"
          placeholder="Price (₦)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={styles.input}
        />

        {/* Quantity */}
        <input
          type="number"
          placeholder="Quantity Available"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={styles.input}
        />

        {/* Category Picker */}
        <h3 style={styles.sectionTitle}>Category</h3>
        <div style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...styles.categoryButton,
                backgroundColor: selectedCategory?.id === cat.id ? '#0504AA' : '#f0f0f0',
                color: selectedCategory?.id === cat.id ? '#fff' : '#333',
                borderColor: selectedCategory?.id === cat.id ? '#0504AA' : '#ccc',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Condition Dropdown */}
        <select
          value={selectedCondition}
          onChange={(e) => setSelectedCondition(e.target.value)}
          style={styles.select}
        >
          {CONDITIONS.map((cond) => (
            <option key={cond} value={cond}>{cond}</option>
          ))}
        </select>

        {/* Submit */}
        <button
          onClick={submitListing}
          disabled={isLoading}
          style={{
            ...styles.submitBtn,
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Publishing...' : 'Publish Item'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  spinnerSmall: {
    width: 20,
    height: 20,
    border: '2px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  imageUpload: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    cursor: 'pointer',
    overflow: 'hidden',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
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
  },
  imagePlaceholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 8,
    color: '#1A1A1A',
  },
  styleRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
  },
  styleButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 12,
    border: '2px solid',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
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
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 14,
    outline: 'none',
    marginBottom: 12,
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
  },
};