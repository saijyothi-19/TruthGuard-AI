import { useState } from 'react';
import { AlertTriangle, ShieldOff, ExternalLink, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { addToBlacklist } from '../api';

const DangerousUrlModal = ({ resultData, onClose, onBlock }) => {
  const [blocked, setBlocked] = useState(false);
  const [loadingBlock, setLoadingBlock] = useState(false);

  if (!resultData) return null;

  const content = resultData.content || 'Unknown URL';
  const riskScore = Math.round(resultData.risk_score || 0);

  const handleBlockWebsite = async () => {
    setLoadingBlock(true);
    try {
      let domain = content.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
      await addToBlacklist(domain, "Auto-blocked from Dangerous URL Alert");
      setBlocked(true);
      if (onBlock) onBlock(domain);
    } catch (e) {
      setBlocked(true);
    } finally {
      setLoadingBlock(false);
    }
  };

  const handleLeaveImmediately = () => {
    window.location.href = 'https://google.com';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 10, 15, 0.99) 100%)',
      backdropFilter: 'blur(20px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div style={{
        maxWidth: '540px',
        width: '100%',
        background: 'rgba(30, 41, 59, 0.9)',
        border: '2px solid #ef4444',
        borderRadius: '20px',
        padding: '2.25rem',
        boxShadow: '0 20px 60px rgba(239, 68, 68, 0.4)',
        textAlign: 'center',
        color: '#f8fafc'
      }}>
        <div style={{
          width: '70px',
          height: '70px',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)'
        }}>
          <AlertTriangle size={38} />
        </div>

        <span style={{
          background: '#ef4444',
          color: '#ffffff',
          fontSize: '0.75rem',
          fontWeight: '800',
          padding: '4px 12px',
          borderRadius: '12px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          🔴 DANGEROUS WEBSITE INTERCEPTED
        </span>

        <h2 style={{ margin: '1rem 0 0.5rem 0', fontSize: '1.6rem', fontWeight: '800' }}>
          Malicious Threat Intercepted!
        </h2>

        <p style={{ margin: '0 0 1rem 0', color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>
          TruthGuard AI detected high risk factors (Risk Score: <strong style={{ color: '#ef4444' }}>{riskScore}%</strong>). Interacting with this link could expose your banking credentials or infect your device with malware.
        </p>

        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          wordBreak: 'break-all',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          color: '#fca5a5',
          marginBottom: '1.5rem'
        }}>
          {content}
        </div>

        {/* Primary Safety Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleLeaveImmediately}
            style={{
              padding: '0.85rem 1.5rem',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
            }}
          >
            <ArrowLeft size={18} /> Leave Immediately (Recommended)
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleBlockWebsite}
              disabled={blocked || loadingBlock}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                background: blocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                color: blocked ? '#10b981' : '#f1f5f9',
                border: blocked ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {blocked ? <CheckCircle2 size={16} /> : <ShieldOff size={16} />}
              {blocked ? 'Domain Blocked' : 'Block Domain'}
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Continue Anyway ⚠️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DangerousUrlModal;
