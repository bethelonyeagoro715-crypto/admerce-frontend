'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdRefresh,
  MdCheckCircle,
  MdBlock,
  MdWarningAmber,
  MdInfo,
  MdClear,
  MdLogout,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface FeatureFlags {
  enable_delivery?: boolean;
  enable_courier?: boolean;
  enable_flipper?: boolean;
  maintenance_mode?: boolean;
  app_version?: string;
  [key: string]: unknown;
}

// ─── ToggleSwitch component ──────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div style={styles.settingRow}>
      <div style={{ flex: 1 }}>
        <div style={styles.settingTitle}>{label}</div>
        {description && (
          <div style={{ fontSize: 13, color: checked ? '#4CAF50' : '#888' }}>
            {description}
          </div>
        )}
      </div>
      <label style={styles.switch}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ display: 'none' }}
        />
        <span
          style={{
            ...styles.slider,
            backgroundColor: checked ? '#4CAF50' : '#ccc',
          }}
        />
        <span
          style={{
            ...styles.knob,
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </label>
    </div>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [enableDelivery, setEnableDelivery] = useState(false);
  const [enableCourier, setEnableCourier] = useState(false);
  const [enableFlipper, setEnableFlipper] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');

  const loadFeatureFlags = async () => {
    setIsLoading(true);
    try {
      const flags = (await api.getFeatureFlags()) as FeatureFlags;
      setEnableDelivery(flags.enable_delivery ?? false);
      setEnableCourier(flags.enable_courier ?? false);
      setEnableFlipper(flags.enable_flipper ?? false);
      setMaintenanceMode(flags.maintenance_mode ?? false);
      setAppVersion(flags.app_version ?? '1.0.0');
    } catch (err) {
      alert('Failed to load settings: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFeatureFlags();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const updateFlag = async (key: string, value: boolean) => {
    try {
      await api.updateFeatureFlag(key, value ? 'true' : 'false');
      switch (key) {
        case 'enable_delivery':
          setEnableDelivery(value);
          break;
        case 'enable_courier':
          setEnableCourier(value);
          break;
        case 'enable_flipper':
          setEnableFlipper(value);
          break;
        case 'maintenance_mode':
          setMaintenanceMode(value);
          break;
      }
      alert(`${key} updated to ${value ? 'ON' : 'OFF'}`);
    } catch (err) {
      alert('Failed to update: ' + (err instanceof Error ? err.message : ''));
    }
  };

  if (isLoading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Admin Settings</h1>
        <button onClick={loadFeatureFlags} style={styles.iconBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      <div style={styles.scrollArea}>
        <h2 style={styles.sectionTitle}>Feature Flags</h2>
        <p style={styles.sectionSubtitle}>Enable or disable app features instantly</p>

        <div style={styles.card}>
          <ToggleSwitch
            label="Delivery"
            description={enableDelivery ? 'Users can request delivery' : 'Delivery is blocked (users see "Coming soon")'}
            checked={enableDelivery}
            onChange={(v) => updateFlag('enable_delivery', v)}
          />
          <div style={styles.divider} />

          <ToggleSwitch
            label="Courier Matching"
            description={enableCourier ? 'Couriers can accept jobs' : 'Courier system is disabled'}
            checked={enableCourier}
            onChange={(v) => updateFlag('enable_courier', v)}
          />
          <div style={styles.divider} />

          <ToggleSwitch
            label="Flipper"
            description={enableFlipper ? 'Users can resell items' : 'Flipper feature is disabled'}
            checked={enableFlipper}
            onChange={(v) => updateFlag('enable_flipper', v)}
          />
          <div style={styles.divider} />

          <ToggleSwitch
            label="Maintenance Mode"
            description={maintenanceMode ? 'App is in maintenance (only admins can access)' : 'App is fully operational'}
            checked={maintenanceMode}
            onChange={(v) => updateFlag('maintenance_mode', v)}
          />
        </div>

        {/* App Information */}
        <h2 style={styles.sectionTitle}>App Information</h2>
        <div style={styles.card}>
          <InfoRow label="Version" value={appVersion} />
          <InfoRow label="Environment" value="Production" />
          <InfoRow label="API Status" value="Online" />
          <InfoRow label="Last Updated" value={new Date().toLocaleString()} />
        </div>

        {/* Danger Zone */}
        <h2 style={{ ...styles.sectionTitle, color: '#F44336' }}>Danger Zone</h2>
        <div style={{ ...styles.card, border: '1px solid #FFCDD2' }}>
          <div style={styles.settingRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.settingTitle}>Clear All Cache</div>
              <div style={{ color: '#888', fontSize: 13 }}>Clears all cached data</div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all cache? This will log out all users.')) {
                  alert('Cache cleared (simulated)');
                }
              }}
              style={{ ...styles.dangerBtn, color: '#FF9800', border: '1px solid #FF9800' }}
            >
              Clear
            </button>
          </div>
          <div style={styles.divider} />

          <div style={styles.settingRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.settingTitle}>Log Out All Users</div>
              <div style={{ color: '#888', fontSize: 13 }}>Force logs out all active sessions</div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to log out all users?')) {
                  alert('All users logged out (simulated)');
                }
              }}
              style={{ ...styles.dangerBtn, color: '#F44336', border: '1px solid #F44336' }}
            >
              Log Out All
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Reusable InfoRow ─────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F8FAFC' },
  spinner: { width: 36, height: 36, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#fff', borderBottom: '1px solid #eee' },
  pageTitle: { fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '24px' },
  sectionTitle: { fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 },
  sectionSubtitle: { color: '#888', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  settingRow: { display: 'flex', alignItems: 'center', padding: '8px 0' },
  settingTitle: { fontWeight: 600, color: '#1A1A1A' },
  switch: { position: 'relative', width: 44, height: 24, display: 'inline-block' },
  slider: { position: 'absolute', inset: 0, borderRadius: 24, transition: 'background-color 0.3s' },
  knob: { position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff', transition: 'transform 0.3s' },
  divider: { height: 1, backgroundColor: '#eee', margin: '8px 0' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0' },
  infoLabel: { fontWeight: 500, color: '#888' },
  infoValue: { color: '#1A1A1A' },
  dangerBtn: { padding: '8px 16px', borderRadius: 8, background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
};