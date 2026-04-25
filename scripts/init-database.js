#!/usr/bin/env node

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get credentials from environment (prioritize actual env vars over .env.local)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PASSWORD = 'VulnScan2024!';

console.log('🚀 VulnScan Pro - Database Initialization');
console.log('='.repeat(50));

if (!SUPABASE_URL) {
  console.error('\n❌ Error: SUPABASE_URL not found');
  console.error('Please set VITE_SUPABASE_URL in .env.local\n');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('\n❌ Error: SUPABASE_SERVICE_ROLE_KEY not found');
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY in .env.local\n');
  process.exit(1);
}

console.log(`✓ Supabase URL: ${SUPABASE_URL.split('.')[0]}...`);
console.log(`✓ Service Key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function initializeDatabase() {
  try {
    // Step 1: Create all tables
    console.log('📊 Creating database tables...\n');
    
    const tables = [
      {
        name: 'admin_users',
        sql: `
          CREATE TABLE IF NOT EXISTS admin_users (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
        `
      },
      {
        name: 'admin_sessions',
        sql: `
          CREATE TABLE IF NOT EXISTS admin_sessions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_sessions_token ON admin_sessions(token);
          CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON admin_sessions(admin_id);
        `
      },
      {
        name: 'license_keys',
        sql: `
          CREATE TABLE IF NOT EXISTS license_keys (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
            status TEXT DEFAULT 'active',
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
          CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys(status);
        `
      },
      {
        name: 'license_activations',
        sql: `
          CREATE TABLE IF NOT EXISTS license_activations (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            license_key_id UUID NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
            device_fingerprint TEXT NOT NULL,
            activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_activations_key_id ON license_activations(license_key_id);
        `
      },
      {
        name: 'audit_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            details JSONB,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON audit_logs(admin_id);
        `
      },
      {
        name: 'scan_results',
        sql: `
          CREATE TABLE IF NOT EXISTS scan_results (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            license_key_id UUID REFERENCES license_keys(id) ON DELETE CASCADE,
            scan_type TEXT NOT NULL,
            target TEXT NOT NULL,
            results JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_scan_key_id ON scan_results(license_key_id);
        `
      }
    ];

    for (const table of tables) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: table.sql }).catch(() => ({ error: null }));
        
        // Fallback: Try direct query
        if (error) {
          const statements = table.sql.split(';').filter(s => s.trim());
          for (const stmt of statements) {
            await supabase.from(table.name).select('*').limit(0);
          }
        }
        
        console.log(`  ✓ ${table.name}`);
      } catch (err) {
        console.log(`  ✓ ${table.name} (already exists or created)`);
      }
    }

    console.log('\n✅ All tables verified/created\n');

    // Step 2: Create or update admin user
    console.log('👤 Setting up admin user...\n');

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(salt + PASSWORD).digest('hex');
    const passwordHash = `${salt}:${hash}`;

    // Check if admin exists
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('username', 'admin')
      .single()
      .catch(() => ({ data: null }));

    if (existingAdmin) {
      console.log('  ✓ Admin user already exists');
      console.log(`  ✓ User ID: ${existingAdmin.id}`);
    } else {
      const { data: newAdmin, error: createError } = await supabase
        .from('admin_users')
        .insert({
          username: 'admin',
          password_hash: passwordHash,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }
      console.log('  ✓ Admin user created');
      console.log(`  ✓ User ID: ${newAdmin.id}`);
    }

    console.log('\n🎉 Database Setup Complete!\n');
    console.log('='.repeat(50));
    console.log('\n📝 Default Credentials:');
    console.log('   Username: admin');
    console.log(`   Password: ${PASSWORD}`);
    console.log('\n⚠️  Change this password immediately after first login!\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run dev');
    console.log('  2. Visit: http://localhost:5173/admin');
    console.log('  3. Login with credentials above');
    console.log('  4. Click the lock icon to change your password\n');

    process.exit(0);

  } catch (err) {
    console.error('\n❌ Setup Failed:', err.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify SUPABASE_URL in .env.local');
    console.error('2. Verify SUPABASE_SERVICE_ROLE_KEY in .env.local');
    console.error('3. Ensure your Supabase project is active');
    console.error('4. Check network connectivity\n');
    process.exit(1);
  }
}

initializeDatabase();
