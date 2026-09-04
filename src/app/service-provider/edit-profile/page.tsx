'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdBusiness,
  MdPerson,
  MdCameraAlt,
  MdSave,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface ProviderProfile {
  nickname?: string;
  username?: string;
  business_name?: string;
  avatar_url?: string;
  business_image_url?: string;
  [key: string]: unknown;
}

export default function EditProviderProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [businessImageUrl, setBusinessImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New image previews and files
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [businessImagePreview, setBusinessImagePreview] = useState<string | null>(null);
  const [businessImageFile, setBusinessImageFile] = useState<File | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const businessImageInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = (await api.getMyProfile()) as ProviderProfile;
      setProfile(data);
      setDisplayName(data.nickname || data.username || '');
      setBusinessName(data.business_name || '');
      setAvatarUrl(data.avatar_url || null);
      setBusinessImageUrl(data.business_image_url || null);
    } catch (err) {
      console.error('Failed to load profile:', err);
      alert('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleBusinessImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusinessImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setBusinessImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveChanges = async () => {
    if (!displayName.trim()) {
      alert('Please enter your display name');
      return;
    }
    if (!businessName.trim()) {
      alert('Please enter a business name');
      return;
    }

    setIsSaving(true);
    try {
      // Update display name and business name
      await api.updateProviderProfile(displayName.trim(), businessName.trim());

      // Upload new avatar if selected
      if (avatarFile) {
        try {
          await api.uploadAvatar(avatarFile);
        } catch (err) {
          alert('Avatar upload failed: ' + (err instanceof Error ? err.message : ''));
        }
      }

      // Upload new business image if selected
      if (businessImageFile) {
        try {
          await api.uploadBusinessImage(businessImageFile);
        } catch (err) {
          alert('Business image upload failed: ' + (err instanceof Error ? err.message : ''));
        }
      }

      alert('Profile updated successfully!');
      router.back();
    } catch (err) {
      alert('Failed to update: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  const finalAvatarUrl = avatarPreview || (avatarUrl ? (avatarUrl.startsWith('http') ? avatarUrl : `${process.env.NEXT_PUBLIC_API_BASE || ''}${avatarUrl}`) : null);
  const finalBusinessImageUrl = businessImagePreview || (businessImageUrl ? (businessImageUrl.startsWith('http') ? businessImageUrl : `${process.env.NEXT_PUBLIC_API_BASE || ''}${businessImageUrl}`) : null);

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Edit Profile</h1>
        <button onClick={saveChanges} disabled={isSaving} style={styles.saveBtn}>
          {isSaving ? <div style={styles.spinnerSmall} /> : <MdSave size={20} color="#fff" />}
        </button>
      </div>

      <div style={styles.scrollArea}>
        {/* Business Image */}
        <h3 style={styles.sectionTitle}>Business Image</h3>
        <div
          style={{
            ...styles.businessImageBox,
            backgroundImage: finalBusinessImageUrl ? `url(${finalBusinessImageUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => businessImageInputRef.current?.click()}
        >
          {!finalBusinessImageUrl && (
            <span style={{ color: '#888' }}>Tap to add business image</span>
          )}
        </div>
        <p style={styles.hintText}>
          {businessImageFile ? 'New image selected' : 'Tap to change business image'}
        </p>
        <input
          ref={businessImageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleBusinessImageChange}
        />

        {/* Personal Avatar */}
        <h3 style={styles.sectionTitle}>Profile Picture</h3>
        <div style={styles.avatarSection} onClick={() => avatarInputRef.current?.click()}>
          <div style={styles.avatarBox}>
            {finalAvatarUrl ? (
              <img src={finalAvatarUrl} alt="Avatar" style={styles.avatar} />
            ) : (
              <MdPerson size={40} color="#aaa" />
            )}
            <div style={styles.cameraBadge}>
              <MdCameraAlt size={14} color="#fff" />
            </div>
          </div>
        </div>
        <p style={styles.hintText}>
          {avatarFile ? 'New photo selected' : 'Tap to change profile picture'}
        </p>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />

        {/* Business Name */}
        <h3 style={styles.sectionTitle}>Business Name</h3>
        <input
          type="text"
          placeholder="Business Name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          style={styles.input}
        />

        {/* Display Name */}
        <h3 style={styles.sectionTitle}>Your Display Name</h3>
        <input
          type="text"
          placeholder="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={styles.input}
        />

        {/* Save Button */}
        <button
          onClick={saveChanges}
          disabled={isSaving}
          style={{
            ...styles.submitBtn,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
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
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
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
  spinnerSmall: {
    width: 20,
    height: 20,
    border: '2px solid #eee',
    borderTopColor: '#fff',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  saveBtn: {
    background: '#0504AA',
    border: 'none',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  businessImageBox: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
    border: '1px solid #ccc',
  },
  hintText: {
    fontSize: 12,
    color: '#888',
    margin: '8px 0 24px',
    textAlign: 'center',
  },
  avatarSection: {
    display: 'flex',
    justifyContent: 'center',
    cursor: 'pointer',
    marginBottom: 8,
  },
  avatarBox: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: '50%',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: '#0504AA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 14,
    outline: 'none',
    marginBottom: 16,
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