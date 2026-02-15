import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Shell } from './components/Shell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage';
import { DocumentsListPage } from './pages/documents/DocumentsListPage';
import { DocumentDetailPage } from './pages/documents/DocumentDetailPage';
import { ChatbotsListPage } from './pages/chatbots/ChatbotsListPage';
import { ChatbotDetailPage } from './pages/chatbots/ChatbotDetailPage';
import { ChatViewPage } from './pages/chats/ChatViewPage';
import { TenantOnboardingPage } from './pages/onboarding/TenantOnboardingPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/documents" replace />
  },
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/register',
    element: <RegisterPage />
  },
  {
    path: '/verify-email',
    element: <VerifyEmailPage />
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />
  },
  {
    path: '/accept-invite',
    element: <AcceptInvitePage />
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Shell />
      </ProtectedRoute>
    ),
    children: [
      { path: '/onboarding/tenant', element: <TenantOnboardingPage /> },
      { path: '/documents', element: <DocumentsListPage /> },
      { path: '/documents/:id', element: <DocumentDetailPage /> },
      { path: '/chatbots', element: <ChatbotsListPage /> },
      { path: '/chatbots/:id', element: <ChatbotDetailPage /> },
      { path: '/chatbots/:id/chat', element: <ChatViewPage /> }
    ]
  }
]);
