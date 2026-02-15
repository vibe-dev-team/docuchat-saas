import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useSession } from '@/components/SessionProvider';
import { useToast } from '@/components/ToastProvider';
import { getApiErrorMessage } from '@/lib/errors';

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login({ email, password });
      await refresh();
      toast.push('Logged in successfully.', 'success');
      navigate('/documents');
    } catch (err) {
      const message = getApiErrorMessage(err, 'Login failed. Please check your credentials.');
      setError(message);
      toast.push(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="card">
          <h1>Welcome back</h1>
          <p>Log in to continue to DocuChat.</p>
          <form className="form" onSubmit={handleSubmit}>
            <div>
              <label>Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </div>
            <div>
              <label>Password</label>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </div>
            {error ? <div className="notice">{error}</div> : null}
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p style={{ marginTop: 12 }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          <p>
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
