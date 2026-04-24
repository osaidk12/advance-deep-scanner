# Admin Panel Login Guide

## Default Credentials

When you first set up the database using `npm run setup-db`, a default admin user is created automatically.

**Default Login Credentials:**
```
Username: admin
Password: VulnScan2024!
```

## Step 1: Setup Database

Run the database setup script to create all tables and the default admin user:

```bash
npm run setup-db
```

You should see output like:
```
✓ Created admin_users table
✓ Created admin_sessions table
✓ Created license_keys table
✓ Created license_activations table
✓ Created scan_results table
✓ Created audit_logs table
✓ Created default admin user (username: admin, password: VulnScan2024!)
✅ Database setup complete!
```

## Step 2: Start the Application

```bash
npm run dev
```

Navigate to: `http://localhost:5173/admin`

## Step 3: Login with Default Credentials

1. Enter Username: `admin`
2. Enter Password: `VulnScan2024!`
3. Click "Sign In"

If login is successful, you'll be taken to the Admin Dashboard.

## Step 4: Change Your Password (IMPORTANT!)

**You MUST change your password immediately after first login for security.**

1. Click the **Lock icon** (🔒) in the top right corner
2. A "Change Password" dialog will appear
3. Enter your current password: `VulnScan2024!`
4. Enter your new strong password (minimum 8 characters)
5. Confirm your new password
6. Click "Change Password"

You should see: **"Password changed successfully"**

## Admin Dashboard Features

Once logged in, you can:

### Generate License Keys
- Click "Generate Keys" button
- Set number of keys to generate
- Set duration (days)
- Add optional notes
- Keys are automatically copied to clipboard

### Manage License Keys
- **View**: See all license keys in the table
- **Search**: Find keys by name
- **Filter**: Filter by status (all, active, inactive, expired, revoked)
- **Copy**: Click copy icon to copy key to clipboard
- **Revoke**: Mark key as revoked (users can't activate)
- **Delete**: Permanently delete key from database

### Dashboard Statistics
View real-time stats:
- Total keys created
- Active keys
- Inactive keys
- Expired keys
- Revoked keys

### Change Password
- Click Lock icon anytime to change password
- Current password must be verified
- New password must be at least 8 characters

### Logout
Click "Logout" button to end your session and return to login page.

## Security Notes

1. **Change Default Password**: Always change the default password immediately after first login
2. **Strong Passwords**: Use passwords with:
   - At least 8 characters
   - Mix of letters, numbers, and special characters
   - Avoid common words and personal information
3. **Session Timeout**: Admin sessions expire after 24 hours
4. **Audit Logging**: All admin actions are logged with IP address and user agent
5. **SSL/TLS**: Always use HTTPS in production

## Troubleshooting

### Login fails with "Invalid credentials"
- Double-check username and password
- Ensure database setup was successful: `npm run setup-db`
- Check browser console for error messages

### "Network error" message
- Ensure Supabase environment variables are set in `.env.local`
- Check that Supabase project is running
- Verify database tables exist (run setup again if needed)
- Check network connection

### Can't see the change password modal
- Make sure JavaScript is enabled
- Try refreshing the page
- Clear browser cache and try again

### Password change fails
- Current password must be correct
- New password must be at least 8 characters
- New passwords must match in confirmation field

## Environment Variables Required

Ensure your `.env.local` has:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
POSTGRES_HOST=db.your-project.supabase.co
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-db-password
```

## Deploy Edge Functions

For the admin panel to work in production, you need to deploy the Edge Functions:

```bash
supabase functions deploy admin-login --project-id your-project-id
supabase functions deploy admin-verify --project-id your-project-id
```

## Support

If you encounter issues:

1. Check `ERRORS_FIXED.md` for common solutions
2. Review console logs in browser DevTools
3. Verify environment variables are correct
4. Ensure Supabase project is active and running
