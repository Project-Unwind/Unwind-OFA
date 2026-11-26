import DashboardPage from '../../src/views/DashboardPage';
import ProtectedRoute from '../../src/components/ProtectedRoute';

export default function Page() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}