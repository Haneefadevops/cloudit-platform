export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  clientId?: string | null;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function isPortalUser(user?: StoredUser | null): boolean {
  const u = user === undefined ? getStoredUser() : user;
  return u?.role === 'client_admin' || u?.role === 'client_staff';
}
