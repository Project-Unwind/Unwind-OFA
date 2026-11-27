'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  LockKeyhole,
} from 'lucide-react';
import './EmergencyLockPage.css';

type EmergencyLockStatus = 'idle' | 'success' | 'error';

interface EmergencyLockResponse {
  message?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? getErrorMessage(error)
    : 'Something went wrong. Please try again.';
}

function EmergencyLockContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<EmergencyLockStatus>('idle');
  const [message, setMessage] = useState('');

  const handleEmergencyLock = async (): Promise<void> => {
    if (!token || loading) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/emergency-lock', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data: EmergencyLockResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to secure your account. The link may have expired or already been used.'
        );
      }

      setStatus('success');
      setMessage(
        data.message ||
          'Your account has been locked and all active sessions have been revoked.'
      );
    } catch (error: unknown) {
      setStatus('error');
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="emergency-lock-page">
      <section className="emergency-lock-card">
        <div className="emergency-lock-brand">
          <span className="emergency-lock-brand-icon">
            <LockKeyhole size={21} />
          </span>
          <span>Unwind OFA</span>
        </div>

        {status === 'success' ? (
          <div className="emergency-lock-content">
            <div className="emergency-lock-icon success">
              <ShieldCheck size={34} />
            </div>

            <p className="emergency-lock-eyebrow">ACCOUNT SECURED</p>
            <h1>Your account is locked.</h1>
            <p className="emergency-lock-description">{message}</p>
            <p className="emergency-lock-note">
              Passkey sign-ins are now blocked. Contact the account
              recovery process before attempting to access your account.
            </p>

            <Link href="/" className="emergency-lock-link">
              Return to Unwind OFA
            </Link>
          </div>
        ) : (
          <div className="emergency-lock-content">
            <div className="emergency-lock-icon warning">
              <ShieldAlert size={34} />
            </div>

            <p className="emergency-lock-eyebrow">EMERGENCY SECURITY</p>
            <h1>Wasn't you?</h1>

            <p className="emergency-lock-description">
              If you don't recognize the recent sign-in, you can
              immediately secure your Unwind OFA account.
            </p>

            {!token ? (
              <div className="emergency-lock-message error">
                This security link is missing its token. Please use the
                complete link from your security email.
              </div>
            ) : (
              <>
                <div className="emergency-lock-warning">
                  <strong>What happens when you confirm?</strong>
                  <ul>
                    <li>Your account will be emergency-locked.</li>
                    <li>All active sessions will be revoked.</li>
                    <li>New passkey sign-ins will be blocked.</li>
                  </ul>
                </div>

                {message && (
                  <div className={`emergency-lock-message ${status}`}>
                    {message}
                  </div>
                )}

                <button
                  type="button"
                  className="emergency-lock-button"
                  onClick={handleEmergencyLock}
                  disabled={loading}
                >
                  {loading ? 'Securing account...' : 'Yes, secure my account'}
                </button>

                <p className="emergency-lock-footnote">
                  Only confirm if you did not authorize the sign-in.
                  This action will prevent normal account access until
                  the account is recovered.
                </p>
              </>
            )}

            <Link href="/" className="emergency-lock-link">
              Return to Unwind OFA
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

export default function EmergencyLockPage() {
  return (
    <Suspense
      fallback={
        <main className="emergency-lock-page">
          <section className="emergency-lock-card">
            Verifying security link...
          </section>
        </main>
      }
    >
      <EmergencyLockContent />
    </Suspense>
  );
}