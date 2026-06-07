import { Routes, Route, Navigate } from 'react-router-dom';
import { Toast } from 'primereact/toast';
import { toastRef } from '@/components/toast';
import { useAuthStore } from '@/store/auth';
import AppLayout from '@/layouts/AppLayout';
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import EmployeesPage from '@/pages/Employees';
import EventsPage from '@/pages/Events';
import SevasPage from '@/pages/Sevas';
import SalesPage from '@/pages/Sales';
import TicketsPage from '@/pages/Tickets';
import ReportsPage from '@/pages/Reports';
import OrgSettingsPage from '@/pages/OrgSettings';
import DonationsPage from '@/pages/Donations';
import DonationsHistoryPage from '@/pages/DonationsHistory';
import DonationPurposesPage from '@/pages/DonationPurposes';
import PrintersPage from '@/pages/Printers';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return isAuth ? children : <Navigate to="/login" replace />;
}

function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const employee = useAuthStore((s) => s.employee);
  if (!employee) return <Navigate to="/login" replace />;
  if (employee.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Toast ref={toastRef} position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="donations" element={<DonationsPage />} />
          <Route path="donations/history" element={<DonationsHistoryPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="sevas" element={<SevasPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="employees" element={<SuperAdminRoute><EmployeesPage /></SuperAdminRoute>} />
          <Route path="donation-purposes" element={<SuperAdminRoute><DonationPurposesPage /></SuperAdminRoute>} />
          <Route path="printers" element={<SuperAdminRoute><PrintersPage /></SuperAdminRoute>} />
          <Route path="settings" element={<SuperAdminRoute><OrgSettingsPage /></SuperAdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
