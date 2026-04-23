const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface LicenseStatus {
  valid: boolean;
  status: 'inactive' | 'active' | 'expired' | 'revoked' | 'none';
  expires_at?: string;
  remaining_days?: number;
  key_id?: string;
  error?: string;
}

export interface LicenseKey {
  id: string;
  key: string;
  duration_days: number;
  status: string;
  created_by: string;
  activated_by: string | null;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  notes: string;
}

const LICENSE_STORAGE_KEY = 'vulnscanpro_license';

function getStoredLicense(): { key: string; user_id: string } | null {
  try {
    const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setStoredLicense(key: string, user_id: string) {
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify({ key, user_id }));
}

export function clearStoredLicense() {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
}

export async function checkLicenseStatus(): Promise<LicenseStatus> {
  const stored = getStoredLicense();
  if (!stored) return { valid: false, status: 'none' };

  try {
    const url = `${SUPABASE_URL}/functions/v1/license-validate?action=check&key=${encodeURIComponent(stored.key)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.valid) {
      return {
        valid: true,
        status: 'active',
        expires_at: data.expires_at,
        remaining_days: data.remaining_days,
        key_id: data.key_id,
      };
    }

    if (data.status === 'expired' || data.status === 'revoked') {
      clearStoredLicense();
    }

    return {
      valid: false,
      status: data.status || 'none',
      error: data.error,
    };
  } catch {
    return { valid: false, status: 'none', error: 'Failed to check license' };
  }
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  const user_id = crypto.randomUUID();
  const fingerprint = await getFingerprint();

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/license-validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, user_id, device_fingerprint: fingerprint }),
    });

    const data = await response.json();

    if (data.valid) {
      setStoredLicense(key, user_id);
      return {
        valid: true,
        status: 'active',
        expires_at: data.expires_at,
        remaining_days: data.remaining_days,
      };
    }

    return {
      valid: false,
      status: 'none',
      error: data.error || 'Activation failed',
    };
  } catch {
    return { valid: false, status: 'none', error: 'Failed to activate license' };
  }
}

async function getFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
  ];
  const encoded = new TextEncoder().encode(components.join('|'));
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

// Admin functions
export async function adminFetchKeys(): Promise<LicenseKey[]> {
  const url = `${SUPABASE_URL}/functions/v1/license-admin?action=list`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  return data.keys || [];
}

export async function adminGenerateKeys(count: number, durationDays: number, notes?: string): Promise<{ keys: string[]; message: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/license-admin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ count, duration_days: durationDays, notes: notes || '' }),
  });
  return response.json();
}

export async function adminRevokeKey(keyId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/functions/v1/license-admin`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key_id: keyId, status: 'revoked' }),
  });
}

export async function adminDeleteKey(keyId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/functions/v1/license-admin?key_id=${keyId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}
