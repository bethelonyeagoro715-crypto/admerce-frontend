'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { MdMyLocation } from 'react-icons/md';

// ─── Type imports for Leaflet ──────────────────────────────────────
import type { Map } from 'leaflet';
type LeafletModule = typeof import('leaflet');

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────
interface StoreLocation {
  store_id: string;
  store_name?: string;
  lat: number;
  lng: number;
  image_url?: string;
}

const DEFAULT_LAT = 5.5103;
const DEFAULT_LNG = 7.0265;

export default function ShopperMapPage() {
  const router = useRouter();
  const mapRef = useRef<Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [leaflet, setLeaflet] = useState<LeafletModule | null>(null);

  // ─── Load Leaflet dynamically ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      import('leaflet/dist/leaflet.css');
      setLeaflet(L);
    });
  }, []);

  // ─── Initialize map when Leaflet is ready ────────────────────────
  useEffect(() => {
    if (!leaflet || !mapContainerRef.current) return;

    const L = leaflet;

    // Clean up any previous map instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_LAT, DEFAULT_LNG],
      zoom: 14,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    // Tile layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // ── User location ─────────────────────────────────────────────
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation([lat, lng]);

          const userIcon = L.divIcon({
            html: '<div style="width:12px;height:12px;background:#0504AA;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.3);"></div>',
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          L.marker([lat, lng], { icon: userIcon }).addTo(map).bindPopup('You are here');
          map.setView([lat, lng], 14);
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
        },
        { timeout: 10000 }
      );
    }

    // ── Load stores ────────────────────────────────────────────────
    const loadStores = async () => {
      try {
        const data = (await api.getStoreLocations()) as unknown as StoreLocation[];

        data.forEach((store) => {
          if (!store.lat || !store.lng) return;

          const storeIcon = L.divIcon({
            html: '<div style="width:24px;height:24px;color:#FF0000;display:flex;align-items:center;justify-content:center;font-size:18px;">🏪</div>',
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const marker = L.marker([store.lat, store.lng], { icon: storeIcon }).addTo(map);
          marker.bindPopup(`<b>${store.store_name || 'Store'}</b>`);
          marker.on('click', () => {
            router.push(`/store-detail/${store.store_id}`);
          });
        });
      } catch (error) {
        console.error('Failed to load stores:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStores();

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leaflet, router]);

  return (
    <main style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            background: 'white',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              border: '2px solid #ccc',
              borderTopColor: '#0504AA',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Loading map...
        </div>
      )}

      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

      {userLocation && (
        <button
          onClick={() => {
            if (mapRef.current && userLocation) {
              mapRef.current.setView(userLocation, 14);
            }
          }}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            background: '#0504AA',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
          title="Re-center"
        >
          <MdMyLocation size={20} />
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}