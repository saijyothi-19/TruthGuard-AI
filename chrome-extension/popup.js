document.getElementById('scan-btn').addEventListener('click', async () => {
  const loading = document.getElementById('loading');
  const resultBox = document.getElementById('result');
  const scanBtn = document.getElementById('scan-btn');

  loading.style.display = 'block';
  resultBox.style.display = 'none';
  scanBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      alert("Could not access active browser tab.");
      return;
    }

    // Filter non-http pages
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      loading.style.display = 'none';
      alert("Internal browser pages (chrome://) cannot be scanned. Please navigate to an external website.");
      return;
    }

    const res = await fetch('https://truthguard-ai-production-cefd.up.railway.app/api/scans/public-scan-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tab.url })
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    loading.style.display = 'none';
    resultBox.style.display = 'block';

    document.getElementById('res-url').innerText = tab.url;
    document.getElementById('res-classification').innerText = data.classification || 'Analysis Complete';
    document.getElementById('res-score').innerText = `${Math.round(data.risk_score || 0)}%`;
    document.getElementById('res-explanation').innerText = data.explanation || 'No threat signals detected.';

    const badge = document.getElementById('res-badge');
    const riskScore = Math.round(data.risk_score || 0);

    if (data.threat_level === 'Red' || data.threat_level === 'Dark Red' || riskScore > 70) {
      badge.innerText = '🔴 DANGEROUS';
      badge.style.background = 'rgba(239, 68, 68, 0.25)';
      badge.style.color = '#ef4444';
      badge.style.border = '1px solid #ef4444';
    } else if (data.threat_level === 'Orange' || data.threat_level === 'Yellow' || riskScore > 35) {
      badge.innerText = '⚠️ SUSPICIOUS';
      badge.style.background = 'rgba(245, 158, 11, 0.25)';
      badge.style.color = '#f59e0b';
      badge.style.border = '1px solid #f59e0b';
    } else {
      badge.innerText = '✅ SAFE';
      badge.style.background = 'rgba(16, 185, 129, 0.25)';
      badge.style.color = '#10b981';
      badge.style.border = '1px solid #10b981';
    }
  } catch (err) {
    alert(`Scan error: ${err.message || 'Check network connection to Railway backend.'}`);
  } finally {
    loading.style.display = 'none';
    scanBtn.disabled = false;
  }
});
