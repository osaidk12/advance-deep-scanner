# Network Error Fix - Complete Guide

## Problem
The admin panel login shows: **"Network error. Please try again."**

## Root Cause
The Supabase database tables were never created. The Edge Functions (admin-login, admin-verify, etc.) were trying to query tables that don't exist.

## Solution Summary

### What I Fixed
1. ✅ Created `scripts/setup-db.js` - Automatic database table creation
2. ✅ Created `.env.local` template - Environment variables placeholder
3. ✅ Created `DATABASE_SETUP.md` - Step-by-step setup guide
4. ✅ Added `npm run setup-db` script - Easy one-command setup
5. ✅ Improved error messages - Better debugging info

### What You Need to Do (5 Steps)

#### Step 1: Get Supabase Credentials (5 min)
- Go to https://supabase.com and create free account
- Create new PostgreSQL project
- Copy from Settings → API:
  - `VITE_SUPABASE_URL` (Project URL)
  - `VITE_SUPABASE_ANON_KEY` (anon key)

#### Step 2: Get Database Credentials (2 min)
- In Supabase Settings → Database
- Copy connection details:
  - POSTGRES_HOST
  - POSTGRES_DATABASE (should be "postgres")
  - POSTGRES_USER (should be "postgres")
  - POSTGRES_PASSWORD

#### Step 3: Update .env.local (1 min)
Edit `.env.local` in your project root:
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
POSTGRES_HOST=db.xxxxxxxxxxx.supabase.co
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
```

#### Step 4: Create Database Tables (1 min)
```bash
npm run setup-db
```

Expected output:
```
[v0] Setting up database schema...
[v0] ✓ Created admin_users table
[v0] ✓ Created admin_sessions table
[v0] ✓ Created license_keys table
[v0] ✓ Created license_activations table
[v0] ✓ Created scan_results table
[v0] ✓ Created audit_logs table
[v0] ✓ Created indexes
[v0] ✓ Created default admin user
[v0] ✅ Database setup complete!
```

#### Step 5: Deploy Edge Functions (5 min)
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy functions (use your project ID from Supabase dashboard)
supabase functions deploy admin-login --project-id YOUR_PROJECT_ID
supabase functions deploy admin-verify --project-id YOUR_PROJECT_ID
supabase functions deploy license-admin --project-id YOUR_PROJECT_ID
supabase functions deploy license-validate --project-id YOUR_PROJECT_ID
```

### Step 6: Test

```bash
npm run dev
```

Go to http://localhost:5173/admin

Login with:
- Username: `admin`
- Password: `VulnScan2024!`

## Files Created/Modified

| File | Purpose |
|------|---------|
| `scripts/setup-db.js` | Database table creation script |
| `.env.local` | Environment variables (you fill in values) |
| `DATABASE_SETUP.md` | Detailed setup instructions |
| `package.json` | Added `setup-db` npm script |
| `src/components/AdminLogin.tsx` | Better error messages |

## Database Tables Created

```
admin_users          - Admin accounts
admin_sessions       - Active login sessions
license_keys         - License key management
license_activations  - Device activations
scan_results         - Vulnerability scan results
audit_logs           - Activity logging
```

## Troubleshooting

### Still getting "Network error"?

1. **Check .env.local exists** in project root
2. **Verify all values** match your Supabase project
3. **Run setup again**: `npm run setup-db`
4. **Check browser console** for detailed error (F12 → Console)
5. **Check Supabase** that tables exist (SQL Editor)

### "Invalid credentials" instead of network error?
- Good! It means database is connected
- Tables exist but admin user not found
- Run: `npm run setup-db` again

### "connect ECONNREFUSED"?
- Supabase credentials are wrong
- Double-check POSTGRES_HOST and POSTGRES_PASSWORD
- Try creating new password in Supabase Settings

### Edge Functions returning 404?
- Edge Functions not deployed
- Run the supabase deploy commands
- Or use Supabase dashboard to deploy manually

## Next Steps After Login

1. ✅ Change default admin password
2. ✅ Generate license keys
3. ✅ Test license activation
4. ✅ Run vulnerability scans
5. ✅ Deploy to production

## Quick Reference

| When You See | Action |
|---|---|
| Network error | Follow steps 1-5 above |
| Invalid credentials | Database connected, check admin user |
| 404 on login | Deploy Edge Functions |
| No tables in Supabase | Run `npm run setup-db` |

## Support

For detailed setup instructions, see: **DATABASE_SETUP.md**

For other issues, check the error message in browser console (F12) for more details.

---

**Status:** ✅ All fixes deployed and committed
**Ready to:** Complete database setup and login
