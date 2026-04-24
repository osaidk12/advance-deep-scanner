# Admin Panel Setup Checklist

Complete this checklist step-by-step to get your admin panel working properly.

## Prerequisites
- [ ] Node.js installed (v16 or higher)
- [ ] npm installed
- [ ] Supabase account created
- [ ] Supabase project created
- [ ] Database credentials obtained

## Phase 1: Environment Setup (5 min)

### 1.1 Get Supabase Credentials
- [ ] Go to https://supabase.com
- [ ] Create new project or use existing
- [ ] Go to Settings → API
- [ ] Copy Project URL → `VITE_SUPABASE_URL`
- [ ] Copy Anon Key → `VITE_SUPABASE_ANON_KEY`
- [ ] Go to Settings → Database
- [ ] Copy Host → `POSTGRES_HOST`
- [ ] Copy User → `POSTGRES_USER`
- [ ] Copy Password → `POSTGRES_PASSWORD`
- [ ] Database name is usually `postgres`

### 1.2 Configure .env.local
- [ ] Create/Edit `.env.local` in project root
- [ ] Fill in all Supabase credentials:
  ```env
  VITE_SUPABASE_URL=https://xxxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  POSTGRES_HOST=db.xxxxx.supabase.co
  POSTGRES_PORT=5432
  POSTGRES_DATABASE=postgres
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=your-password
  ```
- [ ] Save the file

## Phase 2: Database Setup (5 min)

### 2.1 Install Dependencies
```bash
npm install
```
- [ ] Command completed successfully

### 2.2 Setup Database Schema and Default Admin
```bash
npm run setup-db
```
- [ ] See output: "✓ Created admin_users table"
- [ ] See output: "✓ Created admin_sessions table"
- [ ] See output: "✓ Created license_keys table"
- [ ] See output: "✓ Created license_activations table"
- [ ] See output: "✓ Created scan_results table"
- [ ] See output: "✓ Created audit_logs table"
- [ ] See output: "✅ Database setup complete!"

## Phase 3: Local Development (3 min)

### 3.1 Start Dev Server
```bash
npm run dev
```
- [ ] Dev server started successfully
- [ ] See message: "Local: http://localhost:5173"
- [ ] Local URL accessible

### 3.2 Navigate to Admin Login
- [ ] Open http://localhost:5173/admin in browser
- [ ] See Admin Panel login form
- [ ] See default credentials message (green box)

## Phase 4: First Login (2 min)

### 4.1 Login with Default Credentials
- [ ] Username: `admin`
- [ ] Password: `VulnScan2024!`
- [ ] Click "Sign In"
- [ ] Successfully redirected to Admin Dashboard
- [ ] See "License Key Management System" header
- [ ] See your username "admin" in top right (green indicator)

### 4.2 View Dashboard
- [ ] See statistics box with key counts
- [ ] See license keys table (initially empty)
- [ ] See "Generate Keys" button
- [ ] See Lock icon (change password) in top right
- [ ] See "Logout" button

## Phase 5: Change Default Password (2 min) ⚠️ IMPORTANT

### 5.1 Open Change Password Modal
- [ ] Click Lock icon (🔒) in top right corner
- [ ] "Change Password" dialog appears

### 5.2 Enter Current Password
- [ ] Enter current password: `VulnScan2024!`

### 5.3 Enter New Password
- [ ] Enter a strong new password (min 8 characters)
- [ ] Examples: `MySecurePass123!`, `AdminKey@2024$`
- [ ] Avoid simple/common passwords

### 5.4 Confirm New Password
- [ ] Re-enter same password in confirmation field
- [ ] Passwords match

### 5.3 Submit
- [ ] Click "Change Password" button
- [ ] See success message: "Password changed successfully"
- [ ] Modal closes automatically

### 5.4 Verify New Password Works
- [ ] Click Logout button
- [ ] Return to login page
- [ ] Try logging in with old password → should fail
- [ ] Try logging in with new password → should work
- [ ] Successfully in admin dashboard with new password

## Phase 6: Test Admin Features (10 min)

### 6.1 Generate License Keys
- [ ] Click "Generate Keys" button
- [ ] Set "Number of Keys": 3
- [ ] Set "Duration (days)": 365
- [ ] Add optional notes
- [ ] Click "Generate"
- [ ] See success message
- [ ] See 3 new keys appear in table
- [ ] Each key has a copy button

### 6.2 Copy a License Key
- [ ] Click copy icon next to a key
- [ ] See "Copied!" indicator
- [ ] Can paste the key elsewhere

### 6.3 Search Keys
- [ ] Enter text in search box
- [ ] Table filters in real-time
- [ ] Clear search to see all again

### 6.4 Filter by Status
- [ ] Click "Status" filter dropdown
- [ ] Select "active"
- [ ] See only active keys
- [ ] Select "all"
- [ ] See all keys again

### 6.5 View Key Details
- [ ] Each row shows:
  - [ ] License key (copyable)
  - [ ] Created date
  - [ ] Expires date
  - [ ] Status badge (active/inactive/expired/revoked)
  - [ ] Activation count
  - [ ] Actions (revoke/delete)

## Phase 7: Security Check (2 min)

### 7.1 Session Security
- [ ] Admin session token stored in sessionStorage
- [ ] Token automatically cleared on logout
- [ ] Sessions expire after 24 hours

### 7.2 Password Security
- [ ] Default password changed
- [ ] New password is strong (8+ chars, mixed case, special chars)
- [ ] No password stored in .env or code

### 7.3 Audit Logging
- [ ] All admin actions logged in database
- [ ] Includes: timestamp, action, IP address, user agent

## Phase 8: Production Deployment (5 min)

### 8.1 Deploy Edge Functions
Before deploying to production, deploy Supabase Edge Functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy functions
supabase functions deploy admin-login --project-id YOUR_PROJECT_ID
supabase functions deploy admin-verify --project-id YOUR_PROJECT_ID
supabase functions deploy license-admin --project-id YOUR_PROJECT_ID
```

- [ ] All functions deployed successfully
- [ ] Check Supabase Dashboard → Edge Functions
- [ ] All functions show "Active" status

### 8.2 Deploy to Vercel
```bash
git add -A
git commit -m "fix: Deploy admin panel and database setup"
git push origin main
```

- [ ] Code pushed to main branch
- [ ] Vercel automatically deploys
- [ ] Check deployment URL works
- [ ] Admin panel accessible at `/admin` route

### 8.3 Production Environment Variables
In Vercel Project Settings → Environment Variables:
- [ ] Add `VITE_SUPABASE_URL`
- [ ] Add `VITE_SUPABASE_ANON_KEY`
- [ ] Variables match Supabase project
- [ ] Redeploy after adding variables

## Phase 9: Final Verification

### 9.1 Production Admin Panel
- [ ] Login works in production
- [ ] Can generate license keys
- [ ] Can view all keys
- [ ] Can search and filter
- [ ] Can change password
- [ ] Can logout
- [ ] No console errors

### 9.2 Security in Production
- [ ] HTTPS enabled (Vercel automatic)
- [ ] All environment variables are private
- [ ] No sensitive data in public files
- [ ] Edge functions deployed and active

## Troubleshooting

### Login fails
1. Check credentials: username=`admin`, password=your-new-password
2. Verify .env.local has correct Supabase credentials
3. Ensure `npm run setup-db` completed successfully
4. Check browser console for network errors

### Database tables don't exist
1. Run `npm run setup-db` again
2. Check .env.local credentials are correct
3. Verify Supabase project is active

### Edge Functions not working
1. Deploy functions: `supabase functions deploy ...`
2. Check Supabase Dashboard for function status
3. Verify SERVICE_ROLE_KEY is set in Supabase

### Can't see license keys
1. Generate some first with "Generate Keys" button
2. Reload page (F5)
3. Check filter status is not set to specific status

## Success Criteria

When complete, you should be able to:
- [ ] Login to admin panel with your new password
- [ ] Generate new license keys
- [ ] View all generated keys
- [ ] Search and filter keys
- [ ] Copy keys to clipboard
- [ ] Change password anytime
- [ ] Logout securely
- [ ] See all changes reflected immediately

---

**Total Time: ~40 minutes from start to working production admin panel**

For detailed instructions, see:
- `ADMIN_LOGIN_GUIDE.md` - Login and password change help
- `SETUP.md` - Environment configuration details
- `DEPLOYMENT.md` - Production deployment guide
