'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { alertDialog } from '../../../components/ui/dialogs';
import {
  MdVideocam,
  MdDeleteOutline,
  MdClose,
  MdLocationOn,
  MdPlayCircleOutline,
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

export default function CreateServicePage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lat, setLat] = useState(5.5103);
  const [lng, setLng] = useState(7.0265);
  const [locationReady, setLocationReady] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!navigator.geolocation) {
        setLocationReady(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setLocationReady(true);
        },
        () => setLocationReady(false),
        { timeout: 10000 },
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    const reader = new FileReader();
    reader.onload = () => setVideoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const submitService = async () => {
    if (!title.trim()) {
      await alertDialog({
        title: 'Service title required',
        body: 'Give shoppers a short, clear name for what you offer.',
        kind: 'warning',
      });
      return;
    }
    if (!selectedCategory) {
      await alertDialog({
        title: 'Category required',
        body: 'Pick the category that best fits this service.',
        kind: 'warning',
      });
      return;
    }
    if (!price.trim()) {
      await alertDialog({
        title: 'Price required',
        body: 'Enter how much you charge for this service.',
        kind: 'warning',
      });
      return;
    }
    if (!duration.trim()) {
      await alertDialog({
        title: 'Duration required',
        body: 'How many minutes does this service take?',
        kind: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const priceNum = parseFloat(price.trim());
      const durationNum = parseInt(duration.trim(), 10);

      const result = (await api.createService(
        title.trim(),
        selectedCategory.id,
        description.trim(),
        priceNum,
        durationNum,
        lat,
        lng,
      )) as { service_id?: string };

      const serviceId = result.service_id;
      if (!serviceId) throw new Error('Service created but no ID returned');

      // Video upload is best-effort — the service itself already exists.
      let videoWarning: string | null = null;
      if (videoFile) {
        try {
          await api.uploadServiceVideo(serviceId, videoFile);
        } catch (err) {
          videoWarning = extractErrorDetail(err, 'Unknown error');
        }
      }

      if (videoWarning) {
        await alertDialog({
          title: 'Service live, video failed',
          body: `Your service was created but the video didn't upload: ${videoWarning}. You can add it later from Edit Service.`,
          kind: 'warning',
          confirmLabel: 'Got it',
        });
      } else {
        await alertDialog({
          title: 'Service published',
          body: `"${title.trim()}" is now live for shoppers to book.`,
          kind: 'success',
          confirmLabel: 'View dashboard',
        });
      }

      router.replace('/service-provider/home');
    } catch (err) {
      await alertDialog({
        title: "Couldn't create service",
        body: extractErrorDetail(err, 'Please check your details and try again.'),
        kind: 'danger',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Add New Service</h1>
        {isSubmitting && <div style={styles.spinnerSmall} />}
      </div>

      <div style={styles.scrollArea}>
        <div style={styles.mediaUpload}>
          {videoPreview ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <video
                src={videoPreview}
                style={styles.mediaVideo}
                controls
                muted
                playsInline
              />
              <button
                onClick={removeVideo}
                style={styles.removeBtn}
                title="Remove video"
              >
                <MdClose size={18} color="#fff" />
              </button>
            </div>
          ) : (
            <div
              style={styles.mediaPlaceholder}
              onClick={() => videoInputRef.current?.click()}
            >
              <MdPlayCircleOutline size={56} color="#888" />
              <p style={{ margin: '8px 0 0', fontWeight: 600 }}>
                Add a vertical video
              </p>
              <p style={{ fontSize: 12, margin: '4px 0 0', color: '#9A9DA6' }}>
                This is what shoppers see in the feed.
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
        />

        <div style={styles.mediaButtons}>
          <button
            onClick={() => videoInputRef.current?.click()}
            style={styles.mediaButton}
          >
            <MdVideocam size={18} color="#690096" />
            {videoFile ? 'Change Video' : 'Add Video'}
          </button>
          {videoFile && (
            <button onClick={removeVideo} style={styles.mediaButton}>
              <MdDeleteOutline size={18} color="#FF0000" />
              Remove
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="Service Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={styles.input}
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
        />

        <input
          type="number"
          placeholder="Price (₦) *"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={styles.input}
        />

        <input
          type="number"
          placeholder="Duration (minutes) *"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={styles.input}
        />

        <h3 style={styles.sectionTitle}>Category</h3>
        <div style={styles.categoryGrid}>
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...styles.categoryButton,
                backgroundColor:
                  selectedCategory?.id === cat.id ? '#690096' : '#f0f0f0',
                color: selectedCategory?.id === cat.id ? '#fff' : '#333',
                borderColor:
                  selectedCategory?.id === cat.id ? '#690096' : '#ccc',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <button
          onClick={submitService}
          disabled={isSubmitting}
          style={{
            ...styles.submitBtn,
            opacity: isSubmitting ? 0.7 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Publishing…' : 'Publish Service'}
        </button>

        <div style={styles.locationInfo}>
          <MdLocationOn size={20} color="#888" />
          <span style={{ fontSize: 13, color: '#666', flex: 1, marginLeft: 8 }}>
            {locationReady
              ? `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
              : 'Fetching location…'}
          </span>
        </div>
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
    borderTopColor: '#690096',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '16px' },
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
    marginBottom: 16,
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
    fontFamily: 'inherit',
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
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#1A1A1A' },
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
  submitBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#690096',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  locationInfo: {
    display: 'flex',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginTop: 16,
  },
};