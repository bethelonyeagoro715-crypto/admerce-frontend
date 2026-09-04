'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MdLocationOn,
  MdCameraAlt,
  MdMic,
  MdCheckCircle,
  MdAddCircleOutline,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

export default function PermissionPage() {
  const router = useRouter();
  const [locationGranted, setLocationGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [message, setMessage] = useState('');

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      setMessage('Geolocation is not supported by this browser.');
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
      setMessage('Location granted!');
    } catch (err: unknown) {
      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setMessage('Location access was denied. Please allow it in your browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setMessage('Location information is unavailable. Try again later.');
            break;
          case err.TIMEOUT:
            setMessage('Location request timed out. Please try again.');
            break;
          default:
            setMessage(`Location error: ${err.message}`);
        }
      } else if (err instanceof Error) {
        setMessage(`Location error: ${err.message}`);
      } else {
        setMessage('Unable to access location. Check your device permissions.');
      }
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraGranted(true);
      setMessage('Camera granted!');
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setMessage('Camera access was denied. Please allow it in your browser settings.');
        } else {
          setMessage(`Camera error: ${err.message}`);
        }
      } else {
        setMessage('Camera access failed.');
      }
    }
  };

  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicGranted(true);
      setMessage('Microphone granted!');
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setMessage('Microphone access was denied. Please allow it in your browser settings.');
        } else {
          setMessage(`Microphone error: ${err.message}`);
        }
      } else {
        setMessage('Microphone access failed.');
      }
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.heading}>We need a few permissions</h1>

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
          style={styles.continueButton}
        >
          Continue
        </button>

        {message && (
          <div
            style={{
              ...styles.snackbar,
              backgroundColor: message.startsWith('Location') || message.startsWith('Camera') || message.startsWith('Microphone') ? '#c62828' : '#333333',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}

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
    <div onClick={onTap} style={styles.tile}>
      <span style={styles.tileIcon}>
        <Icon size={32} color="#0504AA" />
      </span>
      <div style={styles.tileText}>
        <div style={styles.tileTitle}>{title}</div>
        <div style={styles.tileSubtitle}>{subtitle}</div>
      </div>
      <span style={styles.tileStatus}>
        {granted ? (
          <MdCheckCircle size={24} color="#4CAF50" />
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
    backgroundColor: '#f8f9fa',
    padding: '24px',
  },
  card: {
    maxWidth: '420px',
    width: '100%',
  },
  heading: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#111111',
    marginBottom: '36px',
    textAlign: 'center',
  },
  tile: {
    display: 'flex',
    alignItems: 'center',
    padding: '18px',
    marginBottom: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    cursor: 'pointer',
    border: '1px solid #e9ecef',
  },
  tileIcon: {
    marginRight: '18px',
    display: 'flex',
    alignItems: 'center',
  },
  tileText: {
    flex: 1,
  },
  tileTitle: {
    fontWeight: 700,
    fontSize: '17px',
    color: '#111111',
    marginBottom: '4px',
  },
  tileSubtitle: {
    color: '#555555',
    fontSize: '14px',
    lineHeight: 1.4,
  },
  tileStatus: {
    display: 'flex',
    alignItems: 'center',
  },
  continueButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#0504AA',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    fontSize: '17px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '48px',
    boxShadow: '0 4px 12px rgba(5, 4, 170, 0.3)',
    transition: 'background-color 0.2s',
  },
  snackbar: {
    marginTop: '24px',
    padding: '14px 20px',
    backgroundColor: '#00c10d',
    borderRadius: '8px',
    textAlign: 'center' as const,
    fontWeight: 500,
  },
};