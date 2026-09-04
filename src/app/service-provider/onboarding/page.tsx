'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdArrowBack,
  MdPersonOutline,
  MdPublic,
  MdLocationOn,
  MdGpsFixed,
  MdCameraAlt,
  MdClear,
} from 'react-icons/md';

// ─── Data ───────────────────────────────────────────────────────────
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

const YEARS = Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => new Date().getFullYear() - i);

const COUNTRIES = [
  'Nigeria', 'Ghana', 'South Africa', 'Kenya', 'Egypt', 'Morocco', 'Algeria', 'Tunisia',
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
  'Spain', 'Italy', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Brazil', 'Argentina', 'Mexico', 'Chile', 'Colombia', 'Peru',
  'China', 'Japan', 'India', 'South Korea', 'Indonesia', 'Malaysia', 'Singapore',
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Israel',
  'Turkey', 'Russia', 'Ukraine', 'Poland', 'Belgium', 'Switzerland', 'Austria',
  'New Zealand', 'Ireland', 'Portugal', 'Greece', 'Czech Republic', 'Hungary',
  'Romania', 'Bulgaria', 'Thailand', 'Vietnam', 'Philippines', 'Pakistan',
  'Bangladesh', 'Sri Lanka', 'Nepal', 'Ethiopia', 'Tanzania', 'Uganda',
  'Rwanda', 'Cameroon', 'Senegal', 'Ivory Coast', 'Zimbabwe', 'Zambia',
];

export default function ServiceProviderOnboardingPersonalInfoPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedYear, setSelectedYear] = useState(2000);
  const [selectedCountry, setSelectedCountry] = useState('Nigeria');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Auto‑detect location on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDetectingLocation(true);
      // Simulate detection – on web we default to Owerri, Imo
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
        { timeout: 10000 }
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

  const validate = (): boolean => {
    if (!fullName.trim()) {
      alert('Please enter your full name.');
      return false;
    }
    if (fullName.trim().split(' ').length < 2) {
      alert('Please enter at least two names.');
      return false;
    }
    if (!city.trim()) {
      alert('City is required.');
      return false;
    }
    if (!selectedCountry) {
      alert('Please select your country.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);

    let avatarUrl: string | null = null;

    // Upload avatar if selected
    if (avatarFile) {
      setIsUploadingAvatar(true);
      try {
        const response = (await api.uploadAvatar(avatarFile)) as unknown as { avatar_url?: string };
        avatarUrl = response?.avatar_url || null;
      } catch (err) {
        alert('Failed to upload avatar: ' + (err instanceof Error ? err.message : ''));
        setIsUploadingAvatar(false);
        setIsLoading(false);
        return;
      }
      setIsUploadingAvatar(false);
    }

    const dob = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

    const params = new URLSearchParams({
      fullName: fullName.trim(),
      dateOfBirth: dob,
      country: selectedCountry,
      city: city.trim(),
      avatarUrl: avatarUrl || '',
    });

    setIsLoading(false);
    router.push(`/service-provider/onboarding/service-details?${params.toString()}`);
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
        {/* Progress Indicator */}
        <div style={styles.progressRow}>
          <span style={styles.stepText}>Step 1 of 2</span>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: '50%' }} />
          </div>
        </div>

        {/* Heading */}
        <h2 style={styles.heading}>Tell us about yourself</h2>
        <p style={styles.subHeading}>
          We will use this for your profile and to personalise your experience.
        </p>

        {/* Avatar */}
        <div style={styles.avatarSection}>
          <div style={styles.avatarWrapper} onClick={() => avatarInputRef.current?.click()}>
            {avatarPreview ? (
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
            {avatarPreview ? 'Profile picture set' : 'Tap to add profile picture'}
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
          <MdPersonOutline size={20} color="#888" style={styles.inputIcon} />
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={styles.input}
          />
        </div>

        {/* Date of Birth */}
        <label style={styles.label}>Date of Birth</label>
        <div style={styles.dobRow}>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            style={styles.select}
          >
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {String(day).padStart(2, '0')}
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={styles.select}
          >
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={styles.select}
          >
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Country */}
        <div style={styles.inputWrapper}>
          <MdPublic size={20} color="#888" style={styles.inputIcon} />
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            style={{ ...styles.input, appearance: 'auto', paddingLeft: 36 }}
          >
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        {/* City / State */}
        <div style={styles.cityRow}>
          <div style={styles.inputWrapper}>
            <MdLocationOn size={20} color="#888" style={styles.inputIcon} />
            <input
              type="text"
              placeholder="City / State"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={styles.input}
            />
          </div>
          <button
            onClick={autoDetectLocation}
            disabled={isDetectingLocation}
            style={styles.gpsBtn}
            title="Detect current city"
          >
            {isDetectingLocation ? (
              <div style={styles.spinnerSmall} />
            ) : (
              <MdGpsFixed size={24} color="#0504AA" />
            )}
          </button>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || isUploadingAvatar}
          style={{
            ...styles.continueBtn,
            opacity: isLoading || isUploadingAvatar ? 0.7 : 1,
          }}
        >
          {isUploadingAvatar ? 'Uploading...' : isLoading ? 'Loading...' : 'Continue →'}
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
    backgroundColor: '#f0f0f0',
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
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: '#FF0000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  avatarHint: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
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
  dobRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 20,
  },
  select: {
    flex: 1,
    padding: '10px 6px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 13,
    outline: 'none',
    backgroundColor: '#fff',
  },
  cityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  gpsBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerSmall: {
    width: 20,
    height: 20,
    border: '2px solid #eee',
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
    fontWeight: 600,
    cursor: 'pointer',
  },
};