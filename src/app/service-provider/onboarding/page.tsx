'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { alertDialog } from '../../../components/ui/dialogs';
import DateOfBirthPicker from '../../../components/ui/DateOfBirthPicker';
import CountryPicker from '../../../components/ui/CountryPicker';
import {
  MdArrowBack,
  MdPersonOutline,
  MdLocationOn,
  MdGpsFixed,
  MdCameraAlt,
  MdClear,
} from 'react-icons/md';

export default function ServiceProviderOnboardingPersonalInfoPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [countryCode, setCountryCode] = useState('NG');
  const [countryName, setCountryName] = useState('Nigeria');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect location on mount (parity with prior behavior)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDetectingLocation(true);
      setTimeout(() => {
        setCity('Owerri, Imo');
        setIsDetectingLocation(false);
      }, 500);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const autoDetectLocation = () => {
    if (isDetectingLocation) return;
    setIsDetectingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setCity('Owerri, Imo');
          setIsDetectingLocation(false);
        },
        () => {
          setCity('Owerri, Imo');
          setIsDetectingLocation(false);
        },
        { timeout: 10000 },
      );
    } else {
      setCity('Owerri, Imo');
      setIsDetectingLocation(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const validate = async (): Promise<boolean> => {
    if (!fullName.trim()) {
      await alertDialog({
        title: 'Full name required',
        body: 'Please enter your full name so we can set up your profile.',
        kind: 'warning',
      });
      return false;
    }
    if (fullName.trim().split(/\s+/).filter(Boolean).length < 2) {
      await alertDialog({
        title: 'Add your surname',
        body: 'Please enter your first and last name — both are needed.',
        kind: 'warning',
      });
      return false;
    }
    if (!dateOfBirth) {
      await alertDialog({
        title: 'Date of birth required',
        body: 'Select your date of birth to continue.',
        kind: 'warning',
      });
      return false;
    }
    if (!city.trim()) {
      await alertDialog({
        title: 'City required',
        body: 'Enter your city or state, or tap the location icon to detect it.',
        kind: 'warning',
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    const ok = await validate();
    if (!ok) return;
    setIsLoading(true);

    let avatarUrl: string | null = null;

    if (avatarFile) {
      setIsUploadingAvatar(true);
      try {
        const response = (await api.uploadAvatar(avatarFile)) as unknown as {
          avatar_url?: string;
        };
        avatarUrl = response?.avatar_url || null;
      } catch (err) {
        await alertDialog({
          title: "Couldn't upload your photo",
          body:
            err instanceof Error
              ? err.message
              : 'Try again, or continue without a profile picture.',
          kind: 'danger',
        });
        setIsUploadingAvatar(false);
        setIsLoading(false);
        return;
      }
      setIsUploadingAvatar(false);
    }

    const params = new URLSearchParams({
      fullName: fullName.trim(),
      dateOfBirth,
      country: countryName,
      city: city.trim(),
      avatarUrl: avatarUrl || '',
    });

    setIsLoading(false);
    router.push(
      `/service-provider/onboarding/service-details?${params.toString()}`,
    );
  };

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.backBtn}
          onClick={() => router.back()}
          aria-label="Back"
        >
          <MdArrowBack size={24} color="#000" />
        </button>
        <h1 style={styles.headerTitle}>Offer Your Service</h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={styles.scrollArea}>
        <div style={styles.progressRow}>
          <span style={styles.stepText}>Step 1 of 2</span>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: '50%' }} />
          </div>
        </div>

        <h2 style={styles.heading}>Tell us about yourself</h2>
        <p style={styles.subHeading}>
          We&apos;ll use this for your profile and to personalise your
          experience.
        </p>

        {/* Avatar */}
        <div style={styles.avatarSection}>
          <div
            style={styles.avatarWrapper}
            onClick={() => avatarInputRef.current?.click()}
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Avatar" style={styles.avatar} />
            ) : (
              <MdCameraAlt size={30} color="#aaa" />
            )}
            {avatarPreview && (
              <div
                style={styles.removeAvatar}
                onClick={(e) => {
                  e.stopPropagation();
                  removeAvatar();
                }}
              >
                <MdClear size={14} color="#fff" />
              </div>
            )}
          </div>
          <p style={styles.avatarHint}>
            {avatarPreview
              ? 'Profile picture set'
              : 'Tap to add profile picture'}
          </p>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />

        {/* Full Name */}
        <div style={styles.inputWrapper}>
          <MdPersonOutline
            size={20}
            color="#888"
            style={styles.inputIcon}
          />
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={styles.input}
            autoComplete="name"
          />
        </div>

        {/* Date of Birth — styled picker */}
        <div style={{ marginBottom: 20 }}>
          <DateOfBirthPicker
            value={dateOfBirth}
            onChange={setDateOfBirth}
            label="Date of Birth"
            required
            minAge={18}
            maxAge={120}
          />
        </div>

        {/* Country — searchable modal picker */}
        <div style={{ marginBottom: 20 }}>
          <CountryPicker
            value={countryCode}
            onChange={(code, name) => {
              setCountryCode(code);
              setCountryName(name);
            }}
            label="Country"
            required
          />
        </div>

        {/* City / State */}
        <div style={styles.cityRow}>
          <div style={{ ...styles.inputWrapper, flex: 1, marginBottom: 0 }}>
            <MdLocationOn
              size={20}
              color="#888"
              style={styles.inputIcon}
            />
            <input
              type="text"
              placeholder="City / State"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={styles.input}
              autoComplete="address-level2"
            />
          </div>
          <button
            onClick={autoDetectLocation}
            disabled={isDetectingLocation}
            style={styles.gpsBtn}
            title="Detect current city"
            aria-label="Detect current city"
          >
            {isDetectingLocation ? (
              <div style={styles.spinnerSmall} />
            ) : (
              <MdGpsFixed size={24} color="#0504AA" />
            )}
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading || isUploadingAvatar}
          style={{
            ...styles.continueBtn,
            opacity: isLoading || isUploadingAvatar ? 0.7 : 1,
            cursor: isLoading || isUploadingAvatar ? 'not-allowed' : 'pointer',
          }}
        >
          {isUploadingAvatar
            ? 'Uploading photo…'
            : isLoading
              ? 'Loading…'
              : 'Continue →'}
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
    marginTop: 6,
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: '50%',
    backgroundColor: '#F6F7FB',
    border: '1.5px dashed #C7CCFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  avatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  removeAvatar: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: '#DC2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '2px solid #FFFFFF',
  },
  avatarHint: {
    fontSize: 13,
    color: '#888',
    marginTop: 10,
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
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 40px',
    borderRadius: 12,
    border: '1.5px solid #E2E8F0',
    fontSize: 15,
    outline: 'none',
    backgroundColor: '#FAFAFC',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: '#0B0B1A',
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  cityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  gpsBtn: {
    background: '#EEF0FF',
    border: '1.5px solid #C7CCFF',
    borderRadius: 12,
    cursor: 'pointer',
    padding: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 48,
    minHeight: 48,
  },
  spinnerSmall: {
    width: 20,
    height: 20,
    border: '2px solid #E0E7FF',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  continueBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
    letterSpacing: -0.1,
  },
};