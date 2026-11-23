import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import './SignupPage.css';

function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('Account creation is not connected yet. We will enable registration after backend integration.');
  };

  return (
    <div className="signup-page">
      <Link to="/" className="signup-back-link">
        <ArrowLeft size={17} />
        Back to home
      </Link>

      <div className="signup-card">
        <Link to="/" className="signup-brand">
          <span className="signup-brand-icon"><ShieldCheck size={23} /></span>
          <span>unwind<span className="signup-brand-highlight">ofa</span></span>
        </Link>

        <div className="signup-heading">
          <span className="signup-eyebrow">GET STARTED</span>
          <h1>Your security starts <span>here.</span></h1>
          <p>Create your Unwind OFA account and bring your digital identity together.</p>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          <label htmlFor="signup-name">Full name</label>
          <input
            id="signup-name"
            type="text"
            placeholder="Your name"
            autoComplete="name"
            required
          />

          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="signup-password">Create password</label>
          <div className="signup-password-field">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 12 characters"
              autoComplete="new-password"
              minLength={12}
              required
            />
            <button
              type="button"
              className="signup-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <p className="signup-password-hint">
            Use at least 12 characters. A longer, unique passphrase is recommended.
          </p>

          <label className="signup-terms">
            <input type="checkbox" required />
            <span>
              I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.
            </span>
          </label>

          <button type="submit" className="signup-submit-button">
            Create account <span>→</span>
          </button>

          {message && <p className="signup-message" role="status">{message}</p>}
        </form>

        <p className="signup-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

        <div className="signup-security-note">
          <ShieldCheck size={16} />
          <span>One identity. A more secure Unwind ecosystem.</span>
        </div>
      </div>

      <p className="signup-footer">© 2026 Unwind OFA. Built for a safer digital life.</p>
    </div>
  );
}

export default SignupPage;