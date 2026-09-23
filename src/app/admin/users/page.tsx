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
  MdClose,
  MdChevronRight,
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

// ✅ Fixed: 'user' → 'shopper' (that's the DB role). Human labels for the rest.
const ROLES: { value: string; label: string }[] = [
  { value: 'All', label: 'All roles' },
  { value: 'shopper', label: 'Shopper' },
  { value: 'storekeeper', label: 'Storekeeper' },
  { value: 'courier', label: 'Courier' },
  { value: 'flipper', label: 'Flipper' },
  { value: 'service_provider', label: 'Service provider' },
  { value: 'admin', label: 'Admin' },
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
function extractUsers(data: unknown): AdminUser[] {
  if (Array.isArray(data)) return data as AdminUser[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const inner = obj.data ?? obj.payload ?? obj.response ?? data;
    if (Array.isArray(inner)) return inner as AdminUser[];
    if (inner && typeof inner === 'object') {
      const innerObj = inner as Record<string, unknown>;
      for (const key of ['users', 'data', 'results', 'items', 'list', 'records']) {
        if (Array.isArray(innerObj[key])) return innerObj[key] as AdminUser[];
      }
    }
    for (const key of ['users', 'data', 'results', 'items', 'list', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as AdminUser[];
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

function roleColor(role: string | undefined): string {
  switch ((role || '').toLowerCase()) {
    case 'admin': return '#7C3AED';
    case 'storekeeper': return '#0F766E';
    case 'courier': return '#EA580C';
    case 'flipper': return '#DB2777';
    case 'service_provider': return '#0504AA';
    case 'shopper': return '#16A34A';
    default: return '#64748B';
  }
}

function humanRole(role: string | undefined): string {
  if (!role) return '—';
  const match = ROLES.find((r) => r.value === role);
  if (match) return match.label;
  // Fallback: capitalize the raw value
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── Confirmation dialog state ───────────────────────────────────────
type ConfirmKind = 'suspend' | 'unsuspend' | 'delete';
interface ConfirmState {
  kind: ConfirmKind;
  user: AdminUser;
}

// ─── Component ──────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const router = useRouter();

  const [{ users, isLoading, errorMessage, currentPage }, dispatch] = useReducer(
    fetchReducer,
    initialState,
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [isActing, setIsActing] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 20;

  // ── Core fetch — accepts fresh values to avoid stale closures ─────
  const loadUsers = useCallback(
    async (page: number, query: string, role: string) => {
      dispatch({ type: 'FETCH_START', page });
      try {
        const offset = page * limit;
        const data = await api.adminGetUsers(
          query.trim() || undefined,
          limit,
          offset,
        );
        dispatch({ type: 'FETCH_SUCCESS', users: extractUsers(data) });
      } catch (err) {
        dispatch({
          type: 'FETCH_ERROR',
          message:
            'Failed to load users: ' +
            (err instanceof Error ? err.message : String(err)),
        });
      }
    },
    [],
  );

  // Mount
  useEffect(() => {
    loadUsers(0, '', 'All');
  }, [loadUsers]);

  // Search with 400 ms debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadUsers(0, val, filterRole);
    }, 400);
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    loadUsers(0, '', filterRole);
  };

  // Role filter — server-side
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilterRole(val);
    loadUsers(0, searchQuery, val);
  };

  // Pagination
  const nextPage = () => loadUsers(currentPage + 1, searchQuery, filterRole);
  const prevPage = () => {
    if (currentPage > 0) loadUsers(currentPage - 1, searchQuery, filterRole);
  };

  // ── Row actions (behind the confirm modal) ───────────────────────
  const promptSuspend = (user: AdminUser) => {
    setConfirm({ kind: Boolean(user.suspended) ? 'unsuspend' : 'suspend', user });
  };
  const promptDelete = (user: AdminUser) => {
    setConfirm({ kind: 'delete', user });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    setIsActing(true);
    try {
      if (kind === 'delete') {
        await api.adminDeleteUser(user.id);
      } else if (kind === 'suspend') {
        await api.adminSuspendUser(user.id);
      } else {
        await api.adminUnsuspendUser(user.id);
      }
      setConfirm(null);
      await loadUsers(currentPage, searchQuery, filterRole);
    } catch (err) {
      alert('Action failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsActing(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────
  const hasActiveFilters = searchQuery.trim().length > 0 || filterRole !== 'All';
  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterRole('All');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    loadUsers(0, '', 'All');
  };

  const displayName = (u: AdminUser) =>
    u.nickname || u.email || u.phone || u.id.slice(0, 8);

  const showingLabel =
    users.length > 0
      ? `Page ${currentPage + 1} · ${users.length} shown`
      : `Page ${currentPage + 1}`;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <main className="au-root">
      <style>{CSS}</style>

      {/* Header */}
      <header className="au-header">
        <div className="au-headerLeft">
          <h1 className="au-title">Users</h1>
          {!isLoading && !errorMessage && users.length > 0 && (
            <span className="au-count">{users.length}</span>
          )}
        </div>
        <button
          className="au-iconBtn"
          onClick={() => loadUsers(currentPage, searchQuery, filterRole)}
          title="Refresh"
          aria-label="Refresh"
        >
          <MdRefresh size={22} color="#0504AA" />
        </button>
      </header>

      {/* Filters */}
      <div className="au-filters">
        <div className="au-searchWrap">
          <MdSearch size={20} color="#8A8F99" className="au-searchIcon" />
          <input
            type="text"
            placeholder="Search by name, email, or phone"
            value={searchQuery}
            onChange={handleSearchChange}
            className="au-searchInput"
            aria-label="Search users"
          />
          {searchQuery.length > 0 && (
            <button
              className="au-searchClear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <MdClose size={16} color="#666" />
            </button>
          )}
        </div>
        <select
          value={filterRole}
          onChange={handleRoleChange}
          className="au-roleSelect"
          aria-label="Filter by role"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="au-content">
        {isLoading ? (
          <>
            {/* Skeleton — desktop */}
            <div className="au-tableWrap au-desktopOnly">
              <div className="au-row au-rowHeader">
                <span className="au-colName">User</span>
                <span className="au-colEmail">Email</span>
                <span className="au-colPhone">Phone</span>
                <span className="au-colRole">Role</span>
                <span className="au-colJoined">Joined</span>
                <span className="au-colStatus">Status</span>
                <span className="au-colActions">Actions</span>
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="au-row au-rowSkeleton">
                  <div className="au-skel au-skelAvatar" />
                  <div className="au-skel au-skelLine" />
                  <div className="au-skel au-skelLineShort" />
                  <div className="au-skel au-skelBadge" />
                  <div className="au-skel au-skelLineShort" />
                  <div className="au-skel au-skelBadge" />
                  <div />
                </div>
              ))}
            </div>
            {/* Skeleton — mobile */}
            <div className="au-mobileOnly">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="au-card au-cardSkeleton">
                  <div className="au-skel au-skelAvatar" />
                  <div className="au-cardBody">
                    <div className="au-skel au-skelLine" />
                    <div className="au-skel au-skelLineShort" />
                    <div className="au-skel au-skelLineShort" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : errorMessage ? (
          <div className="au-center">
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p className="au-centerText">{errorMessage}</p>
            <button
              onClick={() => loadUsers(0, searchQuery, filterRole)}
              className="au-primaryBtn"
            >
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="au-center">
            <MdPerson size={48} color="#cbd5e1" />
            <p className="au-centerTitle">
              {hasActiveFilters ? 'No matches' : 'No users yet'}
            </p>
            <p className="au-centerText">
              {hasActiveFilters
                ? 'Try a different search or clear the role filter.'
                : 'Users will appear here as they sign up.'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="au-primaryBtn">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="au-tableWrap au-desktopOnly">
              <div className="au-row au-rowHeader">
                <span className="au-colName">User</span>
                <span className="au-colEmail">Email</span>
                <span className="au-colPhone">Phone</span>
                <span className="au-colRole">Role</span>
                <span className="au-colJoined">Joined</span>
                <span className="au-colStatus">Status</span>
                <span className="au-colActions">Actions</span>
              </div>
              {users.map((user) => {
                const isSuspended = Boolean(user.suspended);
                const name = displayName(user);
                return (
                  <div
                    key={user.id}
                    className="au-row au-rowBody"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/admin/users/${user.id}`);
                      }
                    }}
                  >
                    <span className="au-colName au-userCell">
                      <span
                        className="au-avatar"
                        style={{ backgroundColor: roleColor(user.role) }}
                        aria-hidden="true"
                      >
                        {initialsOf(name)}
                      </span>
                      <span className="au-userName">{name}</span>
                    </span>
                    <span className="au-colEmail au-muted">{user.email || '—'}</span>
                    <span className="au-colPhone au-muted">{user.phone || '—'}</span>
                    <span className="au-colRole">
                      <span className="au-roleBadge">{humanRole(user.role)}</span>
                    </span>
                    <span className="au-colJoined au-muted au-small">
                      {formatDate(user.created_at)}
                    </span>
                    <span className="au-colStatus">
                      <span
                        className="au-statusBadge"
                        style={{
                          backgroundColor: isSuspended ? '#FEE2E2' : '#DCFCE7',
                          color: isSuspended ? '#991B1B' : '#166534',
                        }}
                      >
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </span>
                    <span
                      className="au-colActions au-actionsCell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => promptSuspend(user)}
                        className="au-rowIconBtn"
                        title={isSuspended ? 'Unsuspend' : 'Suspend'}
                        aria-label={isSuspended ? 'Unsuspend' : 'Suspend'}
                      >
                        {isSuspended ? (
                          <MdCheckCircle size={20} color="#16A34A" />
                        ) : (
                          <MdBlock size={20} color="#EA580C" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => promptDelete(user)}
                        className="au-rowIconBtn"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <MdDeleteOutline size={20} color="#DC2626" />
                      </button>
                      <MdChevronRight
                        size={20}
                        color="#cbd5e1"
                        className="au-chevron"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile cards */}
            <div className="au-mobileOnly">
              {users.map((user) => {
                const isSuspended = Boolean(user.suspended);
                const name = displayName(user);
                return (
                  <div
                    key={user.id}
                    className="au-card"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/admin/users/${user.id}`);
                      }
                    }}
                  >
                    <div className="au-cardTop">
                      <span
                        className="au-avatar au-avatarLg"
                        style={{ backgroundColor: roleColor(user.role) }}
                        aria-hidden="true"
                      >
                        {initialsOf(name)}
                      </span>
                      <div className="au-cardMeta">
                        <div className="au-cardName">{name}</div>
                        {user.email && (
                          <div className="au-cardLine">{user.email}</div>
                        )}
                        {user.phone && (
                          <div className="au-cardLine">{user.phone}</div>
                        )}
                      </div>
                      <MdChevronRight size={22} color="#cbd5e1" aria-hidden="true" />
                    </div>
                    <div className="au-cardBadges">
                      <span className="au-roleBadge">{humanRole(user.role)}</span>
                      <span
                        className="au-statusBadge"
                        style={{
                          backgroundColor: isSuspended ? '#FEE2E2' : '#DCFCE7',
                          color: isSuspended ? '#991B1B' : '#166534',
                        }}
                      >
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                      <span className="au-cardJoined">
                        Joined {formatDate(user.created_at)}
                      </span>
                    </div>
                    <div
                      className="au-cardActions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => promptSuspend(user)}
                        className="au-cardAction"
                      >
                        {isSuspended ? (
                          <>
                            <MdCheckCircle size={18} color="#16A34A" />
                            <span>Unsuspend</span>
                          </>
                        ) : (
                          <>
                            <MdBlock size={18} color="#EA580C" />
                            <span>Suspend</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => promptDelete(user)}
                        className="au-cardAction au-cardActionDanger"
                      >
                        <MdDeleteOutline size={18} color="#DC2626" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !errorMessage && users.length > 0 && (
        <div className="au-pagination">
          <span className="au-pageInfo">{showingLabel}</span>
          <div className="au-pageButtons">
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="au-pageBtn"
              aria-label="Previous page"
            >
              <MdKeyboardArrowLeft
                size={20}
                color={currentPage === 0 ? '#cbd5e1' : '#0504AA'}
              />
            </button>
            <button
              onClick={nextPage}
              disabled={users.length < limit}
              className="au-pageBtn"
              aria-label="Next page"
            >
              <MdKeyboardArrowRight
                size={20}
                color={users.length < limit ? '#cbd5e1' : '#0504AA'}
              />
            </button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div
          className="au-modalOverlay"
          onClick={() => (isActing ? undefined : setConfirm(null))}
        >
          <div className="au-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="au-modalTitle">
              {confirm.kind === 'delete'
                ? 'Delete user?'
                : confirm.kind === 'suspend'
                ? 'Suspend user?'
                : 'Unsuspend user?'}
            </h3>
            <p className="au-modalBody">
              {confirm.kind === 'delete' && (
                <>
                  <strong>{displayName(confirm.user)}</strong> will be permanently
                  deleted. This cannot be undone.
                </>
              )}
              {confirm.kind === 'suspend' && (
                <>
                  <strong>{displayName(confirm.user)}</strong> will be blocked from
                  logging in until unsuspended.
                </>
              )}
              {confirm.kind === 'unsuspend' && (
                <>
                  <strong>{displayName(confirm.user)}</strong> will be able to log
                  in again immediately.
                </>
              )}
            </p>
            <div className="au-modalActions">
              <button
                type="button"
                className="au-modalCancel"
                onClick={() => setConfirm(null)}
                disabled={isActing}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  confirm.kind === 'delete'
                    ? 'au-modalConfirm au-modalConfirmDanger'
                    : 'au-modalConfirm'
                }
                onClick={runConfirm}
                disabled={isActing}
              >
                {isActing
                  ? 'Working…'
                  : confirm.kind === 'delete'
                  ? 'Delete'
                  : confirm.kind === 'suspend'
                  ? 'Suspend'
                  : 'Unsuspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes au-spin { to { transform: rotate(360deg); } }
  @keyframes au-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  .au-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #F8FAFC;
  }

  /* Header */
  .au-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: #fff;
    border-bottom: 1px solid #EBEBEB;
    position: sticky;
    top: 0;
    z-index: 5;
  }
  .au-headerLeft { display: flex; align-items: center; gap: 10px; }
  .au-title { font-size: 18px; font-weight: 700; color: #0D0D0D; margin: 0; }
  .au-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    background: #EEF0FF;
    color: #0504AA;
    font-size: 12px;
    font-weight: 700;
  }
  .au-iconBtn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .au-iconBtn:hover { background: #EEF0FF; }

  /* Filters */
  .au-filters {
    display: flex;
    gap: 10px;
    padding: 14px 20px;
    background: #F8FAFC;
    flex-wrap: wrap;
  }
  .au-searchWrap { position: relative; flex: 1 1 220px; min-width: 0; }
  .au-searchIcon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .au-searchInput {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 36px 10px 38px;
    border-radius: 10px;
    border: 1px solid #E0E0E0;
    font-size: 14px;
    outline: none;
    background: #fff;
    color: #1A1A1A;
    transition: border-color 0.15s;
  }
  .au-searchInput:focus { border-color: #0504AA; }
  .au-searchClear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    border: none;
    background: #F0F0F0;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .au-searchClear:hover { background: #E0E0E0; }
  .au-roleSelect {
    flex: 0 0 160px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #E0E0E0;
    font-size: 14px;
    outline: none;
    background: #fff;
    color: #1A1A1A;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .au-roleSelect:focus { border-color: #0504AA; }

  /* Content */
  .au-content { flex: 1; overflow-y: auto; padding: 0 20px 12px; }

  /* Desktop / mobile toggles */
  .au-desktopOnly { display: none; }
  .au-mobileOnly { display: block; }
  @media (min-width: 720px) {
    .au-desktopOnly { display: block; }
    .au-mobileOnly { display: none; }
  }

  /* Desktop table */
  .au-tableWrap {
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    border: 1px solid #F0F0F0;
  }
  .au-row {
    display: grid;
    grid-template-columns:
      minmax(0, 2.2fr)
      minmax(0, 2fr)
      minmax(0, 1.2fr)
      minmax(0, 1.1fr)
      minmax(0, 0.9fr)
      minmax(0, 0.9fr)
      auto;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    font-size: 14px;
    color: #444;
  }
  .au-rowHeader {
    background: #F5F7FA;
    border-bottom: 1px solid #EBEBEB;
    font-size: 11.5px;
    font-weight: 700;
    color: #8A8F99;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    position: sticky;
    top: 0;
    z-index: 4;
  }
  .au-rowBody {
    border-bottom: 1px solid #F5F5F5;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  .au-rowBody:last-child { border-bottom: none; }
  .au-rowBody:hover { background-color: #F7F9FF; }
  .au-rowBody:focus-visible {
    outline: 2px solid #0504AA;
    outline-offset: -2px;
  }
  .au-rowSkeleton {
    border-bottom: 1px solid #F5F5F5;
    pointer-events: none;
  }

  .au-colName { min-width: 0; }
  .au-colEmail, .au-colPhone { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .au-colJoined, .au-colRole, .au-colStatus { min-width: 0; }
  .au-colActions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
  .au-chevron { margin-left: 2px; }

  .au-userCell { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .au-userName {
    font-weight: 600;
    color: #0D0D0D;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .au-avatar {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.02em;
  }
  .au-avatarLg { width: 44px; height: 44px; flex: 0 0 44px; font-size: 15px; }

  .au-roleBadge {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    background: #EEF0FF;
    color: #0504AA;
    white-space: nowrap;
  }
  .au-statusBadge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
  }
  .au-muted { color: #64748B; }
  .au-small { font-size: 13px; }

  .au-rowIconBtn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .au-rowIconBtn:hover { background: #F0F0F0; }

  /* Mobile cards */
  .au-card {
    background: #fff;
    border: 1px solid #F0F0F0;
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    cursor: pointer;
    transition: background 0.15s;
  }
  .au-card:active { background: #F7F9FF; }
  .au-cardSkeleton { cursor: default; display: flex; gap: 12px; align-items: center; }
  .au-cardTop {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .au-cardMeta { flex: 1; min-width: 0; }
  .au-cardName {
    font-weight: 700;
    font-size: 15px;
    color: #0D0D0D;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .au-cardLine {
    font-size: 12.5px;
    color: #64748B;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }
  .au-cardBody { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .au-cardBadges {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .au-cardJoined {
    font-size: 12px;
    color: #94A3B8;
    margin-left: auto;
  }
  .au-cardActions {
    display: flex;
    gap: 8px;
    border-top: 1px solid #F1F5F9;
    padding-top: 12px;
  }
  .au-cardAction {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid #E2E8F0;
    background: #fff;
    color: #334155;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .au-cardAction:active { background: #F1F5F9; }
  .au-cardActionDanger {
    color: #DC2626;
    border-color: #FECACA;
  }
  .au-cardActionDanger:active { background: #FEF2F2; }

  /* Center states */
  .au-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 320px;
    gap: 6px;
    padding: 24px;
    text-align: center;
  }
  .au-centerTitle {
    font-size: 16px;
    font-weight: 700;
    color: #334155;
    margin: 8px 0 0;
  }
  .au-centerText {
    font-size: 13.5px;
    color: #64748B;
    margin: 0 0 12px;
    max-width: 360px;
    line-height: 1.5;
  }
  .au-primaryBtn {
    padding: 10px 22px;
    background: #0504AA;
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: opacity 0.15s;
  }
  .au-primaryBtn:hover { opacity: 0.9; }

  /* Skeleton */
  .au-skel {
    background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
    background-size: 800px 100%;
    animation: au-shimmer 1.4s infinite linear;
    border-radius: 6px;
  }
  .au-skelAvatar { width: 36px; height: 36px; border-radius: 50%; flex: 0 0 36px; }
  .au-skelLine { height: 12px; width: 80%; border-radius: 6px; }
  .au-skelLineShort { height: 12px; width: 55%; border-radius: 6px; }
  .au-skelBadge { height: 20px; width: 64px; border-radius: 999px; }

  /* Pagination */
  .au-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    gap: 8px;
    border-top: 1px solid #EBEBEB;
    background: #fff;
  }
  .au-pageInfo { font-size: 13px; color: #64748B; font-weight: 600; }
  .au-pageButtons { display: flex; gap: 6px; }
  .au-pageBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid #E0E0E0;
    background: #fff;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .au-pageBtn:hover:not(:disabled) { background: #F7F9FF; border-color: #C9CBFF; }
  .au-pageBtn:disabled { cursor: not-allowed; }

  /* Modal */
  .au-modalOverlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: au-fadeIn 0.15s ease;
  }
  @keyframes au-fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .au-modal {
    background: #fff;
    border-radius: 16px;
    padding: 22px;
    max-width: 380px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  }
  .au-modalTitle {
    font-size: 17px;
    font-weight: 800;
    color: #0D0D0D;
    margin: 0 0 8px;
  }
  .au-modalBody {
    font-size: 14px;
    color: #475569;
    line-height: 1.55;
    margin: 0 0 22px;
  }
  .au-modalActions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .au-modalCancel {
    padding: 10px 18px;
    border-radius: 10px;
    border: 1px solid #E2E8F0;
    background: #fff;
    color: #334155;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .au-modalCancel:hover:not(:disabled) { background: #F8FAFC; }
  .au-modalConfirm {
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
  .au-modalConfirm:hover:not(:disabled) { opacity: 0.9; }
  .au-modalConfirm:disabled, .au-modalCancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .au-modalConfirmDanger { background: #DC2626; }
`;