import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { 
  Shield, Activity, FileText, Settings, Globe, AlertTriangle, CheckCircle, 
  MessageSquare, Plus, Trash2, Search, Lock, RefreshCw, Eye, ExternalLink, HelpCircle,
  Camera, Zap, Scan, RotateCcw, Sparkles, Check
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { Html5Qrcode } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import { AuthContext } from '../context/AuthContext';
import { 
  getAnalytics, getScanHistory, scanUrl, scanMessage, 
  getBlacklist, addToBlacklist, deleteFromBlacklist,
  getWhitelist, addToWhitelist, deleteFromWhitelist,
  submitFeedback, getAllFeedback
} from '../api';
import './Dashboard.css';

function Dashboard() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('simulator');
  const [loading, setLoading] = useState(true);

  // Feedback States
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Set default tab based on role
  useEffect(() => {
    if (user) {
      setActiveTab(user.role === 'admin' ? 'overview' : 'simulator');
    }
  }, [user]);

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const list = await getAllFeedback();
      setFeedbackList(list);
    } catch (err) {
      console.error("Failed to load feedback", err);
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    if (tabName === 'feedback' && user?.role === 'admin') {
      loadFeedback();
    }
  };

  // Data States
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [blacklist, setBlacklist] = useState([]);
  const [whitelist, setWhitelist] = useState([]);

  // Simulator & Smart Scanner States
  const [simType, setSimType] = useState('url');
  const [urlInput, setUrlInput] = useState('');
  const [msgInput, setMessageInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [qrActive, setQrActive] = useState(true); // Default camera active for smart scanning
  const [qrCameraError, setQrCameraError] = useState(null);
  
  // Smart Scanner Specific States
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [scanStatus, setScanStatus] = useState('waiting'); // 'waiting', 'qr_detected', 'url_detected', 'scanning', 'complete'
  const [scanStatusText, setScanStatusText] = useState('Point your camera at a QR code or printed URL.');
  const [detectedSource, setDetectedSource] = useState(null);
  const ocrProcessingRef = useRef(false);

  // Blacklist/Whitelist Inputs
  const [listType, setListType] = useState('blacklist'); // blacklist or whitelist
  const [listValue, setListValue] = useState('');
  const [listNotes, setListNotes] = useState('');
  const [listLoading, setListLoading] = useState(false);

  // Detail Modal State
  const [selectedScan, setSelectedScan] = useState(null);

  // Refresh data helper
  const refreshData = async () => {
    try {
      const isAdmin = user?.role === 'admin';
      
      const fetchHistory = getScanHistory(30).catch(() => ({ scans: [], total: 0 }));
      const fetchAnalytics = isAdmin ? getAnalytics().catch(() => null) : Promise.resolve(null);
      const fetchBlacklist = isAdmin ? getBlacklist().catch(() => []) : Promise.resolve([]);
      const fetchWhitelist = isAdmin ? getWhitelist().catch(() => []) : Promise.resolve([]);

      const [analData, histData, blackData, whiteData] = await Promise.all([
        fetchAnalytics,
        fetchHistory,
        fetchBlacklist,
        fetchWhitelist
      ]);
      
      if (analData) setAnalytics(analData);
      setHistory(histData.scans || []);
      setBlacklist(blackData || []);
      setWhitelist(whiteData || []);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    refreshData();
    const interval = setInterval(refreshData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  const triggerAutoScan = useCallback(async (text, isUrl) => {
    setScanning(true);
    setScanStatus('scanning');
    setScanStatusText('Scanning Threat Vector...');
    setScanResult(null);
    setScanError(null);
    try {
      let result;
      if (isUrl) {
        setSimType('url');
        setUrlInput(text);
        result = await scanUrl(text);
      } else {
        setSimType('message');
        setMessageInput(text);
        result = await scanMessage(text);
      }
      setScanResult(result);
      setScanStatus('complete');
      setScanStatusText('Analysis Complete');
      refreshData();
    } catch (err) {
      setScanError(err.response?.data?.detail || 'Analysis timed out or failed. Please check backend.');
      setScanStatus('waiting');
      setScanStatusText('Point your camera at a QR code or printed URL.');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleResetScan = () => {
    setScanResult(null);
    setScanError(null);
    setScanStatus('waiting');
    setScanStatusText('Point your camera at a QR code or printed URL.');
    setDetectedSource(null);
    setUrlInput('');
    setMessageInput('');
    setQrActive(true);
    setQrCameraError(null);
  };

  const toggleCameraFacing = () => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Smart Camera & OCR Scanner Effect
  useEffect(() => {
    let html5QrCode;
    let isMounted = true;
    let ocrInterval;
    
    if (qrActive && !scanning && scanStatus !== 'complete') {
      const timer = setTimeout(() => {
        try {
          html5QrCode = new Html5Qrcode("qr-reader");
          const config = { fps: 10, qrbox: { width: 220, height: 220 } };
          
          const constraint = { facingMode: cameraFacing };
          
          html5QrCode.start(
            constraint,
            config,
            (decodedText) => {
              if (!isMounted) return;
              const isUrl = decodedText.startsWith("http://") || 
                            decodedText.startsWith("https://") || 
                            /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(decodedText);
              
              setScanStatus('qr_detected');
              setDetectedSource('QR Code');
              setScanStatusText(`QR Code Detected: ${decodedText.substring(0, 35)}...`);
              
              html5QrCode.stop().then(() => {
                if (isMounted) {
                  setQrActive(false);
                  triggerAutoScan(decodedText, isUrl);
                }
              }).catch(err => console.error("Error stopping QR reader", err));
            },
            () => {}
          ).catch(err => {
            if (isMounted) {
              console.error("Camera access error with facingMode:", cameraFacing, err);
              if (cameraFacing === 'environment') {
                // Fallback to front camera automatically if back camera is unavailable
                setCameraFacing('user');
              } else {
                const errMsg = err?.message || err?.toString() || "Unknown error";
                setQrCameraError(`Could not access camera: ${errMsg}. Please check camera permissions.`);
              }
            }
          });

          // Start OCR Frame Processing Loop every 1200ms
          ocrInterval = setInterval(async () => {
            if (!isMounted || ocrProcessingRef.current || scanning || scanStatus === 'complete') return;
            const videoElem = document.querySelector('#qr-reader video');
            if (videoElem && videoElem.readyState >= 2 && videoElem.videoWidth > 0) {
              try {
                ocrProcessingRef.current = true;
                const canvas = document.createElement('canvas');
                canvas.width = Math.min(videoElem.videoWidth, 640);
                canvas.height = Math.min(videoElem.videoHeight, 480);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
                
                const { data } = await Tesseract.recognize(canvas, 'eng');
                const rawText = data?.text || '';
                
                // Match URLs in OCR text
                const urlMatch = rawText.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi);
                if (urlMatch && urlMatch.length > 0) {
                  let foundUrl = urlMatch[0].trim().replace(/[\),\.\>\'\"]+$/, '');
                  if (!foundUrl.startsWith('http://') && !foundUrl.startsWith('https://')) {
                    foundUrl = `https://${foundUrl}`;
                  }
                  
                  if (foundUrl.length > 5 && isMounted) {
                    console.log("OCR Detected URL:", foundUrl);
                    setScanStatus('url_detected');
                    setDetectedSource('Printed URL (OCR)');
                    setScanStatusText(`URL Detected via OCR: ${foundUrl}`);
                    
                    if (html5QrCode && html5QrCode.isScanning) {
                      await html5QrCode.stop();
                    }
                    setQrActive(false);
                    triggerAutoScan(foundUrl, true);
                  }
                }
              } catch (ocrErr) {
                // Ignore transient OCR read errors
              } finally {
                ocrProcessingRef.current = false;
              }
            }
          }, 1200);

        } catch (e) {
          console.error(e);
        }
      }, 300);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (ocrInterval) clearInterval(ocrInterval);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(err => console.error("Error stopping QR reader:", err));
        }
      };
    }
  }, [qrActive, cameraFacing, scanning, scanStatus, triggerAutoScan]);

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    try {
      let result;
      if (simType === 'url') {
        if (!urlInput) return;
        result = await scanUrl(urlInput);
      } else {
        if (!msgInput) return;
        result = await scanMessage(msgInput);
      }
      setScanResult(result);
      // Refresh analytics & history silently
      refreshData();
    } catch (err) {
      setScanError(err.response?.data?.detail || 'Analysis timed out or failed. Please check backend.');
    } finally {
      setScanning(false);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!listValue) return;
    setListLoading(true);
    try {
      if (listType === 'blacklist') {
        await addToBlacklist(listValue, listNotes);
      } else {
        await addToWhitelist(listValue, listNotes);
      }
      setListValue('');
      setListNotes('');
      refreshData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add rule.');
    } finally {
      setListLoading(false);
    }
  };

  const handleDeleteRule = async (id, type) => {
    if (!window.confirm(`Are you sure you want to remove this from the ${type}?`)) return;
    try {
      if (type === 'blacklist') {
        await deleteFromBlacklist(id);
      } else {
        await deleteFromWhitelist(id);
      }
      refreshData();
    } catch (err) {
      alert('Failed to delete rule.');
    }
  };

  // Helper to format WhatsApp mockup text
  const getWhatsAppMockupText = (res) => {
    if (!res) return '';
    const risk = Math.round(res.risk_score);
    const classification = res.classification;
    const isDangerous = res.threat_level === 'Red' || res.threat_level === 'Dark Red';
    const isSuspicious = res.threat_level === 'Orange' || res.threat_level === 'Yellow';
    
    let emoji = '✅';
    let header = `Safe ${res.type.toUpperCase()}`;
    let rec = 'Safe to interact.';
    
    if (isDangerous) {
      emoji = '🚨';
      header = `Dangerous ${res.type.toUpperCase()}`;
      rec = 'Do NOT click this link.\nDelete the message.\nBlock the sender.';
    } else if (isSuspicious) {
      emoji = '⚠️';
      header = `Suspicious ${res.type.toUpperCase()}`;
      rec = 'Proceed with caution.\nDo not share personal OTPs or passwords.';
    }
    
    // Extracted signals
    let signalsText = '';
    if (res.details) {
      let sigs = [];
      if (res.type === 'url' && res.details.threat_intel?.threat_signals) {
        sigs = res.details.threat_intel.threat_signals;
      } else if (res.details.nlp_features) {
        const intent = res.details.nlp_features.intent;
        if (intent && intent !== 'General Communication') sigs.push(`Intent: ${intent}`);
        if (res.details.nlp_features.urgency_detected) sigs.push('High urgency wording');
      }
      if (sigs.length > 0) {
        signalsText = '\nReasons:\n' + sigs.map(s => `- ${s}`).join('\n');
      }
    }
    
    return `${emoji} ${header}

Risk Score: ${risk}%

Classification:
${classification}${signalsText}

Explanation:
${res.explanation}

Recommendation:
${rec}`;
  };

  const getThreatColor = (level) => {
    switch (level) {
      case 'Green': return '#10b981'; // safe
      case 'Yellow': return '#f59e0b'; // suspicious
      case 'Orange': return '#f97316'; // scam
      case 'Red': return '#ef4444'; // phishing
      case 'Dark Red': return '#991b1b'; // malware
      default: return '#64748b';
    }
  };

  // --- Rendering overview tab ---
  const renderOverview = () => {
    if (!analytics) return <div className="loading-state">Generating reports...</div>;

    const classData = Object.entries(analytics.classification_counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);

    const sourceData = Object.entries(analytics.source_counts)
      .map(([name, value]) => ({ name, value }));

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444', '#991b1b', '#6366f1', '#a855f7'];

    return (
      <div className="tab-content overview-layout">
        <div className="metrics-cards-grid">
          <div className="glass-card stat-card border-left-green">
            <div className="stat-desc">Total Active Scans</div>
            <div className="stat-value">{analytics.total_scans}</div>
          </div>
          <div className="glass-card stat-card border-left-red">
            <div className="stat-desc">Threats Detected</div>
            <div className="stat-value">
              {analytics.threat_level_counts.Red + analytics.threat_level_counts["Dark Red"] + analytics.threat_level_counts.Orange}
            </div>
          </div>
          <div className="glass-card stat-card border-left-blue">
            <div className="stat-desc">WhatsApp Bot Scans</div>
            <div className="stat-value">{analytics.source_counts.whatsapp || 0}</div>
          </div>
          <div className="glass-card stat-card border-left-purple">
            <div className="stat-desc">Dashboard Scans</div>
            <div className="stat-value">{analytics.source_counts.dashboard || 0}</div>
          </div>
        </div>

        <div className="charts-flex-grid">
          <div className="glass-card chart-container span-2">
            <h3>Scans & Cyber Threats (Last 7 Days)</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={analytics.scans_over_time}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: 8, border: 'none' }} />
                  <Line type="monotone" dataKey="scans" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Total Scans" />
                  <Line type="monotone" dataKey="threats" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Threats Detected" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card chart-container">
            <h3>Threat Classification</h3>
            <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={classData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {classData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val} scans`, 'Scans']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {classData.slice(0, 4).map((entry, index) => (
                  <div key={entry.name} className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="legend-text">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Rendering simulator tab ---
  const renderSimulator = () => {
    return (
      <div className="tab-content simulator-layout">
        <div className="sim-grid">
          <div className="glass-card sim-form-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3>Smart Scanner & Threat Intelligence</h3>
              <div className="status-badge-container">
                <span className={`status-badge ${scanStatus}`}>
                  {scanStatus === 'scanning' && <RefreshCw size={12} className="spin" />}
                  {scanStatus === 'complete' && <Check size={12} />}
                  {scanStatus === 'waiting' && <Zap size={12} />}
                  {scanStatus === 'qr_detected' || scanStatus === 'url_detected' ? <Scan size={12} /> : null}
                  {scanStatusText}
                </span>
              </div>
            </div>
            <p className="card-subtitle" style={{ marginBottom: '1.2rem' }}>
              Point camera at any QR Code, Barcode, or Printed URL (OCR). The scanner automatically detects content and analyzes threat vectors without manual clicks.
            </p>
            
            <div className="sim-action-row" style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="sim-tabs" style={{ margin: 0, flex: 1 }}>
                <button type="button" className={simType === 'url' ? 'active' : ''} onClick={() => setSimType('url')}>URL Link Scanner</button>
                <button type="button" className={simType === 'message' ? 'active' : ''} onClick={() => setSimType('message')}>Full Text Scanner</button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {qrActive && (
                  <button 
                    type="button" 
                    onClick={toggleCameraFacing}
                    title="Switch between Front and Back camera"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      padding: '0.65rem 0.9rem', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-color)', 
                      background: 'rgba(255,255,255,0.06)', 
                      color: '#f1f5f9', 
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.8rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <RotateCcw size={14} /> Switch Camera ({cameraFacing === 'environment' ? 'Back' : 'Front'})
                  </button>
                )}
                
                <button 
                  type="button" 
                  className={`qr-toggle-btn ${qrActive ? 'active' : ''}`} 
                  onClick={() => {
                    setQrActive(!qrActive);
                    setQrCameraError(null);
                  }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '0.65rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)', 
                    background: qrActive ? 'var(--primary)' : 'rgba(255,255,255,0.03)', 
                    color: '#fff', 
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <Camera size={16} /> {qrActive ? 'Close Camera' : 'Open Camera'}
                </button>
              </div>
            </div>

            {qrActive && (
              <div className="qr-scanner-box animate-fade" style={{ 
                background: 'rgba(15, 23, 42, 0.75)', 
                border: '1px dashed var(--primary)', 
                borderRadius: '12px', 
                padding: '1.25rem', 
                marginBottom: '1.5rem',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Smart Camera (QR, Barcode & OCR)
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                    Lens: {cameraFacing === 'environment' ? 'Back' : 'Front'}
                  </span>
                </div>
                
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Point camera at a QR code, barcode, or printed URL link. Detection & Threat Analysis run automatically.
                </p>

                <div id="qr-reader" style={{ 
                  width: '100%', 
                  maxWidth: '300px', 
                  margin: '0 auto', 
                  overflow: 'hidden', 
                  borderRadius: '10px',
                  background: '#000',
                  border: '2px solid rgba(255,255,255,0.1)',
                  position: 'relative'
                }}></div>

                {qrCameraError && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: '500' }}>{qrCameraError}</p>}
              </div>
            )}

            {scanStatus === 'complete' && (
              <div className="scan-again-banner animate-fade" style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h5 style={{ margin: 0, color: '#10b981', fontSize: '0.9rem', fontWeight: '600' }}>Scan Completed Successfully</h5>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>
                    Detected via: {detectedSource || 'Smart Scanner'}. Results updated in WhatsApp preview.
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={handleResetScan} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.5rem 1rem',
                    background: '#10b981',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <RotateCcw size={14} /> Scan Again
                </button>
              </div>
            )}

            <form onSubmit={handleScanSubmit}>
              {simType === 'url' ? (
                <div className="form-group">
                  <label>Suspicious URL (Auto-detected from Camera or enter manually)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. http://secure-paypal-login-verify.xyz/update-auth" 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    required
                  />
                  <small className="help-text">Extracts domain details, SSL keys, WHOIS registration ages, and runs Random Forest predictions.</small>
                </div>
              ) : (
                <div className="form-group">
                  <label>Message Content (Auto-detected from Camera or enter manually)</label>
                  <textarea 
                    rows={4}
                    placeholder="e.g. URGENT: Congratulations, you won $1,000,000 lottery! To claim, verify your credit card pin code here:..."
                    value={msgInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    required
                  />
                  <small className="help-text">Runs NLP tokenization, targets high-risk entities (banks, crypto), intent maps, and tests Logistic Regression models.</small>
                </div>
              )}

              <button type="submit" className="primary-btn flex-center w-full" disabled={scanning}>
                {scanning ? <RefreshCw size={16} className="spin" /> : <Shield size={16} />}
                {scanning ? 'Analyzing Threat Vector...' : 'Scan Threat Vector'}
              </button>
            </form>

            {scanError && <div className="error-banner flex-center" style={{ marginTop: '1rem' }}><AlertTriangle size={18} /> {scanError}</div>}
          </div>

          <div className="mock-phone-wrapper">
            <div className="phone-bezel">
              <div className="phone-screen">
                <div className="whatsapp-header">
                  <div className="wa-avatar">🤖</div>
                  <div className="wa-status">
                    <h4>TruthGuard Bot</h4>
                    <p>online</p>
                  </div>
                </div>

                <div className="whatsapp-chat-body">
                  <div className="wa-msg outgoing">
                    <p>{simType === 'url' ? (urlInput || 'Forwarded URL link shows here...') : (msgInput || 'Forwarded message block shows here...')}</p>
                    <span className="wa-time">12:00 PM</span>
                  </div>

                  {scanning && (
                    <div className="wa-msg incoming wa-typing">
                      <span></span><span></span><span></span>
                    </div>
                  )}

                  {scanResult && (
                    <div className="wa-msg incoming">
                      <pre className="bot-reply">{getWhatsAppMockupText(scanResult)}</pre>
                      <span className="wa-time">Just now</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Rendering history tab ---
  const renderHistory = () => {
    const formatDate = (isoString) => {
      try {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      } catch (e) {
        return isoString;
      }
    };

    return (
      <div className="tab-content history-layout">
        <div className="glass-card">
          <div className="flex-header">
            <h3>Scans Audit & Threat Log</h3>
            <button className="icon-btn" onClick={refreshData}><RefreshCw size={16} /></button>
          </div>

          <div className="table-responsive">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  {user?.role === 'admin' && <th>Scanned By</th>}
                  <th>Type</th>
                  <th>Content</th>
                  <th>Classification</th>
                  <th>Risk Score</th>
                  <th>Source</th>
                  <th>Date & Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 9 : 8} className="text-center">No scans recorded yet. Use the Threat Simulator to run scans!</td>
                  </tr>
                ) : (
                  history.map((item, idx) => (
                    <tr key={item.id}>
                      <td>{idx + 1}</td>
                      {user?.role === 'admin' && (
                        <td>
                          {item.username ? (
                            <div>
                              <strong>{item.username}</strong>
                              {item.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.email}</div>}
                            </div>
                          ) : (
                            <span style={{ color: '#64748b', fontStyle: 'italic' }}>whatsapp bot / guest</span>
                          )}
                        </td>
                      )}
                      <td>
                        <span className={`type-badge ${item.type}`}>
                          {item.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="truncate-text" title={item.content}>{item.content}</td>
                      <td>
                        <span className="threat-label flex-center" style={{ color: getThreatColor(item.threat_level), fontWeight: 'bold' }}>
                          <span className="indicator-dot" style={{ backgroundColor: getThreatColor(item.threat_level) }}></span>
                          {item.classification}
                        </span>
                      </td>
                      <td>
                        <div className="risk-score-cell">
                          <span className="score-num">{Math.round(item.risk_score)}%</span>
                          <div className="score-mini-bar">
                            <div className="score-mini-fill" style={{ width: `${item.risk_score}%`, backgroundColor: getThreatColor(item.threat_level) }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="capitalize">{item.source}</td>
                      <td>{formatDate(item.timestamp)}</td>
                      <td>
                        <button className="action-btn flex-center" onClick={() => setSelectedScan(item)}>
                          <Eye size={14} /> Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // --- Rendering Rules list tab ---
  const renderRules = () => {
    return (
      <div className="tab-content rules-layout">
        <div className="rules-grid">
          <div className="glass-card form-panel">
            <h3>Add Gatekeeper Rule</h3>
            <p className="card-subtitle">Administrators can hardcode blacklists or whitelists. Any matched URL domain is bypassed immediately.</p>
            
            <form onSubmit={handleAddRule}>
              <div className="form-group">
                <label>Filter Type</label>
                <select value={listType} onChange={(e) => setListType(e.target.value)}>
                  <option value="blacklist">Blacklist (Always Block with 100% Risk)</option>
                  <option value="whitelist">Whitelist (Always Trusted with 0% Risk)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Domain or Phone Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. goodcompany.com or +14150000000" 
                  value={listValue}
                  onChange={(e) => setListValue(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Reason / Notes</label>
                <input 
                  type="text" 
                  placeholder="e.g. Verified corporate portal" 
                  value={listNotes}
                  onChange={(e) => setListNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="primary-btn flex-center w-full" disabled={listLoading}>
                <Plus size={16} /> Add Gatekeeper Filter
              </button>
            </form>
          </div>

          <div className="glass-card lists-tables-panel">
            <div className="list-tabs-header">
              <h3>Active Gatekeeper Policies</h3>
            </div>
            
            <div className="rules-split-columns">
              <div className="rules-col">
                <h4 className="rules-header text-red">🚨 Global Blacklist ({blacklist.length})</h4>
                <div className="rules-scroller">
                  {blacklist.length === 0 ? (
                    <p className="empty-text">No active blacklisted elements.</p>
                  ) : (
                    blacklist.map(rule => (
                      <div className="rule-card" key={rule.id}>
                        <div className="rule-meta">
                          <span className="rule-val">{rule.value}</span>
                          <span className="rule-notes">{rule.notes || 'No description'}</span>
                        </div>
                        <button className="delete-btn" onClick={() => handleDeleteRule(rule.id, 'blacklist')}><Trash2 size={14} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rules-col">
                <h4 className="rules-header text-green">✅ Global Whitelist ({whitelist.length})</h4>
                <div className="rules-scroller">
                  {whitelist.length === 0 ? (
                    <p className="empty-text">No active whitelisted elements.</p>
                  ) : (
                    whitelist.map(rule => (
                      <div className="rule-card" key={rule.id}>
                        <div className="rule-meta">
                          <span className="rule-val">{rule.value}</span>
                          <span className="rule-notes">{rule.notes || 'No description'}</span>
                        </div>
                        <button className="delete-btn" onClick={() => handleDeleteRule(rule.id, 'whitelist')}><Trash2 size={14} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFeedback = () => {
    if (user?.role === 'admin') {
      return (
        <div className="tab-content feedback-layout animate-fade">
          <div className="glass-card">
            <div className="flex-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>User Ratings & Suggestions</h3>
              <button className="refresh-btn flex-center" onClick={loadFeedback} disabled={feedbackLoading}>
                <RefreshCw size={14} className={feedbackLoading ? 'spin' : ''} /> Refresh
              </button>
            </div>
            
            {feedbackLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <RefreshCw className="spin text-blue" size={24} />
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Loading feedback entries...</p>
              </div>
            ) : feedbackList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No user feedback submitted yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {feedbackList.map((item) => (
                  <div key={item.id} className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{item.username}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.75rem' }}>({item.email})</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '0.75rem' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} style={{ color: star <= item.rating ? '#eab308' : '#334155', fontSize: '1.2rem' }}>★</span>
                      ))}
                    </div>
                    <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {item.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    } else {
      return (
        <div className="tab-content feedback-layout animate-fade">
          <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3>Rate our Website</h3>
            <p className="card-subtitle">Please let us know how we can improve TruthGuard AI. Suggest any new safety features you want us to build!</p>
            
            {feedbackSuccess && (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                {feedbackSuccess}
              </div>
            )}
            
            {feedbackError && (
              <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
                {feedbackError}
              </div>
            )}
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setFeedbackSubmitting(true);
              setFeedbackError(null);
              setFeedbackSuccess(null);
              try {
                await submitFeedback(feedbackRating, feedbackComment);
                setFeedbackSuccess("Thank you! Your rating and comments have been sent to our security administrators.");
                setFeedbackComment('');
                setFeedbackRating(5);
              } catch (err) {
                setFeedbackError(err.response?.data?.detail || "Failed to submit feedback. Please try again.");
              } finally {
                setFeedbackSubmitting(false);
              }
            }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ marginBottom: '0.75rem', display: 'block' }}>Your Rating</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '2rem',
                        color: star <= feedbackRating ? '#eab308' : '#334155',
                        transition: 'transform 0.1s',
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.15)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1.0)'}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Comment / Suggested Features</label>
                <textarea
                  rows={6}
                  required
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Suggest any safety features you want... E.g. 'I want email phishing scanning' or 'Add phone call spam alerts'"
                  style={{ width: '100%', minHeight: '120px' }}
                />
              </div>
              
              <button type="submit" className="primary-btn flex-center w-full" disabled={feedbackSubmitting}>
                {feedbackSubmitting ? <RefreshCw size={16} className="spin" /> : <MessageSquare size={16} />}
                {feedbackSubmitting ? 'Sending Feedback...' : 'Submit Feedback'}
              </button>
            </form>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Shield size={24} className="brand-logo" />
          <h2>TruthGuard AI</h2>
        </div>
        <nav className="side-nav">
          {user?.role === 'admin' && (
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => handleTabChange('overview')}><Activity size={18}/> Security Analytics</button>
          )}
          <button className={activeTab === 'simulator' ? 'active' : ''} onClick={() => handleTabChange('simulator')}><Shield size={18}/> Threat Simulator</button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => handleTabChange('history')}><FileText size={18}/> {user?.role === 'admin' ? 'Audit Logs' : 'My Scans'}</button>
          {user?.role === 'admin' && (
            <button className={activeTab === 'rules' ? 'active' : ''} onClick={() => handleTabChange('rules')}><Settings size={18}/> Policy Filters</button>
          )}
          <button className={activeTab === 'feedback' ? 'active' : ''} onClick={() => handleTabChange('feedback')}><MessageSquare size={18}/> {user?.role === 'admin' ? 'User Feedback' : 'Submit Feedback'}</button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div className="header-info">
            <h1>{user?.role === 'admin' ? 'TruthGuard AI Cybersecurity Console' : 'TruthGuard AI Safety Portal'}</h1>
            <p>Welcome back, <strong>{user?.username || 'Security Officer'}</strong>. {user?.role === 'admin' ? 'Real-time scanning and analytics active.' : 'Forward links to your WhatsApp bot to view scan history here.'}</p>
          </div>
          <button className="refresh-btn flex-center" onClick={refreshData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </header>

        {loading && (user?.role === 'admin' ? !analytics : false) ? (
          <div className="loading-container">
            <RefreshCw className="spin text-blue" size={32} />
            <p>Syncing dashboard with MongoDB...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && user?.role === 'admin' && renderOverview()}
            {activeTab === 'simulator' && renderSimulator()}
            {activeTab === 'history' && renderHistory()}
            {activeTab === 'rules' && user?.role === 'admin' && renderRules()}
            {activeTab === 'feedback' && renderFeedback()}
          </>
        )}
      </main>

      {/* Audit Report Detail Modal */}
      {selectedScan && (
        <div className="modal-backdrop" onClick={() => setSelectedScan(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 Complete Threat Analysis Report</h3>
              <button className="close-modal-btn" onClick={() => setSelectedScan(null)}>&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="report-alert-banner" style={{ borderLeft: `5px solid ${getThreatColor(selectedScan.threat_level)}` }}>
                <div className="banner-details">
                  <h4>{selectedScan.classification}</h4>
                  <p>Risk Vector Score: <strong>{Math.round(selectedScan.risk_score)}%</strong> | Source: <strong>{selectedScan.source.toUpperCase()}</strong></p>
                </div>
                <div className="threat-badge" style={{ backgroundColor: getThreatColor(selectedScan.threat_level) }}>
                  {selectedScan.threat_level.toUpperCase()} THREAT
                </div>
              </div>

              <div className="report-section">
                <h5>Scanned Content</h5>
                <div className="content-box">
                  <code>{selectedScan.content}</code>
                </div>
              </div>

              <div className="report-section">
                <h5>TruthGuard AI Explanation</h5>
                <p className="explanation-text">{selectedScan.explanation}</p>
              </div>

              {selectedScan.details && (
                <div className="report-section">
                  <h5>Technical Metrics & Features</h5>
                  <div className="metrics-cards-subgrid">
                    {selectedScan.type === 'url' ? (
                      <>
                        <div className="detail-metric-card">
                          <strong>SSL Certificate:</strong>
                          <p className={selectedScan.details.ssl_cert?.valid ? "text-green" : "text-red"}>
                            {selectedScan.details.ssl_cert?.valid ? `Valid (Issuer: ${selectedScan.details.ssl_cert.issuer})` : `Invalid or Error: ${selectedScan.details.ssl_cert?.error || 'untrusted'}`}
                          </p>
                        </div>
                        <div className="detail-metric-card">
                          <strong>Domain Registration Age:</strong>
                          <p>{selectedScan.details.whois_info?.domain_age_days ? `${selectedScan.details.whois_info.domain_age_days} days` : 'Unknown (WHOIS unavailable)'}</p>
                        </div>
                        <div className="detail-metric-card">
                          <strong>VirusTotal Detections:</strong>
                          <p className={selectedScan.details.threat_intel?.virustotal?.malicious > 0 ? "text-red font-bold" : "text-green"}>
                            {selectedScan.details.threat_intel?.virustotal?.malicious || 0} / { (selectedScan.details.threat_intel?.virustotal?.harmless || 0) + (selectedScan.details.threat_intel?.virustotal?.malicious || 0) } scanners flagged
                          </p>
                        </div>
                        <div className="detail-metric-card">
                          <strong>Google Safe Browsing:</strong>
                          <p className={selectedScan.details.threat_intel?.google_safe_browsing?.is_dangerous ? "text-red font-bold" : "text-green"}>
                            {selectedScan.details.threat_intel?.google_safe_browsing?.is_dangerous ? `Flagged: ${selectedScan.details.threat_intel.google_safe_browsing.threat_type}` : 'Clean'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="detail-metric-card">
                          <strong>Classified Intent:</strong>
                          <p>{selectedScan.details.nlp_features?.intent || 'General Communication'}</p>
                        </div>
                        <div className="detail-metric-card">
                          <strong>Urgency Indicators:</strong>
                          <p className={selectedScan.details.nlp_features?.urgency_detected ? "text-red font-bold" : "text-green"}>
                            {selectedScan.details.nlp_features?.urgency_detected ? 'Urgent / Alert Wording' : 'Normal tone'}
                          </p>
                        </div>
                        <div className="detail-metric-card" style={{ gridColumn: 'span 2' }}>
                          <strong>Extracted Keywords:</strong>
                          <p className="keyword-tags">
                            {selectedScan.details.nlp_features?.keywords?.map((k, i) => (
                              <span className="keyword-tag" key={i}>{k}</span>
                            )) || 'None'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="primary-btn close-btn" onClick={() => setSelectedScan(null)}>Close Audit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
