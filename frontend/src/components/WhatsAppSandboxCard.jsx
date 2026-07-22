import { useState } from 'react';
import { MessageSquare, ExternalLink, CheckCircle, ShieldAlert } from 'lucide-react';

const WhatsAppSandboxCard = ({ onConfirmChange, confirmed = false }) => {
  const [isChecked, setIsChecked] = useState(confirmed);

  const handleToggle = (e) => {
    const checked = e.target.checked;
    setIsChecked(checked);
    if (onConfirmChange) onConfirmChange(checked);
  };

  const sandboxUrl = "https://wa.me/14155238886?text=join%20useful-army";
  const qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Fwa.me%2F14155238886%3Ftext%3Djoin%2520useful-army";

  return (
    <div className="whatsapp-sandbox-card" style={{
      background: 'rgba(16, 185, 129, 0.08)',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '12px',
      padding: '1.25rem',
      margin: '1rem 0',
      textAlign: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '0.75rem' }}>
        <MessageSquare size={20} style={{ color: '#10b981' }} />
        <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', fontWeight: '700' }}>
          Step 1: Join Twilio WhatsApp Sandbox
        </h4>
      </div>

      <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
        Twilio requires your WhatsApp number to join the sandbox before receiving OTPs or scan alerts.
      </p>

      {/* QR Code Container */}
      <div style={{
        background: '#ffffff',
        padding: '10px',
        borderRadius: '10px',
        display: 'inline-block',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        marginBottom: '0.75rem'
      }}>
        <img 
          src={qrCodeUrl} 
          alt="Twilio WhatsApp Sandbox QR Code"
          style={{ width: '140px', height: '140px', display: 'block' }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: '#f8fafc' }}>
          Send: <strong style={{ color: '#10b981', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px' }}>join useful-army</strong>
        </p>
        <p style={{ margin: '0.2rem 0', fontSize: '0.75rem', color: '#94a3b8' }}>
          To Twilio Number: <strong>+1 (415) 523-8886</strong>
        </p>
      </div>

      <a 
        href={sandboxUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="primary-btn flex-center"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0.5rem 1rem',
          fontSize: '0.8rem',
          background: '#10b981',
          color: '#ffffff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '600',
          marginBottom: '1rem'
        }}
      >
        🚀 Join Sandbox on WhatsApp <ExternalLink size={14} />
      </a>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justify: 'center',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <input 
          type="checkbox" 
          id="wa-sandbox-check"
          checked={isChecked} 
          onChange={handleToggle} 
          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
        />
        <label htmlFor="wa-sandbox-check" style={{ fontSize: '0.8rem', color: '#f8fafc', cursor: 'pointer', margin: 0, fontWeight: '500' }}>
          I have joined the Twilio WhatsApp Sandbox
        </label>
      </div>
    </div>
  );
};

export default WhatsAppSandboxCard;
