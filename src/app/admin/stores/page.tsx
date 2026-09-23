'use client';

import { useState, useReducer, useEffect, useRef, useCallback } from 'react';
import api from '../../../services/api';
import {
  MdSearch,
  MdRefresh,
  MdErrorOutline,
  MdStore,
  MdBlock,
  MdCheckCircle,
  MdClose,
  MdMoreVert,
  MdLocationOn,
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
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
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

type StoreState = 'active' | 'pending' | 'suspended';

function storeState(store: StoreRecord): StoreState {
  const verified = store.verified === 1 || store.verified === true;
  if (verified) return 'active';
  if (store.status === 'Suspended') return 'suspended';
  return 'pending';
}

const STATUS_META: Record<StoreState, { label: string; color: string; soft: string }> = {
  active: { label: 'Active', color: '#16A34A', soft: '#DCFCE7' },
  pending: { label: 'Pending', color: '#D97706', soft: '#FEF3C7' },
  suspended: { label: 'Suspended', color: '#DC2626', soft: '#FEE2E2' },
};

// ─── Reducer ────────────────────────────────────────────────────────
interface FetchState {
  stores: StoreRecord[];
  isLoading: boolean;
  errorMessage: string | null;
  currentPage: number;
}

type FetchAction =
  | { type: 'FETCH_START'; page: number }
  | { type: 'FETCH_SUCCESS'; stores: StoreRecord[] }
  | { type: 'FETCH_ERROR'; message: string };

const initialState: FetchState = {
  stores: [],
  isLoading: true,
  errorMessage: null,
  currentPage: 0,
};

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, errorMessage: null, currentPage: action.page };
    case 'FETCH_SUCCESS':
      return { ...state, isLoading: false, stores: action.stores };
    case 'FETCH_ERROR':
      return { ...state, isLoading: false, stores: [], errorMessage: action.message };
  }
}

function normalizeStores(data: unknown): StoreRecord[] {
  if (Array.isArray(data)) return data as StoreRecord[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['stores', 'data', 'results', 'items', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as StoreRecord[];
    }
  }
  return [];
}

// ─── Display helpers ─────────────────────────────────────────────────
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ─── Confirm dialog ─────────────────────────────────────────────────
type ConfirmKind = 'verify' | 'suspend';
interface ConfirmState {
  kind: ConfirmKind;
  store: StoreRecord;
}

// ─── Component ──────────────────────────────────────────────────────
export default function AdminStoresPage() {
  const [{ stores, isLoading, errorMessage, currentPage }, dispatch] = useReducer(
    fetchReducer,
    initialState,
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | StoreState>('All');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 20;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const loadStores = useCallback(
    async (page: number, query: string, status: string) => {
      dispatch({ type: 'FETCH_START', page });
      try {
        const offset = page * limit;
        // Map the frontend status to the backend's binary filter.
        const backendStatus =
          status === 'All'
            ? undefined
            : status === 'active'
            ? 'Active'
            : 'Inactive';

        const data = await api.adminGetStores(
          query.trim() || undefined,
          backendStatus,
          limit,
          offset,
        );
        dispatch({ type: 'FETCH_SUCCESS', stores: normalizeStores(data) });
      } catch (err) {
        dispatch({
          type: 'FETCH_ERROR',
          message: 'Failed to load stores: ' + (err instanceof Error ? err.message : ''),
        });
      }
    },
    [],
  );

  useEffect(() => {
    loadStores(0, '', 'All');
  }, [loadStores]);

  // ✅ Close the kebab menu when the list changes.
  //    Wrapped in setTimeout to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    const t = setTimeout(() => {
      setOpenMenuFor(null);
    }, 0);
    return () => clearTimeout(t);
  }, [stores]);

  // ── Search with debounce ────────────────────────────────────────
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadStores(0, val, filterStatus);
    }, 400);
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    loadStores(0, '', filterStatus);
  };

  const pickStatusChip = (value: 'All' | StoreState) => {
    setFilterStatus(value);
    loadStores(0, searchQuery, value);
  };

  const nextPage = () => loadStores(currentPage + 1, searchQuery, filterStatus);
  const prevPage = () => {
    if (currentPage > 0) loadStores(currentPage - 1, searchQuery, filterStatus);
  };

  // ── Actions ────────────────────────────────────────────────────
  const promptVerify = (store: StoreRecord) => {
    setOpenMenuFor(null);
    setConfirm({ kind: 'verify', store });
  };
  const promptSuspend = (store: StoreRecord) => {
    setOpenMenuFor(null);
    setConfirm({ kind: 'suspend', store });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, store } = confirm;
    setIsActing(true);
    try {
      if (kind === 'verify') {
        await api.adminVerifyStore(store.store_id);
        showToast('Store verified');
      } else {
        await api.adminSuspendStore(store.store_id);
        showToast('Store suspended');
      }
      setConfirm(null);
      await loadStores(currentPage, searchQuery, filterStatus);
    } catch (err) {
      alert('Action failed: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsActing(false);
    }
  };

  const openMap = (store: StoreRecord) => {
    setOpenMenuFor(null);
    if (store.lat == null || store.lng == null) return;
    window.open(
      `https://www.google.com/maps?q=${store.lat},${store.lng}`,
      '_blank',
      'noopener',
    );
  };

  // ── Derived ────────────────────────────────────────────────────
  const hasActiveFilters = searchQuery.trim().length > 0 || filterStatus !== 'All';
  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterStatus('All');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    loadStores(0, '', 'All');
  };

  const displayName = (s: StoreRecord) => s.name || s.owner_name || s.store_id.slice(0, 8);
  const ownerLabel = (s: StoreRecord) => s.owner_name || s.owner_id?.slice(0, 8) || '—';

  const activeCount = stores.filter((s) => storeState(s) === 'active').length;
  const pendingCount = stores.filter((s) => storeState(s) === 'pending').length;

  const CHIPS: { value: 'All' | StoreState; label: string }[] = [
    { value: 'All', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'suspended', label: 'Suspended' },
  ];

  return (
    <main className="sd-root">
      <style>{CSS}</style>

      {/* Hero */}
      <header className="sd-hero">
        <div className="sd-heroText">
          <h1 className="sd-title">Stores</h1>
          <p className="sd-subtitle">
            Every store on Admerce. Verify, suspend, or check location.
          </p>
        </div>
        <button
          className="sd-refresh"
          onClick={() => loadStores(currentPage, searchQuery, filterStatus)}
          aria-label="Refresh"
          title="Refresh"
        >
          <MdRefresh size={20} color="#0504AA" />
        </button>
      </header>

      {/* Stats strip */}
      <section className="sd-stats" aria-label="Page summary">
        <div className="sd-statCard">
          <span className="sd-statValue">{stores.length}</span>
          <span className="sd-statLabel">On this page</span>
        </div>
        <div className="sd-statCard">
          <span className="sd-statValue" style={{ color: '#16A34A' }}>
            {activeCount}
          </span>
          <span className="sd-statLabel">Active</span>
        </div>
        <div className="sd-statCard">
          <span className="sd-statValue" style={{ color: '#D97706' }}>
            {pendingCount}
          </span>
          <span className="sd-statLabel">Pending</span>
        </div>
      </section>

      {/* Status chips */}
      <nav className="sd-chips" aria-label="Filter by status">
        {CHIPS.map((c) => {
          const active = filterStatus === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => pickStatusChip(c.value)}
              className={active ? 'sd-chip sd-chipActive' : 'sd-chip'}
              aria-pressed={active}
            >
              {c.label}
            </button>
          );
        })}
      </nav>

      {/* Search */}
      <div className="sd-searchWrap">
        <MdSearch size={20} color="#8A8F99" className="sd-searchIcon" />
        <input
          type="text"
          placeholder="Search by store or owner name"
          value={searchQuery}
          onChange={handleSearchChange}
          className="sd-searchInput"
          aria-label="Search stores"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            className="sd-searchClear"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            <MdClose size={16} color="#666" />
          </button>
        )}
      </div>

      {/* Content */}
      <section className="sd-content">
        {isLoading ? (
          <div className="sd-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="sd-card sd-cardSkeleton">
                <div className="sd-skel sd-skelAvatar" />
                <div className="sd-skel sd-skelLine" />
                <div className="sd-skel sd-skelLineShort" />
                <div className="sd-skel sd-skelLineShort" />
              </div>
            ))}
          </div>
        ) : errorMessage ? (
          <div className="sd-center">
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p className="sd-centerText">{errorMessage}</p>
            <button
              onClick={() => loadStores(0, searchQuery, filterStatus)}
              className="sd-primaryBtn"
            >
              Retry
            </button>
          </div>
        ) : stores.length === 0 ? (
          <div className="sd-center">
            <MdStore size={48} color="#cbd5e1" />
            <p className="sd-centerTitle">
              {hasActiveFilters ? 'No matches' : 'No stores yet'}
            </p>
            <p className="sd-centerText">
              {hasActiveFilters
                ? 'Try a different search or pick another status.'
                : 'Stores will appear here as storekeepers create them.'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="sd-primaryBtn">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="sd-grid">
            {stores.map((store) => {
              const state = storeState(store);
              const meta = STATUS_META[state];
              const name = displayName(store);
              const menuOpen = openMenuFor === store.store_id;
              const canOpenMap = store.lat != null && store.lng != null;

              return (
                <article key={store.store_id} className="sd-card">
                  {/* Kebab */}
                  <div
                    className="sd-kebabWrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="sd-kebab"
                      onClick={() =>
                        setOpenMenuFor(menuOpen ? null : store.store_id)
                      }
                      aria-label="More actions"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                    >
                      <MdMoreVert size={20} color="#64748B" />
                    </button>
                    {menuOpen && (
                      <>
                        <div
                          className="sd-menuBackdrop"
                          onClick={() => setOpenMenuFor(null)}
                        />
                        <div className="sd-menu" role="menu">
                          {state === 'active' ? (
                            <button
                              type="button"
                              className="sd-menuItem"
                              role="menuitem"
                              onClick={() => promptSuspend(store)}
                            >
                              <MdBlock size={16} color="#EA580C" />
                              <span>Suspend store</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="sd-menuItem"
                              role="menuitem"
                              onClick={() => promptVerify(store)}
                            >
                              <MdCheckCircle size={16} color="#16A34A" />
                              <span>Verify store</span>
                            </button>
                          )}
                          {canOpenMap && (
                            <button
                              type="button"
                              className="sd-menuItem"
                              role="menuitem"
                              onClick={() => openMap(store)}
                            >
                              <MdLocationOn size={16} color="#0504AA" />
                              <span>View on map</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Status-ringed avatar */}
                  <div
                    className="sd-avatarRing"
                    style={{ backgroundColor: meta.soft }}
                  >
                    <div
                      className="sd-avatar"
                      style={{ backgroundColor: meta.color }}
                    >
                      {initialsOf(name)}
                    </div>
                  </div>

                  {/* Identity */}
                  <h3 className="sd-name" title={name}>
                    {name}
                  </h3>
                  <p className="sd-line" title={ownerLabel(store)}>
                    {ownerLabel(store)}
                  </p>

                  {/* Meta row */}
                  <div className="sd-meta">
                    {store.category && (
                      <span className="sd-catPill">{store.category}</span>
                    )}
                    <span className="sd-status">
                      <span
                        className="sd-statusDot"
                        style={{ backgroundColor: meta.color }}
                      />
                      {meta.label}
                    </span>
                  </div>

                  <div className="sd-joined">
                    Added {formatDate(store.created_at)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Pagination */}
      {!isLoading && !errorMessage && stores.length > 0 && (
        <footer className="sd-pagination">
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className="sd-pageBtn"
            aria-label="Previous page"
          >
            <MdKeyboardArrowLeft
              size={20}
              color={currentPage === 0 ? '#cbd5e1' : '#0504AA'}
            />
            <span>Previous</span>
          </button>
          <span className="sd-pageInfo">Page {currentPage + 1}</span>
          <button
            onClick={nextPage}
            disabled={stores.length < limit}
            className="sd-pageBtn"
            aria-label="Next page"
          >
            <span>Next</span>
            <MdKeyboardArrowRight
              size={20}
              color={stores.length < limit ? '#cbd5e1' : '#0504AA'}
            />
          </button>
        </footer>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div
          className="sd-modalOverlay"
          onClick={() => (isActing ? undefined : setConfirm(null))}
        >
          <div className="sd-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="sd-modalTitle">
              {confirm.kind === 'verify' ? 'Verify store?' : 'Suspend store?'}
            </h3>
            <p className="sd-modalBody">
              {confirm.kind === 'verify' && (
                <>
                  <strong>{displayName(confirm.store)}</strong> will become active
                  and visible to shoppers. You can suspend it at any time.
                </>
              )}
              {confirm.kind === 'suspend' && (
                <>
                  <strong>{displayName(confirm.store)}</strong> will be hidden from
                  shoppers and its listings will not appear in the feed.
                </>
              )}
            </p>
            <div className="sd-modalActions">
              <button
                type="button"
                className="sd-modalCancel"
                onClick={() => setConfirm(null)}
                disabled={isActing}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  confirm.kind === 'suspend'
                    ? 'sd-modalConfirm sd-modalConfirmDanger'
                    : 'sd-modalConfirm'
                }
                onClick={runConfirm}
                disabled={isActing}
              >
                {isActing
                  ? 'Working…'
                  : confirm.kind === 'verify'
                  ? 'Verify'
                  : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="sd-toast">
          <MdCheckCircle size={16} color="#fff" />
          <span>{toast}</span>
        </div>
      )}
    </main>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes sd-fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sd-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes sd-toastIn {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  .sd-root {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: #F4F5FB;
  }

  /* Hero */
  .sd-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 26px 22px 12px;
  }
  .sd-heroText { min-width: 0; }
  .sd-title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #0B0B1A;
    margin: 0;
    line-height: 1.1;
  }
  .sd-subtitle {
    font-size: 14px;
    color: #6B7280;
    margin: 6px 0 0;
    line-height: 1.4;
  }
  .sd-refresh {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: 1px solid #E5E7EF;
    background: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
  }
  .sd-refresh:hover { background: #EEF0FF; border-color: #C9CBFF; }

  /* Stats */
  .sd-stats {
    display: flex;
    gap: 10px;
    padding: 0 22px 18px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .sd-stats::-webkit-scrollbar { display: none; }
  .sd-statCard {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    min-width: 110px;
    padding: 12px 16px;
    background: #fff;
    border: 1px solid #E8EAF0;
    border-radius: 14px;
  }
  .sd-statValue {
    font-size: 22px;
    font-weight: 800;
    color: #0B0B1A;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  .sd-statLabel {
    font-size: 11.5px;
    color: #6B7280;
    margin-top: 3px;
    font-weight: 600;
  }

  /* Chips */
  .sd-chips {
    display: flex;
    gap: 8px;
    padding: 0 22px 14px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .sd-chips::-webkit-scrollbar { display: none; }
  .sd-chip {
    flex: 0 0 auto;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid #E5E7EF;
    background: #fff;
    color: #475569;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .sd-chip:hover { border-color: #C9CBFF; color: #0504AA; }
  .sd-chipActive {
    background: #0504AA;
    color: #fff;
    border-color: #0504AA;
  }
  .sd-chipActive:hover { background: #0504AA; color: #fff; }

  /* Search */
  .sd-searchWrap {
    position: relative;
    margin: 0 22px 18px;
  }
  .sd-searchIcon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .sd-searchInput {
    width: 100%;
    box-sizing: border-box;
    padding: 13px 40px 13px 42px;
    border-radius: 14px;
    border: 1px solid #E5E7EF;
    font-size: 14.5px;
    outline: none;
    background: #fff;
    color: #1A1A1A;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .sd-searchInput:focus {
    border-color: #0504AA;
    box-shadow: 0 0 0 3px rgba(5, 4, 170, 0.10);
  }
  .sd-searchClear {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 26px;
    height: 26px;
    border: none;
    background: #F0F0F0;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .sd-searchClear:hover { background: #E0E0E0; }

  /* Content + Grid */
  .sd-content { flex: 1; padding: 0 22px 24px; }

  .sd-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 640px) {
    .sd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  }
  @media (min-width: 1024px) {
    .sd-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (min-width: 1440px) {
    .sd-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }

  /* Card */
  .sd-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 18px;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 18px;
    transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
    text-align: left;
  }
  .sd-card:hover {
    border-color: #C9CBFF;
    box-shadow: 0 12px 30px rgba(5, 4, 170, 0.08);
    transform: translateY(-2px);
  }
  .sd-cardSkeleton { pointer-events: none; }

  /* Kebab */
  .sd-kebabWrap {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
  }
  .sd-kebab {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .sd-kebab:hover { background: #F1F3FA; }
  .sd-menuBackdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
  }
  .sd-menu {
    position: absolute;
    top: 40px;
    right: 0;
    min-width: 190px;
    background: #fff;
    border: 1px solid #E8EAF0;
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(15, 17, 32, 0.14);
    padding: 6px;
    z-index: 21;
    animation: sd-fadeIn 0.12s ease;
  }
  .sd-menuItem {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 600;
    color: #1F2937;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
  }
  .sd-menuItem:hover { background: #F5F6FB; }

  /* Avatar */
  .sd-avatarRing {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }
  .sd-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 800;
    font-size: 17px;
    letter-spacing: 0.02em;
  }

  /* Identity */
  .sd-name {
    font-size: 16px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0 0 4px;
    line-height: 1.25;
    letter-spacing: -0.01em;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sd-line {
    font-size: 13px;
    color: #94A3B8;
    margin: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Meta */
  .sd-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 14px;
  }
  .sd-catPill {
    padding: 4px 10px;
    border-radius: 999px;
    background: #EEF0FF;
    color: #0504AA;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.02em;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sd-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #475569;
  }
  .sd-statusDot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
  }

  .sd-joined {
    margin-top: auto;
    padding-top: 12px;
    font-size: 11.5px;
    color: #94A3B8;
    font-weight: 600;
  }

  /* Center states */
  .sd-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 340px;
    gap: 6px;
    padding: 24px;
    text-align: center;
  }
  .sd-centerTitle {
    font-size: 16px;
    font-weight: 800;
    color: #334155;
    margin: 8px 0 0;
  }
  .sd-centerText {
    font-size: 13.5px;
    color: #64748B;
    margin: 0 0 12px;
    max-width: 380px;
    line-height: 1.5;
  }
  .sd-primaryBtn {
    padding: 10px 22px;
    background: #0504AA;
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
  }

  /* Skeleton */
  .sd-skel {
    background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
    background-size: 800px 100%;
    animation: sd-shimmer 1.4s infinite linear;
    border-radius: 8px;
  }
  .sd-skelAvatar { width: 60px; height: 60px; border-radius: 50%; margin-bottom: 14px; }
  .sd-skelLine { height: 14px; width: 70%; margin-bottom: 8px; }
  .sd-skelLineShort { height: 12px; width: 50%; margin-bottom: 6px; }

  /* Pagination */
  .sd-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 22px 24px;
  }
  .sd-pageBtn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 9px 14px;
    border-radius: 10px;
    border: 1px solid #E5E7EF;
    background: #fff;
    color: #334155;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .sd-pageBtn:hover:not(:disabled) {
    background: #F7F9FF;
    border-color: #C9CBFF;
  }
  .sd-pageBtn:disabled { cursor: not-allowed; color: #94A3B8; }
  .sd-pageInfo {
    font-size: 13px;
    font-weight: 700;
    color: #64748B;
  }

  /* Modal */
  .sd-modalOverlay {
    position: fixed;
    inset: 0;
    background: rgba(11, 11, 26, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: sd-fadeIn 0.15s ease;
  }
  .sd-modal {
    background: #fff;
    border-radius: 18px;
    padding: 22px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 24px 70px rgba(11, 11, 26, 0.35);
  }
  .sd-modalTitle {
    font-size: 18px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }
  .sd-modalBody {
    font-size: 14px;
    color: #475569;
    line-height: 1.55;
    margin: 0 0 22px;
  }
  .sd-modalActions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .sd-modalCancel {
    padding: 10px 18px;
    border-radius: 10px;
    border: 1px solid #E2E8F0;
    background: #fff;
    color: #334155;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .sd-modalCancel:hover:not(:disabled) { background: #F8FAFC; }
  .sd-modalConfirm {
    padding: 10px 18px;
    border-radius: 10px;
    border: none;
    background: #0504AA;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .sd-modalConfirm:hover:not(:disabled) { opacity: 0.9; }
  .sd-modalConfirm:disabled, .sd-modalCancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .sd-modalConfirmDanger { background: #DC2626; }

  /* Toast */
  .sd-toast {
    position: fixed;
    left: 50%;
    bottom: 32px;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 999px;
    background: #0B0B1A;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
    z-index: 2000;
    animation: sd-toastIn 0.2s ease;
  }
`;