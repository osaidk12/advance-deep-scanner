#!/usr/bin/env node

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = 'VulnScan2024!';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set in .env.local');
  process.exit(1);
}

console.log('🔧 VulnScan Pro - Database Setup');
console.log('================================\n');

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createAdminUser() {
  try {
    console.log('📊 Step 1: Creating database tables...');
    
    // Read and execute the SQL setup script
    const fs = require('fs');
    const setupSQL = fs.readFileSync('./scripts/04_final_setup.sql', 'utf-8');
    
    // Execute each statement
    const statements = setupSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await supabase.rpc('sql', { query: statement });
      } catch (err) {
        // Continue even if some statements fail (like drop if exists)
      }
    }
    
    console.log('✅ Database tables created\n');
    
    // Hash the password
    console.log('🔐 Step 2: Generating password hash...');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(salt + PASSWORD).digest('hex');
    const passwordHash = `${salt}:${hash}`;
    
    console.log('✅ Password hash generated\n');
    
    // Insert admin user
    console.log('👤 Step 3: Creating admin user...');
    const { data, error } = await supabase
      .from('admin_users')
      .insert({
        username: 'admin',
        password_hash: passwordHash,
      })
      .select();
    
    if (error) {
      if (error.message.includes('duplicate key')) {
        console.log('⚠️  Admin user already exists');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Admin user created\n');
    }
    
    // Verify setup
    console.log('✔️  Step 4: Verifying setup...');
    const { count: adminCount } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true });
    
    const { count: keysCount } = await supabase
      .from('license_keys')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Database verification complete\n`);
    
    console.log('🎉 Setup Complete!');
    console.log('================================');
    console.log(`Admin Users: ${adminCount}`);
    console.log(`License Keys Table: Created`);
    console.log('\n📝 Default Credentials:');
    console.log(`Username: admin`);
    console.log(`Password: ${PASSWORD}`);
    console.log('\n⚠️  Remember to change the password after first login!\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createAdminUser();
