# VulnScan Pro - Setup Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier available at supabase.com)

## Database Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be set up
3. Copy your project URL and anon key from the API settings

### 2. Create Database Tables
1. In Supabase, go to SQL Editor
2. Create a new query and paste the contents of `scripts/01_setup_database.sql`
3. Run the query to create all tables

### 3. Create Admin User
Run this SQL in Supabase SQL Editor:

```sql
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', 'bcrypt_hash_of_your_password');
```

For password hashing, use bcrypt. You can generate a hash at [bcrypt-generator.com](https://bcrypt-generator.com/)
Default admin credentials (change after first login):
- Username: `admin`
- Password: `admin123`

### 4. Environment Variables
1. Copy `.env.example` to `.env.local`
2. Update with your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Installation

```bash
npm install
npm run dev
```

## Project Structure

- `/src/components` - React components
- `/src/services` - API and service logic
- `/src/utils` - Utility functions
- `/src/types` - TypeScript type definitions
- `/scripts` - Database setup scripts

## Features

### User Features
- **License Activation** - Activate license keys to access scan modes
- **Vulnerability Scanning** - Light, Deep, and Network scan modes
- **PDF Reports** - Download detailed security reports
- **Scan History** - View previous scans

### Admin Features
- **Admin Dashboard** - Manage license keys and users
- **Key Generation** - Generate new license keys with custom duration
- **Key Management** - Revoke, delete, and monitor license keys
- **Admin Stats** - View license usage statistics

## Scanning Modes

1. **Light Scan** - Basic security reconnaissance
2. **Deep Scan** - Comprehensive vulnerability assessment
3. **Network Scan** - Network port and service detection

## Troubleshooting

### "Missing SUPABASE_URL"
- Ensure `.env.local` has your Supabase URL
- Restart the dev server after updating env vars

### Admin Login Fails
- Verify admin user exists in database
- Check password hash is correct
- Ensure `VITE_SUPABASE_ANON_KEY` is correct

### License Activation Issues
- Verify license key exists in database
- Check key status is not revoked/expired
- Ensure generated keys match expected format

## Deployment

### Vercel
1. Connect your GitHub repository
2. Add environment variables in Vercel project settings
3. Deploy - Vercel will automatically build and deploy

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## Security Notes

- Change default admin password immediately
- Use HTTPS in production
- Keep license keys secure
- Monitor audit logs regularly
- Enable RLS (Row Level Security) in Supabase for production
