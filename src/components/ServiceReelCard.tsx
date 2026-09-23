'use client';

import { useEffect, useRef, useState } from 'react';
import { MdVolumeOff, MdVolumeUp } from 'react-icons/md';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '';

function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^blob:/i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  const base = API_BASE.replace(/\/+$/, '');
  if (trimmed.startsWith('/')) return base ? `${base}${trimmed}` : trimmed;
  return base ? `${base}/${trimmed}` : trimmed;
}

export interface ServiceReel {
  id: string;
  title: string;
  price: string;
  videoUrl: string | null;
  imageUrl: string | null;
  providerName?: string;
}

/**
 * Reel-style 9:16 service card.
 * - Autoplays muted + looped when >60% visible in viewport.
 * - Pauses when scrolled out, or when the tab is hidden.
 * - Falls back to a cropped image, then to an initial-letter tile.
 */
export default function ServiceReelCard({
  service,
  onOpen,
}: {
  service: ServiceReel;
  onOpen: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [play, setPlay] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mediaError, setMediaError] = useState(false);

  const videoSrc = resolveMediaUrl(service.videoUrl);
  const imageSrc = resolveMediaUrl(service.imageUrl);
  const hasVideo = Boolean(videoSrc);

  // ✅ Play only when the card is at least 60% on screen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasVideo) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const visible = entry.isIntersecting && entry.intersectionRatio > 0.6;
          setPlay(visible);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasVideo]);

  // ✅ Drive the video element from React state.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (play) {
      v.play().catch(() => setPlay(false));
    } else {
      v.pause();
    }
  }, [play]);

  // ✅ Sync muted state imperatively (React's muted attribute is unreliable).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  // ✅ Pause on tab hide; resume only if the card is still active.
  useEffect(() => {
    const onVisibility = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) {
        v.pause();
      } else if (play) {
        v.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [play]);

  return (
    <article
      ref={containerRef}
      className="src-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${service.title}`}
      onClick={() => onOpen(service.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(service.id);
        }
      }}
    >
      {hasVideo && !mediaError ? (
        <video
          ref={videoRef}
          className="src-video"
          src={videoSrc}
          poster={imageSrc || undefined}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onError={() => setMediaError(true)}
        />
      ) : imageSrc && !mediaError ? (
        // ✅ Image fallback for legacy image-only services.
        <img
          className="src-video"
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setMediaError(true)}
        />
      ) : (
        <div className="src-fallback" aria-hidden="true">
          <span>{service.title.slice(0, 1).toUpperCase()}</span>
        </div>
      )}

      {hasVideo && !mediaError && (
        <button
          type="button"
          className="src-mute"
          onClick={(e) => {
            e.stopPropagation();
            setMuted((m) => !m);
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MdVolumeOff size={16} /> : <MdVolumeUp size={16} />}
        </button>
      )}

      <div className="src-overlay">
        {service.providerName ? (
          <p className="src-provider">{service.providerName}</p>
        ) : null}
        <h3 className="src-title">{service.title}</h3>
        <p className="src-price">{service.price}</p>
      </div>

      <style>{`
        .src-card {
          position: relative;
          width: 100%;
          aspect-ratio: 9 / 16;
          border-radius: 16px;
          overflow: hidden;
          background: #0d0d10;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(16, 17, 20, 0.08);
          transition: transform 180ms ease, box-shadow 180ms ease;
        }
        .src-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 32px rgba(16, 17, 20, 0.12);
        }
        .src-card:focus-visible {
          outline: 3px solid rgba(5, 4, 170, 0.24);
          outline-offset: 2px;
        }
        .src-video {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .src-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1a1a2e, #2a2a4a);
          color: #fff;
          font-size: 64px;
          font-weight: 800;
          opacity: 0.55;
        }
        .src-mute {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          border: 0;
          background: rgba(12, 12, 17, 0.55);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(6px);
          z-index: 2;
        }
        .src-overlay {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 14px 12px 12px;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.82) 0%,
            rgba(0, 0, 0, 0.35) 55%,
            transparent 100%
          );
          color: #fff;
          pointer-events: none;
        }
        .src-provider {
          margin: 0 0 4px;
          font-size: 11px;
          font-weight: 600;
          opacity: 0.85;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .src-title {
          margin: 0;
          font-size: 14px;
          font-weight: 750;
          line-height: 1.28;
          letter-spacing: -0.01em;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }
        .src-price {
          margin: 6px 0 0;
          font-size: 13px;
          font-weight: 800;
          color: #C7CBFF;
        }
        @media (prefers-reduced-motion: reduce) {
          .src-card { transition: none; }
        }
      `}</style>
    </article>
  );
}