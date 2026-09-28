'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { SettingsShell } from '../../../../../components/settings/SettingsUI';
import {
  MdSearch,
  MdOpenInNew,
  MdCode,
  MdDescription,
} from 'react-icons/md';

interface License {
  name: string;
  version: string;
  license: string;
  url: string;
}

const LICENSES: License[] = [
  // Runtime / framework
  { name: 'React', version: '19.x', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'React DOM', version: '19.x', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Next.js', version: '16.3', license: 'MIT', url: 'https://github.com/vercel/next.js' },
  { name: 'TypeScript', version: '5.x', license: 'Apache-2.0', url: 'https://github.com/microsoft/TypeScript' },

  // UI / styling
  { name: 'Tailwind CSS', version: '3.x', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'react-icons', version: '5.x', license: 'MIT', url: 'https://github.com/react-icons/react-icons' },
  { name: 'framer-motion', version: '11.x', license: 'MIT', url: 'https://github.com/framer/motion' },
  { name: '@fontsource-variable/google-sans-flex', version: '5.x', license: 'OFL-1.1', url: 'https://github.com/fontsource/fontsource' },

  // Maps
  { name: 'Leaflet', version: '1.9.x', license: 'BSD-2-Clause', url: 'https://github.com/Leaflet/Leaflet' },
  { name: 'leaflet.markercluster', version: '1.5.x', license: 'MIT', url: 'https://github.com/Leaflet/Leaflet.markercluster' },

  // Forms / validation
  { name: 'libphonenumber-js', version: '1.11.x', license: 'MIT', url: 'https://gitlab.com/catamphetamine/libphonenumber-js' },
  { name: 'country-flag-icons', version: '1.x', license: 'MIT', url: 'https://gitlab.com/catamphetamine/country-flag-icons' },

  // Networking / data
  { name: 'Axios', version: '1.7.x', license: 'MIT', url: 'https://github.com/axios/axios' },
  { name: 'Firebase JS SDK', version: '10.x', license: 'Apache-2.0', url: 'https://github.com/firebase/firebase-js-sdk' },

  // Payments
  { name: 'Paystack Inline', version: '2.x', license: 'MIT', url: 'https://github.com/PaystackHQ/paystack-inline-js' },

  // Media / effects
  { name: 'canvas-confetti', version: '1.9.x', license: 'ISC', url: 'https://github.com/catdad/canvas-confetti' },

  // Build tooling
  { name: 'sharp', version: '0.33.x', license: 'Apache-2.0', url: 'https://github.com/lovell/sharp' },
  { name: 'png-to-ico', version: '2.x', license: 'MIT', url: 'https://github.com/steambap/png-to-ico' },
  { name: 'ESLint', version: '9.x', license: 'MIT', url: 'https://github.com/eslint/eslint' },
  { name: 'PostCSS', version: '8.x', license: 'MIT', url: 'https://github.com/postcss/postcss' },
];

export default function LicensesPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [search, setSearch] = useState('');

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}`);
    }
  };

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? LICENSES.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.license.toLowerCase().includes(q),
        )
      : LICENSES;
    const map = new Map<string, License[]>();
    filtered.forEach((l) => {
      const arr = map.get(l.license) || [];
      arr.push(l);
      map.set(l.license, arr);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([license, items]) => ({
        license,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [search]);

  const openUrl = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const totalShown = grouped.reduce((n, g) => n + g.items.length, 0);

  return (
    <SettingsShell title="Open-source licenses" onBack={goBack}>
      <style>{`
        .lc-row:active { background-color: #F8FAFF; }
      `}</style>

      {/* Hero */}
      <div style={css.hero}>
        <div style={css.heroIcon}>
          <MdCode size={28} color="#0504AA" />
        </div>
        <div style={css.heroTitle}>Built with open source</div>
        <div style={css.heroSub}>
          Admerce is powered by {LICENSES.length} open-source projects. Thank
          you to the maintainers and communities who make this possible.
        </div>
      </div>

      {/* Search */}
      <div style={css.searchWrap}>
        <MdSearch size={18} color="#94A3B8" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search packages or licenses"
          style={css.searchInput}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={css.clearBtn}
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>

      {search && (
        <p style={css.resultCount}>
          {totalShown} {totalShown === 1 ? 'package' : 'packages'} match
        </p>
      )}

      {grouped.length === 0 ? (
        <div style={css.empty}>
          <p style={css.emptyTitle}>No matching packages</p>
          <p style={css.emptyBody}>Try another search term.</p>
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.license} style={css.group}>
            <div style={css.groupHead}>
              <MdDescription size={16} color="#0504AA" />
              <span style={css.groupLabel}>{g.license}</span>
              <span style={css.groupCount}>{g.items.length}</span>
            </div>
            <div style={css.groupList}>
              {g.items.map((l) => (
                <button
                  key={l.name}
                  onClick={() => openUrl(l.url)}
                  className="lc-row"
                  style={css.row}
                >
                  <span style={css.rowBody}>
                    <span style={css.rowName}>{l.name}</span>
                    <span style={css.rowVersion}>v{l.version}</span>
                  </span>
                  <MdOpenInNew size={16} color="#CBD5E1" />
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <p style={css.footnote}>
        Full license texts are available at the linked repositories. This list
        covers direct production dependencies; transitive dependencies inherit
        their parent licenses.
      </p>
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '16px 16px 8px',
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 1.55,
    maxWidth: 340,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    border: '1px solid #EAECF3',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14.5,
    fontFamily: 'inherit',
    color: '#0B0B1A',
    backgroundColor: 'transparent',
    fontWeight: 500,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: '#94A3B8',
    cursor: 'pointer',
    padding: '0 6px',
    lineHeight: 1,
  },
  resultCount: {
    fontSize: 12.5,
    color: '#64748B',
    margin: '-8px 4px -4px',
    fontWeight: 600,
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0B0B1A',
    margin: 0,
  },
  emptyBody: {
    fontSize: 13,
    color: '#64748B',
    margin: '6px 0 0',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  groupHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 4px',
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: '#0504AA',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  groupCount: {
    fontSize: 11,
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    padding: '2px 7px',
    borderRadius: 999,
    fontWeight: 700,
  },
  groupList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '13px 16px',
    border: 'none',
    borderBottom: '1px solid #F1F5F9',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  rowBody: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14.5,
    fontWeight: 600,
    color: '#0B0B1A',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowVersion: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    flexShrink: 0,
  },
  footnote: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 1.6,
    margin: '12px 4px 0',
  },
};