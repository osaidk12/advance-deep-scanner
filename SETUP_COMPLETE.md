# Setup is Complete! ✅

I've automatically created everything you need. Just follow these 3 super simple steps.

## The 3-Step Fix

### Step 1: Get Your Supabase Keys (2 min)
Go to https://supabase.com → Your Project → Settings → API

Copy these 3 things:
1. **Project URL** (starts with `https://`)
2. **Anon Key** (long string)
3. **Service Role Secret** (very long secret)

### Step 2: Put Them In `.env.local` (1 min)
Open `.env.local` in your project and paste:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=paste-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-service-role-key-here
```

### Step 3: Run Setup Command (30 seconds)
```bash
npm run setup-admin
```

You'll see this:
```
✅ Database tables created
✅ Password hash generated
✅ Admin user created
🎉 Setup Complete!

Default Credentials:
Username: admin
Password: VulnScan2024!
```

## Then Login & Change Password

1. Start your app:
   ```bash
   npm run dev
   ```

2. Go to: http://localhost:5173/admin

3. Login with:
   - Username: `admin`
   - Password: `VulnScan2024!`

4. Click the lock icon (top right) to change password

5. Enter current password: `VulnScan2024!`

6. Enter your new password (min 8 characters)

7. Click "Change Password"

8. Done! Your password is now changed

## What Gets Created

✅ 6 database tables (all auto-created):
- admin_users (your account)
- admin_sessions (login sessions)
- license_keys (the keys you generate)
- license_activations (when keys are used)
- scan_results (scan history)
- audit_logs (all actions logged)

✅ Admin user ready to use:
- Username: admin
- Password: VulnScan2024!
- Can change anytime after login

✅ Full admin dashboard with:
- Generate license keys
- View all keys
- Search keys
- Revoke keys
- Delete keys
- See statistics
- Change password
- Full audit logging

## That's It!

No complicated SQL. No confusing steps. Just 3 things:
1. Copy 3 keys from Supabase
2. Paste into .env.local
3. Run: `npm run setup-admin`

Everything else is automatic!

## If You Get An Error

Common issues:
- ❌ "Database not found" → Check your Supabase URL
- ❌ "Key not found" → Check your Anon Key
- ❌ "Permission denied" → Check your Service Role Key

The error message will tell you exactly what's wrong!

## Ready?

Start now:
```bash
npm run setup-admin
npm run dev
# Visit: http://localhost:5173/admin
```

You'll have a working admin panel in 5 minutes! 🎉
