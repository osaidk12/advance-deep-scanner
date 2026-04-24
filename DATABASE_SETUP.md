# Database Setup Guide

## Problem
The admin login is returning a "Network error" because the Supabase database tables haven't been created yet.

## Solution: Complete Step-by-Step

### Step 1: Get Your Supabase Credentials

1. **Go to** [supabase.com](https://supabase.com)
2. **Sign in** or create a free account
3. **Create a new project** (choose PostgreSQL)
4. **Wait for it to finish** (takes 2-3 minutes)
5. **Go to Settings** → **API**
6. **Copy these values:**
   - `Project URL` → Your `VITE_SUPABASE_URL`
   - `anon public` → Your `VITE_SUPABASE_ANON_KEY`

### Step 2: Get Database Credentials

1. **In Supabase**, click **Settings** → **Database**
2. **Look for "Connection string"** section
3. **Copy these values from the connection string:**
   - Host (db.xxxxx.supabase.co) → `POSTGRES_HOST`
   - Database (postgres) → `POSTGRES_DATABASE`
   - User (postgres) → `POSTGRES_USER`
   - Password → `POSTGRES_PASSWORD`

### Step 3: Update .env.local

Edit `/vercel/share/v0-project/.env.local` and replace with your actual values:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key
POSTGRES_HOST=db.xxxxxxxxxxx.supabase.co
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-actual-db-password
```

### Step 4: Run Database Setup

```bash
# From project root
node scripts/setup-db.js
```

You should see:
```
[v0] Setting up database schema...
[v0] ✓ Created admin_users table
[v0] ✓ Created admin_sessions table
[v0] ✓ Created license_keys table
[v0] ✓ Created license_activations table
[v0] ✓ Created scan_results table
[v0] ✓ Created audit_logs table
[v0] ✓ Created indexes
[v0] ✓ Created default admin user (username: admin, password: VulnScan2024!)
[v0] ✅ Database setup complete!
```

### Step 5: Verify in Supabase

1. **Go to Supabase Dashboard**
2. **Click "SQL Editor"** on the left
3. **You should see these tables:**
   - `admin_users`
   - `admin_sessions`
   - `license_keys`
   - `license_activations`
   - `scan_results`
   - `audit_logs`

### Step 6: Deploy Edge Functions

The admin-login function needs to be deployed to Supabase:

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Deploy functions
supabase functions deploy admin-login --project-id <your-project-id>
supabase functions deploy admin-verify --project-id <your-project-id>
supabase functions deploy license-admin --project-id <your-project-id>
supabase functions deploy license-validate --project-id <your-project-id>
```

### Step 7: Test the Login

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Go to** http://localhost:5173/admin

3. **Login with:**
   - Username: `admin`
   - Password: `VulnScan2024!`

4. **You should see the Admin Dashboard** ✅

## Troubleshooting

### "Network error. Please try again."
- ❌ Missing .env.local values
- ✅ Solution: Double-check all env vars are correct

### "Invalid credentials"
- ❌ Database tables exist but no admin user
- ✅ Solution: Run `node scripts/setup-db.js` again

### "Error: connect ECONNREFUSED"
- ❌ Supabase credentials are wrong
- ✅ Solution: Verify in .env.local matches Supabase settings

### "Edge Function not found"
- ❌ Edge functions not deployed
- ✅ Solution: Run the `supabase functions deploy` commands

## Default Credentials

After running setup, you get:
- **Username:** `admin`
- **Password:** `VulnScan2024!`

⚠️ **IMPORTANT:** Change this password immediately after first login!

## Environment Variables Reference

| Variable | Source | Example |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Supabase Settings → API → Project URL | `https://abcdef123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Settings → API → anon key | `eyJhbGc...` |
| `POSTGRES_HOST` | Supabase Settings → Database → Host | `db.abcdef123.supabase.co` |
| `POSTGRES_DATABASE` | Always `postgres` | `postgres` |
| `POSTGRES_USER` | Always `postgres` | `postgres` |
| `POSTGRES_PASSWORD` | Supabase Settings → Database → Password | Your DB password |

## Next Steps

Once database is set up:
1. ✅ Login to admin panel
2. ✅ Generate license keys
3. ✅ Activate licenses in the main app
4. ✅ Run vulnerability scans
5. ✅ Download PDF reports

Questions? Check the logs in your browser console for more details!
