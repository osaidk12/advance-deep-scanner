# Troubleshooting Guide - Network Error & Login Issues

## Problem: "Network error. Please try again."

### Quick Diagnosis

Open your browser's Developer Tools (F12) and check:
1. **Console tab** - Any error messages?
2. **Network tab** - Click "Sign In" button and watch for failed requests
3. Look for requests to `your-project.supabase.co/functions/v1/admin-login`

---

## Solution Guide

### ✅ Issue 1: Database Tables Not Created

**How to check:**
1. Go to Supabase dashboard
2. Click "SQL Editor"
3. Run this query:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

**Expected result:** Should list these tables:
- admin_users
- admin_sessions
- license_keys
- license_activations
- audit_logs
- scan_results

**If missing:**
1. Go to `scripts/03_complete_setup.sql` in your project
2. Copy the entire file
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for completion

---

### ✅ Issue 2: Environment Variables Not Set

**How to check:**
1. Open `.env.local` file
2. Verify these lines are NOT placeholders:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

**How to fix:**
1. Go to Supabase Dashboard → Settings → API
2. Copy "Project URL" and paste as `VITE_SUPABASE_URL`
3. Copy "anon public" key and paste as `VITE_SUPABASE_ANON_KEY`
4. Save `.env.local`
5. Restart dev server: `npm run dev`

---

### ✅ Issue 3: Admin User Not Found

**How to check:**
1. Go to Supabase SQL Editor
2. Run:
```sql
SELECT id, username, is_active FROM admin_users;
```

**Expected result:** Should show admin user with username "admin"

**If not found:**
1. Run this SQL to create admin user:
```sql
INSERT INTO admin_users (username, password_hash, is_active)
VALUES (
  'admin',
  'YOUR_HASH_HERE',
  true
);
```

2. To generate the hash, run in terminal:
```bash
node -e "
const crypto = require('crypto');
const password = 'VulnScan2024!';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
console.log(salt + ':' + hash);
"
```

3. Replace `YOUR_HASH_HERE` with the output
4. Run the INSERT query

---

### ✅ Issue 4: Wrong Password Hash

**Symptom:** Login fails with "Invalid credentials"

**How to fix:**

1. Get the correct hash:
```bash
node -e "
const crypto = require('crypto');
const password = 'VulnScan2024!';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
console.log('Copy this: ' + salt + ':' + hash);
"
```

2. Update in Supabase:
```sql
UPDATE admin_users 
SET password_hash = 'PASTE_YOUR_HASH_HERE'
WHERE username = 'admin';
```

---

### ✅ Issue 5: Edge Function Not Working

**How to check:**
1. Supabase Dashboard → Functions → admin-login
2. Should show green "Active" badge
3. Check the "Logs" section for errors

**If inactive:**
1. Go to `supabase/functions/admin-login/index.ts`
2. Check for syntax errors
3. Restart Supabase: `supabase start`

**If you see errors in Logs:**
1. Read the error message carefully
2. Common issues:
   - Database connection failed
   - Table doesn't exist
   - Missing environment variables

---

### ✅ Issue 6: CORS Error

**Error message:** "Access to fetch at ... has been blocked by CORS policy"

**How to fix:**
1. Check the Edge Function header:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

2. Make sure every response includes: `...corsHeaders`

3. Verify in `supabase/functions/admin-login/index.ts`

---

### ✅ Issue 7: Dev Server Not Running

**How to check:**
1. Terminal should show: `VITE vX.X.X ready in XXX ms`
2. Should see: `Local: http://localhost:5173`

**If not running:**
1. Stop the server: Ctrl+C
2. Restart: `npm run dev`
3. Wait for compilation

**If compilation errors:**
1. Check error message in terminal
2. Look for file path and line number
3. Fix the issue
4. Server should auto-reload

---

## Complete Verification Checklist

Run these checks in order:

```bash
# 1. Check environment variables
cat .env.local

# 2. Check Supabase connection
npm run dev

# 3. Open browser DevTools (F12)
# 4. Try to login
# 5. Check Console tab for errors
# 6. Check Network tab for failed requests

# 7. In Supabase SQL Editor, verify tables exist:
SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

# 8. Verify admin user exists:
SELECT * FROM admin_users WHERE username = 'admin';

# 9. Check admin sessions table is empty (no stale sessions):
SELECT count(*) FROM admin_sessions;
```

---

## Step-by-Step Fix Process

If you're still getting the network error, follow this exact sequence:

### Step 1: Get Credentials (5 min)
- Go to Supabase Dashboard
- Settings → API
- Copy Project URL and Anon Key
- Settings → Database
- Note down password and connection details

### Step 2: Update .env.local (2 min)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
POSTGRES_HOST=db.your-project.supabase.co
POSTGRES_PASSWORD=your-password
```

### Step 3: Create Database Schema (3 min)
- Copy all SQL from `scripts/03_complete_setup.sql`
- Paste into Supabase SQL Editor
- Click "Run"

### Step 4: Create Admin User (2 min)
- Generate hash using Node.js command above
- Run UPDATE query in SQL Editor

### Step 5: Restart Dev Server (1 min)
```bash
npm run dev
```

### Step 6: Test Login
- Go to http://localhost:5173/admin
- Username: `admin`
- Password: `VulnScan2024!`
- Click "Sign In"

### Step 7: Check Console (1 min)
- If login fails, check browser Console (F12)
- Look for `[v0]` debug messages
- Check Network tab for response status

---

## Debug Mode

To enable detailed logging:

1. In `src/services/adminService.ts`, logging is already enabled
2. Open DevTools (F12) → Console tab
3. Try to login
4. You'll see `[v0]` prefixed messages showing:
   - Supabase URL being used
   - HTTP response status
   - Response data from server
   - Any errors encountered

---

## Common Error Messages & Fixes

| Error Message | Cause | Fix |
|---|---|---|
| "Network error. Please try again." | Tables not created | Run `scripts/03_complete_setup.sql` |
| "Invalid credentials" | Wrong password hash | Re-generate password hash |
| "User not found" | Admin user not created | Create admin user in SQL |
| "403 Forbidden" | Wrong API key | Copy correct Anon Key |
| "Connection refused" | Supabase down | Check supabase.com status |
| "CORS error" | Edge Function headers | Check corsHeaders in admin-login |

---

## Getting Help

If you're still stuck:

1. **Check the logs:**
   - Browser Console (F12)
   - Supabase Function Logs
   - Terminal output

2. **Read these files:**
   - `FIX_NETWORK_ERROR.md` - Quick 4-step fix
   - `ADMIN_LOGIN_GUIDE.md` - Login instructions
   - `DATABASE_SETUP.md` - Database guide

3. **Verify checklist:**
   - `ADMIN_SETUP_CHECKLIST.md` - 9-phase verification

---

## Still Having Issues?

**Last Resort:**
1. Delete all data and start fresh:
   ```sql
   DROP TABLE IF EXISTS audit_logs CASCADE;
   DROP TABLE IF EXISTS scan_results CASCADE;
   DROP TABLE IF EXISTS license_activations CASCADE;
   DROP TABLE IF EXISTS admin_sessions CASCADE;
   DROP TABLE IF EXISTS license_keys CASCADE;
   DROP TABLE IF EXISTS admin_users CASCADE;
   ```

2. Run `scripts/03_complete_setup.sql` again
3. Restart dev server
4. Try login again

This should fix 99% of issues. Good luck!
