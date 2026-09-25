'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { alertDialog } from '../../../../components/ui/dialogs';
import DateOfBirthPicker from '../../../../components/ui/DateOfBirthPicker';
import CountryPicker from '../../../../components/ui/CountryPicker';
import {
  MdArrowBack,
  MdPersonOutline,
  MdLocationOn,
  MdGpsFixed,
} from 'react-icons/md';

export default function StorekeeperOnboardingPersonalInfoPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  // Country is stored as both ISO code (for the picker) and display name
  // (for the URL and downstream pages). They always move together.
  const [countryCode, setCountryCode] = useState('NG');
  const [countryName, setCountryName] = useState('Nigeria');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Auto-detect location on mount (parity with prior behavior).
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

  const validate = async (): Promise<boolean> => {
    if (!fullName.trim()) {
      await alertDialog({
        title: 'Full name required',
        body: 'Please enter your full name so we can set up your store profile.',
        kind: 'warning',
      });
      return false;
    }
    if (fullName.trim().split(/\s+/).filter(Boolean).length < 2) {
      await alertDialog({
        title: 'Add your surname',
        body: 'Please enter your first and last name — both are needed for KYC.',
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
    setSubmitted(true);
    const ok = await validate();
    if (!ok) return;
    setIsLoading(true);

    const params = new URLSearchParams({
      fullName: fullName.trim(),
      dateOfBirth,
      country: countryName,
      city: city.trim(),
    });
    router.push(`/storekeeper/onboarding/store-details?${params.toString()}`);
  };

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()} aria-label="Back">
          <MdArrowBack size={24} color="#000" />
        </button>
        <h1 style={styles.headerTitle}>Open Your Store</h1>
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
          We&apos;ll use this for your store profile and KYC.
        </p>

        {/* Full Name */}
        <div style={styles.inputWrapper}>
          <MdPersonOutline size={20} color="#888" style={styles.inputIcon} />
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={styles.input}
            autoComplete="name"
          />
        </div>

        {/* Date of Birth — styled picker (native wheel/calendar underneath) */}
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

        {/* City / State with GPS button */}
        <div style={styles.cityRow}>
          <div style={{ ...styles.inputWrapper, flex: 1, marginBottom: 0 }}>
            <MdLocationOn size={20} color="#888" style={styles.inputIcon} />
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
          disabled={isLoading}
          style={{
            ...styles.continueBtn,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Loading…' : 'Continue →'}
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