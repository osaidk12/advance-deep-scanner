# Simple Setup - Just 3 Steps!

## What You Need
- Supabase account (free at supabase.com)
- Your Supabase project

## Step 1: Copy Supabase Credentials (2 minutes)

1. Go to **supabase.com**
2. Click on your project
3. Go to **Settings → API**
4. Copy these and save them:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon Key** → `VITE_SUPABASE_ANON_KEY`
   - **Service Role Secret** → `SUPABASE_SERVICE_ROLE_KEY`

## Step 2: Run Database Setup (1 minute)

Open `.env.local` in your project and paste:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Then run:
```bash
npm run setup-admin
```

You should see:
```
✅ Database tables created
✅ Password hash generated
✅ Admin user created
🎉 Setup Complete!

Default Credentials:
Username: admin
Password: VulnScan2024!
```

## Step 3: Login & Change Password (2 minutes)

1. Start the app:
   ```bash
   npm run dev
   ```

2. Go to: **http://localhost:5173/admin**

3. Login with:
   - Username: `admin`
   - Password: `VulnScan2024!`

4. You'll see the admin dashboard

5. Click the **lock icon** at the top right

6. Change your password:
   - Current: `VulnScan2024!`
   - New: Your choice (min 8 characters)

7. Click **Change Password** and confirm

8. Logout and login with your new password

## Done! 🎉

You now have:
- ✅ Complete database with 6 tables
- ✅ Admin user ready to use
- ✅ Password changed to your choice
- ✅ Full license management system

## If Something Goes Wrong

Check the console (F12) for errors. Most common issues:
- **"Database not found"** → Check your Supabase URL is correct
- **"Key not found"** → Check your Anon Key is correct
- **"Permission denied"** → Check your Service Role Key is correct

That's it! No complicated SQL, no confusing steps. Just 3 simple steps.
