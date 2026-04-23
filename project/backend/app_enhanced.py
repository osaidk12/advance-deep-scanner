#!/usr/bin/env python3
"""
Website Vulnerability Scanner - Enhanced Version
CEH Final Year Project
With Light and Deep Scan Modes
"""

from flask import Flask, render_template, request, jsonify, send_file
import json
from datetime import datetime
import os
from modules.advanced_scanner import AdvancedVulnerabilityScanner
from modules.report_generator import ReportGenerator

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ceh-project-2025-enhanced-scanner'

# Store scan results
scan_results = {}

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index_enhanced.html')

@app.route('/api/scan', methods=['POST'])
def start_scan():
    """Start a new vulnerability scan with mode selection"""
    try:
        data = request.get_json()
        target_url = data.get('url', '').strip()
        scan_mode = data.get('mode', 'light')  # 'light' or 'deep'
        
        if not target_url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Validate URL format
        if not target_url.startswith(('http://', 'https://')):
            target_url = 'http://' + target_url
        
        # Initialize advanced scanner with selected mode
        scanner = AdvancedVulnerabilityScanner(target_url, scan_mode=scan_mode)
        
        # Perform scan
        results = scanner.run_all_scans()
        
        # Generate scan ID
        scan_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        scan_results[scan_id] = {
            'url': target_url,
            'scan_mode': scan_mode,
            'timestamp': datetime.now().isoformat(),
            'results': results
        }
        
        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'scan_mode': scan_mode,
            'results': results
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/report/<scan_id>')
def generate_report(scan_id):
    """Generate HTML report for a scan"""
    try:
        if scan_id not in scan_results:
            return jsonify({'error': 'Scan not found'}), 404
        
        scan_data = scan_results[scan_id]
        report_gen = ReportGenerator()
        
        # Generate HTML report
        report_path = report_gen.generate_html_report(scan_data, scan_id)
        
        return send_file(report_path, as_attachment=True)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history')
def get_history():
    """Get scan history"""
    history = []
    for scan_id, data in scan_results.items():
        total_vulns = 0
        if 'results' in data:
            for category, items in data['results'].items():
                if isinstance(items, list):
                    total_vulns += len([i for i in items if i.get('severity') in ['HIGH', 'CRITICAL', 'MEDIUM']])
        
        history.append({
            'scan_id': scan_id,
            'url': data['url'],
            'scan_mode': data.get('scan_mode', 'light'),
            'timestamp': data['timestamp'],
            'total_vulnerabilities': total_vulns
        })
    return jsonify(history)

if __name__ == '__main__':
    print("=" * 70)
    print("🔒 Website Vulnerability Scanner - Enhanced Edition")
    print("=" * 70)
    print("\n✨ Features:")
    print("  • Light Scan - Quick security assessment")
    print("  • Deep Scan - Comprehensive vulnerability testing")
    print("  • 40+ vulnerability checks")
    print("  • Professional HTML reports")
    print("\n🌐 Starting web interface on http://127.0.0.1:5000")
    print("\n⚠️  WARNING: Only scan websites you own or have permission to test!")
    print("=" * 70)
    print()
    app.run(debug=True, host='0.0.0.0', port=5000)