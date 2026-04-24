# Admin Panel - Complete Summary

## Quick Start (3 Steps)

### Step 1: Setup Database
```bash
npm run setup-db
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Login at http://localhost:5173/admin
```
Username: admin
Password: VulnScan2024!
```

## Default Credentials

- **Username**: `admin`
- **Password**: `VulnScan2024!`
- **First Login**: Must change password immediately (see ADMIN_LOGIN_GUIDE.md)

## Admin Dashboard Features

### 1. License Key Management
- **Generate**: Create multiple license keys at once
  - Set quantity (1-100 keys)
  - Set duration (1-365 days)
  - Add custom notes/description
  - Keys are copied to clipboard automatically

- **View**: See all generated keys in a table
  - Key ID and expiration date
  - Current status (active/inactive/expired/revoked)
  - Number of activations
  - Creation timestamp

- **Search**: Find keys by ID or partial match
  - Real-time filtering as you type
  - Case-insensitive search

- **Filter**: Filter by status
  - All - Show all keys
  - Active - Only active keys
  - Inactive - Not yet activated keys
  - Expired - Expired keys
  - Revoked - Revoked keys

- **Copy**: Copy any key to clipboard
  - Shows "Copied!" indicator
  - Works with one click

- **Revoke**: Disable a key
  - Users can't activate revoked keys
  - Key remains in database
  - Can be permanently deleted later

- **Delete**: Permanently remove key
  - Cannot be undone
  - Use with caution

### 2. Statistics Dashboard
Real-time overview of all license keys:
- **Total Keys**: Total keys ever created
- **Active Keys**: Currently valid and activated
- **Inactive Keys**: Valid but not yet activated
- **Expired Keys**: Past expiration date
- **Revoked Keys**: Manually disabled keys

### 3. Password Management
- **Change Password**: Click lock icon in top right
  - Verify current password
  - Enter new strong password (min 8 characters)
  - Confirm new password matches
  - Automatic validation and error messages

- **Security**: 
  - Passwords hashed with SHA-256 + salt
  - Each password change creates new session
  - Old sessions automatically invalidated

### 4. Session Management
- **Session Duration**: 24 hours
- **Automatic Logout**: After inactivity
- **Token Storage**: Secure sessionStorage (cleared on logout)
- **Device Tracking**: IP address and user agent logged

### 5. Audit Logging
All admin actions logged with:
- Timestamp
- Admin username
- Action performed (login, generate, revoke, delete, password change)
- IP address
- User agent (browser/device info)

## User Interface

### Login Page
- Dark modern theme (slate-900/slate-950)
- Two input fields: Username and Password
- Show/hide password toggle
- Error messages in red box
- Loading indicator during authentication
- Default credentials displayed in green box
- Security warning message

### Admin Dashboard
- Top bar with:
  - App logo and title
  - Admin username indicator
  - Change password button (lock icon)
  - Logout button

- Main content:
  - Statistics cards (total, active, inactive, expired, revoked)
  - Generate Keys button
  - Search box (find keys)
  - Status filter dropdown
  - License keys table with actions

- Change Password Modal:
  - Overlay form
  - Three password inputs
  - Show/hide password toggle for new password
  - Submit and cancel buttons
  - Real-time validation

## Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Vite build tool
- Tailwind CSS styling
- Lucide React icons
- React Router for navigation

**Backend:**
- Supabase (PostgreSQL database)
- Supabase Edge Functions (TypeScript)
- REST API via Edge Functions
- SHA-256 password hashing

**Database Schema:**
- `admin_users` - Admin credentials and status
- `admin_sessions` - Active login sessions
- `license_keys` - Generated keys and metadata
- `license_activations` - When/where keys are used
- `scan_results` - Vulnerability scan results
- `audit_logs` - All admin actions

## Security Features

1. **Password Hashing**
   - SHA-256 with random salt
   - Unique salt per password
   - Not reversible/cannot decrypt

2. **Session Management**
   - Unique tokens per login
   - 24-hour expiration
   - IP and user agent tracking
   - Token invalidation on logout

3. **Audit Trail**
   - All actions logged
   - IP address recorded
   - Timestamps included
   - Cannot be modified after creation

4. **API Security**
   - Bearer token authentication
   - Session verification on each request
   - CORS headers configured
   - Rate limiting (basic)

5. **Database Security**
   - Encrypted connection (SSL)
   - Supabase managed encryption
   - Regular backups

## Files & Configuration

### Key Files
```
src/components/
  ├── AdminLogin.tsx          - Login form UI
  └── AdminDashboardPage.tsx  - Main admin dashboard

src/services/
  ├── adminService.ts         - Admin API calls
  └── licenseService.ts       - License key API calls

supabase/functions/
  ├── admin-login/            - Login & password change
  ├── admin-verify/           - Session verification
  └── license-admin/          - Key generation & management

scripts/
  └── setup-db.js            - Database initialization

.env.local                   - Environment variables (create this!)
```

### Environment Variables Required
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
POSTGRES_HOST=db.xxx.supabase.co
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
```

## Common Tasks

### Generate 10 License Keys Valid for 90 Days
1. Click "Generate Keys" button
2. Set "Number of Keys": 10
3. Set "Duration (days)": 90
4. Click "Generate"
5. Keys appear in table and are ready to use

### Change Your Admin Password
1. Click Lock icon in top right
2. Enter current password
3. Enter new password (min 8 chars)
4. Confirm new password
5. Click "Change Password"

### Find a Specific License Key
1. Click search box
2. Type key ID or partial match
3. Table filters in real-time
4. Click copy icon to copy full key

### Deactivate a License Key
1. Find the key in table
2. Click "Revoke" button
3. Key status changes to "revoked"
4. Users cannot activate this key anymore

### Completely Remove a License Key
1. Find the key in table
2. Click "Delete" button
3. Key is permanently removed from database
4. Cannot be recovered

## Troubleshooting

### Can't Login
**Problem**: Login fails with "Invalid credentials"
**Solution**: 
- Verify you changed the password (first login required)
- Check that `npm run setup-db` succeeded
- Verify .env.local has correct Supabase credentials

### Database Error
**Problem**: "Network error" or database connection failed
**Solution**:
- Run `npm run setup-db` again
- Check Supabase project is active
- Verify POSTGRES credentials in .env.local
- Check internet connection to Supabase

### Can't Generate Keys
**Problem**: Generate button doesn't work or shows error
**Solution**:
- Ensure you're logged in (session hasn't expired)
- Check browser console for errors
- Verify Edge Functions are deployed
- Try refreshing the page

### Password Change Fails
**Problem**: Can't change password
**Solution**:
- Verify current password is correct
- New password must be 8+ characters
- Passwords in confirmation field must match
- Check browser console for error details

## Next Steps

1. **Complete Setup**:
   - Run `npm run setup-db`
   - Start dev server with `npm run dev`
   - Login at http://localhost:5173/admin

2. **Change Password**:
   - Click lock icon
   - Change from default password
   - Logout and login with new password

3. **Test Features**:
   - Generate some license keys
   - Test search and filter
   - Copy a key
   - Change password again

4. **Deploy to Production**:
   - Deploy Edge Functions (see DEPLOYMENT.md)
   - Push code to GitHub
   - Deploy to Vercel
   - Set environment variables in Vercel

## Documentation Index

- **ADMIN_LOGIN_GUIDE.md** - Login and password instructions
- **ADMIN_SETUP_CHECKLIST.md** - Step-by-step verification (40 min)
- **SETUP.md** - Environment configuration details
- **DEPLOYMENT.md** - Production deployment guide
- **DATABASE_SETUP.md** - Database schema explanation
- **ERRORS_FIXED.md** - Common issues and fixes

---

**Status: Admin Panel is Ready to Use! ✅**

Start with: `npm run setup-db` && `npm run dev`
