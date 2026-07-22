import { useState } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';

const SecurityChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Hello! I am TruthGuard AI Cyber Assistant 🤖. Ask me any question about link safety, bank SMS verification, or phishing threats.'
    }
  ]);
  const [input, setInput] = useState('');

  const suggestions = [
    "Is this bank SMS genuine?",
    "Can I trust a newly created website?",
    "Why is missing HTTPS dangerous?",
    "How to report a phishing scam?"
  ];

  const handleSend = (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    const userMsg = { id: Date.now(), sender: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');

    setTimeout(() => {
      let botResponse = "TruthGuard AI Engine recommendation: Always verify the sender domain. Genuine banks never request PINs or passwords via SMS links.";
      const lower = query.toLowerCase();

      if (lower.includes('bank') || lower.includes('sms')) {
        botResponse = "🏦 Genuine bank SMS alerts will never ask you to click a link to update account details or enter PINs. If an SMS contains an urgent link (e.g., 'Account Blocked! Click here'), it is 99% a phishing scam.";
      } else if (lower.includes('new') || lower.includes('domain') || lower.includes('days')) {
        botResponse = "⚠️ Domains registered less than 30 days ago carry an extremely high risk score. Over 85% of zero-day phishing sites use newly registered disposable domains.";
      } else if (lower.includes('https') || lower.includes('ssl')) {
        botResponse = "🔒 Missing HTTPS means communication is unencrypted HTTP. Attackers can intercept your data, passwords, and session tokens on open Wi-Fi networks.";
      } else if (lower.includes('report') || lower.includes('phishing')) {
        botResponse = "📢 You can report phishing websites to Google Safe Browsing (safebrowsing.google.com) and add the domain to TruthGuard AI Policy Filters to block it for your organization.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: botResponse }]);
    }, 600);
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000 }}>
      {/* Bot Floating Bubble Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s'
          }}
          title="Open AI Security Assistant"
        >
          <Bot size={28} />
        </button>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <div className="glass-card animate-slide-up" style={{
          width: '360px',
          maxWidth: '90vw',
          height: '480px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.04)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={20} style={{ color: '#6366f1' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc', fontWeight: '700' }}>AI Security Assistant</h4>
                <small style={{ color: '#10b981', fontSize: '0.65rem' }}>● Online | Cyber Guardian</small>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Body */}
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.sender === 'user' ? '#6366f1' : 'rgba(30, 41, 59, 0.8)',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  lineHeight: '1.4'
                }}
              >
                {m.text}
              </div>
            ))}
          </div>

          {/* Suggestions Chips */}
          <div style={{ padding: '0 0.75rem', display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '8px' }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                style={{
                  whiteSpace: 'nowrap',
                  fontSize: '0.65rem',
                  padding: '4px 8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '8px'
            }}
          >
            <input
              type="text"
              placeholder="Ask AI about link or message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.8rem'
              }}
            />
            <button
              type="submit"
              style={{
                padding: '8px 12px',
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SecurityChatWidget;
