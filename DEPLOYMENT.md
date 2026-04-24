# VulnScan Pro - Deployment Guide

## Vercel Deployment

### Prerequisites
- GitHub repository connected
- Supabase project created
- Environment variables configured

### Step 1: Configure Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Select the project root directory (leave as `/`)
4. Skip Framework selection (Vite will be detected)

### Step 2: Add Environment Variables

In Vercel project settings, add these environment variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Step 3: Deploy

```bash
git add .
git commit -m "Add Supabase integration and deployment config"
git push origin main
```

Vercel will automatically:
1. Build the project (`npm run build`)
2. Create optimized production bundle
3. Deploy to CDN
4. Configure routing rules from `vercel.json`

### Step 4: Test Production

1. Visit your Vercel deployment URL
2. Navigate to `/admin` - should not show 404
3. Try license activation
4. Test admin login

## Supabase Edge Functions Deployment

### Deploy All Edge Functions

```bash
# Login to Supabase CLI
supabase login

# Link to your Supabase project
supabase link --project-ref your_project_ref

# Deploy all functions
supabase functions deploy
```

### Individual Function Deployment

```bash
# Deploy specific function
supabase functions deploy license-validate
supabase functions deploy admin-login
supabase functions deploy admin-verify
supabase functions deploy license-admin
supabase functions deploy scan
supabase functions deploy dns-lookup
```

### Verify Functions

In Supabase Dashboard:
1. Go to Edge Functions
2. Verify all 6 functions are deployed
3. Check recent logs for any errors
4. Test endpoint URLs are accessible

## Database Setup

### Production Database

1. In Supabase Dashboard, go to SQL Editor
2. Create new query for `scripts/01_setup_database.sql`
3. Run the query
4. Create new query for `scripts/02_add_admin_sessions.sql`
5. Run the query

### Create Admin User

```sql
-- Generate password hash
-- Use bcrypt: echo -n "your_password" | bcrypt

INSERT INTO admin_users (username, password_hash)
VALUES ('admin', 'bcrypt_hash_here');
```

### Enable Row Level Security (RLS)

For production security, enable RLS:

```sql
-- License Keys
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

-- Admin Users (protect from client access)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only" ON admin_users
  FOR ALL USING (false);

-- Audit Logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin Sessions
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
```

## Performance Optimization

### Frontend Optimization

The build already includes:
- ✅ Code minification
- ✅ CSS purging (Tailwind)
- ✅ Image optimization
- ✅ Lazy loading for routes

For very large deployments, consider:
```typescript
// Code splitting for large components
const AdminDashboard = lazy(() => import('./components/AdminDashboardPage'));
```

### Database Optimization

Create indexes (already created):
```sql
CREATE INDEX idx_license_keys_status ON license_keys(status);
CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);
```

### Edge Function Optimization

- Edge Functions automatically scale
- Response times <50ms typical
- Cache frequently accessed data

## Monitoring & Logging

### Vercel Monitoring

1. Go to Vercel Dashboard
2. Select your project
3. Check "Logs" tab for:
   - Build logs
   - Serverless function logs
   - Real-time logs

### Supabase Monitoring

1. Go to Supabase Dashboard
2. Check "Logs" tab for:
   - Database queries
   - Edge Function logs
   - Authentication logs

### Error Tracking (Optional)

Add Sentry integration:

```bash
npm install @sentry/react @sentry/tracing
```

In `src/main.tsx`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## Backup & Disaster Recovery

### Database Backup

Supabase automatically backs up daily. For additional security:

```bash
# Manual backup via Supabase CLI
supabase db pull --schema-only > backup_schema.sql
supabase db pull > backup_data.sql
```

### Environment Variables Backup

Store backup of environment variables securely (password manager):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (backup only!)

## Troubleshooting Deployment

### Build Fails

```bash
# Clear build cache
rm -rf .next dist
npm install
npm run build
```

### License API Returns 404

1. Verify Edge Function is deployed
2. Check function logs in Supabase
3. Verify SUPABASE_URL and SUPABASE_ANON_KEY in Vercel

### Admin Login Not Working

1. Check admin_users table has entries
2. Verify admin-login function is deployed
3. Check Edge Function logs for errors
4. Verify token is being stored in sessionStorage

### Slow Scan Performance

1. Check Edge Function logs for scan API delays
2. Verify database query performance
3. Consider enabling query caching in Supabase

## Domain Configuration

### Custom Domain on Vercel

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records (Vercel will show instructions)
4. Wait for SSL certificate (auto-generated)

### Example DNS Records
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com

Type: A
Name: @
Value: 76.76.19.0 (Vercel IP)
```

## CI/CD Pipeline

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - run: npm run typecheck
```

## Security Checklist

- [ ] Change default admin password
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Configure CORS if needed
- [ ] Enable RLS on sensitive tables
- [ ] Set up API rate limiting
- [ ] Configure Content Security Policy headers
- [ ] Enable audit logging
- [ ] Set up monitoring alerts
- [ ] Configure backups
- [ ] Document incident response plan

## Post-Deployment Testing

### Functional Testing

- [ ] License activation works
- [ ] Admin login works
- [ ] Can generate license keys
- [ ] Scans complete successfully
- [ ] Reports download correctly
- [ ] Admin stats update

### Performance Testing

- [ ] Page load time < 3s
- [ ] API response < 500ms
- [ ] No console errors
- [ ] Images load correctly

### Security Testing

- [ ] Cannot access admin without auth
- [ ] License keys cannot be shared
- [ ] Passwords are not exposed
- [ ] API endpoints require auth

## Rollback Procedure

If deployment breaks:

```bash
# Revert to previous version
git revert HEAD
git push origin main

# Or go to Vercel Dashboard → Deployments
# Click previous successful deployment
# Click "Redeploy"
```

## Support & Updates

- Check Supabase status: status.supabase.com
- Check Vercel status: vercel.com/status
- For issues: Create issue in GitHub repository
- Security issues: Email security@example.com
