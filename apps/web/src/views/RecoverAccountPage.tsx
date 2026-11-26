
'use client';

import {
  useEffect,
  useRef,
  useState,
  Suspense,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import {
  ShieldCheck,
  Mail,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  ArrowLeft,
  Fingerprint,
} from 'lucide-react';
import './RecoverAccountPage.css';

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type RecoveryStatus =
  | 'idle'
  | 'verifying'
  | 'submitting'
  | 'sent'
  | 'verified'
  | 'error';

interface ApiResponse {
  success: boolean;
  message?: string;
}

interface RecoveryEmailResponse extends ApiResponse {
  recoveryToken?: string;
}

interface AuthenticationOptionsResponse extends ApiResponse {
  options?: Parameters<typeof startAuthentication>[0]['optionsJSON'];
  challengeId?: string;
}

interface RegistrationOptionsResponse extends ApiResponse {
  options?: Parameters<typeof startRegistration>[0]['optionsJSON'];
  challengeId?: string;
}

interface RecoveryCompletionResponse extends ApiResponse {
  recoveryCodes?: unknown;
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error ? error.message : fallback;
}

// --------------------------------------------------
// RECOVERY CONTENT
// --------------------------------------------------

function RecoverAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');

  const [email, setEmail] = useState('');

  const [status, setStatus] = useState<RecoveryStatus>(
    urlToken ? 'verifying' : 'idle'
  );

  const [message, setMessage] = useState(
    urlToken ? 'Verifying your recovery link...' : ''
  );

  const [recoveryToken, setRecoveryToken] = useState('');
  const [loading, setLoading] = useState(false);

  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyVerified, setPasskeyVerified] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState('');

  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryCodeLoading, setRecoveryCodeLoading] = useState(false);
  const [recoveryCodeVerified, setRecoveryCodeVerified] = useState(false);
  const [recoveryCodeMessage, setRecoveryCodeMessage] = useState('');

  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementRegistered, setReplacementRegistered] = useState(false);
  const [replacementMessage, setReplacementMessage] = useState('');

  const [recoveryCompleting, setRecoveryCompleting] = useState(false);
  const [recoveryCompleted, setRecoveryCompleted] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [completionMessage, setCompletionMessage] = useState('');
  const [codesCopied, setCodesCopied] = useState(false);
  const [codesSaved, setCodesSaved] = useState(false);

  const verificationStarted = useRef(false);

  // --------------------------------------------------
  // VERIFY RECOVERY EMAIL LINK
  // --------------------------------------------------

  useEffect(() => {
    async function verifyRecoveryEmail(): Promise<void> {
      if (!urlToken || verificationStarted.current) {
        return;
      }

      verificationStarted.current = true;

      setStatus('verifying');
      setMessage('Verifying your recovery link...');

      try {
        const response = await fetch(
          '/api/auth/recovery/verify-email',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token: urlToken,
            }),
          }
        );

        const result: RecoveryEmailResponse =
          await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              'This recovery link is invalid or has expired.'
          );
        }

        if (!result.recoveryToken) {
          throw new Error(
            'The recovery session could not be established.'
          );
        }

        setRecoveryToken(result.recoveryToken);
        setStatus('verified');
        setMessage(
          'Your email has been verified. Now verify your existing passkey.'
        );

        router.replace('/recover-account', { scroll: false });
      } catch (error: unknown) {
        setStatus('error');
        setMessage(
          getErrorMessage(
            error,
            'Unable to verify your recovery link.'
          )
        );

        router.replace('/recover-account', { scroll: false });
      }
    }

    void verifyRecoveryEmail();
  }, [urlToken, router]);

  // --------------------------------------------------
  // REQUEST ACCOUNT RECOVERY
  // --------------------------------------------------

  const requestRecovery = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch(
        '/api/auth/recovery/start',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Unable to process your recovery request.'
        );
      }

      setStatus('sent');
      setMessage(
        result.message ||
          'If an eligible account exists for that email address, a recovery link will be sent.'
      );
    } catch (error: unknown) {
      setStatus('error');
      setMessage(
        getErrorMessage(
          error,
          'Unable to process your request. Please try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // VERIFY EXISTING PASSKEY
  // --------------------------------------------------

  const verifyExistingPasskey = async (): Promise<void> => {
    if (!recoveryToken || passkeyLoading || passkeyVerified) {
      return;
    }

    setPasskeyLoading(true);
    setPasskeyMessage('Preparing passkey verification...');

    try {
      const optionsResponse = await fetch(
        '/api/auth/recovery/passkey/options',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recoveryToken,
          }),
        }
      );

      const optionsResult: AuthenticationOptionsResponse =
        await optionsResponse.json();

      if (!optionsResponse.ok || !optionsResult.success) {
        throw new Error(
          optionsResult.message ||
            'Unable to start passkey verification.'
        );
      }

      if (!optionsResult.options || !optionsResult.challengeId) {
        throw new Error(
          'The server returned incomplete passkey options.'
        );
      }

      setPasskeyMessage(
        'Follow your device instructions to verify your existing passkey.'
      );

      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsResult.options,
      });

      setPasskeyMessage('Verifying your passkey...');

      const verifyResponse = await fetch(
        '/api/auth/recovery/passkey/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recoveryToken,
            challengeId: optionsResult.challengeId,
            response: authenticationResponse,
          }),
        }
      );

      const verifyResult: ApiResponse =
        await verifyResponse.json();

      if (!verifyResponse.ok || !verifyResult.success) {
        throw new Error(
          verifyResult.message ||
            'Your existing passkey could not be verified.'
        );
      }

      setPasskeyVerified(true);
      setPasskeyMessage(
        'Your existing passkey has been verified successfully.'
      );
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === 'NotAllowedError' ||
          error.name === 'AbortError')
      ) {
        setPasskeyMessage(
          'Passkey verification was cancelled. You can try again.'
        );
      } else {
        setPasskeyMessage(
          getErrorMessage(
            error,
            'Passkey verification failed. Please try again.'
          )
        );
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  // --------------------------------------------------
  // VERIFY RECOVERY CODE
  // --------------------------------------------------

  const verifyRecoveryCode = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (
      !recoveryToken ||
      recoveryCodeLoading ||
      recoveryCodeVerified
    ) {
      return;
    }

    const normalizedCode = recoveryCode.trim().toUpperCase();

    if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/.test(normalizedCode)) {
      setRecoveryCodeMessage(
        'Enter a valid recovery code in the format XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX.'
      );
      return;
    }

    setRecoveryCodeLoading(true);
    setRecoveryCodeMessage('Verifying your recovery code...');

    try {
      const response = await fetch(
        '/api/auth/recovery/code/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recoveryToken,
            recoveryCode: normalizedCode,
          }),
        }
      );

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Recovery code verification failed.'
        );
      }

      setRecoveryCodeVerified(true);
      setRecoveryCode('');
      setRecoveryCodeMessage(
        'Your recovery code has been verified successfully.'
      );
    } catch (error: unknown) {
      setRecoveryCodeMessage(
        getErrorMessage(
          error,
          'Unable to verify your recovery code.'
        )
      );
    } finally {
      setRecoveryCodeLoading(false);
    }
  };

  // --------------------------------------------------
  // REGISTER REPLACEMENT PASSKEY
  // --------------------------------------------------

  const registerReplacementPasskey = async (): Promise<void> => {
    if (
      !recoveryToken ||
      !(passkeyVerified || recoveryCodeVerified) ||
      replacementLoading ||
      replacementRegistered
    ) {
      return;
    }

    setReplacementLoading(true);
    setReplacementMessage(
      'Preparing replacement passkey registration...'
    );

    try {
      const optionsResponse = await fetch(
        '/api/auth/recovery/replacement-passkey/options',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recoveryToken,
          }),
        }
      );

      const optionsResult: RegistrationOptionsResponse =
        await optionsResponse.json();

      if (!optionsResponse.ok || !optionsResult.success) {
        throw new Error(
          optionsResult.message ||
            'Unable to start replacement passkey registration.'
        );
      }

      if (!optionsResult.options || !optionsResult.challengeId) {
        throw new Error(
          'The server returned incomplete registration options.'
        );
      }

      setReplacementMessage(
        'Follow your device instructions to register your replacement passkey.'
      );

      const registrationResponse = await startRegistration({
        optionsJSON: optionsResult.options,
      });

      setReplacementMessage(
        'Verifying your replacement passkey...'
      );

      const verifyResponse = await fetch(
        '/api/auth/recovery/replacement-passkey/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recoveryToken,
            challengeId: optionsResult.challengeId,
            response: registrationResponse,
          }),
        }
      );

      const verifyResult: ApiResponse =
        await verifyResponse.json();

      if (!verifyResponse.ok || !verifyResult.success) {
        throw new Error(
          verifyResult.message ||
            'Replacement passkey registration could not be verified.'
        );
      }

      setReplacementRegistered(true);
      setReplacementMessage(
        'Your replacement passkey has been registered successfully.'
      );
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === 'NotAllowedError' ||
          error.name === 'AbortError')
      ) {
        setReplacementMessage(
          'Passkey registration was cancelled. You can try again.'
        );
      } else {
        setReplacementMessage(
          getErrorMessage(
            error,
            'Replacement passkey registration failed. Please try again.'
          )
        );
      }
    } finally {
      setReplacementLoading(false);
    }
  };

  // --------------------------------------------------
  // COMPLETE ACCOUNT RECOVERY
  // --------------------------------------------------

  const completeRecovery = async (): Promise<void> => {
    if (
      !recoveryToken ||
      !replacementRegistered ||
      recoveryCompleting ||
      recoveryCompleted
    ) {
      return;
    }

    setRecoveryCompleting(true);
    setCompletionMessage('Restoring your account...');

    try {
      const response = await fetch(
        '/api/auth/recovery/complete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recoveryToken,
          }),
        }
      );

      const result: RecoveryCompletionResponse =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Unable to complete account recovery.'
        );
      }

      if (
        !Array.isArray(result.recoveryCodes) ||
        result.recoveryCodes.length !== 10 ||
        !result.recoveryCodes.every(
          (code: unknown): code is string =>
            typeof code === 'string' && code.length > 0
        )
      ) {
        throw new Error(
          'The recovery response did not contain ten valid recovery codes. Do not leave this page; contact support.'
        );
      }

      setRecoveryCodes(result.recoveryCodes);
      setRecoveryCompleted(true);
      setRecoveryToken('');

      setCompletionMessage(
        result.message ||
          'Your account has been recovered successfully.'
      );

      setMessage(
        'Your Unwind OFA account has been recovered.'
      );
    } catch (error: unknown) {
      setCompletionMessage(
        getErrorMessage(
          error,
          'Account recovery failed. Please try again.'
        )
      );
    } finally {
      setRecoveryCompleting(false);
    }
  };

  // --------------------------------------------------
  // COPY AND SAVE RECOVERY CODES
  // --------------------------------------------------

  const copyRecoveryCodes = async (): Promise<void> => {
    if (!recoveryCodes.length) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        recoveryCodes.join('\n')
      );

      setCodesCopied(true);
      setCompletionMessage(
        'Recovery codes copied. Store them somewhere secure.'
      );
    } catch {
      setCompletionMessage(
        'Automatic copying failed. Select and copy the codes manually.'
      );
    }
  };

  const isVerified = status === 'verified';

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="recover-account-page">
      <Link href="/login" className="recover-back-link">
        <ArrowLeft size={17} />
        Back to sign in
      </Link>

      <section className="recover-account-card">
        <Link href="/" className="recover-account-brand">
          <span className="recover-brand-icon">
            <ShieldCheck size={23} />
          </span>

          <span>
            unwind<span>ofa</span>
          </span>
        </Link>

        {/* STATUS ICON */}

        <div className={`recover-status ${status}`}>
          {['verifying', 'submitting'].includes(status) && (
            <LoaderCircle size={42} />
          )}

          {['sent', 'verified'].includes(status) && (
            <CheckCircle2 size={42} />
          )}

          {status === 'error' && (
            <AlertCircle size={42} />
          )}

          {status === 'idle' && (
            <Mail size={42} />
          )}
        </div>

        {/* PAGE HEADING */}

        <div className="recover-heading">
          <span className="recover-eyebrow">
            ACCOUNT RECOVERY
          </span>

          <h1>
            {status === 'verifying' &&
              'Verifying recovery link'}

            {status === 'submitting' &&
              'Requesting recovery'}

            {status === 'sent' &&
              'Check your inbox'}

            {status === 'verified' && (
              recoveryCompleted
                ? 'Account recovered'
                : replacementRegistered
                  ? 'Replacement passkey registered'
                  : passkeyVerified
                    ? 'Passkey verified'
                    : recoveryCodeVerified
                      ? 'Recovery code verified'
                      : 'Verify your identity'
            )}

            {status === 'error' &&
              'Recovery unsuccessful'}

            {status === 'idle' &&
              'Regain access.'}
          </h1>

          <p>
            {message ||
              'Enter your registered email address to begin securely recovering your Unwind OFA account.'}
          </p>
        </div>

        {/* REQUEST RECOVERY */}

        {status === 'idle' && (
          <form
            className="recover-form"
            onSubmit={requestRecovery}
          >
            <label htmlFor="recovery-email">
              Email address
            </label>
<input
  id="recovery-email"
  type="email"
  value={email}
  onChange={(event) => {
    setEmail(event.target.value);
    setStatus('idle');
    setMessage('');
  }}
  placeholder="you@example.com"
  autoComplete="email"
  required
  maxLength={254}
/>

            <button
              type="submit"
              className="recover-submit-button"
              disabled={loading}
            >
              {loading
                ? 'Sending recovery link...'
                : 'Send recovery link'}

              {loading ? (
                <LoaderCircle size={18} />
              ) : (
                <Mail size={18} />
              )}
            </button>
          </form>
        )}

        {/* RETRY RECOVERY REQUEST */}

        {status === 'error' && !urlToken && (
          <button
            type="button"
            className="recover-submit-button"
            onClick={() => {
              setStatus('idle');
              setMessage('');
            }}
          >
            Try again
          </button>
        )}

        {/* EMAIL SENT */}

        {status === 'sent' && (
          <Link
            href="/login"
            className="recover-secondary-link"
          >
            Return to sign in
          </Link>
        )}

        {/* RECOVERY WORKFLOW */}

        {isVerified && (recoveryToken || recoveryCompleted) && (
          <div className="recover-next-step">

            {/* STEP 4: DISPLAY NEW RECOVERY CODES */}

            {recoveryCompleted ? (
              <>
                <p>
                  Your account has been restored. These ten
                  recovery codes are displayed only once.
                  Save them somewhere secure before leaving
                  this page.
                </p>

                <ol className="recover-codes-list">
                  {recoveryCodes.map((code) => (
                    <li key={code}>
                      <code>{code}</code>
                    </li>
                  ))}
                </ol>

                <button
                  type="button"
                  className="recover-submit-button"
                  onClick={copyRecoveryCodes}
                >
                  {codesCopied
                    ? 'Codes copied'
                    : 'Copy recovery codes'}
                </button>

                {completionMessage && (
                  <span>{completionMessage}</span>
                )}

                <p>
                  Your old passkeys and active sessions have
                  been revoked. Keep your replacement passkey
                  and recovery codes safe.
                </p>

                <button
                  type="button"
                  className="recover-submit-button"
                  onClick={() => setCodesSaved(true)}
                >
                  I have saved my recovery codes
                </button>

                {codesSaved && (
                  <div className="recover-save-confirmation">
                    <ShieldCheck size={25} />

                    <h3>Confirm your recovery codes</h3>

                    <p>
                      Have you securely saved all ten recovery codes?
                      You will not be able to view these codes again
                      after leaving this page.
                    </p>

                    <div className="recover-confirmation-actions">
                      <button
                        type="button"
                        className="recover-not-saved-button"
                        onClick={() => setCodesSaved(false)}
                      >
                        Not saved
                      </button>

                      <Link
                        href="/login"
                        className="recover-confirm-continue"
                      >
                        Saved, continue to Login Page
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : !(passkeyVerified || recoveryCodeVerified) ? (

              /* STEP 1: VERIFY EXISTING PASSKEY OR RECOVERY CODE */

              <>
                <p>
                  Your email has been verified. Prove ownership
                  of your account using either an existing
                  passkey or one of your unused recovery codes.
                </p>

                <button
                  type="button"
                  className="recover-submit-button"
                  onClick={verifyExistingPasskey}
                  disabled={passkeyLoading || recoveryCodeLoading}
                >
                  {passkeyLoading
                    ? 'Verifying passkey...'
                    : 'Verify using existing passkey'}

                  {passkeyLoading ? (
                    <LoaderCircle size={18} />
                  ) : (
                    <Fingerprint size={19} />
                  )}
                </button>

                {passkeyMessage && (
                  <span>{passkeyMessage}</span>
                )}

                <div className="recover-code-divider">
                  <span>OR</span>
                </div>

                <form
                  className="recover-form"
                  onSubmit={verifyRecoveryCode}
                >
                  <label htmlFor="recovery-code">
                    Recovery code
                  </label>

                  <input
                    id="recovery-code"
                    type="text"
                    value={recoveryCode}
                    onChange={(event) => {
                      const value = event.target.value
                        .toUpperCase()
                        .replace(/[^A-F0-9]/g, '')
                        .slice(0, 32);

                      const formatted =
                        value.match(/.{1,4}/g)?.join('-') || '';

                      setRecoveryCode(formatted);
                      setRecoveryCodeMessage('');
                    }}
                    onPaste={(event) => {
                      event.preventDefault();

                      const pasted = event.clipboardData
                        .getData('text')
                        .toUpperCase()
                        .replace(/[^A-F0-9]/g, '')
                        .slice(0, 32);

                      const formatted =
                        pasted.match(/.{1,4}/g)?.join('-') || '';

                      setRecoveryCode(formatted);
                      setRecoveryCodeMessage('');
                    }}
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={39}
                    required
                    disabled={recoveryCodeLoading}
                  />

                  <button
                    type="submit"
                    className="recover-submit-button"
                    disabled={
                      recoveryCodeLoading || passkeyLoading
                    }
                  >
                    {recoveryCodeLoading
                      ? 'Verifying recovery code...'
                      : 'Verify recovery code'}

                    {recoveryCodeLoading ? (
                      <LoaderCircle size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                  </button>
                </form>

                {recoveryCodeMessage && (
                  <span>{recoveryCodeMessage}</span>
                )}
              </>
            ) : !replacementRegistered ? (

              /* STEP 2: REGISTER REPLACEMENT PASSKEY */

              <>
                <p>
                  Your existing passkey has been verified.
                  Register a replacement passkey to continue
                  recovering your account.
                </p>

                <button
                  type="button"
                  className="recover-submit-button"
                  onClick={registerReplacementPasskey}
                  disabled={replacementLoading}
                >
                  {replacementLoading
                    ? 'Registering replacement...'
                    : 'Register replacement passkey'}

                  {replacementLoading ? (
                    <LoaderCircle size={18} />
                  ) : (
                    <Fingerprint size={19} />
                  )}
                </button>

                {passkeyMessage && (
                  <span>{passkeyMessage}</span>
                )}

                {replacementMessage && (
                  <span>{replacementMessage}</span>
                )}
              </>
            ) : (

              /* STEP 3: UNLOCK ACCOUNT */

              <>
                <p>
                  Your replacement passkey is registered.
                  Complete the final step to unlock your account
                  and generate ten new recovery codes.
                </p>

                {replacementMessage && (
                  <span>{replacementMessage}</span>
                )}

                <button
                  type="button"
                  className="recover-submit-button"
                  onClick={completeRecovery}
                  disabled={recoveryCompleting}
                >
                  {recoveryCompleting
                    ? 'Recovering account...'
                    : 'Complete account recovery'}

                  {recoveryCompleting ? (
                    <LoaderCircle size={18} />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                </button>

                {completionMessage && (
                  <span>{completionMessage}</span>
                )}
              </>
            )}
          </div>
        )}

        {/* RETURN TO SIGN IN */}

        {(status === 'verified' || status === 'error') &&
          !recoveryCompleted && (
            <Link
              href="/login"
              className="recover-secondary-link"
            >
              Return to sign in
            </Link>
          )}

        {/* SECURITY NOTE */}

        <p className="recover-security-note">
          <ShieldCheck size={15} />

          {recoveryCompleted
            ? 'Save your recovery codes securely. They will not be shown again.'
            : 'Email verification alone never unlocks your account.'}
        </p>
      </section>

      <p className="recover-footer">
        © 2026 Unwind OFA. One identity. One secure ecosystem.
      </p>
    </main>
  );
}

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function RecoverAccountPage() {
  return (
    <Suspense
      fallback={
        <main className="recover-account-page">
          <section className="recover-account-card">
            Verifying recovery link...
          </section>
        </main>
      }
    >
      <RecoverAccountContent />
    </Suspense>
  );
}
