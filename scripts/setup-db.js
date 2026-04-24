#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const postgres = require('postgres');

const sql = postgres({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DATABASE,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: 'require',
});

async function setupDatabase() {
  try {
    console.log('[v0] Setting up database schema...');

    // Create admin_users table
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('[v0] ✓ Created admin_users table');

    // Create admin_sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true
      )
    `;
    console.log('[v0] ✓ Created admin_sessions table');

    // Create license_keys table
    await sql`
      CREATE TABLE IF NOT EXISTS license_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT UNIQUE NOT NULL,
        description TEXT,
        duration_days INTEGER DEFAULT 365,
        created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        activation_count INTEGER DEFAULT 0,
        max_activations INTEGER,
        status TEXT DEFAULT 'active',
        is_revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMP
      )
    `;
    console.log('[v0] ✓ Created license_keys table');

    // Create license_activations table
    await sql`
      CREATE TABLE IF NOT EXISTS license_activations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        license_id UUID NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
        device_id TEXT UNIQUE NOT NULL,
        device_name TEXT,
        device_fingerprint TEXT,
        activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_verified_at TIMESTAMP,
        ip_address TEXT,
        expires_at TIMESTAMP
      )
    `;
    console.log('[v0] ✓ Created license_activations table');

    // Create scan_results table
    await sql`
      CREATE TABLE IF NOT EXISTS scan_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        license_id UUID NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
        scan_type TEXT NOT NULL,
        target TEXT,
        results JSONB,
        status TEXT DEFAULT 'pending',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        duration_seconds INTEGER,
        error_message TEXT
      )
    `;
    console.log('[v0] ✓ Created scan_results table');

    // Create audit_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        details JSONB,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('[v0] ✓ Created audit_logs table');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_license_activations_license_id ON license_activations(license_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id)`;
    console.log('[v0] ✓ Created indexes');

    // Create default admin if it doesn't exist
    const admins = await sql`SELECT COUNT(*) as count FROM admin_users WHERE username = 'admin'`;
    if (admins[0].count === 0) {
      // Hash password: "VulnScan2024!"
      const crypto = require('crypto');
      const salt = crypto.randomUUID();
      const password = 'VulnScan2024!';
      const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
      const passwordHash = `${salt}:${hash}`;

      await sql`
        INSERT INTO admin_users (username, password_hash, is_active)
        VALUES ('admin', ${passwordHash}, true)
      `;
      console.log('[v0] ✓ Created default admin user (username: admin, password: VulnScan2024!)');
    } else {
      console.log('[v0] ✓ Admin user already exists');
    }

    console.log('[v0] ✅ Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('[v0] ❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();
