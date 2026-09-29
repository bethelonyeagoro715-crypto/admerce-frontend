'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { alertDialog } from '../../../components/ui/dialogs';
import {
  MdAddPhotoAlternate,
  MdAutoAwesome,
  MdClose,
  MdPreview,
  MdWbSunny,
  MdPhotoCamera,
  MdInsertDriveFile,
  MdArrowBack,
  MdCheck,
  MdErrorOutline,
  MdStorefront,
} from 'react-icons/md';

// ─── Constants ──────────────────────────────────────────────────────
interface Category {
  id: string;
  label: string;
  emoji: string;
}

const CATEGORIES: Category[] = [
  { id: 'tech_electronics', label: 'Tech & Electronics', emoji: '🔌' },
  { id: 'food_beverage', label: 'Food & Beverage', emoji: '🍏' },
  { id: 'health_wellness', label: 'Health & Beauty', emoji: '⚕️' },
  { id: 'fashion_apparel', label: 'Fashion & Apparel', emoji: '👗' },
  { id: 'building_industrial', label: 'Building & Hardware', emoji: '🏗️' },
  { id: 'home_garden', label: 'Home & Garden', emoji: '🛋️' },
  { id: 'kids_toys', label: 'Kids & Toys', emoji: '🧸' },
  { id: 'sports_outdoors', label: 'Sports & Outdoors', emoji: '⚽' },
  { id: 'automotive', label: 'Automotive', emoji: '🚗' },
  { id: 'media_office', label: 'Media & Office', emoji: '📚' },
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Used', 'Refurbished'];

const STYLES: { label: string; value: string; icon: React.ReactNode }[] = [
  { label: 'Warm', value: 'warm', icon: <MdWbSunny size={16} /> },
  { label: 'Clean', value: 'clean', icon: <MdAutoAwesome size={16} /> },
  { label: 'Studio', value: 'studio', icon: <MdPhotoCamera size={16} /> },
];

// ─── Component ──────────────────────────────────────────────────────
export default function AddItemPage() {
  useAuthGuard();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedCondition, setSelectedCondition] = useState('New');
  const [selectedStyle, setSelectedStyle] = useState('warm');

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRewritingTitle, setIsRewritingTitle] = useState(false);
  const [isRewritingDescription, setIsRewritingDescription] = useState(false);
  const [loadingStore, setLoadingStore] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [lat, setLat] = useState(5.5103);
  const [lng, setLng] = useState(7.0265);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  // ── Bootstrap ──────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const seq = ++reqSeq.current;
    const run = async () => {
      try {
        const store = (await api.getMyStore()) as {
          store_id?: string;
        } | null;
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        if (store?.store_id) setStoreId(store.store_id);
      } catch {
        // ignore
      } finally {
        if (seq === reqSeq.current && isMountedRef.current) {
          setLoadingStore(false);
        }
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => {
        // keep defaults
      },
      { timeout: 10000 },
    );
  }, []);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // ── Image handling ─────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImageFileName(file.name);
    setProcessedImageUrl(null);
    setPreviewError(false);

    try {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } catch (err) {
      console.warn('createObjectURL failed:', err);
      setPreviewError(true);
    }
  };

  const removeImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setImageFileName('');
    setProcessedImageUrl(null);
    setPreviewError(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── AI actions ─────────────────────────────────────────────────
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
      const note =
        confidence === 'low'
          ? 'Confidence is low — please review carefully.'
          : confidence === 'high'
            ? 'Looks confident about this one.'
            : 'Give the suggestions a quick look before publishing.';

      await alertDialog({
        title: `Detected: ${identified}`,
        body: `AI filled in the title, description, category, and condition. ${note}`,
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
      if (isMountedRef.current) setIsAnalyzing(false);
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
      }
    } catch (err) {
      await alertDialog({
        title: 'Rewrite failed',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setIsRewritingTitle(false);
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
      }
    } catch (err) {
      await alertDialog({
        title: 'Rewrite failed',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setIsRewritingDescription(false);
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
        if (imagePreview && imagePreview.startsWith('blob:')) {
          URL.revokeObjectURL(imagePreview);
        }
        setProcessedImageUrl(response.image_url as string);
        setImagePreview(response.image_url as string);
        setPreviewError(false);
      }
    } catch (err) {
      await alertDialog({
        title: "Couldn't preview",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setIsAnalyzing(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!imageFile) return 'Every listing needs at least one photo.';
    if (!title.trim()) return 'Give your item a short, descriptive name.';
    if (!selectedCategory) return 'Pick the category that best fits this item.';
    if (!price.trim() || Number(price) <= 0)
      return 'Enter how much this item costs.';
    if (!quantity.trim() || Number(quantity) < 1)
      return 'How many of these do you have in stock?';
    if (!storeId) return 'Set up your store before adding items.';
    return null;
  };

  const submitListing = async () => {
    const err = validate();
    if (err) {
      await alertDialog({
        title: 'Check your details',
        body: err,
        kind: 'warning',
      });
      return;
    }
    if (!storeId || !imageFile || !selectedCategory) return;

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
        body: extractErrorDetail(
          err,
          'Please check your details and try again.',
        ),
        kind: 'danger',
      });
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/storekeeper/home');
    }
  };

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

  const hasPreviewImage = !!imagePreview && !previewError;
  const ready =
    !!imageFile &&
    !!title.trim() &&
    !!selectedCategory &&
    Number(price) > 0 &&
    Number(quantity) >= 1;

  // ── Loading store ──────────────────────────────────────────────
  if (loadingStore) {
    return (
      <main style={css.root} className="sk-add">
        <style>{CSS}</style>
        <div style={css.headerWrap}>
          <div style={css.headerInner}>
            <div style={css.headerSkel} />
          </div>
        </div>
        <div style={css.sheet}>
          <div style={css.heroSkel} />
          <div style={css.blockSkel} />
          <div style={css.blockSkel} />
        </div>
      </main>
    );
  }

  // ── No store ───────────────────────────────────────────────────
  if (!storeId) {
    return (
      <main style={css.centerRoot} className="sk-add">
        <style>{CSS}</style>
        <div style={css.setupHalo}>
          <MdStorefront size={40} color="#0504AA" />
        </div>
        <h2 style={css.centerTitle}>Set up your store first</h2>
        <p style={css.centerBody}>
          You need a store before you can list items. It takes about two
          minutes to set up.
        </p>
        <button
          onClick={() => router.push('/storekeeper/onboarding')}
          style={css.centerPrimary}
        >
          <span>Create my store</span>
        </button>
      </main>
    );
  }

  // ── Main ───────────────────────────────────────────────────────
  return (
    <main style={css.root} className="sk-add">
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <button
            type="button"
            onClick={goBack}
            style={css.backBtn}
            aria-label="Back"
          >
            <MdArrowBack size={20} color="#fff" />
          </button>
          <div style={css.headerText}>
            <h1 style={css.headerTitle}>Add item</h1>
            <div style={css.headerSub}>
              {ready ? 'Ready to publish' : 'Fill in the details below'}
            </div>
          </div>
          <div style={css.headerSpacer} />
        </div>
      </div>

      <div style={css.sheet}>
        {/* PHOTO */}
        <label
          htmlFor="add-item-image-input"
          style={css.photoCard}
          className="sk-photo-card"
        >
          <input
            id="add-item-image-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={visuallyHiddenInput}
            onChange={handleFileChange}
          />
          {hasPreviewImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Product"
                style={css.photoImg}
                onError={() => setPreviewError(true)}
              />

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scanImageWithAI();
                }}
                disabled={isAnalyzing}
                style={css.aiScanBtn}
                title="AI auto-fill"
              >
                {isAnalyzing ? (
                  <div style={css.spinnerWhite} />
                ) : (
                  <>
                    <MdAutoAwesome size={16} color="#fff" />
                    <span style={css.aiScanLabel}>AI</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeImage();
                }}
                style={css.removeBtn}
                title="Remove"
                aria-label="Remove photo"
              >
                <MdClose size={16} color="#fff" />
              </button>

              <div style={css.photoHint}>
                Tap to change photo
              </div>
            </>
          ) : (
            <div style={css.photoPlaceholder}>
              <div style={css.photoPlaceholderHalo}>
                <MdAddPhotoAlternate size={40} color="#0504AA" />
              </div>
              <div style={css.photoPlaceholderTitle}>
                {previewError
                  ? "This image can't be previewed"
                  : 'Add product photo'}
              </div>
              <div style={css.photoPlaceholderHint}>
                {previewError
                  ? 'Try a different photo — JPG or PNG work best'
                  : 'Then tap ✨ AI to auto-fill'}
              </div>
            </div>
          )}
        </label>

        {/* FILENAME CHIP */}
        {imageFileName && (
          <div style={css.fileChip}>
            <MdInsertDriveFile size={14} color="#0504AA" />
            <span style={css.fileChipText} title={imageFileName}>
              {imageFileName}
            </span>
            <button
              type="button"
              onClick={removeImage}
              style={css.fileChipRemove}
              aria-label="Remove file"
            >
              <MdClose size={14} color="#64748B" />
            </button>
          </div>
        )}

        {/* STYLE */}
        {hasPreviewImage && (
          <>
            <h3 style={css.sectionLabel}>Image style</h3>
            <div style={css.styleRow}>
              {STYLES.map((style) => {
                const active = selectedStyle === style.value;
                return (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => setSelectedStyle(style.value)}
                    style={{
                      ...css.stylePill,
                      borderColor: active ? '#0504AA' : '#E6E8F0',
                      backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                      color: active ? '#0504AA' : '#475569',
                    }}
                    className="sk-style-pill"
                  >
                    {style.icon}
                    <span>{style.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={previewImageStyle}
              disabled={!imageFile || isAnalyzing}
              style={{
                ...css.previewBtn,
                opacity: !imageFile || isAnalyzing ? 0.5 : 1,
                cursor:
                  !imageFile || isAnalyzing ? 'not-allowed' : 'pointer',
              }}
              className="sk-preview-btn"
            >
              <MdPreview size={18} color="#0504AA" />
              <span>Preview this style</span>
            </button>
          </>
        )}

        {/* THE BASICS */}
        <h3 style={css.sectionLabel}>The basics</h3>
        <div style={css.card}>
          <div style={css.fieldWrap}>
            <label style={css.fieldLabel}>Title</label>
            <div style={css.inputRow}>
              <input
                type="text"
                placeholder="e.g. Black Italian suit, size 42"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                style={css.input}
                className="sk-input"
              />
              <button
                type="button"
                onClick={rewriteTitle}
                disabled={isRewritingTitle}
                style={css.aiMiniBtn}
                title="AI rewrite title"
                aria-label="AI rewrite title"
              >
                {isRewritingTitle ? (
                  <div style={css.spinnerSmall} />
                ) : (
                  <MdAutoAwesome size={18} color="#0504AA" />
                )}
              </button>
            </div>
            <div style={css.fieldFooter}>
              <span style={css.fieldHint}>
                Short and clear — buyers skim titles
              </span>
              <span style={css.charCount}>{title.length}/120</span>
            </div>
          </div>

          <div style={css.fieldWrap}>
            <label style={css.fieldLabel}>Description</label>
            <div style={css.inputRow}>
              <textarea
                placeholder="Condition, features, size, colour, anything useful"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={4}
                style={css.textarea}
                className="sk-input"
              />
              <button
                type="button"
                onClick={rewriteDescription}
                disabled={isRewritingDescription}
                style={css.aiMiniBtn}
                title="AI rewrite description"
                aria-label="AI rewrite description"
              >
                {isRewritingDescription ? (
                  <div style={css.spinnerSmall} />
                ) : (
                  <MdAutoAwesome size={18} color="#0504AA" />
                )}
              </button>
            </div>
            <div style={css.fieldFooter}>
              <span style={css.fieldHint}>
                Optional — but listings with a description sell 3× faster
              </span>
              <span style={css.charCount}>{description.length}/500</span>
            </div>
          </div>
        </div>

        {/* PRICE & STOCK */}
        <h3 style={css.sectionLabel}>Price & stock</h3>
        <div style={css.card}>
          <div style={css.fieldWrap}>
            <label style={css.fieldLabel}>Price (₦)</label>
            <div style={css.currencyRow}>
              <span style={css.currencySymbol}>₦</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                style={{ ...css.input, paddingLeft: 34 }}
                className="sk-input"
              />
            </div>
            <span style={css.fieldHint}>
              {Number(price) > 0
                ? `₦${Number(price).toLocaleString('en-NG')}`
                : 'How much do you want to sell this for?'}
            </span>
          </div>

          <div style={css.fieldWrap}>
            <label style={css.fieldLabel}>Quantity in stock</label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={1}
              style={css.input}
              className="sk-input"
            />
            <span style={css.fieldHint}>
              Buyers see this count — update it when you restock
            </span>
          </div>
        </div>

        {/* CATEGORY */}
        <h3 style={css.sectionLabel}>Category</h3>
        <div style={css.chipsWrap}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  ...css.chip,
                  borderColor: active ? '#0504AA' : '#E6E8F0',
                  backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                  color: active ? '#0504AA' : '#475569',
                }}
                className="sk-chip"
              >
                <span style={css.chipEmoji} aria-hidden>
                  {cat.emoji}
                </span>
                <span
                  style={{
                    fontWeight: active ? 800 : 700,
                  }}
                >
                  {cat.label}
                </span>
                {active && <MdCheck size={14} color="#0504AA" />}
              </button>
            );
          })}
        </div>

        {/* CONDITION */}
        <h3 style={css.sectionLabel}>Condition</h3>
        <div style={css.chipsWrap}>
          {CONDITIONS.map((cond) => {
            const active = selectedCondition === cond;
            return (
              <button
                key={cond}
                type="button"
                onClick={() => setSelectedCondition(cond)}
                style={{
                  ...css.chip,
                  borderColor: active ? '#0504AA' : '#E6E8F0',
                  backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                  color: active ? '#0504AA' : '#475569',
                }}
                className="sk-chip"
              >
                <span
                  style={{
                    fontWeight: active ? 800 : 700,
                  }}
                >
                  {cond}
                </span>
                {active && <MdCheck size={14} color="#0504AA" />}
              </button>
            );
          })}
        </div>

        {/* MISSING FIELDS NUDGE */}
        {!ready && (
          <div style={css.missingNudge}>
            <MdErrorOutline size={16} color="#92400E" />
            <span>
              {!imageFile
                ? 'Add a photo to continue'
                : !title.trim()
                  ? 'Add a title to continue'
                  : !selectedCategory
                    ? 'Pick a category to continue'
                    : Number(price) <= 0
                      ? 'Enter a price to continue'
                      : 'Enter the quantity to continue'}
            </span>
          </div>
        )}

        {/* SUBMIT */}
        <button
          type="button"
          onClick={submitListing}
          disabled={isLoading}
          style={{
            ...css.submitBtn,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          className="sk-submit"
        >
          {isLoading ? (
            <>
              <div style={css.spinnerWhite} />
              <span>Publishing…</span>
            </>
          ) : (
            <span>{ready ? 'Publish item' : 'Continue'}</span>
          )}
        </button>

        <div style={{ height: 24 }} />
      </div>
    </main>
  );
}

// ─── Interaction CSS + desktop layout ───────────────────────────────
const CSS = `
  @keyframes skSpin { to { transform: rotate(360deg); } }
  @keyframes skShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  .sk-add,
  .sk-add *,
  .sk-add *::before,
  .sk-add *::after {
    box-sizing: border-box;
  }

  .sk-input:focus {
    border-color: #0504AA !important;
    box-shadow: 0 0 0 3px rgba(5,4,170,0.10);
  }

  .sk-style-pill {
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .sk-style-pill:active { transform: scale(0.97); }

  .sk-preview-btn {
    transition: background-color 0.15s;
  }
  .sk-preview-btn:hover:not(:disabled) {
    background-color: #E0E7FF !important;
  }

  .sk-chip {
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .sk-chip:active { transform: scale(0.97); }

  .sk-photo-card {
    transition: box-shadow 0.15s;
  }
  .sk-photo-card:hover {
    box-shadow: 0 12px 32px rgba(5,4,170,0.08);
  }

  .sk-submit {
    transition: transform 0.12s, box-shadow 0.15s;
  }
  .sk-submit:active:not(:disabled) {
    transform: scale(0.98);
  }

  /* Desktop: wider sheet, two-column basics, larger inputs */
  @media (min-width: 1024px) {
    .sk-add-sheet {
      max-width: 880px;
    }
  }
`;

// ─── Styles ─────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    overflowX: 'hidden',
  },

  // HEADER
  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    backgroundColor: '#0504AA',
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    padding: '12px 20px',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    maxWidth: 880,
    margin: '0 auto',
    width: '100%',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    color: '#fff',
    margin: 0,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: 600,
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 38, flexShrink: 0 },
  headerSkel: {
    width: 160,
    height: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // SHEET
  sheet: {
    flex: 1,
    padding: '20px 20px 40px',
    maxWidth: 880,
    margin: '0 auto',
    width: '100%',
  },

  // PHOTO
  photoCard: {
    position: 'relative',
    display: 'block',
    width: '100%',
    aspectRatio: '16 / 10',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    border: '1.5px dashed #C7D2FE',
    cursor: 'pointer',
    overflow: 'hidden',
    marginBottom: 12,
    boxShadow: '0 6px 18px rgba(5,4,170,0.05)',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  aiScanBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    minWidth: 44,
    height: 44,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 999,
    backgroundColor: '#0504AA',
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(5,4,170,0.42)',
    zIndex: 2,
  },
  aiScanLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.3,
  },
  removeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
    backdropFilter: 'blur(4px)',
  },
  photoHint: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
    fontWeight: 600,
    letterSpacing: 0.2,
    textShadow: '0 1px 4px rgba(0,0,0,0.55)',
    pointerEvents: 'none',
  },
  photoPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 20,
    gap: 6,
    backgroundColor: '#F8FAFF',
  },
  photoPlaceholderHalo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  photoPlaceholderTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.2,
  },
  photoPlaceholderHint: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: 500,
    lineHeight: 1.45,
    maxWidth: 260,
  },

  // FILE CHIP
  fileChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    marginBottom: 20,
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7CCFF',
    borderRadius: 10,
  },
  fileChipText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    fontWeight: 600,
    color: '#0504AA',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileChipRemove: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // SECTION LABELS
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '24px 0 10px 4px',
  },

  // STYLE PILLS
  styleRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  stylePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
    borderRadius: 12,
    border: '1.5px solid',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  previewBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '13px 16px',
    marginTop: 10,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
  },

  // CARD (form sections)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '16px',
    borderBottom: '1px solid #F1F5F9',
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#334155',
    letterSpacing: 0.1,
    marginBottom: 2,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  currencyRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  currencySymbol: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 15,
    fontWeight: 800,
    color: '#0504AA',
    pointerEvents: 'none',
  },
  input: {
    flex: 1,
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    fontSize: 14.5,
    fontWeight: 500,
    color: '#0B0B1A',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: '#FFFFFF',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  },
  textarea: {
    flex: 1,
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    fontSize: 14.5,
    fontWeight: 500,
    color: '#0B0B1A',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: '#FFFFFF',
    resize: 'vertical',
    lineHeight: 1.5,
    minHeight: 92,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  },
  aiMiniBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.15s',
  },
  fieldFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  fieldHint: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  charCount: {
    fontSize: 11,
    color: '#94A3B8',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
  },

  // CHIPS
  chipsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 14px',
    borderRadius: 999,
    border: '1.5px solid',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.05,
  },
  chipEmoji: {
    fontSize: 14,
    lineHeight: 1,
  },

  // MISSING NUDGE
  missingNudge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    padding: '12px 14px',
    backgroundColor: '#FEF3C7',
    border: '1px solid #FDE68A',
    borderRadius: 12,
    color: '#92400E',
    fontSize: 12.5,
    fontWeight: 600,
    lineHeight: 1.4,
  },

  // SUBMIT
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 20,
    padding: 17,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 16,
    fontSize: 15.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    boxShadow: '0 14px 28px rgba(5,4,170,0.28)',
  },

  // SPINNERS
  spinnerSmall: {
    width: 18,
    height: 18,
    border: '2px solid #E6E8F0',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'skSpin 0.8s linear infinite',
  },
  spinnerWhite: {
    width: 18,
    height: 18,
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'skSpin 0.8s linear infinite',
  },

  // CENTER SCREENS
  centerRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    padding: 24,
    textAlign: 'center',
  },
  setupHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7D2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  centerBody: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    maxWidth: 340,
    lineHeight: 1.55,
  },
  centerPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: '13px 24px',
    borderRadius: 14,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
  },

  // SKELETONS
  heroSkel: {
    height: 260,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  blockSkel: {
    height: 140,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 20,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
};