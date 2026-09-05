'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../../../services/api';
import {
  MdArrowBack,
  MdWorkOutline,
  MdDescription,
  MdAddPhotoAlternate,
  MdEdit,
  MdClose,
  MdPlayArrow,
  MdInfoOutline,
  MdImage,
  MdVideocam,
} from 'react-icons/md';
import {
  setOnboardingStatus,
  setActiveRole,
} from '../../../../services/localStorage';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

// ─── Service Categories (simplified; you can expand) ─────────────────
const SERVICE_CATEGORIES = [
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

export default function ServiceProviderOnboardingServiceDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Personal data from previous step (query params)
  const fullName = searchParams.get('fullName') || 'there';

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Media state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ─── Media helpers ──────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    // Clear video if image set (optional)
    setVideoFile(null);
    setVideoPreview(null);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    const reader = new FileReader();
    reader.onload = () => setVideoPreview(reader.result as string);
    reader.readAsDataURL(file);
    // Clear image if video set
    setImageFile(null);
    setImagePreview(null);
  };

  const removeAllMedia = () => {
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const hasMedia = imageFile || videoFile;

  // ─── Validation ────────────────────────────────────────────────
  const validate = (): boolean => {
    if (!title.trim()) {
      alert('Please enter a service title.');
      return false;
    }
    if (title.trim().length < 3) {
      alert('Title must be at least 3 characters.');
      return false;
    }
    if (!selectedCategory) {
      alert('Please select a service category.');
      return false;
    }
    if (!description.trim()) {
      alert('Please enter a description.');
      return false;
    }
    return true;
  };

  // ─── Submit / Save Draft ──────────────────────────────────────
  const submitService = async (asDraft: boolean) => {
    if (!validate()) return;

    if (asDraft) setIsSavingDraft(true);
    else setIsLoading(true);

    try {
      // Create service with dummy price/duration for now
      const response = (await api.createService(
        title.trim(),
        selectedCategory!,
        description.trim(),
        0, // price
        0, // duration
        5.5103, // lat (fallback)
        7.0265, // lng
      )) as { service_id?: string };

      const serviceId = response.service_id;
      if (!serviceId) throw new Error('Service created but no ID returned');

      // Upload image if present
      if (imageFile) {
        try {
          await api.uploadServiceImage(serviceId, imageFile);
        } catch (err) {
          alert('Service created, but image upload failed.');
        }
      }

      // Upload video if present
      if (videoFile) {
        try {
          await api.uploadServiceVideo(serviceId, videoFile);
        } catch (err) {
          alert('Service created, but video upload failed.');
        }
      }

      // Mark onboarding complete
      setOnboardingStatus('service-provider', true);
      setActiveRole('service-provider');

      alert(asDraft ? 'Draft saved!' : 'Service created!');
      router.replace('/service-provider/home');
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
      setIsSavingDraft(false);
    }
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <MdArrowBack size={24} color="#000" />
        </button>
        <h1 style={styles.headerTitle}>Offer Your Service</h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={styles.scrollArea}>
        {/* Step indicator */}
        <div style={styles.progressRow}>
          <span style={styles.stepText}>Step 2 of 2</span>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: '100%' }} />
          </div>
        </div>

        {/* Heading */}
        <h2 style={styles.heading}>Hi {fullName}, tell us about your service</h2>
        <p style={styles.subHeading}>
          We’ll help you create a listing that stands out. You can set your price and availability later.
        </p>

        {/* Service Title */}
        <div style={styles.inputWrapper}>
          <MdWorkOutline size={20} color="#888" style={styles.inputIcon} />
          <input
            type="text"
            placeholder="Service Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
          />
        </div>

        {/* Category Picker */}
        <label style={styles.label}>Category</label>
        <div style={styles.categoryGrid}>
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                ...styles.categoryButton,
                backgroundColor: selectedCategory === cat.id ? '#0504AA' : '#f0f0f0',
                color: selectedCategory === cat.id ? '#fff' : '#333',
                borderColor: selectedCategory === cat.id ? '#0504AA' : '#ccc',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Description */}
        <div style={styles.inputWrapper}>
          <MdDescription size={20} color="#888" style={styles.inputIcon} />
          <textarea
            placeholder="Describe your service and what makes you unique..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
          />
        </div>

        {/* Media Upload */}
        <label style={styles.label}>Add Service Image or Video (optional)</label>
        <div style={styles.mediaUpload}>
          {hasMedia ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {imagePreview ? (
                <img src={imagePreview} alt="Service" style={styles.mediaImage} />
              ) : videoPreview ? (
                <video src={videoPreview} style={styles.mediaImage} controls />
              ) : null}
              <button
                onClick={removeAllMedia}
                style={styles.removeBtn}
                title="Remove media"
              >
                <MdClose size={18} color="#fff" />
              </button>
              <button
                onClick={() => (imageFile ? imageInputRef.current?.click() : videoInputRef.current?.click())}
                style={styles.editBtn}
                title="Change media"
              >
                <MdEdit size={18} color="#fff" />
              </button>
            </div>
          ) : (
            <div style={styles.mediaPlaceholder} onClick={() => imageInputRef.current?.click()}>
              <MdAddPhotoAlternate size={48} color="#888" />
              <p>Tap to add image or video</p>
              <p style={{ fontSize: 12 }}>Optional – you can add more later</p>
            </div>
          )}
        </div>
        <div style={styles.mediaButtons}>
          <button
            onClick={() => imageInputRef.current?.click()}
            style={styles.mediaButton}
          >
            <MdImage size={18} color="#0504AA" />
            Add Image
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            style={styles.mediaButton}
          >
            <MdVideocam size={18} color="#0504AA" />
            Add Video
          </button>
          {hasMedia && (
            <button
              onClick={removeAllMedia}
              style={styles.mediaButton}
            >
              <MdClose size={18} color="#FF0000" />
              Remove
            </button>
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

        {/* Live Preview */}
        <label style={styles.label}>Preview of your listing</label>
        <div style={styles.previewCard}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={styles.previewIcon}>
              {selectedCategory ? <MdWorkOutline size={24} color="#0504AA" /> : <MdInfoOutline size={24} color="#ccc" />}
            </div>
            <div style={{ marginLeft: 12 }}>
              <div style={styles.previewTitle}>{title || 'Your Service Title'}</div>
              <div style={styles.previewCategory}>
                {selectedCategory ? SERVICE_CATEGORIES.find(c => c.id === selectedCategory)?.label : 'Category not set'}
              </div>
            </div>
          </div>
          <p style={styles.previewDescription}>
            {description || 'Your service description will appear here.'}
          </p>
        </div>

        {/* Transparency note */}
        <div style={styles.infoRow}>
          <MdInfoOutline size={16} color="#888" />
          <span style={styles.infoText}>
            After creating your service, you can set a price, add photos, and adjust availability.
            Admerce charges a 5% platform fee on completed bookings.
          </span>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionsRow}>
          <button
            onClick={() => submitService(true)}
            disabled={isLoading || isSavingDraft}
            style={styles.draftBtn}
          >
            {isSavingDraft ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => submitService(false)}
            disabled={isLoading || isSavingDraft}
            style={styles.submitBtn}
          >
            {isLoading ? 'Creating...' : 'Create Service'}
          </button>
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
    height: '100vh',
    backgroundColor: '#fff',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#000',
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
    color: '#888',
  },
  progressBar: {
    width: 100,
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0504AA',
    borderRadius: 2,
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: '#000',
    margin: 0,
  },
  subHeading: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
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
    border: '1px solid #ccc',
    fontSize: 14,
    outline: 'none',
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: '#000',
    marginBottom: 6,
    display: 'block',
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
  mediaUpload: {
    width: '100%',
    height: 160,
    borderRadius: 12,
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
    backgroundColor: '#0504AA',
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
  previewCard: {
    backgroundColor: '#fff',
    border: '1px solid #eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f0edff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1A1A1A',
  },
  previewCategory: {
    fontSize: 13,
    color: '#0504AA',
  },
  previewDescription: {
    fontSize: 14,
    color: '#555',
    marginTop: 8,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  infoText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
    flex: 1,
  },
  actionsRow: {
    display: 'flex',
    gap: 12,
  },
  draftBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: 14,
    border: '1px solid #0504AA',
    background: 'none',
    color: '#0504AA',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 2,
    padding: '14px',
    borderRadius: 14,
    border: 'none',
    backgroundColor: '#0504AA',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};