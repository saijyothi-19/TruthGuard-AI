import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { verifyOTP, verifyLoginOTP } from '../api';
import { AuthContext } from '../context/AuthContext';
import WhatsAppSandboxCard from '../components/WhatsAppSandboxCard';

const Verify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);

  // Extract parameters from URL query parameters
  const getUsernameFromQuery = () => {
    const params = new URLSearchParams(location.search);
    return params.get('username') || '';
  };

  const [username, setUsername] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const qUsername = getUsernameFromQuery();
    if (qUsername) {
      setUsername(qUsername);
    }
  }, [location]);

  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await verifyLoginOTP(username.trim(), emailOtp.trim(), phoneOtp.trim() || '000000');
        setSuccess('Login verification successful! Redirecting...');
        setTimeout(() => {
          login(response.access_token);
          navigate('/');
        }, 1500);
      } else {
        const response = await verifyOTP(username.trim(), emailOtp.trim(), phoneOtp.trim() || '000000');
        setSuccess(response.message || 'Account successfully verified! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed. Please check your OTP codes and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>{mode === 'login' ? 'Login Verification | TruthGuard AI' : 'Account Verification | TruthGuard AI'}</h2>
        
        <div 
          style={{ 
            backgroundColor: 'rgba(139, 92, 246, 0.1)', 
            color: '#a78bfa', 
            padding: '10px 15px', 
            borderRadius: '6px', 
            border: '1px solid #8b5cf6', 
            margin: '10px 0 20px 0', 
            fontSize: '14px',
            textAlign: 'center'
          }}
        >
          OTP sent to Gmail (and WhatsApp if connected)
        </div>

        <p className="auth-subtitle" style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
          {mode === 'login' 
            ? 'Verify your identity by entering the secure codes sent to your registered destinations.' 
            : 'Please enter the OTP verification codes sent to your registered destinations.'
          }
        </p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '10px 15px', borderRadius: '6px', border: '1px solid #10b981', marginBottom: '15px', fontSize: '14px' }}>{success}</div>}

        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Username"
            disabled={true}
          />
        </div>

        <div className="form-group">
          <label>Gmail Verification Code (6-digit OTP)</label>
          <input
            type="text"
            maxLength={6}
            value={emailOtp}
            onChange={(e) => setEmailOtp(e.target.value)}
            required
            placeholder="e.g. 123456"
          />
        </div>

        {/* Twilio WhatsApp Sandbox QR Code & Info */}
        <WhatsAppSandboxCard confirmed={true} />

        <div className="form-group">
          <label>WhatsApp Verification Code (6-digit OTP)</label>
          <input
            type="text"
            maxLength={6}
            value={phoneOtp}
            onChange={(e) => setPhoneOtp(e.target.value)}
            placeholder="e.g. 123456 (Enter 000000 if no phone registered)"
          />
          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
            Check WhatsApp on your phone for a message from Twilio Sandbox.
          </span>
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Verifying Codes...' : (mode === 'login' ? 'Verify & Sign In' : 'Verify & Activate')}
        </button>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={async () => {
              if (!username) {
                setError('Username missing. Please re-enter registration.');
                return;
              }
              setLoading(true);
              setError(null);
              setSuccess(null);
              try {
                const { resendOTP } = await import('../api');
                const res = await resendOTP(username);
                setSuccess(res.message || 'A new OTP code has been dispatched to your Gmail inbox.');
              } catch (err) {
                setError(err.response?.data?.detail || 'Failed to resend OTP. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#818cf8',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Didn't receive Gmail code? Click to Resend OTP 📩
          </button>
        </div>

        <p className="auth-switch">
          Need to sign in instead? <Link to="/login">Sign in here</Link>
        </p>
      </form>
    </div>
  );
};

export default Verify;
