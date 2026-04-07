import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProfileEditModal from './components/ProfileEditModal';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import PostJobPage from './pages/PostJobPage';
import JobDetailPage from './pages/JobDetailPage';
import MapPage from './pages/MapPage';
import ApplyPage from './pages/ApplyPage';
import DashboardPage from './pages/DashboardPage';
import EmployerJobPage from './pages/EmployerJobPage';
import SubmitResumePage from './pages/SubmitResumePage';
import AdminPage from './pages/AdminPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

export default function App() {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <Navbar onEditProfile={() => setProfileOpen(true)} />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/post-job" element={<PostJobPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/jobs/:id/apply" element={<ApplyPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/employer/jobs/:id" element={<EmployerJobPage />} />
            <Route path="/submit-resume" element={<SubmitResumePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/auth/reset" element={<ResetPasswordPage />} />
          </Routes>
          <Footer />
          <ProfileEditModal open={profileOpen} onClose={() => setProfileOpen(false)} />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
