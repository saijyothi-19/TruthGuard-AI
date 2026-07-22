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
      alert("Could not access active tab URL.");
      return;
    }

    const res = await fetch('https://truthguard-ai-production-cefd.up.railway.app/api/scan/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tab.url })
    });

    const data = await res.json();
    loading.style.display = 'none';
    resultBox.style.display = 'block';

    document.getElementById('res-url').innerText = tab.url;
    document.getElementById('res-classification').innerText = data.classification || 'Analysis Complete';
    document.getElementById('res-score').innerText = `${Math.round(data.risk_score || 0)}%`;
    document.getElementById('res-explanation').innerText = data.explanation || 'No threat signals found.';

    const badge = document.getElementById('res-badge');
    if (data.threat_level === 'Red' || data.threat_level === 'Dark Red') {
      badge.innerText = 'DANGEROUS';
      badge.className = 'badge badge-red';
    } else {
      badge.innerText = 'SAFE';
      badge.className = 'badge badge-green';
    }
  } catch (err) {
    alert("Scan failed. Please check network connection.");
  } finally {
    loading.style.display = 'none';
    scanBtn.disabled = false;
  }
});
