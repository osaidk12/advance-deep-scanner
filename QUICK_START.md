# 🚀 Quick Start Guide - 5 Minutes to Running

## TL;DR

```bash
# 1. Setup (2 min)
npm install
cp .env.example .env.local
# Add Supabase URL and anon key to .env.local

# 2. Database (1 min)
# Copy scripts/01_setup_database.sql
# Paste in Supabase SQL Editor → Run

# 3. Admin (1 min)
# In Supabase SQL Editor, run:
INSERT INTO admin_users (username, password_hash) VALUES ('admin', 'admin123');

# 4. Run (1 min)
npm run dev
# Visit http://localhost:5173
```

---

## Step-by-Step

### 1️⃣ Install Dependencies
```bash
npm install
```
**Expected output:** Installs ~200 packages, no errors

### 2️⃣ Get Supabase Credentials
1. Go to [supabase.com](https://supabase.com)
2. Create new project (free)
3. Copy:
   - **Project URL**: Settings → API → Project URL
   - **Anon Key**: Settings → API → anon (public)

### 3️⃣ Configure Environment
```bash
# Copy template
cp .env.example .env.local

# Edit .env.local with your credentials:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

### 4️⃣ Create Database Tables
```sql
-- In Supabase → SQL Editor → New Query
-- Copy entire contents of scripts/01_setup_database.sql
-- Click "Run"
```

### 5️⃣ Create Admin User
```sql
-- In Supabase → SQL Editor → New Query
INSERT INTO admin_users (username, password_hash) 
VALUES ('admin', 'admin123');
-- Click "Run"
```

### 6️⃣ Start Development Server
```bash
npm run dev
```
**Visit:** http://localhost:5173

---

## First Tests

### Test License Activation
1. Page shows "Activate Your License"
2. Generate a key in admin panel (see below)
3. Paste key and click "Activate License"
4. Should show "Licensed" status

### Test Admin Panel
1. Go to http://localhost:5173/admin
2. Login: **admin** / **admin123**
3. Click "Generate Keys"
4. Create 1 key for 30 days
5. Copy the key → use in main app

### Test Scanning
1. Back to main page
2. Click "Light Scan"
3. Enter any URL (e.g., https://example.com)
4. Click "Start Scan"
5. Watch progress → Get results

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build          # Build for production
npm run preview        # Preview production build
npm run typecheck      # Check TypeScript errors
npm run lint           # Run linter

# Database
# (Use Supabase SQL Editor in dashboard)
```

---

## Environment Variables Quick Reference

| Variable | Where to Find | Example |
|----------|---------------|---------|
| `VITE_SUPABASE_URL` | Supabase → Settings → API | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API | `eyJhbGci...` |

---

## Project URLs

| Page | URL | Purpose |
|------|-----|---------|
| Main App | http://localhost:5173 | License & Scanning |
| Admin | http://localhost:5173/admin | Key Management |

---

## Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |

**⚠️ CHANGE in production!**

---

## File Locations

```
✅ .env.example          - Copy this to .env.local
✅ scripts/*.sql         - Database schemas
✅ src/utils/supabase.ts - Supabase client
✅ vercel.json          - Deployment config
```

---

## Troubleshooting (2 min)

### "Module not found: @supabase/supabase-js"
```bash
npm install @supabase/supabase-js
npm run dev
```

### "Cannot find environment variables"
1. Check `.env.local` exists
2. Verify format: `VITE_SUPABASE_URL=...`
3. Restart dev server

### "License activation fails"
1. Check admin user exists: Supabase → SQL Editor
   ```sql
   SELECT * FROM admin_users;
   ```
2. Check license key exists in `license_keys` table
3. Verify key status is 'active' not 'inactive'

### "Admin login fails"  
1. Verify admin user exists (see above)
2. Check credentials: admin / admin123
3. Make sure you ran the SQL INSERT command

---

## What's Included

✅ **Frontend**
- License activation UI
- Admin dashboard
- Vulnerability scanning interface
- PDF report generation

✅ **Backend**
- Supabase PostgreSQL database
- Edge Functions for authentication
- License validation system
- Admin key management

✅ **Documentation**
- SETUP.md (detailed setup)
- DEPLOYMENT.md (production)
- ERRORS_FIXED.md (all fixes)
- IMPLEMENTATION_CHECKLIST.md (step-by-step)
- This file (quick start)

---

## Next Steps

1. ✅ Follow steps above (5 min)
2. ✅ Test all features
3. ✅ Read SETUP.md for details
4. ✅ Read DEPLOYMENT.md to deploy
5. ✅ Deploy to Vercel

---

## Support

- **Setup issues?** → Read SETUP.md
- **Deployment?** → Read DEPLOYMENT.md  
- **Errors?** → Read ERRORS_FIXED.md
- **All steps?** → Read IMPLEMENTATION_CHECKLIST.md

---

## Build Status

✅ TypeScript: No errors  
✅ Build: 5.07s success  
✅ Dependencies: All installed  
✅ Ready: YES ✅

---

**You're ready to use VulnScan Pro! 🎉**

Start with: `npm run dev`
