"""
Security Recommendations Module
Provides defensive guidance and remediation steps for vulnerabilities
"""

class SecurityRecommendations:
    """Provides security recommendations and remediation guidance"""

    @staticmethod
    def get_recommendation(vulnerability_type, severity='MEDIUM'):
        """Get detailed security recommendation for a vulnerability"""

        recommendations = {
            'Missing Strict-Transport-Security': {
                'risk': 'Without HSTS, users can be vulnerable to man-in-the-middle attacks and SSL stripping',
                'fix': [
                    'Add HSTS header: Strict-Transport-Security: max-age=31536000; includeSubDomains',
                    'For Apache: Header always set Strict-Transport-Security "max-age=31536000"',
                    'For Nginx: add_header Strict-Transport-Security "max-age=31536000" always;',
                    'For Node.js: Use helmet middleware with HSTS enabled'
                ],
                'defense': [
                    'Start with max-age=300 for testing, then increase to 31536000 (1 year)',
                    'Add includeSubDomains to protect all subdomains',
                    'Consider preload list submission after 1 year',
                    'Ensure all resources load over HTTPS before enabling'
                ]
            },

            'Missing X-Frame-Options': {
                'risk': 'Attackers can embed your site in an iframe to perform clickjacking attacks and steal user credentials',
                'fix': [
                    'Add header: X-Frame-Options: DENY (blocks all framing)',
                    'Or use: X-Frame-Options: SAMEORIGIN (allows same-origin framing)',
                    'For Apache: Header always set X-Frame-Options "DENY"',
                    'For Nginx: add_header X-Frame-Options "DENY" always;'
                ],
                'defense': [
                    'Use DENY unless you need iframe functionality',
                    'Also implement Content-Security-Policy frame-ancestors directive',
                    'Test thoroughly if using SAMEORIGIN with legitimate iframes',
                    'Monitor for clickjacking attempts in logs'
                ]
            },

            'Missing X-Content-Type-Options': {
                'risk': 'Browsers may incorrectly interpret file types, leading to XSS attacks via uploaded files',
                'fix': [
                    'Add header: X-Content-Type-Options: nosniff',
                    'For Apache: Header always set X-Content-Type-Options "nosniff"',
                    'For Nginx: add_header X-Content-Type-Options "nosniff" always;'
                ],
                'defense': [
                    'Always set correct Content-Type for all responses',
                    'Validate file uploads and restrict dangerous types',
                    'Serve user uploads from separate domain',
                    'Use Content-Disposition: attachment for downloads'
                ]
            },

            'Missing Content-Security-Policy': {
                'risk': 'No protection against XSS, code injection, and unauthorized resource loading',
                'fix': [
                    "Start with: Content-Security-Policy: default-src 'self'",
                    "Add unsafe-inline carefully: script-src 'self' 'unsafe-inline'",
                    'Use nonce or hash instead of unsafe-inline when possible',
                    'Specify allowed domains: script-src \'self\' https://trusted.com'
                ],
                'defense': [
                    'Start with report-only mode: Content-Security-Policy-Report-Only',
                    'Monitor CSP violation reports to refine policy',
                    'Move inline scripts to external files',
                    'Use strict-dynamic for modern browsers',
                    'Avoid unsafe-inline and unsafe-eval in production'
                ]
            },

            'Missing CSRF Protection': {
                'risk': 'Attackers can trick users into performing unwanted actions on your site',
                'fix': [
                    'Implement CSRF tokens for all state-changing operations',
                    'Use SameSite cookie attribute: SameSite=Strict or Lax',
                    'Verify Origin and Referer headers',
                    'For frameworks: Enable built-in CSRF protection (Django, Rails, Laravel)'
                ],
                'defense': [
                    'Use POST/PUT/DELETE for state changes, never GET',
                    'Require re-authentication for sensitive operations',
                    'Implement double-submit cookie pattern',
                    'Use custom request headers for AJAX requests',
                    'Set short token expiration times'
                ]
            },

            'SQL Injection': {
                'risk': 'CRITICAL - Attacker can read, modify, or delete entire database, steal user credentials and sensitive data',
                'fix': [
                    'Use parameterized queries/prepared statements ALWAYS',
                    'Example (PHP): $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?"); $stmt->execute([$id]);',
                    'Example (Python): cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))',
                    'Never concatenate user input into SQL queries',
                    'Use ORM frameworks (Django ORM, SQLAlchemy, Eloquent)'
                ],
                'defense': [
                    'Apply principle of least privilege to database accounts',
                    'Disable dangerous SQL functions (xp_cmdshell, LOAD_FILE)',
                    'Implement input validation with whitelist',
                    'Use Web Application Firewall (WAF)',
                    'Enable database query logging and monitoring',
                    'Escape special characters as last resort, not primary defense'
                ]
            },

            'Cross-Site Scripting (XSS)': {
                'risk': 'HIGH - Attacker can steal cookies, session tokens, redirect users, or perform actions as the victim',
                'fix': [
                    'Encode all user input before displaying: htmlspecialchars($input, ENT_QUOTES)',
                    'Use context-aware encoding (HTML, JavaScript, URL, CSS)',
                    'Never insert untrusted data into script tags or event handlers',
                    'Sanitize rich text with libraries (DOMPurify, Bleach)',
                    'Set HttpOnly flag on cookies to prevent JavaScript access'
                ],
                'defense': [
                    'Implement Content Security Policy (CSP)',
                    'Use frameworks with auto-escaping (React, Vue, Angular)',
                    'Validate input on server-side, not just client',
                    'Use template engines with auto-escaping enabled',
                    'Sanitize data from all sources (URL, forms, APIs)',
                    'Regular security testing with XSS payloads'
                ]
            },

            'Insecure Cookie': {
                'risk': 'Session hijacking, cookie theft over insecure connections, XSS-based session stealing',
                'fix': [
                    'Add Secure flag: Set-Cookie: sessionid=abc123; Secure',
                    'Add HttpOnly flag: Set-Cookie: sessionid=abc123; HttpOnly',
                    'Add SameSite: Set-Cookie: sessionid=abc123; SameSite=Strict',
                    'Complete: Set-Cookie: sessionid=abc123; Secure; HttpOnly; SameSite=Strict'
                ],
                'defense': [
                    'Use Secure flag on all cookies (requires HTTPS)',
                    'Use HttpOnly to prevent JavaScript access',
                    'Use SameSite=Strict for sensitive cookies',
                    'Set appropriate expiration times',
                    'Implement session timeout and renewal',
                    'Use __Host- or __Secure- cookie prefixes'
                ]
            },

            'No HTTPS': {
                'risk': 'CRITICAL - All data transmitted in plain text, easily intercepted by attackers on network',
                'fix': [
                    'Get free SSL certificate from Let\'s Encrypt: certbot --nginx',
                    'For shared hosting: Enable SSL in control panel',
                    'For custom servers: certbot certonly --standalone -d yourdomain.com',
                    'Configure auto-renewal: certbot renew --dry-run',
                    'Update all internal links to https://'
                ],
                'defense': [
                    'Force HTTPS redirects (HTTP to HTTPS)',
                    'Enable HSTS header after testing',
                    'Use strong cipher suites (TLS 1.2+)',
                    'Disable weak protocols (SSLv3, TLS 1.0, TLS 1.1)',
                    'Monitor certificate expiration',
                    'Use CAA DNS records to prevent fraudulent certificates'
                ]
            },

            'Directory Listing Enabled': {
                'risk': 'Exposes file structure, sensitive files, backup files, and internal information',
                'fix': [
                    'For Apache: Add "Options -Indexes" to .htaccess or httpd.conf',
                    'For Nginx: Remove autoindex on; from config',
                    'Create index.html in all directories',
                    'Set proper directory permissions (755 for directories)'
                ],
                'defense': [
                    'Never store sensitive files in web root',
                    'Use .htaccess or web.config to deny access',
                    'Regular audit of exposed directories',
                    'Move uploads outside public directory',
                    'Implement proper access controls'
                ]
            },

            'HTTP TRACE Enabled': {
                'risk': 'Can be used for cross-site tracing (XST) attacks to steal credentials',
                'fix': [
                    'For Apache: Add "TraceEnable off" to httpd.conf',
                    'For Nginx: Disabled by default, no action needed',
                    'For IIS: Remove TRACE verb in Request Filtering'
                ],
                'defense': [
                    'Disable all unnecessary HTTP methods',
                    'Only allow GET, POST, PUT, DELETE as needed',
                    'Use WAF to block dangerous methods',
                    'Regular security scanning'
                ]
            },

            'Exposed Backup File': {
                'risk': 'HIGH - Leaked source code, database credentials, API keys, and sensitive configuration',
                'fix': [
                    'Immediately remove all backup files from web root',
                    'Use: find /var/www -name "*.bak" -o -name "*.backup" -delete',
                    'Block access via .htaccess: <FilesMatch "\.(bak|backup|old|orig)$"> Deny from all </FilesMatch>',
                    'Store backups outside web root or on separate server'
                ],
                'defense': [
                    'Never commit backups to version control',
                    'Use .gitignore to exclude backup files',
                    'Automated backup to secure location only',
                    'Encrypt all backup files',
                    'Regular scans for exposed files',
                    'Use proper deployment process, not manual file copying'
                ]
            },

            'Sensitive File Exposed': {
                'risk': 'CRITICAL - Exposed .env, config files, or database credentials can lead to full system compromise',
                'fix': [
                    'Immediately revoke any exposed credentials',
                    'Move .env and config files outside web root',
                    'Add to .htaccess: <FilesMatch "^\.env"> Deny from all </FilesMatch>',
                    'For Nginx: location ~ /\.env { deny all; }',
                    'Never commit .env to Git, use .gitignore'
                ],
                'defense': [
                    'Store secrets in environment variables',
                    'Use secret management tools (Vault, AWS Secrets)',
                    'Set proper file permissions (600 for sensitive files)',
                    'Regular security audits',
                    'Use deployment tools instead of manual uploads',
                    'Implement file access monitoring'
                ]
            },

            'Admin Page Found': {
                'risk': 'Exposed admin interfaces are prime targets for brute force and exploitation',
                'fix': [
                    'Implement IP whitelisting for admin pages',
                    'Use non-standard URLs (not /admin or /administrator)',
                    'Require VPN access for admin area',
                    'Add HTTP basic auth as additional layer',
                    'Implement rate limiting and account lockout'
                ],
                'defense': [
                    'Enable 2FA/MFA for all admin accounts',
                    'Use strong password policy',
                    'Monitor failed login attempts',
                    'Implement CAPTCHA after failed attempts',
                    'Log all admin actions',
                    'Separate admin interface on different subdomain',
                    'Use client certificates for authentication'
                ]
            },

            'CORS Misconfiguration': {
                'risk': 'Allows malicious sites to read sensitive data from your API on behalf of users',
                'fix': [
                    'Never use wildcard (*) with credentials',
                    'Specify exact origins: Access-Control-Allow-Origin: https://trusted.com',
                    'Validate Origin header on server-side',
                    'Use whitelist of allowed origins',
                    'Avoid reflecting Origin header without validation'
                ],
                'defense': [
                    'Only enable CORS for public APIs',
                    'Use authentication tokens, not cookies for APIs',
                    'Implement request rate limiting',
                    'Validate all CORS preflight requests',
                    'Log suspicious cross-origin requests',
                    'Use SameSite cookie attribute'
                ]
            },

            'Outdated JavaScript Library': {
                'risk': 'Known vulnerabilities in old libraries can be exploited for XSS and other attacks',
                'fix': [
                    'Update to latest stable version immediately',
                    'For jQuery: Update to 3.5+ (removes XSS vulnerabilities)',
                    'Use npm audit or yarn audit to find vulnerabilities',
                    'Run: npm update or yarn upgrade',
                    'Check for breaking changes before updating'
                ],
                'defense': [
                    'Enable automated dependency updates (Dependabot)',
                    'Regular security audits of dependencies',
                    'Use Subresource Integrity (SRI) for CDN resources',
                    'Monitor security advisories',
                    'Remove unused libraries',
                    'Consider using modern frameworks with better security'
                ]
            },

            'Debug Mode Enabled': {
                'risk': 'Exposes stack traces, file paths, database queries, and internal application structure',
                'fix': [
                    'Set debug=false in production environment',
                    'For Django: DEBUG = False in settings.py',
                    'For Flask: app.debug = False',
                    'For PHP: display_errors = Off in php.ini',
                    'For Node.js: Set NODE_ENV=production'
                ],
                'defense': [
                    'Use separate configs for dev/staging/production',
                    'Log errors to files, not to browser',
                    'Implement centralized error logging (Sentry, Rollbar)',
                    'Show generic error pages to users',
                    'Monitor error logs for security issues',
                    'Never expose database errors to users'
                ]
            },

            'Information Disclosure': {
                'risk': 'Reveals server version, technology stack, making targeted attacks easier',
                'fix': [
                    'Remove Server header: Apache - ServerTokens Prod',
                    'Remove X-Powered-By header: PHP - expose_php = Off',
                    'For Nginx: server_tokens off;',
                    'Use custom error pages',
                    'Strip version numbers from all headers'
                ],
                'defense': [
                    'Minimize information in HTTP headers',
                    'Use generic error messages',
                    'Remove comments from production HTML',
                    'Disable directory listings',
                    'Hide technology fingerprints',
                    'Regular penetration testing'
                ]
            },

            'Open Redirect': {
                'risk': 'Attackers can redirect users to phishing sites using your trusted domain',
                'fix': [
                    'Validate all redirect URLs against whitelist',
                    'Only allow relative URLs for redirects',
                    'Check that redirect URL belongs to your domain',
                    'Example: if (!url.startsWith("https://yourdomain.com")) { block }',
                    'Never redirect to user-supplied URLs without validation'
                ],
                'defense': [
                    'Use indirect references (redirect IDs mapped to URLs)',
                    'Implement confirmation page for external redirects',
                    'Log all redirect attempts',
                    'Show warning for external links',
                    'Use POST instead of GET for redirects',
                    'Implement redirect token/nonce system'
                ]
            },

            'Weak TLS Version': {
                'risk': 'Outdated SSL/TLS protocols vulnerable to downgrade and decryption attacks',
                'fix': [
                    'Disable TLS 1.0 and 1.1, enable only TLS 1.2+',
                    'For Apache: SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1',
                    'For Nginx: ssl_protocols TLSv1.2 TLSv1.3;',
                    'Use strong cipher suites only',
                    'Test with: https://www.ssllabs.com/ssltest/'
                ],
                'defense': [
                    'Keep OpenSSL/security libraries updated',
                    'Disable weak ciphers (RC4, DES, 3DES)',
                    'Enable Perfect Forward Secrecy (PFS)',
                    'Use ECDHE cipher suites',
                    'Regular SSL/TLS configuration audits',
                    'Monitor for new protocol vulnerabilities'
                ]
            }
        }

        # Get recommendation or return generic one
        rec = recommendations.get(vulnerability_type, {
            'risk': 'Security vulnerability detected that could be exploited',
            'fix': ['Review security best practices for this vulnerability type',
                   'Consult OWASP guidelines',
                   'Apply security patches and updates'],
            'defense': ['Implement defense in depth strategy',
                       'Regular security testing',
                       'Monitor for suspicious activity']
        })

        return rec

    @staticmethod
    def get_priority_summary(findings):
        """Generate prioritized summary of security issues"""
        critical = []
        high = []
        medium = []
        low = []

        for category, items in findings.items():
            if isinstance(items, list):
                for item in items:
                    severity = item.get('severity', 'INFO')
                    if severity == 'CRITICAL':
                        critical.append(item)
                    elif severity == 'HIGH':
                        high.append(item)
                    elif severity == 'MEDIUM':
                        medium.append(item)
                    elif severity == 'LOW':
                        low.append(item)

        summary = {
            'critical_count': len(critical),
            'high_count': len(high),
            'medium_count': len(medium),
            'low_count': len(low),
            'priority_actions': [],
            'quick_wins': [],
            'security_score': 100
        }

        # Calculate security score (start at 100, deduct points)
        score = 100
        score -= len(critical) * 20  # -20 per critical
        score -= len(high) * 10      # -10 per high
        score -= len(medium) * 5     # -5 per medium
        score -= len(low) * 1        # -1 per low
        summary['security_score'] = max(0, score)

        # Priority actions (critical and high)
        if critical:
            summary['priority_actions'].append({
                'priority': 'IMMEDIATE',
                'action': f'Fix {len(critical)} critical vulnerabilities',
                'issues': [f"{item.get('type', 'Unknown')}" for item in critical[:3]]
            })

        if high:
            summary['priority_actions'].append({
                'priority': 'URGENT',
                'action': f'Address {len(high)} high-risk issues',
                'issues': [f"{item.get('type', 'Unknown')}" for item in high[:3]]
            })

        # Quick wins (easy fixes)
        quick_fix_types = ['Missing Strict-Transport-Security', 'Missing X-Frame-Options',
                          'Missing X-Content-Type-Options', 'Information Disclosure']
        quick_wins = [item for item in medium + low if item.get('type') in quick_fix_types]
        if quick_wins:
            summary['quick_wins'] = [
                f"Add {item.get('type', 'security header').replace('Missing ', '')}"
                for item in quick_wins[:5]
            ]

        return summary
