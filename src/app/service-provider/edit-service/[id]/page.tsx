'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import {
  MdArrowBack,
  MdVideocam,
  MdDeleteOutline,
  MdClose,
  MdPlayCircleOutline,
  MdImageNotSupported,
  MdWarning,
} from 'react-icons/md';

interface ServiceCategory {
  id: string;
  label: string;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'grooming_beauty', label: 'Grooming & Beauty' },
  { id: 'repair_maintenance', label: 'Repair & Maintenance' },
  { id: 'cleaning_care', label: 'Cleaning & Care' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'education', label: 'Education' },
  { id: 'health_wellness', label: 'Health & Wellness' },
  { id: 'home_garden', label: 'Home & Garden' },
  { id: 'event_entertainment', label: 'Event & Entertainment' },
  { id: 'digital_creative', label: 'Digital & Creative' },
];

const MAX_VIDEO_MB = 50;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '';

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

interface ServiceResponse {
  service_id: string;
  title?: string;
  category?: string;
  description?: string;
  price?: number | string;
  duration_minutes?: number;
  video_url?: string | null;
  image_url?: string | null;
  provider_id?: string;
}

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const serviceId = Array.isArray(rawId) ? rawId[0] : rawId || '';

  // ─── Loading / error states ──────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ─── Form state ──────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);

  // ─── Media state ─────────────────────────────────────────────
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string | null>(null);
  // ✅ Distinct from "no video" — the user explicitly tapped Remove.
  const [videoMarkedForRemoval, setVideoMarkedForRemoval] = useState(false);

  // ─── Submit state ────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);

  // ─── Load service ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!serviceId) {
        setLoadError('Missing service id.');
        setLoading(false);
        return;
      }
      try {
        const data = (await api.getService(serviceId)) as unknown as ServiceResponse;
        if (cancelled) return;

        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setPrice(data.price != null ? String(data.price) : '');
        setDuration(data.duration_minutes != null ? String(data.duration_minutes) : '');

        const cat = SERVICE_CATEGORIES.find((c) => c.id === data.category);
        if (cat) setSelectedCategory(cat);

        setCurrentVideoUrl(resolveMediaUrl(data.video_url ?? null));
        setCurrentImageUrl(resolveMediaUrl(data.image_url ?? null));
      } catch (err) {
        if (cancelled) return;
        setLoadError(extractErrorDetail(err, 'Could not load this service.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  // ─── Video picker ────────────────────────────────────────────
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_VIDEO_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      alert(
        `Video is ${sizeMb}MB. Maximum is ${MAX_VIDEO_MB}MB.\n\n` +
          'Please record a shorter clip or compress it before uploading.',
      );
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    setNewVideoFile(file);
    setVideoMarkedForRemoval(false);
    const reader = new FileReader();
    reader.onload = () => setNewVideoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearNewVideo = () => {
    setNewVideoFile(null);
    setNewVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const markVideoForRemoval = () => {
    setVideoMarkedForRemoval(true);
    clearNewVideo();
  };

  const undoMarkVideoForRemoval = () => {
    setVideoMarkedForRemoval(false);
  };

  // ─── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return alert('Please enter a service title.');
    if (!selectedCategory) return alert('Please select a category.');

    const priceNum = parseFloat(price.trim());
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return alert('Please enter a price greater than ₦0.');
    }

    const durationNum = parseInt(duration.trim(), 10);
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      return alert('Please enter a duration greater than 0 minutes.');
    }

    setIsSubmitting(true);
    setUploadProgress(null);

    try {
      // ── 1. Update metadata (single PATCH, partial fields)
      await (api as typeof api & {
        updateService: (
          id: string,
          data: {
            title: string;
            category: string;
            description: string;
            price: number;
            duration_minutes: number;
          },
        ) => Promise<unknown>;
      }).updateService(serviceId, {
        title: trimmedTitle,
        category: selectedCategory.id,
        description: description.trim(),
        price: priceNum,
        duration_minutes: durationNum,
      });

      // ── 2. Handle video change
      // Order matters: replace > remove. If user picked a new video AND
      // had previously marked removal, the new video wins.
      if (newVideoFile) {
        try {
          setUploadProgress(0);
          await api.uploadServiceVideo(serviceId, newVideoFile, (pct) =>
            setUploadProgress(pct),
          );
          setUploadProgress(100);
        } catch (err) {
          const msg = extractErrorDetail(err, 'Unknown error');
          const isTimeout =
            msg.toLowerCase().includes('timeout') ||
            msg.toLowerCase().includes('exceeded');
          alert(
            `Details saved, but video upload failed: ${
              isTimeout ? 'it timed out.' : msg
            }\n\nYou can try again from this page.`,
          );
          setIsSubmitting(false);
          setUploadProgress(null);
          return;
        }
      } else if (videoMarkedForRemoval && currentVideoUrl) {
        try {
          await (api as typeof api & {
            deleteServiceVideo: (id: string) => Promise<unknown>;
          }).deleteServiceVideo(serviceId);
          setCurrentVideoUrl(null);
          setVideoMarkedForRemoval(false);
        } catch (err) {
          const msg = extractErrorDetail(err, 'Unknown error');
          alert(`Details saved, but removing the video failed: ${msg}`);
          setIsSubmitting(false);
          setUploadProgress(null);
          return;
        }
      }

      alert('Service updated.');
      router.replace('/service-provider/home');
    } catch (err) {
      alert(extractErrorDetail(err, 'Failed to save changes.'));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  // ─── Delete service ──────────────────────────────────────────
  const handleDeleteService = async () => {
    if (isSubmitting) return;
    if (
      !window.confirm(
        'Delete this service permanently? Bookings already made against it are not affected, but the service will no longer appear to shoppers.',
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      await api.deleteService(serviceId);
      alert('Service deleted.');
      router.replace('/service-provider/home');
    } catch (err) {
      alert(extractErrorDetail(err, 'Failed to delete service.'));
      setIsSubmitting(false);
    }
  };

  // ─── Render gates ────────────────────────────────────────────
  if (loading) {
    return (
      <main style={styles.centered}>
        <div style={styles.spinner} />
      </main>
    );
  }
  if (loadError) {
    return (
      <main style={styles.centered}>
        <MdImageNotSupported size={48} color="#ccc" />
        <p style={{ color: '#666', marginTop: 12, textAlign: 'center' }}>{loadError}</p>
        <button onClick={() => router.back()} style={styles.submitBtn}>
          Go back
        </button>
      </main>
    );
  }

  // ─── Preview media resolution ────────────────────────────────
  const showNewVideo = Boolean(newVideoPreview);
  const showCurrentVideo = !showNewVideo && Boolean(currentVideoUrl) && !videoMarkedForRemoval;
  const showCurrentImage =
    !showNewVideo && !showCurrentVideo && Boolean(currentImageUrl) && !videoMarkedForRemoval;

  const submitLabel = isSubmitting
    ? uploadProgress !== null && uploadProgress < 100
      ? `Uploading video… ${uploadProgress}%`
      : 'Saving…'
    : 'Save changes';

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <MdArrowBack size={24} color="#000" />
        </button>
        <h1 style={styles.headerTitle}>Edit service</h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={styles.scrollArea}>
        <h2 style={styles.heading}>Update the details</h2>
        <p style={styles.subHeading}>
          Changes go live as soon as you save. Videos are what shoppers see in the feed.
        </p>

        {/* Media block */}
        <div style={styles.mediaUpload}>
          {showNewVideo ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <video src={newVideoPreview!} style={styles.mediaVideo} controls muted playsInline />
              <button onClick={clearNewVideo} style={styles.removeBtn} title="Cancel new video">
                <MdClose size={18} color="#fff" />
              </button>
            </div>
          ) : showCurrentVideo ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <video src={currentVideoUrl!} style={styles.mediaVideo} controls muted playsInline />
              <button
                onClick={markVideoForRemoval}
                style={styles.removeBtn}
                title="Remove video on save"
              >
                <MdClose size={18} color="#fff" />
              </button>
            </div>
          ) : videoMarkedForRemoval ? (
            <div style={styles.mediaPlaceholder}>
              <MdWarning size={40} color="#FFA000" />
              <p style={{ margin: '8px 0 0', fontWeight: 600, color: '#FFA000' }}>
                Video will be removed on save
              </p>
              <button
                onClick={undoMarkVideoForRemoval}
                style={{
                  marginTop: 8,
                  background: 'none',
                  border: '1px solid #FFA000',
                  color: '#FFA000',
                  borderRadius: 8,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Undo
              </button>
            </div>
          ) : showCurrentImage ? (
            <img src={currentImageUrl!} alt="Service" style={styles.mediaVideo} />
          ) : (
            <div style={styles.mediaPlaceholder} onClick={() => videoInputRef.current?.click()}>
              <MdPlayCircleOutline size={56} color="#888" />
              <p style={{ margin: '8px 0 0', fontWeight: 600 }}>Add a vertical video</p>
              <p style={{ fontSize: 12, margin: '4px 0 0', color: '#9A9DA6' }}>
                Max {MAX_VIDEO_MB}MB · this is what shoppers see in the feed.
              </p>
            </div>
          )}
        </div>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleVideoChange}
          disabled={isSubmitting}
        />

        <div style={styles.mediaButtons}>
          <button
            onClick={() => videoInputRef.current?.click()}
            style={{ ...styles.mediaButton, opacity: isSubmitting ? 0.5 : 1 }}
            disabled={isSubmitting}
          >
            <MdVideocam size={18} color="#0504AA" />
            {showCurrentVideo || showNewVideo ? 'Replace video' : 'Add video'}
          </button>
          {(showNewVideo || (showCurrentVideo && !videoMarkedForRemoval)) && (
            <button
              onClick={showNewVideo ? clearNewVideo : markVideoForRemoval}
              style={styles.mediaButton}
              disabled={isSubmitting}
            >
              <MdDeleteOutline size={18} color="#FF0000" />
              Remove
            </button>
          )}
        </div>

        {/* Title */}
        <input
          type="text"
          placeholder="Service Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={styles.input}
          disabled={isSubmitting}
        />

        {/* Description */}
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
          disabled={isSubmitting}
        />

        {/* Price */}
        <input
          type="number"
          placeholder="Price (₦) *"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={styles.input}
          disabled={isSubmitting}
        />

        {/* Duration */}
        <input
          type="number"
          placeholder="Duration (minutes) *"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={styles.input}
          disabled={isSubmitting}
        />

        {/* Category */}
        <h3 style={styles.sectionTitle}>Category</h3>
        <div style={styles.categoryGrid}>
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat)}
              disabled={isSubmitting}
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

        {/* Progress bar */}
        {uploadProgress !== null && (
          <div style={styles.progressWrap}>
            <div style={styles.progressBarBg}>
              <div style={{ ...styles.progressBarFill, width: `${uploadProgress}%` }} />
            </div>
            <p style={styles.progressText}>Uploading video… {uploadProgress}%</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isSubmitting}
          style={{ ...styles.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}
        >
          {submitLabel}
        </button>

        {/* Danger zone */}
        <div style={styles.dangerZone}>
          <h3 style={styles.dangerTitle}>Danger zone</h3>
          <p style={styles.dangerText}>
            Deleting this service removes it permanently. Past bookings are not affected.
          </p>
          <button
            onClick={handleDeleteService}
            disabled={isSubmitting}
            style={styles.dangerBtn}
          >
            <MdDeleteOutline size={18} />
            Delete this service
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#fff',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    padding: 24,
    backgroundColor: '#fff',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '20px 16px 40px' },
  heading: { fontSize: 22, fontWeight: 700, color: '#1A1A1A', margin: 0 },
  subHeading: { fontSize: 14, color: '#888', marginTop: 6, marginBottom: 20, lineHeight: 1.5 },
  mediaUpload: {
    width: '100%',
    maxWidth: 280,
    aspectRatio: '9 / 16',
    margin: '0 auto 12px',
    borderRadius: 16,
    backgroundColor: '#0d0d10',
    border: '1px solid #ccc',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  mediaVideo: { width: '100%', height: '100%', objectFit: 'cover' },
  mediaPlaceholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#aaa',
    padding: 16,
    textAlign: 'center',
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
  mediaButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  mediaButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #ccc',
    background: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 14,
    outline: 'none',
    marginBottom: 12,
    backgroundColor: '#fff',
    boxSizing: 'border-box',
  },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#1A1A1A' },
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
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  progressWrap: { marginBottom: 12 },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0504AA',
    borderRadius: 999,
    transition: 'width 0.25s ease',
  },
  progressText: {
    margin: '6px 0 0',
    fontSize: 12,
    color: '#0504AA',
    fontWeight: 600,
    textAlign: 'center',
  },
  dangerZone: {
    marginTop: 40,
    padding: 16,
    borderRadius: 12,
    border: '1px solid #FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#991B1B',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerText: {
    fontSize: 13,
    color: '#991B1B',
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 1.5,
  },
  dangerBtn: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #DC2626',
    backgroundColor: 'transparent',
    color: '#DC2626',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
};