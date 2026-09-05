'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import api from '../../../services/api';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Service {
  id: string;
  title: string;
  price: string;
  image: string;
  video: string | null;
  description: string;
}

interface ProviderServiceResponse {
  service_id: string;
  title?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  video_url?: string | null;
  description?: string | null;
  business_name?: string | null;
  username?: string | null;
}

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

function ProviderServicesContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const providerId = params.id;
  const [providerName, setProviderName] = useState<string>(
    searchParams.get('name') || 'Service Provider'
  );
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = (await api.getProviderServicesByUserId(providerId)) as ProviderServiceResponse[];

        if (!searchParams.get('name') && data.length > 0) {
          const first = data[0];
          const name = first?.business_name || first?.username || 'Service Provider';
          setProviderName(name);
        }

        const list: Service[] = data.map((s: ProviderServiceResponse) => ({
          id: s.service_id,
          title: s.title ?? 'Service',
          price: s.price ? `₦${Number(s.price).toFixed(0)}` : '₦0',
          image: resolveImageUrl(s.image_url),
          video: s.video_url ? resolveImageUrl(s.video_url) : null,
          description: s.description ?? '',
        }));

        setServices(list);
      } catch (err) {
        console.error('Failed to load services:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [providerId, searchParams]);

  return (
    <main style={styles.container}>
      <div style={styles.appBar}>
        <button onClick={() => router.back()} style={styles.backBtn}>←</button>
        <h1 style={styles.title}>{providerName}</h1>
      </div>

      {loading ? (
        <div style={styles.center}>Loading services...</div>
      ) : services.length === 0 ? (
        <div style={styles.center}>No services offered yet.</div>
      ) : (
        <div style={styles.grid}>
          {services.map((service) => (
            <div
              key={service.id}
              style={styles.card}
              onClick={() => router.push(`/service-detail/${service.id}`)}
            >
              <div style={styles.mediaWrap}>
                {service.video ? (
                  <video
                    src={service.video}
                    poster={service.image || undefined}
                    controls
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : service.image ? (
                  <img
                    src={service.image}
                    alt={service.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: 32, color: '#999' }}>🛠️</span>
                )}
                {service.video && <div style={styles.playIcon}>▶️</div>}
              </div>

              <div style={styles.info}>
                <div style={styles.serviceTitle}>{service.title}</div>
                <div style={styles.price}>{service.price}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function ProviderServicesPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>}>
      <ProviderServicesContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' },
  appBar: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10 },
  backBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', marginRight: 12, color: '#333' },
  title: { fontSize: 20, fontWeight: 'bold', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  center: { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#888' },
  grid: { flex: 1, overflowY: 'auto', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' },
  card: { backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 4px 8px rgba(0,0,0,0.06)', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
  mediaWrap: { height: 140, backgroundColor: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  playIcon: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', pointerEvents: 'none' },
  info: { padding: '8px' },
  serviceTitle: { fontWeight: 'bold', fontSize: 14, lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};