import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './routes/ProtectedRoute';
import Spinner from './components/common/Spinner';

// Direct imports for small components used in routing helpers
import WorkerDashboard  from './pages/worker/WorkerDashboard';
import SeekerDashboard  from './pages/seeker/SeekerDashboard';
import EditWorkerProfile from './pages/worker/EditWorkerProfile';
import EditSeekerProfile from './pages/seeker/EditSeekerProfile';

// Lazy imports for all pages
const LoginPage          = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/auth/RegisterPage'));
const OTPPage            = lazy(() => import('./pages/auth/OTPPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/auth/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('./pages/auth/ChangePasswordPage'));
const WorkerSearchPage   = lazy(() => import('./pages/workers/WorkerSearchPage'));
const WorkerProfilePage  = lazy(() => import('./pages/workers/WorkerProfilePage'));
const CreateJobPage      = lazy(() => import('./pages/jobs/CreateJobPage'));
const BrowseJobsPage     = lazy(() => import('./pages/jobs/BrowseJobsPage'));
const JobDetailPage      = lazy(() => import('./pages/jobs/JobDetailPage'));
const MyJobsPage         = lazy(() => import('./pages/jobs/MyJobsPage'));
const MessagesPage       = lazy(() => import('./pages/messages/MessagesPage'));
const CreateReviewPage   = lazy(() => import('./pages/reviews/CreateReviewPage'));
const DisputesPage       = lazy(() => import('./pages/disputes/DisputesPage'));
const CreateDisputePage  = lazy(() => import('./pages/disputes/CreateDisputePage'));
const DisputeDetailPage  = lazy(() => import('./pages/disputes/DisputeDetailPage'));
const ReferralsPage      = lazy(() => import('./pages/referrals/ReferralsPage'));
const PaymentHistoryPage = lazy(() => import('./pages/payments/PaymentHistoryPage'));
const CategoriesPage     = lazy(() => import('./pages/categories/CategoriesPage'));
const AdminDashboard     = lazy(() => import('./pages/admin/AdminDashboard'));
const HomePage           = lazy(() => import('./pages/shared/HomePage'));
const DashboardPage      = lazy(() => import('./pages/shared/DashboardPage'));

// Role-aware profile routing
const ProfileView = () => {
  const { isWorker, isSeeker, isAdmin } = useAuth();
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isWorker) return <WorkerDashboard />;
  if (isSeeker) return <SeekerDashboard />;
  return <Navigate to="/login" replace />;
};

const ProfileEdit = () => {
  const { isWorker, isSeeker, isAdmin } = useAuth();
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isWorker) return <EditWorkerProfile />;
  if (isSeeker) return <EditSeekerProfile />;
  return <Navigate to="/login" replace />;
};

const Fallback = () => (
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
    <Spinner size={48} />
  </div>
);

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <NotificationProvider>
          <Layout>
            <Suspense fallback={<Fallback />}>
              <Routes>
                {/* Public */}
                <Route path="/"                  element={<HomePage />} />
                <Route path="/login"             element={<LoginPage />} />
                <Route path="/register"          element={<RegisterPage />} />
                <Route path="/otp"               element={<OTPPage />} />
                <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
                <Route path="/reset-password"    element={<ResetPasswordPage />} />
                <Route path="/workers/search"    element={<WorkerSearchPage />} />
                <Route path="/workers/:workerId" element={<WorkerProfilePage />} />
                <Route path="/jobs"              element={<BrowseJobsPage />} />
                <Route path="/jobs/browse"       element={<BrowseJobsPage />} />
                <Route path="/jobs/:id"          element={<JobDetailPage />} />
                <Route path="/categories"        element={<CategoriesPage />} />

                {/* Protected - any auth user */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard"        element={<DashboardPage />} />
                  <Route path="/profile"          element={<ProfileView />} />
                  <Route path="/profile/edit"     element={<ProfileEdit />} />
                  <Route path="/jobs/my-jobs"     element={<MyJobsPage />} />
                  <Route path="/messages"         element={<MessagesPage />} />
                  <Route path="/reviews/create"   element={<CreateReviewPage />} />
                  <Route path="/disputes"         element={<DisputesPage />} />
                  <Route path="/disputes/create"  element={<CreateDisputePage />} />
                  <Route path="/disputes/:id"     element={<DisputeDetailPage />} />
                  <Route path="/referrals"        element={<ReferralsPage />} />
                  <Route path="/payments/history" element={<PaymentHistoryPage />} />
                  <Route path="/change-password"  element={<ChangePasswordPage />} />
                </Route>

                {/* Seeker only */}
                <Route element={<ProtectedRoute role="seeker" />}>
                  <Route path="/jobs/create" element={<CreateJobPage />} />
                </Route>

                {/* Admin only */}
                <Route element={<ProtectedRoute role="admin" />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
