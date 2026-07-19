import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../api';
import { Eye, EyeOff, Mail, KeyRound, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Send Code, 2: Reset Password
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSuccess("Reset code sent! Please check your registered email inbox.");
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send reset code. Verify the email address is correct.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    
    setLoading(true);
    try {
      await resetPassword(email, resetCode, newPassword);
      setSuccess("Password successfully updated! Redirecting to login...");
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update password. Check your reset code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={step === 1 ? handleSendCode : handleResetPassword}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <Link to="/login" style={{ color: 'var(--text-muted)', marginRight: '1rem', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </Link>
          <h2 style={{ margin: 0 }}>Reset Password</h2>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>{success}</div>}

        {step === 1 ? (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Enter your registered email address below. We will email you a 6-digit code to securely verify your identity and reset your password.
            </p>
            <div className="form-group">
              <label>Email Address</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                  placeholder="name@example.com"
                />
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
              </div>
            </div>
            <button type="submit" className="submit-btn" disabled={loading} style={{ marginTop: '1rem' }}>
              {loading ? 'Sending Verification Code...' : 'Send Reset Code'}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Type the 6-digit reset code sent to <strong>{email}</strong> and choose a new secure password.
            </p>
            <div className="form-group">
              <label>Verification Reset Code</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  required
                  style={{ width: '100%', paddingLeft: '2.5rem', letterSpacing: '4px', fontWeight: 'bold' }}
                  placeholder="e.g. 123456"
                />
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
              </div>
            </div>

            <div className="form-group">
              <label>New Password (Min 6 characters)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading} style={{ marginTop: '1rem' }}>
              {loading ? 'Updating Password...' : 'Reset Password'}
            </button>
          </>
        )}

        <p className="auth-switch" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          Remembered your password? <Link to="/login">Back to Sign In</Link>
        </p>
      </form>
    </div>
  );
};

export default ForgotPassword;
