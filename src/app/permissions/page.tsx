'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MdLocationOn,
  MdCameraAlt,
  MdMic,
  MdCheckCircle,
  MdAddCircleOutline,
  MdErrorOutline,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

type MessageKind = 'success' | 'error';

interface StatusMessage {
  text: string;
  kind: MessageKind;
}

export default function PermissionPage() {
  const router = useRouter();

  const [locationGranted, setLocationGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);

  // ✅ CHANGED — kind drives colour; text is just for display.
  const [message, setMessage] = useState<StatusMessage | null>(null);

  // ✅ NEW — auto-dismiss the banner after 3.2s. Cleared and reset on
  //    every new message.
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(t);
  }, [message]);

  const showSuccess = (text: string) => setMessage({ text, kind: 'success' });
  const showError = (text: string) => setMessage({ text, kind: 'error' });

  // ── Location ───────────────────────────────────────────────────
  const requestLocation = async () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by this browser.');
      return;
    }
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 0,
        });
      });
      setLocationGranted(true);
      showSuccess('Location granted');
    } catch (err: unknown) {
      // Duck-type on `code` — GeolocationPositionError isn't a global
      // constructor in every browser.
      const code = (err as { code?: number })?.code;
      if (code === 1) {
        showError(
          'Location was denied. Please allow it in your browser settings.',
        );
      } else if (code === 2) {
        showError('Location is unavailable. Try again in a moment.');
      } else if (code === 3) {
        showError('Location request timed out. Please try again.');
      } else if (err instanceof Error) {
        showError(`Location error: ${err.message}`);
      } else {
        showError('Unable to access location. Check your device permissions.');
      }
    }
  };

  // ── Camera ─────────────────────────────────────────────────────
  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCameraGranted(true);
      showSuccess('Camera granted');
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError') {
        showError('Camera was denied. Please allow it in your browser settings.');
      } else if (err instanceof Error) {
        showError(`Camera error: ${err.message}`);
      } else {
        showError('Camera access failed.');
      }
    }
  };

  // ── Microphone ─────────────────────────────────────────────────
  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
      showSuccess('Microphone granted');
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError') {
        showError('Microphone was denied. Please allow it in your browser settings.');
      } else if (err instanceof Error) {
        showError(`Microphone error: ${err.message}`);
      } else {
        showError('Microphone access failed.');
      }
    }
  };

  const allGranted = locationGranted && cameraGranted && micGranted;

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.heading}>We need a few permissions</h1>
        <p style={styles.subheading}>
          You can grant them one at a time. Nothing is shared without your say.
        </p>

        <PermissionTile
          Icon={MdLocationOn}
          title="Location"
          subtitle="To find items, stores, and services near you"
          granted={locationGranted}
          onTap={requestLocation}
        />
        <PermissionTile
          Icon={MdCameraAlt}
          title="Camera"
          subtitle="To scan barcodes, search by photo, and list products"
          granted={cameraGranted}
          onTap={requestCamera}
        />
        <PermissionTile
          Icon={MdMic}
          title="Microphone"
          subtitle="To search with voice and record messages"
          granted={micGranted}
          onTap={requestMicrophone}
        />

        <button
          onClick={() => router.push('/onboarding')}
          style={{
            ...styles.continueButton,
            ...(allGranted ? styles.continueButtonReady : {}),
          }}
        >
          {allGranted ? 'All set — Continue' : 'Continue'}
        </button>

        {/* ✅ Snackbar — colour comes from `message.kind`, not string matching */}
        {message && (
          <div
            style={{
              ...styles.snackbar,
              backgroundColor:
                message.kind === 'success' ? '#ECFDF5' : '#FEF2F2',
              borderColor:
                message.kind === 'success' ? '#A7F3D0' : '#FECACA',
              color:
                message.kind === 'success' ? '#065F46' : '#991B1B',
            }}
            role="status"
            aria-live="polite"
          >
            {message.kind === 'success' ? (
              <MdCheckCircle size={18} color="#16A34A" />
            ) : (
              <MdErrorOutline size={18} color="#DC2626" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Tile ──────────────────────────────────────────────────────────
function PermissionTile({
  Icon,
  title,
  subtitle,
  granted,
  onTap,
}: {
  Icon: IconType;
  title: string;
  subtitle: string;
  granted: boolean;
  onTap: () => void;
}) {
  return (
    <div
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap();
        }
      }}
      style={{
        ...styles.tile,
        // ✅ Granted tiles get a soft green ring — a persistent cue even
        //    after the banner fades.
        ...(granted ? styles.tileGranted : {}),
      }}
    >
      <span
        style={{
          ...styles.tileIcon,
          backgroundColor: granted ? '#DCFCE7' : '#EEF0FF',
        }}
      >
        <Icon size={30} color={granted ? '#16A34A' : '#0504AA'} />
      </span>
      <div style={styles.tileText}>
        <div style={styles.tileTitle}>{title}</div>
        <div style={styles.tileSubtitle}>
          {granted ? 'Permission granted' : subtitle}
        </div>
      </div>
      <span style={styles.tileStatus}>
        {granted ? (
          <MdCheckCircle size={24} color="#16A34A" />
        ) : (
          <MdAddCircleOutline size={24} color="#0504AA" />
        )}
      </span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    padding: '24px',
  },
  card: {
    maxWidth: '440px',
    width: '100%',
  },
  heading: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: '-0.02em',
    textAlign: 'center',
  },
  subheading: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: 1.5,
    textAlign: 'center',
    margin: '10px 0 28px',
  },
  tile: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    marginBottom: '14px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(11, 11, 26, 0.04)',
    cursor: 'pointer',
    border: '1px solid #EAECF3',
    transition: 'border-color 0.18s, background 0.18s, transform 0.18s',
    fontFamily: 'inherit',
  },
  tileGranted: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  tileIcon: {
    width: 48,
    height: 48,
    flex: '0 0 48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginRight: 14,
    transition: 'background 0.18s',
  },
  tileText: {
    flex: 1,
    minWidth: 0,
  },
  tileTitle: {
    fontWeight: 800,
    fontSize: '16px',
    color: '#0B0B1A',
    marginBottom: '2px',
    letterSpacing: '-0.01em',
  },
  tileSubtitle: {
    color: '#64748B',
    fontSize: '13px',
    lineHeight: 1.4,
  },
  tileStatus: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 12,
  },
  continueButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: '30px',
    fontSize: '16px',
    fontWeight: 800,
    cursor: 'pointer',
    marginTop: '36px',
    boxShadow: '0 6px 18px rgba(5, 4, 170, 0.25)',
    transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
    fontFamily: 'inherit',
  },
  continueButtonReady: {
    backgroundColor: '#16A34A',
    boxShadow: '0 6px 18px rgba(22, 163, 74, 0.30)',
  },
  snackbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid',
    fontSize: 13.5,
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: 'center',
    animation: 'permFadeIn 0.2s ease',
  },
};