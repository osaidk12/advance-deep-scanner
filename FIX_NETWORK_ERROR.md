# Fix Network Error - Step by Step

## Problem
You're getting "Network error. Please try again." when trying to login with admin/VulnScan2024!

## Root Cause
The Supabase database tables haven't been created yet. The Edge Function is trying to query non-existent tables.

## Solution - 4 Easy Steps

### Step 1: Get Your Supabase Credentials (2 minutes)

1. Go to https://supabase.com and login
2. Find your project in the dashboard
3. Click on "Settings" → "API"
4. Copy these values:
   - **Project URL** (e.g., https://xxxxxxxxxxxx.supabase.co)
   - **Anon key** (public key, starts with eyJ...)
5. Go to "Settings" → "Database"
6. Copy these values:
   - **Host** (db.xxxxxxxxxxxx.supabase.co)
   - **Password** (your database password)
   - **Port** (usually 5432)
   - **User** (usually postgres)

### Step 2: Create the Database Schema (3 minutes)

1. In Supabase, go to "SQL Editor"
2. Click "New Query"
3. Copy the entire content from `scripts/03_complete_setup.sql`
4. Paste it into the SQL editor
5. Click "Run" button
6. You should see all tables created successfully

**Tables created:**
- ✓ admin_users
- ✓ admin_sessions
- ✓ license_keys
- ✓ license_activations
- ✓ audit_logs
- ✓ scan_results

### Step 3: Create the Default Admin User (1 minute)

Run this SQL query in Supabase SQL Editor:

```sql
-- Create default admin user with password: VulnScan2024!
INSERT INTO admin_users (username, password_hash, is_active)
VALUES (
  'admin',
  'default-salt:4e6e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e',
  true
);
```

**Note:** The password hash above is a placeholder. For proper security, we need to generate the correct hash.

### Step 4: Generate Correct Password Hash (1 minute)

To create the correct password hash for "VulnScan2024!", run this in your terminal:

```bash
node -e "
const crypto = require('crypto');
const password = 'VulnScan2024!';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
console.log('Hash:', salt + ':' + hash);
"
```

Copy the output and run this in Supabase:

```sql
UPDATE admin_users 
SET password_hash = 'PASTE_THE_HASH_HERE'
WHERE username = 'admin';
```

## Verification

After completing all steps:

1. Go to http://localhost:5173/admin
2. Enter username: `admin`
3. Enter password: `VulnScan2024!`
4. Click "Sign In"
5. You should see the Admin Dashboard

## If Still Getting Network Error

Check these:

1. **Database tables exist?**
   - In Supabase SQL Editor, run:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   ```
   - You should see: admin_users, admin_sessions, license_keys, etc.

2. **Admin user exists?**
   - Run in Supabase SQL Editor:
   ```sql
   SELECT * FROM admin_users;
   ```
   - You should see the admin user

3. **Environment variables correct?**
   - Check that `.env.local` has correct Supabase URL and keys
   - Restart the dev server: `npm run dev`

4. **Edge Functions deployed?**
   - Check Supabase: Functions → admin-login
   - Should have green "Active" status

## Complete Checklist

- [ ] Supabase project created
- [ ] Copied Project URL to `.env.local`
- [ ] Copied Anon Key to `.env.local`
- [ ] Ran `scripts/03_complete_setup.sql` in Supabase
- [ ] Created admin user with password hash
- [ ] Dev server restarted
- [ ] Can login at http://localhost:5173/admin

## Need More Help?

Check these files:
- `ADMIN_LOGIN_GUIDE.md` - Detailed login instructions
- `DATABASE_SETUP.md` - Complete database setup guide
- `ADMIN_SETUP_CHECKLIST.md` - Full verification checklist
