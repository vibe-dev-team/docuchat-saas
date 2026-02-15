import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantsApi } from '@/api/tenants';
import { useSession } from '@/components/SessionProvider';
import { useToast } from '@/components/ToastProvider';
import { getApiErrorMessage } from '@/lib/errors';

export function TenantOnboardingPage() {
  const [tenantName, setTenantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useSession();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!tenantName.trim()) {
      const message = 'Please enter a workspace name.';
      setError(message);
      toast.push(message, 'error');
      return;
    }
    setLoading(true);
    try {
      await tenantsApi.create({ name: tenantName.trim() });
      await refresh();
      toast.push('Workspace created. Welcome!', 'success');
      navigate('/documents');
    } catch (err) {
      const message = getApiErrorMessage(err, 'Unable to create workspace.');
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
          <h1>Create your workspace</h1>
          <p>Set up your tenant to continue into DocuChat.</p>
          <form className="form" onSubmit={handleSubmit}>
            <div>
              <label>Workspace name</label>
              <input value={tenantName} onChange={(event) => setTenantName(event.target.value)} required />
            </div>
            {error ? <div className="notice">{error}</div> : null}
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create workspace'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
