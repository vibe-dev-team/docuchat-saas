import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useToast } from '@/components/ToastProvider';
import { getApiErrorMessage } from '@/lib/errors';

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    try {
      await authApi.forgotPassword({ email });
      setStatus('sent');
      toast.push('Reset email sent. Check your inbox.', 'success');
    } catch (err) {
      const message = getApiErrorMessage(err, 'Unable to send reset email.');
      setStatus('error');
      toast.push(message, 'error');
    }
  };

  return (
    <main>
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="card">
          <h1>Reset your password</h1>
          <p>Enter your email to receive a reset link.</p>
          <form className="form" onSubmit={handleSubmit}>
            <div>
              <label>Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </div>
            {status === 'error' ? <div className="notice">Unable to send reset email.</div> : null}
            {status === 'sent' ? <div className="notice">Check your email for a reset link.</div> : null}
            <button type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <p style={{ marginTop: 12 }}>
            <Link to="/login">Back to login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
