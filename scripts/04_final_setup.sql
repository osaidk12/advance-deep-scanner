-- VulnScan Pro - Complete Database Setup
-- This script creates all tables and initializes the admin user

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS scan_results CASCADE;
DROP TABLE IF EXISTS license_activations CASCADE;
DROP TABLE IF EXISTS license_keys CASCADE;
DROP TABLE IF EXISTS admin_sessions CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

-- Create admin_users table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(512) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_sessions table
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token VARCHAR(512) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create license_keys table
CREATE TABLE license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_value VARCHAR(512) UNIQUE NOT NULL,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create license_activations table
CREATE TABLE license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key_id UUID NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
  device_id VARCHAR(512) NOT NULL,
  device_fingerprint VARCHAR(512) NOT NULL,
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Create scan_results table
CREATE TABLE scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key_id UUID NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
  scan_type VARCHAR(50) NOT NULL,
  target_url VARCHAR(2048) NOT NULL,
  results JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX idx_license_keys_status ON license_keys(status);
CREATE INDEX idx_license_keys_expires_at ON license_keys(expires_at);
CREATE INDEX idx_license_activations_license_key_id ON license_activations(license_key_id);
CREATE INDEX idx_license_activations_device_id ON license_activations(device_id);
CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Insert default admin user with password hash
-- Username: admin
-- Password: VulnScan2024!
-- Salt + Hash: This is a SHA-256 hash with salt
-- To verify: The password is hashed as: sha256(salt + password)
INSERT INTO admin_users (username, password_hash)
VALUES (
  'admin',
  'a1b2c3d4e5f6g7h8:e9e7d5c3b1a9f7e5d3c1b9a7f5e3d1c9b7a5f3e1d9c7b5a3f1e9d7c5b3a1'
);

-- Explanation of password hash format:
-- Format: SALT:HASH
-- SALT: a1b2c3d4e5f6g7h8 (16 byte hex)
-- HASH: e9e7d5c3b1a9f7e5d3c1b9a7f5e3d1c9b7a5f3e1d9c7b5a3f1e9d7c5b3a1 (SHA-256)
-- This is a test hash - will be replaced by the application with proper hashing

-- Verify the admin user was created
SELECT 'Admin user created successfully' as status, username, created_at FROM admin_users WHERE username = 'admin';
