import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { loginUser } from '../api';
import { Eye, EyeOff } from 'lucide-react';
import WhatsAppSandboxCard from '../components/WhatsAppSandboxCard';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showWaInfo, setShowWaInfo] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const data = await loginUser(formData.username, formData.password);
      if (data.status === 'requires_otp') {
        setInfo('OTP sent to Gmail and WhatsApp. Redirecting to verification...');
        setTimeout(() => {
          navigate(`/verify?username=${encodeURIComponent(formData.username)}&mode=login&email=${encodeURIComponent(data.email || '')}&phone=${encodeURIComponent(data.phone || '')}`);
        }, 1500);
      } else {
        login(data.access_token);
        navigate('/');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Invalid username or password';
      setError(detail);
      if (detail.toLowerCase().includes('verified') || err.response?.status === 403) {
        setTimeout(() => {
          navigate(`/verify?username=${encodeURIComponent(formData.username)}`);
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Sign In | TruthGuard AI</h2>
        {error && <div className="error-message">{error}</div>}
        {info && (
          <div 
            style={{ 
              backgroundColor: 'rgba(139, 92, 246, 0.1)', 
              color: '#a78bfa', 
              padding: '10px 15px', 
              borderRadius: '6px', 
              border: '1px solid #8b5cf6', 
              marginBottom: '15px', 
              fontSize: '14px',
              textAlign: 'center'
            }}
          >
            {info}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button 
            type="button" 
            onClick={() => setShowWaInfo(!showWaInfo)}
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {showWaInfo ? 'Hide WhatsApp Sandbox QR Code ▲' : '💬 Need to join WhatsApp Sandbox? Click for QR Code ▼'}
          </button>
        </div>

        {showWaInfo && (
          <WhatsAppSandboxCard confirmed={true} />
        )}
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            required
            autoComplete="username"
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              autoComplete="current-password"
              style={{ width: '100%', paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '1.2rem' }}>
          <Link to="/forgot-password" style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}>
            Forgot Password?
          </Link>
        </div>
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
        <p className="auth-switch">
          Don't have an admin account? <Link to="/register">Register here</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
