import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useToast } from '@/components/ToastProvider';
import { getApiErrorMessage } from '@/lib/errors';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const toast = useToast();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!token) return;
    setStatus('loading');
    authApi
      .verifyEmail({ token })
      .then(() => {
        setStatus('success');
        toast.push('Email verified. You can log in now.', 'success');
      })
      .catch((err) => {
        setStatus('error');
        toast.push(getApiErrorMessage(err, 'Verification failed. The token may be invalid.'), 'error');
      });
  }, [token, toast]);

  return (
    <main>
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card">
          <h1>Verify your email</h1>
          {!token ? <p>Paste the verification link from your email.</p> : null}
          {status === 'idle' && token ? <p>Ready to verify your email token.</p> : null}
          {status === 'loading' ? <p>Verifying...</p> : null}
          {status === 'success' ? <p>Email verified. You can now log in.</p> : null}
          {status === 'error' ? <div className="notice">Verification failed. The token may be invalid.</div> : null}
          <p style={{ marginTop: 12 }}>
            <Link to="/login">Return to login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
