import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import './VerifyEmailPage.css';

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState(
    'Verifying your email address...'
  );

  const verificationStarted = useRef(false);

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setStatus('error');
        setMessage('The verification link is missing its token.');
        return;
      }

      if (verificationStarted.current) {
        return;
      }

      verificationStarted.current = true;

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Email verification failed.'
          );
        }

        setStatus('success');
        setMessage(result.message);
      } catch (error) {
        setStatus('error');
        setMessage(
          error.message ||
            'Unable to verify your email address. Please try again.'
        );
      }
    }

    verifyEmail();
  }, [token]);

  return (
    <main className="verify-email-page">
      <section className="verify-email-card">
        <Link to="/" className="verify-email-brand">
          <span className="verify-email-brand-icon">
            <ShieldCheck size={23} />
          </span>

          <span>
            unwind<span>ofa</span>
          </span>
        </Link>

        <div className={`verify-email-status ${status}`}>
          {status === 'loading' && <LoaderCircle size={42} />}
          {status === 'success' && <CheckCircle2 size={42} />}
          {status === 'error' && <AlertCircle size={42} />}
        </div>

        <div className="verify-email-heading">
          <span className="verify-email-eyebrow">
            EMAIL SECURITY
          </span>

          <h1>
            {status === 'loading' && 'Verifying your email'}
            {status === 'success' && 'Email verified'}
            {status === 'error' && 'Verification unsuccessful'}
          </h1>

          <p>{message}</p>
        </div>

        {status !== 'loading' && (
          <Link to="/login" className="verify-email-button">
            Continue to sign in
          </Link>
        )}

        <p className="verify-email-footer">
          One identity. A more secure Unwind ecosystem.
        </p>
      </section>
    </main>
  );
}

export default VerifyEmailPage;