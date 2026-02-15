import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useToast } from '@/components/ToastProvider';
import { getApiErrorMessage } from '@/lib/errors';
import { validatePassword } from '@/lib/validation';

export function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      toast.push(passwordError, 'error');
      return;
    }
    if (!inviteToken && !tenantName) {
      const message = 'Provide a tenant name or an invite token to continue.';
      setError(message);
      toast.push(message, 'error');
      return;
    }
    setLoading(true);
    try {
      await authApi.register({
        email,
        password,
        tenantName: tenantName || undefined,
        inviteToken: inviteToken || undefined
      });
      toast.push('Registration complete. Check your email to verify your account.', 'success');
      navigate('/verify-email');
    } catch (err) {
      const message = getApiErrorMessage(err, 'Registration failed. Check the form details or email already exists.');
      setError(message);
      toast.push(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card">
          <h1>Create your account</h1>
          <p>Set up your tenant or accept an invite token.</p>
          <form className="form" onSubmit={handleSubmit}>
            <div>
              <label>Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </div>
            <div>
              <label>Password</label>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </div>
            <div>
              <label>Tenant name (for new workspace)</label>
              <input value={tenantName} onChange={(event) => setTenantName(event.target.value)} />
            </div>
            <div>
              <label>Invite token (optional)</label>
              <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} />
            </div>
            {error ? <div className="notice">{error}</div> : null}
            <button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Register'}
            </button>
          </form>
          <p style={{ marginTop: 12 }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
