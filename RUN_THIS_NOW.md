# ADMIN LOGIN - FIX NOW

Your Supabase credentials are in `.env.local`. Now run this ONE command to set up the database:

```bash
npm run init-db
```

That's it! This will:
- ✅ Create all 6 database tables
- ✅ Create admin user
- ✅ Set password: `VulnScan2024!`
- ✅ Display verification info

## Then Start Your App

```bash
npm run dev
```

Visit: http://localhost:5173/admin

Login with:
- Username: `admin`
- Password: `VulnScan2024!`

Then click the lock icon to change your password.

---

## If Something Goes Wrong

Check that `.env.local` has real values (not placeholders):

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

If missing, copy them from: supabase.com → Your Project → Settings → API

Then run: `npm run init-db` again
