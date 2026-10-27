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
  const [countryCode, setCountryCode] = useState('NG');
  const [countryName, setCountryName] = useState('Nigeria');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const autoDetectLocation = () => {
    if (isDetectingLocation) return;
    setIsDetectingLocation(true);

    if (!navigator.geolocation) {
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const data = await res.json();
          if (data && data.address) {
            const cityName = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
            const state = data.address.state || '';
            setCity(cityName ? `${cityName}, ${state}` : state);
            if (data.address.country_code) {
              setCountryCode(data.address.country_code.toUpperCase());
              setCountryName(data.address.country);
            }
          }
        } catch (err) {
          console.error('Failed to reverse geocode', err);
        } finally {
          setIsDetectingLocation(false);
        }
      },
      () => {
        setIsDetectingLocation(false);
        alertDialog({
          title: 'Location denied',
          body: 'Please type your city manually.',
          kind: 'warning',
        });
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  // Detect location after the component mounts.
  useEffect(() => {
    const timer = setTimeout(() => {
      autoDetectLocation();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
          <MdArrowBack size={24} color="var(--text-primary)" />
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

        <div style={styles.inputWrapper}>
          <MdPersonOutline size={20} color="var(--text-tertiary)" style={styles.inputIcon} />
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={styles.input}
            autoComplete="name"
          />
        </div>

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

        <div style={styles.cityRow}>
          <div style={{ ...styles.inputWrapper, flex: 1, marginBottom: 0 }}>
            <MdLocationOn size={20} color="var(--text-tertiary)" style={styles.inputIcon} />
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
              <MdGpsFixed size={24} color="var(--brand-primary)" />
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
    backgroundColor: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-default)',
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
    color: 'var(--text-primary)',
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
    color: 'var(--text-tertiary)',
  },
  progressBar: {
    width: 100,
    height: 4,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--brand-primary)',
    borderRadius: 2,
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  subHeading: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
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
    border: '1.5px solid var(--border-default)',
    fontSize: 15,
    outline: 'none',
    backgroundColor: 'var(--bg-secondary)',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  cityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  gpsBtn: {
    background: 'var(--brand-soft)',
    border: '1.5px solid var(--brand-primary)',
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
    border: '2px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  continueBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--brand-on-primary)',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
    letterSpacing: -0.1,
  },
};