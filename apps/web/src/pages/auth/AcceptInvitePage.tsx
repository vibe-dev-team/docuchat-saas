import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useToast } from '@/components/ToastProvider';
import { getApiErrorMessage } from '@/lib/errors';
import { validatePassword } from '@/lib/validation';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') ?? '';
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!inviteToken) {
      toast.push('Missing invite token.', 'error');
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
      await authApi.acceptInvite({ email, password, inviteToken });
      setStatus('success');
      toast.push('Invite accepted. You can log in now.', 'success');
    } catch (err) {
      setStatus('error');
      toast.push(getApiErrorMessage(err, 'Invite acceptance failed.'), 'error');
    }
  };

  return (
    <main>
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card">
          <h1>Accept invite</h1>
          {!inviteToken ? <div className="notice">Missing invite token.</div> : null}
          <form className="form" onSubmit={handleSubmit}>
            <div>
              <label>Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </div>
            <div>
              <label>Password</label>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </div>
            {status === 'error' ? <div className="notice">Invite acceptance failed.</div> : null}
            {status === 'success' ? <div className="notice">Invite accepted. You can log in.</div> : null}
            <button type="submit" disabled={status === 'loading' || !inviteToken}>
              {status === 'loading' ? 'Submitting...' : 'Accept invite'}
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
