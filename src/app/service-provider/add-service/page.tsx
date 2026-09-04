'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdAddPhotoAlternate,
  MdImage,
  MdVideocam,
  MdDeleteOutline,
  MdEdit,
  MdTextFields,
  MdDescription,
  MdAttachMoney,
  MdTimer,
  MdLocationOn,
  MdClose,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
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

  // Media
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lat, setLat] = useState(5.5103);
  const [lng, setLng] = useState(7.0265);
  const [locationReady, setLocationReady] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Get location
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
        () => {
          setLocationReady(false);
        },
        { timeout: 10000 }
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    const reader = new FileReader();
    reader.onload = () => setVideoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const hasMedia = imageFile || videoFile;

  const submitService = async () => {
    if (!title.trim()) {
      alert('Please enter a service title.');
      return;
    }
    if (!selectedCategory) {
      alert('Please select a category.');
      return;
    }
    if (!price.trim()) {
      alert('Please enter a price.');
      return;
    }
    if (!duration.trim()) {
      alert('Please enter the duration in minutes.');
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
        lng
      )) as { service_id?: string };

      const serviceId = result.service_id;
      if (!serviceId) throw new Error('Service created but no ID returned');

      if (imageFile) {
        try {
          await api.uploadServiceImage(serviceId, imageFile);
        } catch {
          alert('Service created, but image upload failed.');
        }
      }

      if (videoFile) {
        try {
          await api.uploadServiceVideo(serviceId, videoFile);
        } catch {
          alert('Service created, but video upload failed.');
        }
      }

      alert('Service created successfully!');
      setTimeout(() => router.replace('/service-provider/home'), 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create service';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Add New Service</h1>
        {isSubmitting && <div style={styles.spinnerSmall} />}
      </div>

      <div style={styles.scrollArea}>
        {/* Media Upload */}
        <div style={styles.mediaUpload}>
          {hasMedia ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {imagePreview ? (
                <img src={imagePreview} alt="Service" style={styles.mediaImage} />
              ) : videoPreview ? (
                <video src={videoPreview} style={styles.mediaImage} controls />
              ) : null}
              <button
                onClick={removeMedia}
                style={styles.removeBtn}
                title="Remove media"
              >
                <MdClose size={18} color="#fff" />
              </button>
              <button
                onClick={() => imageInputRef.current?.click()}
                style={styles.editBtn}
                title="Change image/video"
              >
                <MdEdit size={18} color="#fff" />
              </button>
            </div>
          ) : (
            <div style={styles.mediaPlaceholder} onClick={() => imageInputRef.current?.click()}>
              <MdAddPhotoAlternate size={48} color="#888" />
              <p>Tap to add image or video</p>
              <p style={{ fontSize: 12 }}>Tap edit to change</p>
            </div>
          )}
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageChange}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleVideoChange}
        />

        {/* Media Buttons */}
        <div style={styles.mediaButtons}>
          <button
            onClick={() => imageInputRef.current?.click()}
            style={styles.mediaButton}
          >
            <MdImage size={18} color="#690096" />
            Add Image
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            style={styles.mediaButton}
          >
            <MdVideocam size={18} color="#690096" />
            Add Video
          </button>
          {hasMedia && (
            <button
              onClick={removeMedia}
              style={styles.mediaButton}
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
        />

        {/* Description */}
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
        />

        {/* Price */}
        <input
          type="number"
          placeholder="Price (₦) *"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={styles.input}
        />

        {/* Duration */}
        <input
          type="number"
          placeholder="Duration (minutes) *"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={styles.input}
        />

        {/* Category Picker */}
        <h3 style={styles.sectionTitle}>Category</h3>
        <div style={styles.categoryGrid}>
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...styles.categoryButton,
                backgroundColor: selectedCategory?.id === cat.id ? '#690096' : '#f0f0f0',
                color: selectedCategory?.id === cat.id ? '#fff' : '#333',
                borderColor: selectedCategory?.id === cat.id ? '#690096' : '#ccc',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={submitService}
          disabled={isSubmitting}
          style={{
            ...styles.submitBtn,
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Publishing...' : 'Publish Service'}
        </button>

        {/* Location info */}
        <div style={styles.locationInfo}>
          <MdLocationOn size={20} color="#888" />
          <span style={{ fontSize: 13, color: '#666', flex: 1, marginLeft: 8 }}>
            {locationReady
              ? `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
              : 'Fetching location...'}
          </span>
        </div>
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
    borderTopColor: '#690096',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  mediaUpload: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    cursor: 'pointer',
    overflow: 'hidden',
    marginBottom: 8,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  mediaPlaceholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
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
  editBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#690096',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  mediaButtons: {
    display: 'flex',
    flexWrap: 'wrap',
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
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 8,
    color: '#1A1A1A',
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