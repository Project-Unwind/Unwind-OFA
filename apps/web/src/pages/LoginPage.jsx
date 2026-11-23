import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Fingerprint,
} from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

function LoginPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const signInWithPasskey = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Request discoverable passkey authentication options.
      const optionsResponse = await fetch(
        `${API_BASE_URL}/api/auth/login/options`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      const optionsResult = await optionsResponse.json();

      if (!optionsResponse.ok || !optionsResult.success) {
        throw new Error(
          optionsResult.message ||
            'Unable to start passkey sign-in.'
        );
      }

      // Open the browser's native passkey prompt.
      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsResult.options,
      });

      // Verify the passkey with the OFA backend.
      const verifyResponse = await fetch(
        `${API_BASE_URL}/api/auth/login/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            challengeId: optionsResult.challengeId,
            response: authenticationResponse,
          }),
        }
      );

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyResult.success) {
        throw new Error(
          verifyResult.message ||
            'Passkey authentication failed.'
        );
      }

      // Confirm that the server-issued session cookie works.
      const sessionResult = await refreshSession();

      if (!sessionResult.authenticated) {
        throw new Error(
          'Authentication succeeded, but your session could not be established.'
        );
      }

      setMessage('You have successfully signed in.');

      navigate('/dashboard', { replace: true });
    } catch (signInError) {
      console.error('Passkey sign-in failed:', signInError);

      if (signInError.name === 'NotAllowedError') {
        setError(
          'Passkey sign-in was cancelled or not allowed. Please try again.'
        );
      } else {
        setError(
          signInError.message ||
            'Unable to sign in. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
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

          <span>
            unwind<span className="auth-brand-highlight">ofa</span>
          </span>
        </Link>

        <div className="auth-heading">
          <span className="auth-eyebrow">
            PASSWORDLESS SIGN IN
          </span>

          <h1>
            Welcome <span>back.</span>
          </h1>

          <p>
            Sign in securely using your registered passkey.
            No password or email verification required.
          </p>
        </div>

        <div className="auth-success">
          <Fingerprint size={42} />

          <p>
            Use your device's biometric authentication,
            Windows Hello, device PIN, or another supported
            passkey authenticator.
          </p>

          <button
            type="button"
            className="auth-submit-button"
            onClick={signInWithPasskey}
            disabled={loading}
          >
            {loading
              ? 'Waiting for passkey...'
              : 'Sign in with passkey'}

            <Fingerprint size={18} />
          </button>
        </div>

        {error && (
          <p
            className="auth-message auth-message-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}

        <p className="auth-switch">
          Don't have an account?{' '}
          <Link to="/signup">Create one</Link>
        </p>

        <div className="auth-security-note">
          <ShieldCheck size={16} />
          <span>
            Your security is at the heart of everything.
          </span>
        </div>
      </div>

      <p className="auth-footer">
        © 2026 Unwind OFA. One identity. One secure ecosystem.
      </p>
    </div>
  );
}

export default LoginPage;