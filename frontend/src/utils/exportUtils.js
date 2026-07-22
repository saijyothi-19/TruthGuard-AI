/**
 * TruthGuard AI Report Export Utility
 * Provides one-click exports for Security Audit Reports in JSON, CSV, and printable PDF formats.
 */

export const exportToJSON = (scanResult) => {
  if (!scanResult) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scanResult, null, 2));
  const downloadAnchor = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `truthguard_report_${timestamp}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

export const exportToCSV = (scanResult) => {
  if (!scanResult) return;
  
  const headers = ["Scan Timestamp", "Content", "Threat Level", "Risk Score (%)", "Classification", "Source", "Explanation"];
  const row = [
    `"${scanResult.scanned_at || new Date().toISOString()}"`,
    `"${(scanResult.content || '').replace(/"/g, '""')}"`,
    `"${scanResult.threat_level || 'Unknown'}"`,
    `"${Math.round(scanResult.risk_score || 0)}"`,
    `"${(scanResult.classification || '').replace(/"/g, '""')}"`,
    `"${scanResult.source || 'web'}"`,
    `"${(scanResult.explanation || '').replace(/"/g, '""')}"`
  ];

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), row.join(',')].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `truthguard_audit_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const exportToPDF = (scanResult) => {
  if (!scanResult) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Please allow popups to download the PDF report.");
    return;
  }

  const threatColor = 
    scanResult.threat_level === 'Green' ? '#10b981' :
    scanResult.threat_level === 'Blue' ? '#3b82f6' :
    scanResult.threat_level === 'Orange' ? '#f97316' : '#ef4444';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>TruthGuard AI - Security Intelligence Report</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: 800; color: #4f46e5; }
          .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; color: #fff; font-weight: bold; background-color: ${threatColor}; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
          h3 { margin-top: 0; color: #0f172a; }
          .metric-row { display: flex; gap: 20px; margin-top: 15px; }
          .metric-box { flex: 1; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; }
          .footer { margin-top: 50px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div className="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
        </div>

        <div className="header">
          <div className="logo">🛡️ TruthGuard AI Security Report</div>
          <div className="badge">${(scanResult.threat_level || 'UNKNOWN').toUpperCase()} THREAT</div>
        </div>

        <div className="card">
          <h3>Executive Summary</h3>
          <p><strong>Scanned Item:</strong> <code>${scanResult.content}</code></p>
          <p><strong>Classification:</strong> ${scanResult.classification}</p>
          <p><strong>Risk Score:</strong> ${Math.round(scanResult.risk_score || 0)}%</p>
          <p><strong>Timestamp:</strong> ${scanResult.scanned_at || new Date().toLocaleString()}</p>
        </div>

        <div className="card">
          <h3>AI Analysis Explanation</h3>
          <p>${scanResult.explanation || 'No detailed explanation provided.'}</p>
        </div>

        <div className="metric-row">
          <div className="metric-box">
            <strong>Source Vector</strong>
            <p>${(scanResult.source || 'web').toUpperCase()}</p>
          </div>
          <div className="metric-box">
            <strong>SSL Certificate Status</strong>
            <p>${scanResult.details?.ssl_cert?.valid ? 'Valid (Trusted)' : 'Invalid / Untrusted'}</p>
          </div>
          <div className="metric-box">
            <strong>Domain Age</strong>
            <p>${scanResult.details?.whois_info?.domain_age_days ? `${scanResult.details.whois_info.domain_age_days} Days` : 'N/A'}</p>
          </div>
        </div>

        <div className="footer">
          Official Security Intelligence Certificate generated by TruthGuard AI Cyber Defense Engine.
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
