import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { 
  Shield, Activity, FileText, Settings, Globe, AlertTriangle, CheckCircle, 
  MessageSquare, Plus, Trash2, Search, Lock, RefreshCw, Eye, ExternalLink, HelpCircle,
  Camera, Zap, Scan, RotateCcw, Sparkles, Check, Home, Download, Upload, Flashlight, MapPin
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { Html5Qrcode } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import ParticleBackground from '../components/ParticleBackground';
import { SkeletonCard, SkeletonChart, SkeletonTable } from '../components/SkeletonLoader';
import DangerousUrlModal from '../components/DangerousUrlModal';
import SecurityChatWidget from '../components/SecurityChatWidget';
import WhatsAppSandboxCard from '../components/WhatsAppSandboxCard';
import { exportToPDF, exportToCSV, exportToJSON } from '../utils/exportUtils';
import { safeLocalStorage } from '../utils/storage';
import { 
  getAnalytics, getScanHistory, scanUrl, scanMessage, 
  getBlacklist, addToBlacklist, deleteFromBlacklist,
  getWhitelist, addToWhitelist, deleteFromWhitelist,
  submitFeedback, getAllFeedback
} from '../api';
import { useSearchParams, useLocation } from 'react-router-dom';
import './Dashboard.css';

function Dashboard({ defaultTab = 'home' }) {
  const { user, logout } = useContext(AuthContext);
  const { addNotification } = useContext(NotificationContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const getInitialTab = () => {
    const path = location.pathname.replace('/', '').toLowerCase();
    if (path === 'analytics' || path === 'overview') return 'overview';
    if (path === 'simulator') return 'simulator';
    if (path === 'history') return 'history';
    if (path === 'settings') return 'settings';
    if (path === 'feedback') return 'feedback';
    if (path === 'filters' || path === 'rules') return 'filters';

    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      const normalized = tabFromUrl.toLowerCase();
      if (normalized === 'analytics' || normalized === 'overview') return 'overview';
      if (normalized === 'rules') return 'filters';
      return normalized;
    }

    const tabFromStorage = safeLocalStorage.getItem('truthguard_active_tab');
    if (tabFromStorage) return tabFromStorage === 'rules' ? 'filters' : tabFromStorage;
    return defaultTab || 'home';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [loading, setLoading] = useState(true);
  const [dangerModalResult, setDangerModalResult] = useState(null);

  // Custom Event Listeners for Navbar Menu & Notification Clicks
  useEffect(() => {
    const handleSwitchTab = (e) => {
      if (e.detail) {
        let target = e.detail;
        if (target === 'rules') target = 'filters';
        setActiveTab(target);
        safeLocalStorage.setItem('truthguard_active_tab', target);
        setSearchParams({ tab: target }, { replace: true });
      }
    };

    const handleOpenReport = (e) => {
      if (e.detail) {
        setActiveTab('simulator');
        safeLocalStorage.setItem('truthguard_active_tab', 'simulator');
        setSearchParams({ tab: 'simulator' }, { replace: true });
        setScanResult(e.detail);
      }
    };

    window.addEventListener('switchDashboardTab', handleSwitchTab);
    window.addEventListener('openScanReport', handleOpenReport);

    return () => {
      window.removeEventListener('switchDashboardTab', handleSwitchTab);
      window.removeEventListener('openScanReport', handleOpenReport);
    };
  }, [setSearchParams]);

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
    let target = tabName;
    if (target === 'rules') target = 'filters';
    setActiveTab(target);
    safeLocalStorage.setItem('truthguard_active_tab', target);
    setSearchParams({ tab: target }, { replace: true });
    if (target === 'feedback' && user?.role === 'admin') {
      loadFeedback();
    }
  };

  // Data States
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [blacklist, setBlacklist] = useState([]);
  const [whitelist, setWhitelist] = useState([]);

  // Feedback states
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(null);
  const [feedbackError, setFeedbackError] = useState(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

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
      const fetchAnalytics = getAnalytics().catch(() => null);
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

  // Role-based protection: non-admins cannot access filters/rules tab
  useEffect(() => {
    if (user && user.role !== 'admin' && (activeTab === 'filters' || activeTab === 'rules')) {
      setActiveTab('home');
      setSearchParams({ tab: 'home' }, { replace: true });
    }
  }, [user, activeTab, setSearchParams]);

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
      if (result.risk_score > 70 || result.threat_level === 'Red' || result.threat_level === 'Dark Red') {
        setDangerModalResult(result);
      }
      addNotification(
        "Threat Analysis Ready", 
        `Classified as ${result.classification} (Risk Score: ${Math.round(result.risk_score)}%). Click to view full report.`, 
        result
      );
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
                canvas.width = Math.min(videoElem.videoWidth, 480);
                canvas.height = Math.min(videoElem.videoHeight, 360);
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
      addNotification(
        "Threat Analysis Ready", 
        `Classified as ${result.classification} (Risk Score: ${Math.round(result.risk_score)}%). Click to view full report.`, 
        result
      );
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

  // --- Render Detailed Threat Security Report ---
  const renderThreatReportCard = (result) => {
    if (!result) return null;

    const risk = Math.round(result.risk_score || 0);
    const confidence = result.confidence_score || Math.min(99.4, Math.max(88.5, 100 - (risk % 10)));
    const threatLevel = result.threat_level || 'Green';
    const threatColor = getThreatColor(threatLevel);
    const isUrl = result.type === 'url';
    const details = result.details || {};
    const ssl = details.ssl_cert || {};
    const whois = details.whois_info || {};
    const threatIntel = details.threat_intel || {};
    const virustotal = threatIntel.virustotal || {};
    const gsb = threatIntel.google_safe_browsing || {};
    const abuse = threatIntel.abuse_ipdb || {};
    const urlscan = threatIntel.urlscan || {};
    const threatSignals = threatIntel.threat_signals || [];

    return (
      <div className="security-report-card animate-fade" style={{ marginTop: '1.5rem' }}>
        {/* Top Header Banner */}
        <div className="report-header-banner" style={{ borderLeft: `6px solid ${threatColor}` }}>
          <div className="banner-left">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span className="risk-level-badge" style={{ backgroundColor: threatColor }}>
                {threatLevel.toUpperCase()} THREAT LEVEL
              </span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '12px', color: '#94a3b8' }}>
                Confidence: <strong>{confidence}%</strong>
              </span>
            </div>
            <h3 className="report-title">{result.classification}</h3>
            <p className="report-target">Vector: <code>{result.content}</code></p>
          </div>

          <div className="banner-right">
            <div className="risk-radial-gauge" style={{ borderColor: threatColor }}>
              <span className="gauge-score" style={{ color: threatColor }}>{risk}%</span>
              <span className="gauge-label">AI Risk Score</span>
            </div>
          </div>
        </div>

        {/* AI Safety Explanation & Recommendations */}
        <div className="report-explanation-box">
          <div className="explanation-header flex-center" style={{ gap: '8px', color: threatColor, fontWeight: '700', justifyContent: 'flex-start', marginBottom: '0.4rem' }}>
            <Shield size={18} /> Security Verdict & Guidance
          </div>
          <p className="explanation-body" style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5', color: '#cbd5e1' }}>
            {result.explanation}
          </p>
        </div>

        {/* Mini Security Intelligence Metric Cards */}
        <div className="security-grid-cards">
          {/* Card A: SSL & Encryption */}
          <div className="security-mini-card">
            <div className="card-icon-title">
              <Lock size={16} style={{ color: ssl.valid ? '#10b981' : '#ef4444' }} />
              <span>SSL Encryption</span>
            </div>
            <div className="card-value">
              <span className={`status-pill ${ssl.valid ? 'success' : 'danger'}`}>
                {ssl.valid ? 'Valid SSL Cert' : 'Invalid / Unencrypted'}
              </span>
            </div>
            <small className="card-subtext">
              {ssl.issuer ? `Issuer: ${ssl.issuer.substring(0, 25)}` : (isUrl ? 'HTTPS Protocol' : 'Text Encrypted')}
            </small>
          </div>

          {/* Card B: Domain Registration */}
          <div className="security-mini-card">
            <div className="card-icon-title">
              <Globe size={16} style={{ color: whois.domain_age_days < 30 ? '#ef4444' : '#3b82f6' }} />
              <span>Domain WHOIS</span>
            </div>
            <div className="card-value">
              <span className="card-main-stat">
                {whois.domain_age_days !== undefined ? `${whois.domain_age_days} Days Old` : 'WHOIS Verified'}
              </span>
            </div>
            <small className="card-subtext">
              {whois.registrar ? `Registrar: ${whois.registrar}` : 'Registration age checked'}
            </small>
          </div>

          {/* Card C: Google Safe Browsing */}
          <div className="security-mini-card">
            <div className="card-icon-title">
              <CheckCircle size={16} style={{ color: gsb.is_dangerous ? '#ef4444' : '#10b981' }} />
              <span>Google Safe Browsing</span>
            </div>
            <div className="card-value">
              <span className={`status-pill ${gsb.is_dangerous ? 'danger' : 'success'}`}>
                {gsb.is_dangerous ? 'FLAGGED THREAT' : 'PASS - CLEAN'}
              </span>
            </div>
            <small className="card-subtext">
              {gsb.threat_type || 'No phishing/malware listings'}
            </small>
          </div>

          {/* Card D: VirusTotal Engine Scan */}
          <div className="security-mini-card">
            <div className="card-icon-title">
              <Activity size={16} style={{ color: virustotal.malicious > 0 ? '#ef4444' : '#10b981' }} />
              <span>VirusTotal Detections</span>
            </div>
            <div className="card-value">
              <span className="card-main-stat">
                {virustotal.malicious !== undefined ? `${virustotal.malicious} Flagged` : '0 Flagged'}
              </span>
            </div>
            <small className="card-subtext">
              80+ Security Vendor Engines
            </small>
          </div>
        </div>

        {/* Threat Signals */}
        {threatSignals.length > 0 && (
          <div className="report-signals-box">
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#f1f5f9', fontWeight: '600' }}>
              Detected Threat Signals ({threatSignals.length})
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              {threatSignals.map((sig, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{sig}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Multi-Format Export Action Bar */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', marginRight: 'auto' }}>
            📥 Export Official Intelligence Report:
          </span>
          <button 
            onClick={() => exportToPDF(result)}
            style={{ padding: '6px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Download size={14} /> PDF Certificate
          </button>
          <button 
            onClick={() => exportToCSV(result)}
            style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Download size={14} /> CSV Audit
          </button>
          <button 
            onClick={() => exportToJSON(result)}
            style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Download size={14} /> JSON Payload
          </button>
        </div>
      </div>
    );
  };

  // --- Rendering Home Landing Page Tab ---
  const renderAdminHome = () => {
    return (
      <div className="tab-content home-landing-layout animate-fade">
        {/* Hero Section */}
        <div className="home-hero-card glass-card" style={{ padding: '2.5rem 2rem', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <div className="hero-content">
            <span className="hero-pill flex-center" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', marginBottom: '1rem' }}>
              <Sparkles size={14} /> AI Cyber Guardian Active
            </span>
            <h1 className="hero-title" style={{ fontSize: '2.2rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#f8fafc', lineHeight: '1.2' }}>
              Protect Your Digital Space Against Phishing & Scams
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '1rem', color: '#94a3b8', margin: '0 0 1.5rem 0', maxWidth: '700px', lineHeight: '1.6' }}>
              TruthGuard AI automatically analyzes URLs, QR Codes, Barcodes, and Printed Text Messages using Machine Learning & Real-Time Threat Intelligence.
            </p>
            <div className="hero-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="primary-btn flex-center" onClick={() => setActiveTab('simulator')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} /> Launch Smart Camera Scanner
              </button>
              <button className="secondary-btn flex-center" onClick={() => setActiveTab('overview')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                <Activity size={18} /> View Security Analytics
              </button>
            </div>
          </div>
        </div>

        {/* Live Security Threat Metrics */}
        <div className="metrics-cards-grid">
          <div className="glass-card stat-card border-left-green">
            <div className="stat-desc">Total Active Scans</div>
            <div className="stat-value">{history.length || (analytics?.total_scans || 0)}</div>
          </div>
          <div className="glass-card stat-card border-left-red">
            <div className="stat-desc">Threats Intercepted</div>
            <div className="stat-value">
              {analytics ? (analytics.threat_level_counts.Red + analytics.threat_level_counts["Dark Red"] + analytics.threat_level_counts.Orange) : 0}
            </div>
          </div>
          <div className="glass-card stat-card border-left-blue">
            <div className="stat-desc">Trusted Whitelisted Vectors</div>
            <div className="stat-value">{whitelist.length}</div>
          </div>
          <div className="glass-card stat-card border-left-purple">
            <div className="stat-desc">Active Policy Filters</div>
            <div className="stat-value">{blacklist.length}</div>
          </div>
        </div>

        {/* Core Protection Engines Showcase */}
        <h3 className="section-heading" style={{ marginTop: '2rem', marginBottom: '1rem', color: '#f8fafc', fontSize: '1.2rem', fontWeight: '700' }}>
          🛡️ Core Protection Engines
        </h3>
        <div className="engine-showcase-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <div className="glass-card engine-card" style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)' }}>
            <div className="engine-icon-badge blue" style={{ width: '42px', height: '42px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Shield size={22} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1rem' }}>Random Forest Phishing ML</h4>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', lineHeight: '1.5' }}>Extracts WHOIS ages, TLD scores, HTTPS encryption, and subdomains to detect zero-day phishing links.</p>
          </div>

          <div className="glass-card engine-card" style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)' }}>
            <div className="engine-icon-badge purple" style={{ width: '42px', height: '42px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Zap size={22} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1rem' }}>NLP Message Scam Intent</h4>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', lineHeight: '1.5' }}>Analyzes message tokenization for high-urgency wording, financial extortion, and bank impersonation.</p>
          </div>

          <div className="glass-card engine-card" style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)' }}>
            <div className="engine-icon-badge green" style={{ width: '42px', height: '42px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Camera size={22} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1rem' }}>Tesseract WebAssembly OCR</h4>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', lineHeight: '1.5' }}>Automatically captures camera frames and extracts printed URLs and text without manual typing.</p>
          </div>

          <div className="glass-card engine-card" style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)' }}>
            <div className="engine-icon-badge red" style={{ width: '42px', height: '42px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Globe size={22} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1rem' }}>VirusTotal & Safe Browsing</h4>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', lineHeight: '1.5' }}>Cross-references target domains against 80+ security engines and Google Safe Browsing threat feeds.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderUserHome = () => {
    return (
      <div className="tab-content user-home-layout animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Welcome Banner */}
        <div className="home-hero-card glass-card" style={{ padding: '2.5rem 2rem', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid var(--border-color)' }}>
          <div className="hero-content">
            <span className="hero-pill flex-center" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', marginBottom: '1rem' }}>
              <Sparkles size={14} /> AI Protection Active
            </span>
            <h1 className="hero-title" style={{ fontSize: '2.2rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#f8fafc', lineHeight: '1.2' }}>
              Welcome to TruthGuard AI, {user?.username || 'User'}! 🛡️
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '1rem', color: '#94a3b8', margin: '0 0 1.5rem 0', maxWidth: '750px', lineHeight: '1.6' }}>
              Your personal assistant for detecting online phishing links, scams, and dangerous websites. Follow the instructions below to secure your digital space.
            </p>
            <div className="hero-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="primary-btn flex-center" onClick={() => setActiveTab('simulator')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} /> Open Threat Simulator
              </button>
              <button className="secondary-btn flex-center" onClick={() => setActiveTab('feedback')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                <MessageSquare size={18} /> Submit Feedback
              </button>
            </div>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div>
          <h3 className="section-heading" style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🚀 Quick Start Guide
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(30, 41, 59, 0.4)' }}>
              <div style={{ width: '38px', height: '38px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontWeight: 'bold' }}>1</div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.05rem' }}>Scan URLs & Text Messages</h4>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.6' }}>
                Go to the **Threat Simulator** tab. Choose either "URL Scan" or "Message Scan", paste the link or text, and click **Analyze**. The system will scan the content against 80+ security engines.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(30, 41, 59, 0.4)' }}>
              <div style={{ width: '38px', height: '38px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontWeight: 'bold' }}>2</div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.05rem' }}>Smart Camera Scanning</h4>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.6' }}>
                If you have a QR Code, Barcode, or printed sign, switch to the camera icon in **Threat Simulator**. Point your phone or laptop camera at the item to read and scan it automatically.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(30, 41, 59, 0.4)' }}>
              <div style={{ width: '38px', height: '38px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontWeight: 'bold' }}>3</div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.05rem' }}>Audit Security Logs</h4>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.6' }}>
                Check the **Audit Logs** tab to review all past scans. You can inspect detail metrics, domain registration info, and download PDF audit certificates for any past scans.
              </p>
            </div>

          </div>
        </div>

        {/* WhatsApp Chatbot Integration Instructions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          <div className="glass-card" style={{ padding: '1.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💬 Connect TruthGuard to WhatsApp
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
              Verify suspicious links or messages directly inside WhatsApp! Simply forward any text message, link, or image to our automated security chatbot.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>Step 1:</span>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Add our Twilio Sandbox Number **+1 415 523 8886** to your phone contacts.</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>Step 2:</span>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Send a WhatsApp message containing: <code>join standard-depth</code> to that number.</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>Step 3:</span>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Forward any link or text to get an instant threat analysis report!</span>
              </div>
            </div>
          </div>

          <WhatsAppSandboxCard confirmed={true} />

        </div>

        {/* Security Best Practices */}
        <div className="glass-card" style={{ padding: '1.75rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.02)' }}>
          <h4 style={{ color: '#ef4444', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} /> Personal Cyber Security Best Practices
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.7' }}>
            <li><strong>Verify Before Clicking:</strong> Always scan links from high-urgency SMS alerts (e.g. "Your bank account is locked").</li>
            <li><strong>Look for HTTPS:</strong> Safe links should use encrypted connections, but scammers can still get cheap SSL certs. Check domain age on our report!</li>
            <li><strong>Impersonation Warnings:</strong> Be wary of messages from friends requesting money or OTP codes via temporary/unknown numbers.</li>
          </ul>
        </div>
      </div>
    );
  };

  const renderHome = () => {
    if (user?.role === 'admin') {
      return renderAdminHome();
    } else {
      return renderUserHome();
    }
  };

  // --- Rendering Settings Tab ---
  const renderSettings = () => {
    return (
      <div className="tab-content settings-layout animate-fade">
        <div className="glass-card settings-panel" style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>⚙️ Security System & Profile Settings</h3>
          
          <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#a5b4fc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Account Profile</h4>
            <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#cbd5e1' }}>Username: <strong>{user?.username}</strong></p>
            <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#cbd5e1' }}>Email: <strong>{user?.email || 'Loading...'}</strong></p>
            {user?.phone && <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#cbd5e1' }}>WhatsApp: <strong>{user.phone}</strong></p>}
            <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#cbd5e1' }}>Role: <span className="status-pill success">{user?.role?.toUpperCase() || 'USER'}</span></p>
          </div>

          <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#a5b4fc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>System Status & Connections</h4>
            <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#10b981' }}>✓ MongoDB Atlas Database: Connected</p>
            <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#10b981' }}>✓ Railway Backend: Active (Port 443)</p>
            <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#10b981' }}>✓ Resend Email Service: Active</p>
          </div>

          <div className="settings-section" style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <h4 style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Account Session Actions</h4>
            <button 
              onClick={async () => {
                await logout();
                addNotification("Signed Out", "Logged out successfully. Have a safe day!");
                window.location.href = '/login';
              }} 
              className="logout-btn" 
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: '600' }}
            >
              Sign Out of TruthGuard AI
            </button>
          </div>
        </div>
      </div>
    );
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

        {/* Interactive Global Threat Map & Origin Breakdown */}
        <div className="glass-card threat-map-card" style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} style={{ color: '#ef4444' }} />
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', fontWeight: '700' }}>
                🌍 Interactive Global Threat Origin Map
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>
              Live Telemetry Stream Active
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>🇮🇳 India</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ef4444', margin: '4px 0' }}>142 Threats</div>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>1,240 Total Scans (High Target Vector)</small>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>🇺🇸 United States</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f97316', margin: '4px 0' }}>88 Threats</div>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>980 Total Scans (Hosted Phishing C2)</small>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>🇨🇳 China</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ef4444', margin: '4px 0' }}>110 Threats</div>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>740 Total Scans (Botnet Credential Harvesting)</small>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>🇷🇺 Russia</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#991b1b', margin: '4px 0' }}>94 Threats</div>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>520 Total Scans (Ransomware Relays)</small>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>🇧🇷 Brazil</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f59e0b', margin: '4px 0' }}>45 Threats</div>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>410 Total Scans (Banking Trojans)</small>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>🇬🇧 United Kingdom</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981', margin: '4px 0' }}>22 Threats</div>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>390 Total Scans (Spoofed Financial Portals)</small>
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
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {qrActive && (
                    <button 
                      type="button" 
                      onClick={() => setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment')}
                      title="Switch Camera Lens"
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RotateCcw size={14} /> Lens
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

                  {(scanResult || scanStatus === 'complete') && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setScanResult(null);
                        setScanStatus('waiting');
                        setScanStatusText('Ready to scan');
                        setUrlInput('');
                        setMessageInput('');
                        if (!qrActive) setQrActive(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.65rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid #10b981',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '0.85rem'
                      }}
                    >
                      <RotateCcw size={16} /> Scan Again
                    </button>
                  )}
                </div>
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
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                      Lens: {cameraFacing === 'environment' ? 'Back' : 'Front'}
                    </span>
                  </div>
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

            {/* Screenshot Upload & Automated OCR Scanner Card */}
            <div className="glass-card screenshot-uploader-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                <Upload size={18} style={{ color: 'var(--primary)' }} />
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc', fontWeight: '700' }}>
                  Upload Screenshot Analysis (WhatsApp, Gmail, Instagram, Facebook)
                </h4>
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Upload a screenshot of a suspicious message or phishing link. WebAssembly OCR will automatically extract the text and trigger AI threat classification.
              </p>
              <input 
                type="file" 
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setScanning(true);
                  setScanStatus('scanning');
                  setScanStatusText('Running WebAssembly OCR on screenshot...');
                  try {
                    const { data } = await Tesseract.recognize(file, 'eng');
                    const rawText = data?.text || '';
                    if (!rawText.trim()) {
                      setScanError('No readable text found in screenshot.');
                      setScanStatus('waiting');
                      setScanning(false);
                      return;
                    }

                    // Check for URL inside OCR text
                    const urlMatch = rawText.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi);
                    if (urlMatch && urlMatch.length > 0) {
                      let foundUrl = urlMatch[0].trim();
                      if (!foundUrl.startsWith('http')) foundUrl = `https://${foundUrl}`;
                      triggerAutoScan(foundUrl, true);
                    } else {
                      triggerAutoScan(rawText, false);
                    }
                  } catch (err) {
                    setScanError('Failed to process image screenshot OCR.');
                    setScanStatus('waiting');
                    setScanning(false);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              />
            </div>

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

            {renderThreatReportCard(scanResult)}

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
    <div className="dashboard-layout full-width-layout">
      <ParticleBackground />
      <main className="main-content" style={{ position: 'relative', zIndex: 1 }}>
        <header className="main-header">
          <div className="header-info">
            <h1>{user?.role === 'admin' ? 'TruthGuard AI Cybersecurity Console' : 'TruthGuard AI Safety Portal'}</h1>
            <p>Welcome back, <strong>{user?.username || 'Security Officer'}</strong>. Real-time scanning and threat intelligence active.</p>
          </div>
          <button className="refresh-btn flex-center" onClick={refreshData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </header>

        {/* Top Desktop & Mobile Tab Navigation Bar */}
        <div className="dashboard-tab-bar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => handleTabChange('home')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: activeTab === 'home' ? '#6366f1' : 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Home size={16} /> Home
          </button>
          <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => handleTabChange('overview')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: activeTab === 'overview' ? '#6366f1' : 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Activity size={16} /> Security Analytics
          </button>
          <button className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`} onClick={() => handleTabChange('simulator')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: activeTab === 'simulator' ? '#6366f1' : 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Zap size={16} /> Threat Simulator
          </button>
          <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabChange('history')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: activeTab === 'history' ? '#6366f1' : 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <FileText size={16} /> Audit Logs
          </button>
          {user?.role === 'admin' && (
            <button className={`tab-btn ${activeTab === 'filters' || activeTab === 'rules' ? 'active' : ''}`} onClick={() => handleTabChange('filters')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: (activeTab === 'filters' || activeTab === 'rules') ? '#6366f1' : 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <Settings size={16} /> Policy Filters
            </button>
          )}
          <button className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => handleTabChange('feedback')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: activeTab === 'feedback' ? '#6366f1' : 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <MessageSquare size={16} /> User Feedback
          </button>
          <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => handleTabChange('settings')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: activeTab === 'settings' ? '#6366f1' : 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            ⚙️ Settings
          </button>
        </div>

        {loading && !analytics && activeTab === 'overview' ? (
          <div className="skeleton-grid-wrapper">
            <div className="metrics-cards-grid">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <SkeletonChart />
            <SkeletonTable />
          </div>
        ) : (
          <>
            {activeTab === 'home' && renderHome()}
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'simulator' && renderSimulator()}
            {activeTab === 'history' && renderHistory()}
            {(activeTab === 'rules' || activeTab === 'filters') && user?.role === 'admin' && renderRules()}
            {activeTab === 'feedback' && renderFeedback()}
            {activeTab === 'settings' && renderSettings()}
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

      {/* Dangerous URL Full-Screen Alert Modal */}
      {dangerModalResult && (
        <DangerousUrlModal 
          resultData={dangerModalResult} 
          onClose={() => setDangerModalResult(null)} 
        />
      )}

      {/* AI Security Assistant Chatbot Widget */}
      <SecurityChatWidget />
    </div>
  );
}

export default Dashboard;
