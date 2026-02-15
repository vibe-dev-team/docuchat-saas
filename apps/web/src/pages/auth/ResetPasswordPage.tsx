import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useToast } from '@/components/ToastProvider';
import { getApiErrorMessage } from '@/lib/errors';
import { validatePassword } from '@/lib/validation';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      toast.push('Missing reset token.', 'error');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setStatus('error');
      toast.push(passwordError, 'error');
      return;
    }
    setStatus('loading');
    try {
      await authApi.resetPassword({ token, password });
      setStatus('success');
      toast.push('Password updated. You can log in now.', 'success');
    } catch (err) {
      setStatus('error');
      toast.push(getApiErrorMessage(err, 'Reset failed. Try again.'), 'error');
    }
  };

  return (
    <main>
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="card">
          <h1>Choose a new password</h1>
          {!token ? <div className="notice">Missing reset token.</div> : null}
          <form className="form" onSubmit={handleSubmit}>
            <div>
              <label>New password</label>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </div>
            {status === 'error' ? <div className="notice">Reset failed. Try again.</div> : null}
            {status === 'success' ? <div className="notice">Password updated. You can log in.</div> : null}
            <button type="submit" disabled={status === 'loading' || !token}>
              {status === 'loading' ? 'Saving...' : 'Reset password'}
            </button>
          </form>
          <p style={{ marginTop: 12 }}>
            <Link to="/login">Return to login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
