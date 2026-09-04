'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdSearch,
  MdRefresh,
  MdDeleteOutline,
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
  MdErrorOutline,
  MdSwapHoriz,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface AdminFlipper {
  id: string;
  nickname?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  [key: string]: unknown;
}

// ─── Normalization helper ──────────────────────────────────────────
function normalizeFlippers(data: unknown): AdminFlipper[] {
  if (Array.isArray(data)) return data as AdminFlipper[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.flippers)) return obj.flippers as AdminFlipper[];
    if (Array.isArray(obj.data)) return obj.data as AdminFlipper[];
    if (Array.isArray(obj.results)) return obj.results as AdminFlipper[];
  }
  return [];
}

export default function AdminFlippersPage() {
  const router = useRouter();

  const [flippers, setFlippers] = useState<AdminFlipper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 20;

  const loadFlippers = async (page = 0, query = searchQuery) => {
    setCurrentPage(page);
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const offset = page * limit;
      const data = await api.adminGetFlippers(
        query.trim() ? query.trim() : undefined,
        limit,
        offset
      );
      const list = normalizeFlippers(data);
      setFlippers(list);
    } catch (err) {
      setErrorMessage('Failed to load flippers: ' + (err instanceof Error ? err.message : ''));
      setFlippers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFlippers(0, '');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const deleteFlipper = async (userId: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.adminDeleteFlipper(userId);
      await loadFlippers(currentPage, searchQuery);
    } catch (err) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const nextPage = () => loadFlippers(currentPage + 1, searchQuery);
  const prevPage = () => {
    if (currentPage > 0) loadFlippers(currentPage - 1, searchQuery);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Flippers</h1>
        <button onClick={() => loadFlippers(0, searchQuery)} style={styles.iconBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.searchWrapper}>
          <MdSearch size={20} color="#888" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search flippers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              loadFlippers(0, e.target.value);
            }}
            style={styles.searchInput}
          />
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : errorMessage ? (
          <div style={styles.center}>
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p>{errorMessage}</p>
            <button onClick={() => loadFlippers(0, searchQuery)} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        ) : flippers.length === 0 ? (
          <div style={styles.center}>
            <MdSwapHoriz size={48} color="#ccc" />
            <p>No flippers found.</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            {/* Table Header */}
            <div style={styles.tableHeader}>
              <span style={{ flex: 2 }}>Name</span>
              <span style={{ flex: 1 }}>Phone</span>
              <span style={{ flex: 2 }}>Email</span>
              <span style={{ flex: 1 }}>Joined</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Action</span>
            </div>

            {/* Rows */}
            {flippers.map((flipper) => (
              <div key={flipper.id} style={styles.row}>
                <span style={{ flex: 2, fontWeight: 600, color: '#1A1A1A' }}>
                  {flipper.nickname || flipper.phone || '—'}
                </span>
                <span style={{ flex: 1 }}>{flipper.phone || '—'}</span>
                <span style={{ flex: 2 }}>{flipper.email || '—'}</span>
                <span style={{ flex: 1 }}>{formatDate(flipper.created_at)}</span>
                <span style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => deleteFlipper(flipper.id, flipper.nickname || flipper.phone || '')}
                    style={styles.deleteBtn}
                    title="Delete"
                  >
                    <MdDeleteOutline size={20} color="#FF0000" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !errorMessage && (
        <div style={styles.pagination}>
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            style={styles.pageBtn}
          >
            <MdKeyboardArrowLeft size={20} color={currentPage === 0 ? '#ccc' : '#0504AA'} />
            Previous
          </button>
          <span style={styles.pageInfo}>Page {currentPage + 1}</span>
          <button
            onClick={nextPage}
            disabled={flippers.length < limit}
            style={styles.pageBtn}
          >
            Next
            <MdKeyboardArrowRight size={20} color={flippers.length < limit ? '#ccc' : '#0504AA'} />
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#fff', borderBottom: '1px solid #eee' },
  pageTitle: { fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  filters: { padding: '16px', backgroundColor: '#F8FAFC' },
  searchWrapper: { position: 'relative' },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' },
  searchInput: { width: '100%', padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid #E0E0E0', fontSize: 14, outline: 'none', backgroundColor: '#fff' },
  content: { flex: 1, overflowY: 'auto', padding: '0 16px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' },
  spinner: { width: 36, height: 36, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  retryBtn: { marginTop: 16, padding: '8px 20px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  tableWrapper: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  tableHeader: { display: 'flex', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #eee' },
  row: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f5f5f5' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', gap: 8 },
  pageBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  pageInfo: { fontSize: 14, color: '#666' },
};