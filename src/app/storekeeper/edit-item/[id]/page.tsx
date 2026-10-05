'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../components/ui/dialogs';
import {
  MdArrowBack,
  MdImage,
  MdErrorOutline,
  MdPhotoLibrary,
  MdClose,
} from 'react-icons/md';

interface Listing {
  listing_id: string;
  title?: string;
  description?: string;
  image_url?: string;
  quantity_total?: number | null;
  quantity_available?: number | null;
  is_available?: boolean;
  price?: number | string;
  category?: string | null;
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
    return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function formatPrice(raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return '₦0';
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

export default function EditItemPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams();
  const listingId = typeof params?.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isAvailable, setIsAvailable] = useState(true);

  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [price, setPrice] = useState<string>('₦0');
  const [soldCount, setSoldCount] = useState(0);

  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // ── Fetch the listing to edit
  useEffect(() => {
    if (!listingId) return;

    (async () => {
      try {
        const data = (await api.getStorekeeperListing(listingId)) as Listing;
        if (!isMountedRef.current) return;
        setTitle(data.title || '');
        setDescription(data.description || '');
        const total = Number(data.quantity_total ?? 1);
        const avail = Number(data.quantity_available ?? total);
        setQuantity(total);
        setSoldCount(Math.max(0, total - avail));
        setIsAvailable(
          data.is_available === undefined ? true : Boolean(data.is_available),
        );
        setExistingImage(data.image_url || null);
        setPrice(formatPrice(data.price));
        setLoading(false);
      } catch {
        if (isMountedRef.current) {
          setLoading(false);
          setErrored(true);
        }
      }
    })();
  }, [listingId]);

  const handlePickImage = () => fileInputRef.current?.click();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const url = URL.createObjectURL(f);
    objectUrlRef.current = url;
    setNewImage(f);
    setNewImagePreview(url);
  };

  const handleClearImage = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setNewImage(null);
    setNewImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      await alertDialog({
        title: 'Title required',
        body: 'Give the item a name so shoppers can find it.',
        kind: 'danger',
      });
      return;
    }
    if (quantity < 1) {
      await alertDialog({
        title: 'Quantity must be at least 1',
        body: 'Set quantity to at least 1, or set availability to off.',
        kind: 'danger',
      });
      return;
    }
    if (quantity < soldCount) {
      await alertDialog({
        title: 'Quantity too low',
        body: `${soldCount} units have already been ordered. Total can't go below ${soldCount}.`,
        kind: 'danger',
      });
      return;
    }

    const fd = new FormData();
    fd.append('title', trimmedTitle);
    fd.append('description', description);
    fd.append('quantity_total', String(quantity));
    fd.append('is_available', isAvailable ? 'true' : 'false');
    if (newImage) fd.append('image', newImage);

    setSaving(true);
    try {
      await api.updateStorekeeperListing(listingId, fd);
      if (isMountedRef.current) router.back();
    } catch (err) {
      await alertDialog({
        title: 'Could not save',
        body: extractErrorDetail(
          err,
          'Something went wrong. Please try again.',
        ),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  if (loading) {
    return (
      <main style={css.root}>
        <style>{CSS}</style>
        <div style={css.headerWrap}>
          <div style={css.headerInner}>
            <div style={css.skelLine} />
          </div>
        </div>
        <div style={css.sheet}>
          <div style={css.skelBlock} />
          <div style={css.skelBlock} />
          <div style={css.skelBlock} />
        </div>
      </main>
    );
  }

  if (errored) {
    return (
      <main style={css.centerRoot}>
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="var(--danger-fg)" />
        </div>
        <h2 style={css.centerTitle}>Couldn&apos;t load this item</h2>
        <p style={css.centerBody}>
          It may have been deleted, or you may not have permission to edit
          it.
        </p>
        <button onClick={() => router.back()} style={css.retryBtn}>
          <MdArrowBack size={18} color="var(--brand-on-gradient)" />
          <span>Go back</span>
        </button>
      </main>
    );
  }

  return (
    <main style={css.root} className="sk-edit">
      <style>{CSS}</style>

      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <button
            type="button"
            onClick={() => router.back()}
            style={css.backBtn}
            aria-label="Back"
          >
            <MdArrowBack size={20} color="var(--brand-on-gradient)" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={css.title}>Edit item</h1>
            <div style={css.subtitle}>
              Price locked at {price} · sold {soldCount}
            </div>
          </div>
        </div>
      </div>

      <div style={css.sheet}>
        {/* Image */}
        <section style={css.section}>
          <label style={css.label}>Photo</label>
          <div style={css.imageRow}>
            <div style={css.imageThumb}>
              {newImagePreview || existingImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    newImagePreview ||
                    resolveImageUrl(existingImage) ||
                    ''
                  }
                  alt=""
                  style={css.imageThumbImg}
                />
              ) : (
                <div style={css.imageThumbPlaceholder}>
                  <MdImage size={26} color="var(--text-muted)" />
                </div>
              )}
            </div>
            <div style={css.imageActions}>
              <button
                type="button"
                onClick={handlePickImage}
                style={css.imagePickBtn}
              >
                <MdPhotoLibrary size={16} color="var(--brand-primary)" />
                <span>{newImage ? 'Change' : 'Replace'}</span>
              </button>
              {newImage && (
                <button
                  type="button"
                  onClick={handleClearImage}
                  style={css.imageClearBtn}
                  aria-label="Remove new image"
                >
                  <MdClose size={14} color="var(--text-tertiary)" />
                  <span>Undo</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          {newImage && (
            <div style={css.imageHint}>
              A new photo will replace the old one once you save.
            </div>
          )}
        </section>

        {/* Title */}
        <section style={css.section}>
          <label style={css.label} htmlFor="edit-title">
            Title
          </label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Wireless earbuds, black"
            maxLength={200}
            style={css.input}
          />
          <div style={css.fieldHint}>
            {title.length}/200 · shoppers search on this
          </div>
        </section>

        {/* Description */}
        <section style={css.section}>
          <label style={css.label} htmlFor="edit-desc">
            Description
          </label>
          <textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Condition, size, colour, anything a buyer should know"
            maxLength={2000}
            rows={5}
            style={{ ...css.input, resize: 'vertical', minHeight: 110 }}
          />
          <div style={css.fieldHint}>{description.length}/2000</div>
        </section>

        {/* Quantity */}
        <section style={css.section}>
          <label style={css.label} htmlFor="edit-qty">
            Quantity in stock
          </label>
          <div style={css.qtyRow}>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              style={css.qtyBtn}
              aria-label="Decrease"
              disabled={quantity <= 1}
            >
              −
            </button>
            <input
              id="edit-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setQuantity(Number.isFinite(v) ? v : 1);
              }}
              style={css.qtyInput}
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              style={css.qtyBtn}
              aria-label="Increase"
            >
              +
            </button>
          </div>
          {soldCount > 0 && (
            <div style={css.fieldHint}>
              {soldCount} already ordered — total can&apos;t go below this.
            </div>
          )}
        </section>

        {/* Availability */}
        <section style={css.section}>
          <div style={css.toggleRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={css.toggleTitle}>Available to shoppers</div>
              <div style={css.toggleSub}>
                {isAvailable
                  ? 'Item is visible and can be bought.'
                  : 'Item is hidden. You keep the stock count.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAvailable((v) => !v)}
              style={{
                ...css.toggle,
                backgroundColor: isAvailable
                  ? 'var(--brand-primary)'
                  : 'var(--bg-tertiary)',
              }}
              aria-pressed={isAvailable}
              aria-label="Toggle availability"
            >
              <span
                style={{
                  ...css.toggleKnob,
                  transform: isAvailable
                    ? 'translateX(20px)'
                    : 'translateX(0)',
                }}
              />
            </button>
          </div>
        </section>

        <div style={{ height: 96 }} />
      </div>

      {/* Sticky save bar */}
      <div style={css.saveBar}>
        <div style={css.saveBarInner}>
          <button
            type="button"
            onClick={() => router.back()}
            style={css.cancelBtn}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={css.saveBtn}
            disabled={saving}
          >
            {saving ? (
              <div style={css.saveSpinner} />
            ) : (
              <span>Save changes</span>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

const CSS = `
  @keyframes skSpin { to { transform: rotate(360deg); } }
  @keyframes skShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  .sk-edit, .sk-edit *, .sk-edit *::before, .sk-edit *::after {
    box-sizing: border-box;
  }
`;

const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    overflowX: 'hidden',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--brand-gradient)',
    padding: '14px 20px',
    transition: 'background 0.18s ease',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    maxWidth: 720,
    margin: '0 auto',
    width: '100%',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 14%, transparent)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    margin: 0,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 78%, transparent)',
    fontWeight: 600,
    marginTop: 3,
  },
  sheet: {
    flex: 1,
    padding: '20px 20px 40px',
    maxWidth: 720,
    margin: '0 auto',
    width: '100%',
  },
  section: {
    marginBottom: 22,
  },
  label: {
    display: 'block',
    fontSize: 12.5,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  // Image
  imageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  imageThumb: {
    width: 92,
    height: 92,
    flexShrink: 0,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-default)',
  },
  imageThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  imageThumbPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  imagePickBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 12,
    backgroundColor: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  imageClearBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 10,
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-tertiary)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  imageHint: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginTop: 8,
    fontWeight: 600,
  },

  // Inputs
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    fontSize: 14.5,
    fontFamily: 'inherit',
    outline: 'none',
    fontWeight: 500,
    transition: 'border-color 0.15s, background-color 0.18s ease',
  },
  fieldHint: {
    fontSize: 11.5,
    color: 'var(--text-tertiary)',
    marginTop: 6,
    fontWeight: 600,
  },

  // Quantity
  qtyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  qtyInput: {
    flex: 1,
    padding: '11px 14px',
    borderRadius: 12,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    fontSize: 17,
    fontWeight: 800,
    fontFamily: 'inherit',
    outline: 'none',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },

  // Toggle
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '16px 16px',
    borderRadius: 14,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
  },
  toggleTitle: {
    fontSize: 14.5,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  toggleSub: {
    fontSize: 12.5,
    color: 'var(--text-tertiary)',
    marginTop: 3,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 999,
    border: 'none',
    position: 'relative',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.18s ease',
  },
  toggleKnob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: 'var(--bg-primary)',
    transition: 'transform 0.18s ease',
    boxShadow: 'var(--shadow-sm)',
  },

  // Save bar
  saveBar: {
    position: 'sticky',
    bottom: 0,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-default)',
    padding: '12px 20px max(12px, env(safe-area-inset-bottom))',
    zIndex: 20,
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  saveBarInner: {
    display: 'flex',
    gap: 10,
    maxWidth: 720,
    margin: '0 auto',
    width: '100%',
  },
  cancelBtn: {
    padding: '14px 20px',
    borderRadius: 14,
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14.5,
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  saveBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 20px',
    borderRadius: 14,
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
    minHeight: 48,
  },
  saveSpinner: {
    width: 20,
    height: 20,
    border: '2px solid var(--brand-on-gradient)',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'skSpin 0.7s linear infinite',
  },

  // Skeletons
  skelLine: {
    height: 14,
    width: 180,
    borderRadius: 7,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 22%, transparent)',
  },
  skelBlock: {
    height: 72,
    borderRadius: 14,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    marginBottom: 16,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },

  // States
  centerRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: 24,
    textAlign: 'center',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  errorHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  centerBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
    marginTop: 8,
    maxWidth: 340,
    lineHeight: 1.55,
  },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: '13px 24px',
    borderRadius: 14,
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
};