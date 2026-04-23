"""
Core Vulnerability Scanner Module
Performs various security checks on target websites
"""

import requests
import socket
import ssl
import re
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import warnings
from security_recommendations import SecurityRecommendations
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

class VulnerabilityScanner:
    def __init__(self, target_url, timeout=10):
        self.target_url = target_url
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Security Scanner) CEH-Project/1.0'
        })

    def add_remediation(self, finding):
        """Add remediation advice to a finding"""
        if isinstance(finding, dict) and finding.get('severity') not in ['INFO', 'GOOD']:
            vuln_type = finding.get('type', '')
            rec = SecurityRecommendations.get_recommendation(vuln_type, finding.get('severity'))
            finding['risk'] = rec['risk']
            finding['how_to_fix'] = rec['fix']
            finding['defense_tips'] = rec['defense']
        return finding

    def run_all_scans(self):
        """Run all vulnerability scans"""
        results = {
            'target': self.target_url,
            'timestamp': None,
            'subdomain_enumeration': self.enumerate_subdomains(),
            'sql_injection': self.test_sql_injection(),
            'xss': self.test_xss(),
            'security_headers': self.check_security_headers(),
            'ssl_tls': self.check_ssl_certificate(),
            'directory_traversal': self.test_directory_traversal(),
            'information_disclosure': self.check_information_disclosure(),
            'open_ports': self.scan_common_ports(),
            'cms_detection': self.detect_cms(),
        }
        return results
    
    def test_sql_injection(self):
        """Test for SQL injection vulnerabilities"""
        vulnerabilities = []
        
        # SQL injection payloads
        payloads = [
            "' OR '1'='1",
            "' OR '1'='1' --",
            "' OR '1'='1' /*",
            "admin' --",
            "1' ORDER BY 1--+",
            "1' UNION SELECT NULL--",
        ]
        
        sql_errors = [
            "SQL syntax",
            "mysql_fetch",
            "MySQLSyntaxErrorException",
            "valid MySQL result",
            "SQLite",
            "PostgreSQL",
            "ORA-",
            "Microsoft SQL Native Client error"
        ]
        
        try:
            # Get initial response
            response = self.session.get(self.target_url, timeout=self.timeout, verify=False)
            
            # Find forms
            soup = BeautifulSoup(response.text, 'html.parser')
            forms = soup.find_all('form')
            
            for form in forms:
                action = form.get('action', '')
                method = form.get('method', 'get').lower()
                form_url = urljoin(self.target_url, action)
                
                inputs = form.find_all('input')
                
                for payload in payloads:
                    data = {}
                    for input_tag in inputs:
                        input_name = input_tag.get('name')
                        input_type = input_tag.get('type', 'text')
                        
                        if input_name:
                            if input_type == 'text' or input_type == 'password':
                                data[input_name] = payload
                            else:
                                data[input_name] = 'test'
                    
                    try:
                        if method == 'post':
                            test_response = self.session.post(form_url, data=data, timeout=self.timeout, verify=False)
                        else:
                            test_response = self.session.get(form_url, params=data, timeout=self.timeout, verify=False)
                        
                        # Check for SQL error messages
                        for error in sql_errors:
                            if error.lower() in test_response.text.lower():
                                vulnerabilities.append({
                                    'type': 'SQL Injection',
                                    'severity': 'HIGH',
                                    'location': form_url,
                                    'payload': payload,
                                    'evidence': f'SQL error pattern detected: {error}'
                                })
                                break
                    except:
                        continue
        
        except Exception as e:
            vulnerabilities.append({
                'type': 'SQL Injection Test',
                'severity': 'INFO',
                'message': f'Could not complete SQL injection test: {str(e)}'
            })
        
        return vulnerabilities
    
    def test_xss(self):
        """Test for Cross-Site Scripting vulnerabilities"""
        vulnerabilities = []
        
        # XSS payloads
        payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "<svg/onload=alert('XSS')>",
            "javascript:alert('XSS')",
            "<iframe src=javascript:alert('XSS')>",
        ]
        
        try:
            response = self.session.get(self.target_url, timeout=self.timeout, verify=False)
            soup = BeautifulSoup(response.text, 'html.parser')
            forms = soup.find_all('form')
            
            for form in forms:
                action = form.get('action', '')
                method = form.get('method', 'get').lower()
                form_url = urljoin(self.target_url, action)
                
                inputs = form.find_all('input')
                
                for payload in payloads:
                    data = {}
                    for input_tag in inputs:
                        input_name = input_tag.get('name')
                        if input_name:
                            data[input_name] = payload
                    
                    try:
                        if method == 'post':
                            test_response = self.session.post(form_url, data=data, timeout=self.timeout, verify=False)
                        else:
                            test_response = self.session.get(form_url, params=data, timeout=self.timeout, verify=False)
                        
                        # Check if payload is reflected in response
                        if payload in test_response.text:
                            vulnerabilities.append({
                                'type': 'Cross-Site Scripting (XSS)',
                                'severity': 'HIGH',
                                'location': form_url,
                                'payload': payload,
                                'evidence': 'Payload reflected in response without sanitization'
                            })
                            break
                    except:
                        continue
        
        except Exception as e:
            vulnerabilities.append({
                'type': 'XSS Test',
                'severity': 'INFO',
                'message': f'Could not complete XSS test: {str(e)}'
            })
        
        return vulnerabilities
    
    def check_security_headers(self):
        """Check for security-related HTTP headers"""
        results = []
        
        security_headers = {
            'X-Frame-Options': 'Prevents clickjacking attacks',
            'X-Content-Type-Options': 'Prevents MIME-sniffing',
            'Strict-Transport-Security': 'Enforces HTTPS',
            'Content-Security-Policy': 'Prevents XSS and injection attacks',
            'X-XSS-Protection': 'Enables XSS filter',
            'Referrer-Policy': 'Controls referrer information',
            'Permissions-Policy': 'Controls browser features'
        }
        
        try:
            response = self.session.get(self.target_url, timeout=self.timeout, verify=False)
            
            for header, description in security_headers.items():
                if header in response.headers:
                    results.append({
                        'header': header,
                        'status': 'PRESENT',
                        'value': response.headers[header],
                        'severity': 'GOOD',
                        'description': description
                    })
                else:
                    results.append({
                        'header': header,
                        'status': 'MISSING',
                        'severity': 'MEDIUM',
                        'description': f'Missing {header} - {description}'
                    })
        
        except Exception as e:
            results.append({
                'type': 'Security Headers Check',
                'severity': 'INFO',
                'message': f'Could not check headers: {str(e)}'
            })
        
        return results
    
    def check_ssl_certificate(self):
        """Check SSL/TLS certificate"""
        results = []
        
        try:
            parsed_url = urlparse(self.target_url)
            hostname = parsed_url.netloc or parsed_url.path
            
            if parsed_url.scheme == 'https':
                context = ssl.create_default_context()
                
                with socket.create_connection((hostname, 443), timeout=self.timeout) as sock:
                    with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                        cert = ssock.getpeercert()
                        
                        results.append({
                            'type': 'SSL Certificate',
                            'status': 'VALID',
                            'severity': 'GOOD',
                            'issuer': dict(x[0] for x in cert['issuer']),
                            'subject': dict(x[0] for x in cert['subject']),
                            'version': cert['version'],
                            'notAfter': cert['notAfter']
                        })
            else:
                results.append({
                    'type': 'SSL Certificate',
                    'status': 'NOT USING HTTPS',
                    'severity': 'HIGH',
                    'message': 'Website is not using HTTPS encryption'
                })
        
        except ssl.SSLError as e:
            results.append({
                'type': 'SSL Certificate',
                'status': 'ERROR',
                'severity': 'HIGH',
                'message': f'SSL Error: {str(e)}'
            })
        except Exception as e:
            results.append({
                'type': 'SSL Certificate',
                'status': 'ERROR',
                'severity': 'INFO',
                'message': f'Could not verify SSL: {str(e)}'
            })
        
        return results
    
    def test_directory_traversal(self):
        """Test for directory traversal vulnerabilities"""
        vulnerabilities = []
        
        payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\win.ini",
            "....//....//....//etc/passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
        ]
        
        directory_traversal_patterns = [
            "root:",
            "[boot loader]",
            "for 16-bit app support"
        ]
        
        try:
            response = self.session.get(self.target_url, timeout=self.timeout, verify=False)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find links with parameters
            links = soup.find_all('a', href=True)
            
            for link in links[:10]:  # Test first 10 links
                href = link['href']
                if '?' in href and '=' in href:
                    test_url = urljoin(self.target_url, href)
                    
                    for payload in payloads:
                        # Replace parameter value with payload
                        if '=' in test_url:
                            parts = test_url.split('=')
                            test_url_modified = parts[0] + '=' + payload
                            
                            try:
                                test_response = self.session.get(test_url_modified, timeout=self.timeout, verify=False)
                                
                                for pattern in directory_traversal_patterns:
                                    if pattern in test_response.text:
                                        vulnerabilities.append({
                                            'type': 'Directory Traversal',
                                            'severity': 'HIGH',
                                            'location': test_url_modified,
                                            'payload': payload,
                                            'evidence': f'Sensitive file content detected'
                                        })
                                        break
                            except:
                                continue
        
        except Exception as e:
            vulnerabilities.append({
                'type': 'Directory Traversal Test',
                'severity': 'INFO',
                'message': f'Could not complete test: {str(e)}'
            })
        
        return vulnerabilities
    
    def check_information_disclosure(self):
        """Check for information disclosure"""
        findings = []
        
        try:
            response = self.session.get(self.target_url, timeout=self.timeout, verify=False)
            
            # Check Server header
            if 'Server' in response.headers:
                findings.append({
                    'type': 'Server Version Disclosure',
                    'severity': 'LOW',
                    'value': response.headers['Server'],
                    'message': 'Server version is exposed in headers'
                })
            
            # Check X-Powered-By header
            if 'X-Powered-By' in response.headers:
                findings.append({
                    'type': 'Technology Disclosure',
                    'severity': 'LOW',
                    'value': response.headers['X-Powered-By'],
                    'message': 'Technology stack is exposed in headers'
                })
            
            # Check for common sensitive files
            sensitive_files = [
                'robots.txt',
                '.git/config',
                '.env',
                'phpinfo.php',
                'config.php',
                'web.config'
            ]
            
            for file in sensitive_files:
                test_url = urljoin(self.target_url, file)
                try:
                    file_response = self.session.get(test_url, timeout=5, verify=False)
                    if file_response.status_code == 200:
                        findings.append({
                            'type': 'Sensitive File Exposed',
                            'severity': 'MEDIUM',
                            'file': file,
                            'url': test_url,
                            'message': f'Publicly accessible: {file}'
                        })
                except:
                    continue
        
        except Exception as e:
            findings.append({
                'type': 'Information Disclosure Check',
                'severity': 'INFO',
                'message': f'Could not complete check: {str(e)}'
            })
        
        return findings
    
    def scan_common_ports(self):
        """Scan common ports"""
        results = []
        
        common_ports = {
            21: 'FTP',
            22: 'SSH',
            23: 'Telnet',
            25: 'SMTP',
            80: 'HTTP',
            443: 'HTTPS',
            3306: 'MySQL',
            3389: 'RDP',
            5432: 'PostgreSQL',
            8080: 'HTTP-Alt'
        }
        
        try:
            parsed_url = urlparse(self.target_url)
            hostname = parsed_url.netloc.split(':')[0] if ':' in parsed_url.netloc else parsed_url.netloc
            
            for port, service in common_ports.items():
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2)
                result = sock.connect_ex((hostname, port))
                
                if result == 0:
                    results.append({
                        'port': port,
                        'service': service,
                        'status': 'OPEN',
                        'severity': 'INFO' if port in [80, 443] else 'MEDIUM'
                    })
                
                sock.close()
        
        except Exception as e:
            results.append({
                'type': 'Port Scan',
                'severity': 'INFO',
                'message': f'Could not complete port scan: {str(e)}'
            })
        
        return results
    
    def detect_cms(self):
        """Detect Content Management System"""
        findings = []

        cms_signatures = {
            'WordPress': ['/wp-content/', '/wp-includes/', 'wp-json'],
            'Joomla': ['/components/com_', '/administrator/', 'Joomla!'],
            'Drupal': ['/sites/default/', 'Drupal.settings', '/misc/drupal.js'],
            'Magento': ['/skin/frontend/', 'Mage.Cookies', '/js/mage/'],
        }

        try:
            response = self.session.get(self.target_url, timeout=self.timeout, verify=False)

            for cms, signatures in cms_signatures.items():
                for signature in signatures:
                    if signature in response.text:
                        findings.append({
                            'type': 'CMS Detection',
                            'cms': cms,
                            'severity': 'INFO',
                            'message': f'{cms} detected - ensure it is updated to latest version'
                        })
                        break

        except Exception as e:
            findings.append({
                'type': 'CMS Detection',
                'severity': 'INFO',
                'message': f'Could not detect CMS: {str(e)}'
            })

        return findings

    def enumerate_subdomains(self):
        """Enumerate common subdomains"""
        findings = []

        common_subdomains = [
            'www', 'mail', 'ftp', 'admin', 'test', 'dev', 'staging',
            'api', 'blog', 'shop', 'store', 'mobile', 'app',
            'beta', 'portal', 'vpn', 'remote', 'secure'
        ]

        try:
            parsed_url = urlparse(self.target_url)
            base_domain = parsed_url.netloc.split(':')[0]

            # Skip if already a subdomain or IP
            if base_domain.replace('.', '').isdigit() or base_domain.count('.') > 1:
                findings.append({
                    'type': 'Subdomain Enumeration',
                    'severity': 'INFO',
                    'message': 'Subdomain enumeration skipped for non-root domains'
                })
                return findings

            found_subdomains = []

            for subdomain in common_subdomains:
                test_domain = f"{subdomain}.{base_domain}"

                try:
                    # Try DNS resolution
                    socket.gethostbyname(test_domain)

                    # If DNS resolves, try HTTP/HTTPS
                    for protocol in ['https', 'http']:
                        try:
                            test_url = f"{protocol}://{test_domain}"
                            resp = self.session.get(test_url, timeout=3, verify=False)

                            if resp.status_code < 500:
                                found_subdomains.append({
                                    'subdomain': test_domain,
                                    'protocol': protocol,
                                    'status_code': resp.status_code
                                })
                                break
                        except:
                            continue
                except:
                    continue

            if found_subdomains:
                for sub in found_subdomains:
                    findings.append({
                        'type': 'Active Subdomain Found',
                        'severity': 'INFO',
                        'subdomain': sub['subdomain'],
                        'url': f"{sub['protocol']}://{sub['subdomain']}",
                        'status': sub['status_code'],
                        'message': f"Active subdomain: {sub['subdomain']}"
                    })
            else:
                findings.append({
                    'type': 'Subdomain Enumeration',
                    'severity': 'INFO',
                    'message': f'No common subdomains found for {base_domain}'
                })

        except Exception as e:
            findings.append({
                'type': 'Subdomain Enumeration',
                'severity': 'INFO',
                'message': f'Could not enumerate subdomains: {str(e)}'
            })

        return findings
