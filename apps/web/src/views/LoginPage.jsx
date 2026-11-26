'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  Fingerprint,
} from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const signInWithPasskey = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const optionsResponse = await fetch(
        '/api/auth/login/options',
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

      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsResult.options,
      });
      console.log('Passkey ID from browser:', authenticationResponse.id);
console.log('Passkey rawId from browser:', authenticationResponse.rawId);

      const verifyResponse = await fetch(
        '/api/auth/login/verify',
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

      const sessionResult = await refreshSession();

      if (!sessionResult.authenticated) {
        throw new Error(
          'Authentication succeeded, but your session could not be established.'
        );
      }

      setMessage('You have successfully signed in.');

      router.replace('/dashboard');
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
      <Link href="/" className="auth-back-link">
        <ArrowLeft size={17} />
        Back to home
      </Link>

      <div className="auth-card">
        <Link href="/" className="auth-brand">
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
            Sign in using your device's built-in authentication.
            Use fingerprint recognition, Face ID, Windows Hello,
            or another supported passkey verification method.
          </p>
        </div>

        <div className="auth-success">
          <Fingerprint size={42} />

          <p>
            Authenticate securely with your device's fingerprint
            sensor, facial recognition, or supported screen-lock
            verification.
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

          <Link
            href="/recover-account"
            className="auth-recovery-link"
          >
            Forgot access? Recover your account
          </Link>
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
          <Link href="/signup">Create one</Link>
        </p>

        <div className="auth-security-note">
          <ShieldCheck size={16} />
          <span>
            Your security is at the heart of everything.
          </span>
        </div>
      </div>

      <p className="auth-footer">
        &copy; 2026 Unwind OFA. One identity. One secure ecosystem.
      </p>
    </div>
  );
}

export default LoginPage;