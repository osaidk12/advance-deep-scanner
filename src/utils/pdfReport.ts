import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ScanResult, Severity } from '../types/scanner';
import { countBySeverity, SEVERITY_ORDER } from './severityUtils';

export function generatePdfReport(result: ScanResult) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 0;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 52, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(0, 52, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('VULNERABILITY SCAN REPORT', margin, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 195, 210);
  doc.text('CEH Security Assessment Tool', margin, 30);

  doc.setTextColor(220, 230, 240);
  doc.setFontSize(9);
  const date = new Date(result.timestamp).toLocaleString();
  doc.text(`Generated: ${date}`, margin, 40);
  doc.text(`Mode: ${result.scan_mode.toUpperCase()} SCAN`, pageWidth - margin - 40, 40);

  y = 62;

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, 'F');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text('TARGET', margin + 5, y + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(result.target, margin + 5, y + 12);
  doc.setFont('helvetica', 'normal');

  y += 24;

  const counts = countBySeverity(result.categories);
  const severityColors: Record<string, [number, number, number]> = {
    CRITICAL: [185, 28, 28],
    HIGH: [194, 65, 12],
    MEDIUM: [180, 83, 9],
    LOW: [3, 105, 161],
    INFO: [71, 85, 105],
    GOOD: [4, 120, 87],
  };
  const severityBgColors: Record<string, [number, number, number]> = {
    CRITICAL: [254, 242, 242],
    HIGH: [255, 247, 237],
    MEDIUM: [255, 251, 235],
    LOW: [240, 249, 255],
    INFO: [248, 250, 252],
    GOOD: [236, 253, 245],
  };

  const totalFindings = Object.values(counts).reduce((a, b) => a + b, 0);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('EXECUTIVE SUMMARY', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 6;

  const boxWidth = (pageWidth - margin * 2 - 15) / 6;
  let bx = margin;
  for (const sev of SEVERITY_ORDER) {
    const bg = severityBgColors[sev];
    const color = severityColors[sev];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(bx, y, boxWidth, 20, 2, 2, 'F');
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(bx, y, boxWidth, 20, 2, 2, 'S');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(counts[sev]), bx + boxWidth / 2, y + 10, { align: 'center' });
    doc.setFontSize(6);
    doc.text(sev, bx + boxWidth / 2, y + 16, { align: 'center' });
    bx += boxWidth + 3;
  }

  y += 28;
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total findings: ${totalFindings} across ${result.categories.length} test categories`, margin, y);
  y += 5;
  doc.setDrawColor(210, 215, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILED FINDINGS', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  for (const category of result.categories) {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }

    const highestSev = category.findings.reduce((max, f) => {
      const order = SEVERITY_ORDER.indexOf(f.severity);
      const maxOrder = SEVERITY_ORDER.indexOf(max as Severity);
      return order < maxOrder ? f.severity : max;
    }, 'GOOD' as Severity);

    const catColor = severityColors[highestSev] || [71, 85, 105];
    doc.setFillColor(catColor[0], catColor[1], catColor[2]);
    doc.roundedRect(margin, y - 3, 2.5, 7, 1, 1, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(category.label, margin + 6, y + 1);
    doc.setFont('helvetica', 'normal');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(`${category.findings.length} finding(s)`, pageWidth - margin - 25, y + 1);
    y += 6;

    const tableData = category.findings.map((f) => [
      f.severity,
      f.type,
      f.message || f.evidence || f.value || '-',
      f.recommendation || f.location || f.payload || '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Severity', 'Type', 'Details', 'Info']],
      body: tableData,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        textColor: [40, 50, 65],
        lineColor: [210, 215, 225],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 55 },
        3: { cellWidth: 55 },
      },
      didParseCell: (data) => {
        if (data.column.index === 0 && data.section === 'body') {
          const sev = String(data.cell.raw);
          const color = severityColors[sev];
          if (color) {
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(210, 215, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RECOMMENDATIONS', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  const recommendations = getRecommendations(result);
  doc.setFontSize(8);
  for (const rec of recommendations) {
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
    const color = severityColors[rec.severity] || [71, 85, 105];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(margin + 2, y - 1, 1.5, 'F');
    doc.setTextColor(40, 50, 65);
    doc.setFont('helvetica', 'normal');
    doc.text(rec.text, margin + 7, y);
    y += 7;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(210, 215, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 14, pageWidth - margin, pageH - 14);
    doc.setTextColor(120, 130, 145);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('CEH Vulnerability Scanner - Confidential', margin, pageH - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageH - 8);
  }

  const filename = `vuln-scan-${result.target.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

interface Recommendation {
  severity: string;
  text: string;
}

function getRecommendations(result: ScanResult): Recommendation[] {
  const recs: Recommendation[] = [];
  const seen = new Set<string>();

  for (const cat of result.categories) {
    for (const f of cat.findings) {
      if (f.severity === 'GOOD' || f.severity === 'INFO') continue;

      let text = '';
      if (f.recommendation) {
        text = f.recommendation;
      } else if (f.type.includes('SQL Injection')) {
        text = 'Implement parameterized queries and input validation to prevent SQL injection';
      } else if (f.type.includes('XSS')) {
        text = 'Sanitize and encode all user input before rendering in the browser';
      } else if (f.type.includes('Missing') && f.type.includes('Header')) {
        text = `Add the ${f.type.replace('Missing ', '')} security header`;
      } else if (f.type.includes('CORS')) {
        text = 'Restrict CORS origins to trusted domains only';
      } else if (f.type.includes('Cookie')) {
        text = 'Set Secure, HttpOnly, and SameSite attributes on all cookies';
      } else if (f.type.includes('Directory Listing')) {
        text = 'Disable directory listing on the web server';
      } else if (f.type.includes('Backup') || f.type.includes('Sensitive File')) {
        text = 'Remove or restrict access to exposed sensitive files';
      } else if (f.type.includes('CSRF')) {
        text = 'Implement anti-CSRF tokens in all state-changing forms';
      } else if (f.type.includes('SSL') || f.type.includes('HTTPS')) {
        text = 'Enable HTTPS with a valid TLS 1.2+ certificate';
      } else if (f.type.includes('Port')) {
        text = 'Close unnecessary open ports and restrict access to essential services only';
      } else if (f.type.includes('TRACE') || (f.type.includes('HTTP') && f.type.includes('Enabled'))) {
        text = 'Disable dangerous HTTP methods (TRACE, TRACK) on the web server';
      } else {
        text = f.message || `Address ${f.type} finding`;
      }

      if (!seen.has(text)) {
        seen.add(text);
        recs.push({ severity: f.severity, text });
      }
    }
  }

  const severityPriority: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  recs.sort((a, b) => (severityPriority[a.severity] ?? 9) - (severityPriority[b.severity] ?? 9));

  return recs;
}
