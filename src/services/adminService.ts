const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ADMIN_TOKEN_KEY = 'vulnscanpro_admin_token';

export interface AdminSession {
  token: string;
  expires_at: string;
  admin: { id: string; username: string };
}

export function getStoredAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearStoredAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function adminLogin(username: string, password: string): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
  try {
    console.log('[v0] Starting admin login...');
    console.log('[v0] Supabase URL:', SUPABASE_URL);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-login?action=login`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    console.log('[v0] Login response status:', response.status);
    const data = await response.json();
    console.log('[v0] Login response data:', data);

    if (!response.ok) {
      console.error('[v0] Login failed with status:', response.status);
      return { success: false, error: data.error || `Login failed (${response.status})` };
    }

    if (data.success && data.token) {
      setStoredAdminToken(data.token);
      return {
        success: true,
        session: {
          token: data.token,
          expires_at: data.expires_at,
          admin: data.admin,
        },
      };
    }

    return { success: false, error: data.error || 'Login failed' };
  } catch (err) {
    console.error('[v0] Admin login error:', err);
    return { success: false, error: 'Network error. Please check your Supabase setup. See FIX_NETWORK_ERROR.md' };
  }
}

export async function adminLogout(): Promise<void> {
  const token = getStoredAdminToken();
  if (token) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/admin-login?action=logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch { /* ignore */ }
  }
  clearStoredAdminToken();
}

export async function verifyAdminSession(): Promise<{ valid: boolean; admin?: { id: string; username: string } }> {
  const token = getStoredAdminToken();
  if (!token) return { valid: false };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-verify?action=verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.valid) {
      return { valid: true, admin: data.admin };
    }

    clearStoredAdminToken();
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const token = getStoredAdminToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-login?action=change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });

    const data = await response.json();
    return { success: data.success || false, error: data.error };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function getAdminStats(): Promise<{ total: number; inactive: number; active: number; expired: number; revoked: number }> {
  const token = getStoredAdminToken();
  if (!token) return { total: 0, inactive: 0, active: 0, expired: 0, revoked: 0 };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-verify?action=stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data.stats || { total: 0, inactive: 0, active: 0, expired: 0, revoked: 0 };
  } catch {
    return { total: 0, inactive: 0, active: 0, expired: 0, revoked: 0 };
  }
}
