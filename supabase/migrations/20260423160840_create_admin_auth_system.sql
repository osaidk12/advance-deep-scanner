/*
  # Create Admin Authentication Table

  1. New Tables
    - `admin_users`
      - `id` (uuid, primary key)
      - `username` (text, unique) - Admin username
      - `password_hash` (text) - bcrypt hashed password
      - `created_at` (timestamptz)
      - `last_login` (timestamptz, nullable)
      - `is_active` (boolean) - Whether admin account is active

  2. Security
    - Enable RLS on admin_users
    - Only service_role can read/write (no public access)
    - No user can query this table directly

  3. Important Notes
    - Passwords are hashed using bcrypt via the edge function
    - A default admin account is seeded with username 'admin' and password 'VulnScan2024!'
    - The admin MUST change this password after first login
    - Session tokens are JWTs signed with the service role key
*/

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz,
  is_active boolean DEFAULT true
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only service_role can access admin_users
CREATE POLICY "Service role full access on admin_users"
  ON admin_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No other role can access
-- (RLS is restrictive by default, so no additional policies needed)

-- Create admin sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  ip_address text DEFAULT '',
  user_agent text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true
);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on admin_sessions"
  ON admin_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Seed default admin (password will be set via edge function on first deploy)
-- We insert a placeholder that will be updated by the edge function
INSERT INTO admin_users (username, password_hash, is_active)
VALUES ('admin', 'PLACEHOLDER_CHANGE_IMMEDIATELY', true)
ON CONFLICT (username) DO NOTHING;
