import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sendOtp = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setEmail(normalizedEmail);
    setStep('otp');
    setMessage('A verification code has been sent to your email.');
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email',
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    setStep('verified');
    setMessage('Your email has been verified. You are now signed in!');
  };

  const resendOtp = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
      },
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setMessage('A new verification code has been sent.');
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back-link">
        <ArrowLeft size={17} />
        Back to home
      </Link>

      <div className="auth-card">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-icon">
            <ShieldCheck size={23} />
          </span>
          <span>unwind<span className="auth-brand-highlight">ofa</span></span>
        </Link>

        <div className="auth-heading">
          <span className="auth-eyebrow">PASSWORDLESS SIGN IN</span>
          <h1>
            {step === 'email' && <>Welcome <span>back.</span></>}
            {step === 'otp' && <>Check your <span>inbox.</span></>}
            {step === 'verified' && <>You're <span>signed in.</span></>}
          </h1>
          <p>
            {step === 'email' && 'Sign in securely using a one-time verification code.'}
            {step === 'otp' && `Enter the six-digit code sent to ${email}.`}
            {step === 'verified' && 'Your Unwind OFA account is now authenticated.'}
          </p>
        </div>

        {step === 'email' && (
          <form className="auth-form" onSubmit={sendOtp}>
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <button type="submit" className="auth-submit-button" disabled={loading}>
              {loading ? 'Sending code...' : 'Send verification code'}
              <Mail size={18} />
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form className="auth-form" onSubmit={verifyOtp}>
            <label htmlFor="login-otp">Six-digit verification code</label>
            <input
              id="login-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              pattern="[0-9]{6}"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
              required
            />

            <button type="submit" className="auth-submit-button" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify and sign in'}
            </button>

            <button
              type="button"
              className="auth-text-button"
              onClick={resendOtp}
              disabled={loading}
            >
              Resend verification code
            </button>

            <button
              type="button"
              className="auth-text-button"
              onClick={() => {
                setStep('email');
                setOtp('');
                setError('');
                setMessage('');
              }}
            >
              Change email address
            </button>
          </form>
        )}

        {step === 'verified' && (
          <div className="auth-success">
            <ShieldCheck size={38} />
            <p>Your authentication session has been established successfully.</p>
            <Link to="/" className="auth-submit-button">
              Continue to Unwind OFA
            </Link>
          </div>
        )}

        {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
        {message && <p className="auth-message" role="status">{message}</p>}

        {step !== 'verified' && (
          <p className="auth-switch">
            Don't have an account? <Link to="/signup">Create one</Link>
          </p>
        )}

        <div className="auth-security-note">
          <ShieldCheck size={16} />
          <span>Your security is at the heart of everything.</span>
        </div>
      </div>

      <p className="auth-footer">
        © 2026 Unwind OFA. One identity. One secure ecosystem.
      </p>
    </div>
  );
}

export default LoginPage;