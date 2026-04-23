#!/usr/bin/env python3
"""
Website Vulnerability Scanner
CEH Final Year Project
Author: Security Research Team
Description: Comprehensive web application security scanner
"""


from flask import Flask, render_template, request, jsonify, send_file
import json
from datetime import datetime
import os
from scanner import VulnerabilityScanner
from report_generator import ReportGenerator


app = Flask(__name__)
app.config['SECRET_KEY'] = 'ceh-project-2025-secure-key'

# Store scan results
scan_results = {}

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index.html')

@app.route('/api/scan', methods=['POST'])
def start_scan():
    """Start a new vulnerability scan"""
    try:
        data = request.get_json()
        target_url = data.get('url', '').strip()
        
        if not target_url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Validate URL format
        if not target_url.startswith(('http://', 'https://')):
            target_url = 'http://' + target_url
        
        # Initialize scanner
        scanner = VulnerabilityScanner(target_url)
        
        # Perform scan
        results = scanner.run_all_scans()
        
        # Generate scan ID
        scan_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        scan_results[scan_id] = {
            'url': target_url,
            'timestamp': datetime.now().isoformat(),
            'results': results
        }
        
        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'results': results
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/report/<scan_id>')
def generate_report(scan_id):
    """Generate PDF report for a scan"""
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
        history.append({
            'scan_id': scan_id,
            'url': data['url'],
            'timestamp': data['timestamp'],
            'total_vulnerabilities': sum(len(v) for v in data['results'].values() if isinstance(v, list))
        })
    return jsonify(history)

if __name__ == '__main__':
    print("=" * 60)
    print("Website Vulnerability Scanner - CEH Project")
    print("=" * 60)
    print("\nStarting web interface on http://127.0.0.1:5000")
    print("\nWARNING: Only scan websites you own or have permission to test!")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)
