import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import './LoginPage.css';

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('Authentication is not connected yet. We will enable sign-in after backend integration.');
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back-link">
        <ArrowLeft size={17} />
        Back to home
      </Link>

      <div className="auth-card">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-icon"><ShieldCheck size={23} /></span>
          <span>unwind<span className="auth-brand-highlight">ofa</span></span>
        </Link>

        <div className="auth-heading">
          <span className="auth-eyebrow">WELCOME BACK</span>
          <h1>Good to see you <span>again.</span></h1>
          <p>Sign in to access your Unwind identity and security workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <div className="auth-label-row">
            <label htmlFor="login-password">Password</label>
            <button type="button" className="auth-text-button">
              Forgot password?
            </button>
          </div>

          <div className="auth-password-field">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label className="auth-checkbox">
            <input type="checkbox" />
            <span>Remember me on this device</span>
          </label>

          <button type="submit" className="auth-submit-button">
            Sign in <span>→</span>
          </button>

          {message && <p className="auth-message" role="status">{message}</p>}
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>

        <div className="auth-security-note">
          <ShieldCheck size={16} />
          <span>Your security is at the heart of everything.</span>
        </div>
      </div>

      <p className="auth-footer">© 2026 Unwind OFA. One identity. One secure ecosystem.</p>
    </div>
  );
}

export default LoginPage;