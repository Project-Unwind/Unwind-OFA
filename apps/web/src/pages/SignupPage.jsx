import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  Fingerprint,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './SignupPage.css';

function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('details');
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
        shouldCreateUser: true,
        data: {
          full_name: fullName.trim(),
        },
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

    setStep('passkey');
    setMessage('Email verified! Now register your passkey.');
  };

  const registerPasskey = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error: passkeyError } =
        await supabase.auth.registerPasskey();

      if (passkeyError) {
        setError(passkeyError.message);
        return;
      }

      setStep('complete');
      setMessage('Your passkey has been registered successfully!');
    } catch (passkeyError) {
      setError(
        passkeyError.message || 'Unable to register your passkey.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        data: {
          full_name: fullName.trim(),
        },
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
    <div className="signup-page">
      <Link to="/" className="signup-back-link">
        <ArrowLeft size={17} />
        Back to home
      </Link>

      <div className="signup-card">
        <Link to="/" className="signup-brand">
          <span className="signup-brand-icon">
            <ShieldCheck size={23} />
          </span>
          <span>
            unwind<span className="signup-brand-highlight">ofa</span>
          </span>
        </Link>

        <div className="signup-heading">
          <span className="signup-eyebrow">
            {step === 'passkey' || step === 'complete'
              ? 'PASSKEY SECURITY'
              : 'PASSWORDLESS REGISTRATION'}
          </span>

          <h1>
            {step === 'details' && (
              <>Your security starts <span>here.</span></>
            )}
            {step === 'otp' && (
              <>Verify your <span>email.</span></>
            )}
            {step === 'passkey' && (
              <>Secure your <span>identity.</span></>
            )}
            {step === 'complete' && (
              <>Welcome to <span>Unwind.</span></>
            )}
          </h1>

          <p>
            {step === 'details' &&
              'Create your Unwind OFA account and get started.'}
            {step === 'otp' &&
              `Enter the six-digit code sent to ${email}.`}
            {step === 'passkey' &&
              'Register a passkey to sign in securely using your device.'}
            {step === 'complete' &&
              'Your account and passkey are ready.'}
          </p>
        </div>

        {step === 'details' && (
          <form className="signup-form" onSubmit={sendOtp}>
            <label htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />

            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label className="signup-terms">
              <input type="checkbox" required />
              <span>
                I agree to the <a href="#terms">Terms of Service</a> and{' '}
                <a href="#privacy">Privacy Policy</a>.
              </span>
            </label>

            <button
              type="submit"
              className="signup-submit-button"
              disabled={loading}
            >
              {loading ? 'Sending code...' : 'Verify email'}
              <Mail size={18} />
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form className="signup-form" onSubmit={verifyOtp}>
            <label htmlFor="signup-otp">
              Six-digit verification code
            </label>

            <input
              id="signup-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              pattern="[0-9]{6}"
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, ''))
              }
              required
            />

            <button
              type="submit"
              className="signup-submit-button"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify email'}
            </button>

            <button
              type="button"
              className="signup-text-button"
              onClick={resendOtp}
              disabled={loading}
            >
              Resend verification code
            </button>

            <button
              type="button"
              className="signup-text-button"
              onClick={() => {
                setStep('details');
                setOtp('');
                setError('');
                setMessage('');
              }}
            >
              Change account details
            </button>
          </form>
        )}

        {step === 'passkey' && (
          <div className="signup-success">
            <Fingerprint size={42} />

            <p>
              Use Windows Hello, your device biometrics, a device PIN,
              or a supported security key to create your passkey.
            </p>

            <button
              type="button"
              className="signup-submit-button"
              onClick={registerPasskey}
              disabled={loading}
            >
              {loading ? 'Registering passkey...' : 'Register my passkey'}
              <Fingerprint size={18} />
            </button>
          </div>
        )}

        {step === 'complete' && (
          <div className="signup-success">
            <ShieldCheck size={42} />

            <p>
              Your identity is authenticated and your passkey is
              registered. You can now use it for future sign-ins.
            </p>

            <Link to="/dashboard" className="signup-submit-button">
              Continue to dashboard
            </Link>
          </div>
        )}

        {error && (
          <p
            className="signup-message signup-message-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {message && (
          <p className="signup-message" role="status">
            {message}
          </p>
        )}

        {step !== 'complete' && (
          <p className="signup-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}

        <div className="signup-security-note">
          <ShieldCheck size={16} />
          <span>One identity. A more secure Unwind ecosystem.</span>
        </div>
      </div>

      <p className="signup-footer">
        © 2026 Unwind OFA. Built for a safer digital life.
      </p>
    </div>
  );
}

export default SignupPage;