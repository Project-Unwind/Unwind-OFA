'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import './VerifyEmailPage.css';

type VerificationStatus = 'loading' | 'success' | 'error';

interface VerificationResponse {
  success: boolean;
  message?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? getErrorMessage(error)
    : 'Unable to verify your email address. Please try again.';
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] =
    useState<VerificationStatus>('loading');

  const [message, setMessage] = useState(
    'Verifying your email address...'
  );

  const verificationStarted = useRef(false);

  useEffect(() => {
    async function verifyEmail(): Promise<void> {
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

        const result =
          (await response.json()) as VerificationResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Email verification failed.'
          );
        }

        setStatus('success');
        setMessage(result.message ?? 'Your email has been verified successfully.');
      } catch (error: unknown) {
        setStatus('error');
        setMessage(getErrorMessage(error));
      }
    }

    void verifyEmail();
  }, [token]);

  return (
    <main className="verify-email-page">
      <section className="verify-email-card">
        <Link href="/" className="verify-email-brand">
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
          <Link href="/login" className="verify-email-button">
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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="verify-email-page">
          <section className="verify-email-card">
            Verifying your email address...
          </section>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}