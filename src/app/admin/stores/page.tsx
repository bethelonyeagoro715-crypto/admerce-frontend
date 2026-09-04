'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdSearch,
  MdRefresh,
  MdCheckCircle,
  MdBlock,
  MdVisibility,
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
  MdErrorOutline,
  MdStore,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface StoreRecord {
  store_id: string;
  name?: string;
  owner_name?: string;
  owner_id?: string;
  category?: string;
  created_at?: string;
  verified?: number | boolean;
  status?: string;
  [key: string]: unknown;
}

function normalizeStores(data: unknown): StoreRecord[] {
  if (Array.isArray(data)) return data as StoreRecord[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.stores)) return obj.stores as StoreRecord[];
    if (Array.isArray(obj.data)) return obj.data as StoreRecord[];
    if (Array.isArray(obj.results)) return obj.results as StoreRecord[];
  }
  return [];
}

export default function AdminStoresPage() {
  const router = useRouter();

  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isMobile, setIsMobile] = useState(false);
  const limit = 20;

  const loadStores = async (page = 0, query = searchQuery, status = filterStatus) => {
    setCurrentPage(page);
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const offset = page * limit;
      const data = await api.adminGetStores(
        query.trim() ? query.trim() : undefined,
        status !== 'All' ? status : undefined,
        limit,
        offset
      );
      const list = normalizeStores(data);
      setStores(list);
    } catch (err) {
      setErrorMessage('Failed to load stores: ' + (err instanceof Error ? err.message : ''));
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStores(0, '', 'All');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const verifyStore = async (storeId: string) => {
    try {
      await api.adminVerifyStore(storeId);
      await loadStores(currentPage, searchQuery, filterStatus);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const toggleSuspend = async (storeId: string, currentlyVerified: boolean) => {
    try {
      if (currentlyVerified) {
        await api.adminSuspendStore(storeId);
      } else {
        await api.adminVerifyStore(storeId);
      }
      await loadStores(currentPage, searchQuery, filterStatus);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const nextPage = () => loadStores(currentPage + 1, searchQuery, filterStatus);
  const prevPage = () => {
    if (currentPage > 0) loadStores(currentPage - 1, searchQuery, filterStatus);
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

  const renderStoreRow = (store: StoreRecord) => {
    const isVerified = store.verified === 1 || store.verified === true;
    const isPending = !isVerified && store.status !== 'Suspended';
    const statusLabel = isVerified ? 'Active' : isPending ? 'Pending' : 'Suspended';
    const statusColor = isVerified ? '#4CAF50' : isPending ? '#FF9800' : '#F44336';
    const category = store.category || '—';
    const owner = store.owner_name || store.owner_id || 'Unknown';

    return (
      <div key={store.store_id} style={isMobile ? styles.mobileCard : styles.desktopRow}>
        {isMobile ? (
          /* Mobile card layout */
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div style={styles.avatarCircle}>
                {(store.name || 'S')[0].toUpperCase()}
              </div>
              <div style={{ marginLeft: 12, flex: 1 }}>
                <div style={styles.storeName}>{store.name || '—'}</div>
                <div style={styles.ownerText}>{owner}</div>
              </div>
              <span style={{ ...styles.statusBadge, backgroundColor: `${statusColor}20`, color: statusColor }}>
                {statusLabel}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={styles.smallLabel}>Category</div>
                <div>{category}</div>
              </div>
              <div>
                <div style={styles.smallLabel}>Created</div>
                <div>{formatDate(store.created_at)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
              {isPending && (
                <button onClick={() => verifyStore(store.store_id)} style={styles.actionBtn} title="Verify">
                  <MdCheckCircle size={20} color="#4CAF50" />
                </button>
              )}
              <button
                onClick={() => toggleSuspend(store.store_id, isVerified)}
                style={styles.actionBtn}
                title={isVerified ? 'Suspend' : 'Activate'}
              >
                {isVerified ? <MdBlock size={20} color="#F44336" /> : <MdCheckCircle size={20} color="#4CAF50" />}
              </button>
              <button onClick={() => alert('Store details coming soon')} style={styles.actionBtn} title="View">
                <MdVisibility size={20} color="#0504AA" />
              </button>
            </div>
          </>
        ) : (
          /* Desktop table row */
          <>
            <span style={{ flex: 2, fontWeight: 600 }}>{store.name || '—'}</span>
            <span style={{ flex: 2 }}>{owner}</span>
            <span style={{ flex: 1 }}>{category}</span>
            <span style={{ flex: 1 }}>{formatDate(store.created_at)}</span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <span style={{ ...styles.statusBadge, backgroundColor: `${statusColor}20`, color: statusColor }}>
                {statusLabel}
              </span>
            </span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}>
              {isPending && (
                <button onClick={() => verifyStore(store.store_id)} style={styles.actionBtn} title="Verify">
                  <MdCheckCircle size={20} color="#4CAF50" />
                </button>
              )}
              <button
                onClick={() => toggleSuspend(store.store_id, isVerified)}
                style={styles.actionBtn}
                title={isVerified ? 'Suspend' : 'Activate'}
              >
                {isVerified ? <MdBlock size={20} color="#F44336" /> : <MdCheckCircle size={20} color="#4CAF50" />}
              </button>
              <button onClick={() => alert('Store details coming soon')} style={styles.actionBtn} title="View">
                <MdVisibility size={20} color="#0504AA" />
              </button>
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Stores</h1>
        <button onClick={() => loadStores(0, searchQuery, filterStatus)} style={styles.iconBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.searchWrapper}>
          <MdSearch size={20} color="#888" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search stores..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              loadStores(0, e.target.value, filterStatus);
            }}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            loadStores(0, searchQuery, e.target.value);
          }}
          style={styles.statusSelect}
        >
          {['All', 'Active', 'Pending', 'Suspended'].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
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
            <button onClick={() => loadStores(0, searchQuery, filterStatus)} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        ) : stores.length === 0 ? (
          <div style={styles.center}>
            <MdStore size={48} color="#ccc" />
            <p>No stores found.</p>
          </div>
        ) : isMobile ? (
          <div style={styles.mobileList}>
            {stores.map(renderStoreRow)}
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            {/* Table Header */}
            <div style={styles.tableHeader}>
              <span style={{ flex: 2 }}>Store Name</span>
              <span style={{ flex: 2 }}>Owner</span>
              <span style={{ flex: 1 }}>Category</span>
              <span style={{ flex: 1 }}>Created</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Status</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Actions</span>
            </div>
            {stores.map(renderStoreRow)}
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
            disabled={stores.length < limit}
            style={styles.pageBtn}
          >
            Next
            <MdKeyboardArrowRight size={20} color={stores.length < limit ? '#ccc' : '#0504AA'} />
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
  filters: { display: 'flex', gap: 12, padding: '16px', backgroundColor: '#F8FAFC' },
  searchWrapper: { position: 'relative', flex: 3 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' },
  searchInput: { width: '100%', padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid #E0E0E0', fontSize: 14, outline: 'none', backgroundColor: '#fff' },
  statusSelect: { flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid #E0E0E0', fontSize: 14, outline: 'none', backgroundColor: '#fff' },
  content: { flex: 1, overflowY: 'auto', padding: '0 16px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' },
  spinner: { width: 36, height: 36, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  retryBtn: { marginTop: 16, padding: '8px 20px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  tableWrapper: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  tableHeader: { display: 'flex', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #eee' },
  desktopRow: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f5f5f5' },
  mobileCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  mobileList: { display: 'flex', flexDirection: 'column' },
  avatarCircle: { width: 36, height: 36, borderRadius: '50%', backgroundColor: '#7B61FF20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7B61FF' },
  storeName: { fontWeight: 600, color: '#1A1A1A' },
  ownerText: { fontSize: 12, color: '#888' },
  smallLabel: { fontSize: 10, color: '#999' },
  statusBadge: { display: 'inline-block', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, textAlign: 'center' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', gap: 8 },
  pageBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  pageInfo: { fontSize: 14, color: '#666' },
};