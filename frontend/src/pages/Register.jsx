import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api';
import { Eye, EyeOff } from 'lucide-react';
import WhatsAppSandboxCard from '../components/WhatsAppSandboxCard';

const countries = [
  { name: 'India', code: '+91', placeholder: '+91 0000000000', minLen: 10, maxLen: 10 },
  { name: 'United States', code: '+1', placeholder: '+1 0000000000', minLen: 10, maxLen: 10 },
  { name: 'United Kingdom', code: '+44', placeholder: '+44 0000000000', minLen: 10, maxLen: 11 },
  { name: 'Australia', code: '+61', placeholder: '+61 000000000', minLen: 9, maxLen: 9 },
  { name: 'Germany', code: '+49', placeholder: '+49 0000000000', minLen: 10, maxLen: 11 },
];

const Register = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [waConfirmed, setWaConfirmed] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let finalPhone = '';
    if (phoneInput.trim()) {
      if (!waConfirmed) {
        setError('Please check the confirmation box verifying that you have joined the Twilio WhatsApp Sandbox.');
        setLoading(false);
        return;
      }
      const digits = phoneInput.replace(/\D/g, '');
      if (digits.length < selectedCountry.minLen || digits.length > selectedCountry.maxLen) {
        setError(`Invalid phone number length for ${selectedCountry.name}. Expected ${selectedCountry.minLen}-${selectedCountry.maxLen} digits.`);
        setLoading(false);
        return;
      }
      finalPhone = `${selectedCountry.code}${digits}`;
    }

    try {
      await registerUser(formData.username, formData.email, formData.password, finalPhone);
      navigate(`/verify?username=${encodeURIComponent(formData.username)}`);
    } catch (err) {
      console.error("Registration submit error:", err);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg).join(', '));
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Registration failed. Try a different username/email.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Create Account | TruthGuard AI</h2>
        {error && <div className="error-message">{error}</div>}
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            required
            minLength={3}
          />
        </div>
        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
        </div>

        {/* Twilio WhatsApp Sandbox QR & Step 1 */}
        <WhatsAppSandboxCard 
          confirmed={waConfirmed} 
          onConfirmChange={(checked) => setWaConfirmed(checked)} 
        />

        <div className="form-group">
          <label>WhatsApp Phone (Optional, for WhatsApp OTPs)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={selectedCountry.code}
              onChange={(e) => {
                const country = countries.find(c => c.code === e.target.value);
                setSelectedCountry(country);
              }}
              style={{
                width: '120px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-color, #1e293b)',
                color: 'var(--text-color, #f1f5f9)',
              }}
            >
              {countries.map(c => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={selectedCountry.placeholder}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Password (Min 6 characters)</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              minLength={6}
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
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Creating Account...' : 'Register'}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in here</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
