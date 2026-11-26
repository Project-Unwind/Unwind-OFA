import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';

import MainLayout from './layouts/MainLayout';
import HomePage from './views/HomePage';
import LoginPage from './views/LoginPage';
import SignupPage from './views/SignupPage';
import VerifyEmailPage from './views/VerifyEmailPage';
import DashboardPage from './views/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';
import NotFoundPage from './views/NotFoundPage';
import EmergencyLockPage from './views/EmergencyLockPage';
import RecoverAccountPage from './views/RecoverAccountPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/verify-email"
            element={<VerifyEmailPage />}
          />

          <Route
  path="/emergency-lock"
  element={<EmergencyLockPage />}
/>

<Route
  path="/recover-account"
  element={<RecoverAccountPage />}
/>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;