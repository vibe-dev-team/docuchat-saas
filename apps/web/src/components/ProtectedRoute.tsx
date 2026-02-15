import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container">
        <p>Loading session...</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!user.tenantId && location.pathname !== '/onboarding/tenant') {
    return <Navigate to="/onboarding/tenant" replace />;
  }
  return children;
}
