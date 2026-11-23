import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Fingerprint,
} from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import './SignupPage.css';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [step, setStep] = useState('details');
  const [loading, setLoading] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const requestRegistrationOptions = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/register/options`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: fullName.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to start registration.'
        );
      }

      setRegistration({
        userId: result.userId,
        challengeId: result.challengeId,
        options: result.options,
      });

      setStep('passkey');
      setMessage(
        'Your identity is ready. Register a passkey to continue.'
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          'Unable to connect to the Unwind OFA server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const registerPasskey = async () => {
    if (!registration) {
      setError('Registration details are missing. Please try again.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Open the browser's native passkey registration prompt.
      const credential = await startRegistration({
        optionsJSON: registration.options,
      });

      // Verify the authenticator response with the OFA backend.
      const response = await fetch(
        `${API_BASE_URL}/api/auth/register/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: registration.userId,
            challengeId: registration.challengeId,
            response: credential,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Passkey registration failed.'
        );
      }

      setStep('complete');
      setMessage(
        'Your Unwind OFA passkey has been registered successfully.'
      );
    } catch (registrationError) {
      console.error(
        'Passkey registration failed:',
        registrationError
      );

      if (registrationError.name === 'NotAllowedError') {
        setError(
          'Passkey registration was cancelled or not allowed. Please try again.'
        );
      } else {
        setError(
          registrationError.message ||
            'Unable to register your passkey. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const restartRegistration = () => {
    setRegistration(null);
    setStep('details');
    setError('');
    setMessage('');
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
            {step === 'details'
              ? 'PASSWORDLESS REGISTRATION'
              : 'PASSKEY SECURITY'}
          </span>

          <h1>
            {step === 'details' && (
              <>
                Your security starts <span>here.</span>
              </>
            )}

            {step === 'passkey' && (
              <>
                Secure your <span>identity.</span>
              </>
            )}

            {step === 'complete' && (
              <>
                Welcome to <span>Unwind.</span>
              </>
            )}
          </h1>

          <p>
            {step === 'details' &&
              'Create your Unwind OFA identity using a passkey. No password or email verification required.'}

            {step === 'passkey' &&
  'Register using your device’s built-in authentication. Your device may use fingerprint recognition, Face ID, Windows Hello, or another supported screen-lock verification method.'}

            {step === 'complete' &&
              'Your Unwind OFA identity and passkey have been successfully registered.'}
          </p>
        </div>

        {step === 'details' && (
          <form
            className="signup-form"
            onSubmit={requestRegistrationOptions}
          >
            <label htmlFor="signup-name">Full name</label>

            <input
              id="signup-name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              minLength={2}
              maxLength={60}
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              required
            />

            <label className="signup-terms">
              <input type="checkbox" required />

              <span>
                I agree to the{' '}
                <Link to="/terms">Terms of Service</Link> and{' '}
                <Link to="/privacy">Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              className="signup-submit-button"
              disabled={loading}
            >
              {loading
                ? 'Preparing registration...'
                : 'Continue with passkey'}

              <Fingerprint size={18} />
            </button>
          </form>
        )}

        {step === 'passkey' && (
          <div className="signup-success">
            <Fingerprint size={42} />

            <p>
              <p>
  Your device will securely verify your identity
  using its supported fingerprint, facial recognition,
  or screen-lock authentication.
</p>
            </p>

            <button
              type="button"
              className="signup-submit-button"
              onClick={registerPasskey}
              disabled={loading}
            >
              {loading
                ? 'Registering passkey...'
                : 'Register my passkey'}

              <Fingerprint size={18} />
            </button>

            <button
              type="button"
              className="signup-text-button"
              onClick={restartRegistration}
              disabled={loading}
            >
              Start again
            </button>
          </div>
        )}

        {step === 'complete' && (
          <div className="signup-success">
            <ShieldCheck size={42} />

            <p>
              Your passkey is registered successfully.
              Your public credential has been securely saved
              by Unwind OFA.
            </p>

            <p>
              Sign-in and session creation will be available
              in the next authentication milestone.
            </p>

            <Link to="/login" className="signup-submit-button">
  Sign in with your passkey
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
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        )}

        <div className="signup-security-note">
          <ShieldCheck size={16} />

          <span>
            One identity. A more secure Unwind ecosystem.
          </span>
        </div>
      </div>

      <p className="signup-footer">
        © 2026 Unwind OFA. Built for a safer digital life.
      </p>
    </div>
  );
}

export default SignupPage;