// src/services/localStorage.ts

const TOKEN_KEY = 'auth_token';
const ROLE_KEY = 'active_role';
const INTENDED_ROLE_KEY = 'intended_role';
const FUTURE_INTERESTS_KEY = 'future_interests';
const ONBOARDING_STATUS_KEY = 'onboarding_status';
const STORE_ID_KEY = 'store_id';
const USER_ID_KEY = 'user_id';
const USER_NAME_KEY = 'user_name';
const USER_ROLE_KEY = 'user_role'; // for admin checks
const RESERVATIONS_KEY = 'reservations';

// ---------- Token ----------
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// ---------- Active Role ----------
export const getActiveRole = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ROLE_KEY);
};

export const setActiveRole = (role: string | null): void => {
  if (role === null) {
    localStorage.removeItem(ROLE_KEY);
  } else {
    localStorage.setItem(ROLE_KEY, role);
  }
};

export const clearActiveRole = (): void => {
  localStorage.removeItem(ROLE_KEY);
};

// ---------- Intended Role (from onboarding) ----------
export const setIntendedRole = (role: string): void => {
  localStorage.setItem(INTENDED_ROLE_KEY, role);
};

export const getIntendedRole = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(INTENDED_ROLE_KEY);
};

export const clearIntendedRole = (): void => {
  localStorage.removeItem(INTENDED_ROLE_KEY);
};

// ---------- Future Interests ----------
export const setFutureInterests = (interests: string[]): void => {
  localStorage.setItem(FUTURE_INTERESTS_KEY, JSON.stringify(interests));
};

export const getFutureInterests = (): string[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(FUTURE_INTERESTS_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const clearFutureInterests = (): void => {
  localStorage.removeItem(FUTURE_INTERESTS_KEY);
};

// ---------- Store ID ----------
export const setStoreId = (storeId: string): void => {
  localStorage.setItem(STORE_ID_KEY, storeId);
};

export const getStoreId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORE_ID_KEY);
};

export const clearStoreId = (): void => {
  localStorage.removeItem(STORE_ID_KEY);
};

// ---------- User ID ----------
export const setUserId = (userId: string): void => {
  localStorage.setItem(USER_ID_KEY, userId);
};

export const getUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ID_KEY);
};

export const clearUserId = (): void => {
  localStorage.removeItem(USER_ID_KEY);
};

// ---------- User Name ----------
export const setUserName = (name: string): void => {
  localStorage.setItem(USER_NAME_KEY, name);
};

export const getUserName = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_NAME_KEY);
};

export const clearUserName = (): void => {
  localStorage.removeItem(USER_NAME_KEY);
};

// ---------- User Role (admin checks) ----------
export const setUserRole = (role: string): void => {
  localStorage.setItem(USER_ROLE_KEY, role);
};

export const getUserRole = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ROLE_KEY);
};

export const clearUserRole = (): void => {
  localStorage.removeItem(USER_ROLE_KEY);
};

// ---------- Onboarding Status (per role) ----------
export const setOnboardingStatus = (role: string, completed: boolean): void => {
  const raw = localStorage.getItem(ONBOARDING_STATUS_KEY);
  let map: Record<string, boolean> = {};
  try {
    map = raw ? JSON.parse(raw) : {};
  } catch {
    // ignore parse errors
  }
  map[role] = completed;
  localStorage.setItem(ONBOARDING_STATUS_KEY, JSON.stringify(map));
};

export const getOnboardingStatus = (role: string): boolean => {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(ONBOARDING_STATUS_KEY);
  if (!raw) return false;
  try {
    const map = JSON.parse(raw) as Record<string, boolean>;
    return map[role] ?? false;
  } catch {
    return false;
  }
};

export const clearOnboardingStatus = (): void => {
  localStorage.removeItem(ONBOARDING_STATUS_KEY);
};

// ---------- Reservations (local cache) ----------
export const saveReservation = (reservation: Record<string, unknown>): void => {
  const raw = localStorage.getItem(RESERVATIONS_KEY);
  const list = raw ? JSON.parse(raw) : [];
  list.push(reservation);
  localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(list));
};

export const getReservations = (): Record<string, unknown>[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(RESERVATIONS_KEY);
  return raw ? JSON.parse(raw) : [];
};

// ---------- Clear all data (logout) ----------
export const clear = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.clear();
  }
};