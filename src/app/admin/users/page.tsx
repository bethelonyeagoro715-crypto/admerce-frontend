'use client';

import { useState, useReducer, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdSearch,
  MdRefresh,
  MdDeleteOutline,
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
  MdErrorOutline,
  MdPerson,
  MdBlock,
  MdCheckCircle,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  nickname?: string;
  email?: string;
  phone?: string;
  role?: string;
  created_at?: string;
  suspended?: number | boolean;
  [key: string]: unknown;
}

const ROLES = [
  'All',
  'user',
  'admin',
  'storekeeper',
  'courier',
  'flipper',
  'service_provider',
];

// ─── Reducer — one atomic state update per fetch ────────────────────
interface FetchState {
  users: AdminUser[];
  isLoading: boolean;
  errorMessage: string | null;
  currentPage: number;
}

type FetchAction =
  | { type: 'FETCH_START'; page: number }
  | { type: 'FETCH_SUCCESS'; users: AdminUser[] }
  | { type: 'FETCH_ERROR'; message: string };

const initialState: FetchState = {
  users: [],
  isLoading: true,
  errorMessage: null,
  currentPage: 0,
};

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, errorMessage: null, currentPage: action.page };
    case 'FETCH_SUCCESS':
      return { ...state, isLoading: false, users: action.users };
    case 'FETCH_ERROR':
      return { ...state, isLoading: false, users: [], errorMessage: action.message };
  }
}

// ─── Normalization helper ────────────────────────────────────────────
// Handles all common API response shapes:
//   [] | { users } | { data } | { results } | { items } | { list } | { payload }
function extractUsers(data: unknown): AdminUser[] {
  if (Array.isArray(data)) return data as AdminUser[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Unwrap one level of { data: ... } wrapping first
    const inner = obj.data ?? obj.payload ?? obj.response ?? data;
    if (Array.isArray(inner)) return inner as AdminUser[];
    if (inner && typeof inner === 'object') {
      const innerObj = inner as Record<string, unknown>;
      for (const key of ['users', 'data', 'results', 'items', 'list', 'records']) {
        if (Array.isArray(innerObj[key])) return innerObj[key] as AdminUser[];
      }
    }
    // Try every key on the top-level object
    for (const key of ['users', 'data', 'results', 'items', 'list', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as AdminUser[];
    }
  }
  return [];
}

// ─── Component ──────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const router = useRouter();

  const [{ users, isLoading, errorMessage, currentPage }, dispatch] = useReducer(
    fetchReducer,
    initialState,
  );

  // UI-only state (no fetch dependency)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('All');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 20;

  // ── Core fetch — accepts fresh values to avoid stale closure bugs ──
  // Single dispatch per fetch = no cascading setState calls in effects.
  const loadUsers = useCallback(
    async (page: number, query: string) => {
      dispatch({ type: 'FETCH_START', page });
      try {
        const offset = page * limit;
        const data = await api.adminGetUsers(
          query.trim() || undefined,
          limit,
          offset,
        );
        // 🔍 Temporary: log the raw API response to identify its shape
        console.log('[AdminUsers] raw API response:', JSON.stringify(data, null, 2));
        const extracted = extractUsers(data);
        console.log('[AdminUsers] extracted users count:', extracted.length);
        dispatch({ type: 'FETCH_SUCCESS', users: extracted });
      } catch (err) {
        dispatch({
          type: 'FETCH_ERROR',
          message: 'Failed to load users: ' + (err instanceof Error ? err.message : String(err)),
        });
      }
    },
    [],
  );

  // Mount
  useEffect(() => {
    loadUsers(0, '');
  }, [loadUsers]);

  // ── Search with 400 ms debounce ──────────────────────────────────
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadUsers(0, val);
    }, 400);
  };

  // ── Role filter ──────────────────────────────────────────────────
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterRole(e.target.value);
    // Role filter is client-side — no re-fetch needed
  };

  // ── Pagination ───────────────────────────────────────────────────
  const nextPage = () => loadUsers(currentPage + 1, searchQuery);
  const prevPage = () => {
    if (currentPage > 0) loadUsers(currentPage - 1, searchQuery);
  };

  // ── Delete ───────────────────────────────────────────────────────
  const deleteUser = async (userId: string, userName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${userName}"? This action cannot be undone.`,
      )
    )
      return;
    try {
      await api.adminDeleteUser(userId);
      await loadUsers(currentPage, searchQuery);
    } catch (err) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // ── Suspend / Unsuspend ──────────────────────────────────────────
  const toggleSuspend = async (userId: string, isSuspended: boolean) => {
    try {
      if (isSuspended) {
        await api.adminUnsuspendUser(userId);
      } else {
        await api.adminSuspendUser(userId);
      }
      await loadUsers(currentPage, searchQuery);
    } catch (err) {
      alert('Action failed: ' + (err instanceof Error ? err.message : String(err)));
    }
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

  // ── Client-side role filter fallback (if API doesn't support it) ──
  const visibleUsers =
    filterRole === 'All' ? users : users.filter((u) => u.role === filterRole);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <main style={styles.container}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .user-row:hover { background-color: #F0F4FF !important; }
        .icon-btn:hover { opacity: 0.75; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Users</h1>
        <button
          className="icon-btn"
          onClick={() => loadUsers(0, searchQuery)}
          style={styles.iconBtn}
          title="Refresh"
        >
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.searchWrapper}>
          <MdSearch size={20} color="#888" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={handleSearchChange}
            style={styles.searchInput}
          />
        </div>
        <select value={filterRole} onChange={handleRoleChange} style={styles.roleSelect}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
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
            <p style={{ margin: '8px 0' }}>{errorMessage}</p>
            <button
              onClick={() => loadUsers(0, searchQuery)}
              style={styles.retryBtn}
            >
              Retry
            </button>
          </div>
        ) : visibleUsers.length === 0 ? (
          <div style={styles.center}>
            <MdPerson size={48} color="#ccc" />
            <p style={{ color: '#888' }}>No users found.</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            {/* Table Header */}
            <div style={styles.tableHeader}>
              <span style={{ flex: 2 }}>Name</span>
              <span style={{ flex: 2 }}>Email</span>
              <span style={{ flex: 1 }}>Phone</span>
              <span style={{ flex: 1 }}>Role</span>
              <span style={{ flex: 1 }}>Joined</span>
              <span style={{ flex: 1 }}>Status</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Actions</span>
            </div>

            {/* Rows */}
            {visibleUsers.map((user) => {
              const isSuspended = Boolean(user.suspended);
              return (
                <div
                  key={user.id}
                  className="user-row"
                  style={styles.userRow}
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  <span style={{ flex: 2, fontWeight: 600, color: '#1A1A1A' }}>
                    {user.nickname || user.phone || '—'}
                  </span>
                  <span style={{ flex: 2, color: '#555' }}>{user.email || '—'}</span>
                  <span style={{ flex: 1, color: '#555' }}>{user.phone || '—'}</span>
                  <span style={{ flex: 1 }}>
                    <span style={styles.roleBadge}>{user.role || 'user'}</span>
                  </span>
                  <span style={{ flex: 1, color: '#888', fontSize: 13 }}>
                    {formatDate(user.created_at)}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: isSuspended ? '#FFEBEE' : '#E8F5E9',
                        color: isSuspended ? '#C62828' : '#2E7D32',
                      }}
                    >
                      {isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </span>

                  {/* Actions — stop row click propagation */}
                  <span
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="icon-btn"
                      onClick={() => toggleSuspend(user.id, isSuspended)}
                      style={styles.rowIconBtn}
                      title={isSuspended ? 'Unsuspend' : 'Suspend'}
                    >
                      {isSuspended ? (
                        <MdCheckCircle size={20} color="#4CAF50" />
                      ) : (
                        <MdBlock size={20} color="#FF9800" />
                      )}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() =>
                        deleteUser(user.id, user.nickname || user.phone || user.id)
                      }
                      style={styles.rowIconBtn}
                      title="Delete"
                    >
                      <MdDeleteOutline size={20} color="#F44336" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !errorMessage && (
        <div style={styles.pagination}>
          <button onClick={prevPage} disabled={currentPage === 0} style={styles.pageBtn}>
            <MdKeyboardArrowLeft size={20} color={currentPage === 0 ? '#ccc' : '#0504AA'} />
            Previous
          </button>
          <span style={styles.pageInfo}>Page {currentPage + 1}</span>
          <button
            onClick={nextPage}
            disabled={users.length < limit}
            style={styles.pageBtn}
          >
            Next
            <MdKeyboardArrowRight
              size={20}
              color={users.length < limit ? '#ccc' : '#0504AA'}
            />
          </button>
        </div>
      )}
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#F8FAFC',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #EBEBEB',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0D0D0D',
    margin: 0,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 8,
    transition: 'opacity 0.15s',
  },
  filters: {
    display: 'flex',
    gap: 12,
    padding: '16px 20px',
    backgroundColor: '#F8FAFC',
  },
  searchWrapper: {
    position: 'relative',
    flex: 3,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px 10px 38px',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    fontSize: 14,
    outline: 'none',
    backgroundColor: '#fff',
    color: '#1A1A1A',
  },
  roleSelect: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    fontSize: 14,
    outline: 'none',
    backgroundColor: '#fff',
    color: '#1A1A1A',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 12px',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
    color: '#888',
    gap: 4,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    marginTop: 12,
    padding: '8px 22px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  tableWrapper: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    border: '1px solid #F0F0F0',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '11px 16px',
    backgroundColor: '#F5F7FA',
    borderBottom: '1px solid #EBEBEB',
    fontSize: 12,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '13px 16px',
    borderBottom: '1px solid #F5F5F5',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    fontSize: 14,
    color: '#444',
  },
  roleBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
  },
  rowIconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    transition: 'opacity 0.15s',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '12px 20px',
    gap: 8,
    borderTop: '1px solid #EBEBEB',
    backgroundColor: '#fff',
  },
  pageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid #E0E0E0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#333',
    transition: 'border-color 0.15s',
  },
  pageInfo: {
    fontSize: 14,
    color: '#666',
    minWidth: 60,
    textAlign: 'center',
  },
};