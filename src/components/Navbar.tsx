import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Briefcase, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, companyName, isAdmin, isApproved, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand-group">
          <Link to="/" className="navbar-brand" onClick={closeMenu}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#38b653" />
              <Briefcase x="5" y="5" width="18" height="18" color="white" strokeWidth={1.5} />
            </svg>
            Association Careers
          </Link>
          <span className="navbar-powered-by">
            powered by <strong>Paramount Consulting Group</strong>
          </span>
        </div>
        <button className="navbar-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className={`navbar-links ${menuOpen ? 'navbar-links-open' : ''}`}>
          <Link to="/" className={`nav-link ${pathname === '/' ? 'nav-link-active' : ''}`} onClick={closeMenu}>
            Jobs
          </Link>
          <Link to="/submit-resume" className={`nav-link ${pathname === '/submit-resume' ? 'nav-link-active' : ''}`} onClick={closeMenu}>
            Become a Candidate
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'nav-link-active' : ''}`} onClick={closeMenu}>
                Dashboard
              </Link>
              {isAdmin && (
                <Link to="/admin" className={`nav-link ${pathname.startsWith('/admin') ? 'nav-link-active' : ''}`} onClick={closeMenu}>
                  <Shield size={14} /> Admin
                </Link>
              )}
              {isApproved && (
                <Link to="/post-job" className="btn btn-primary btn-sm" onClick={closeMenu}>
                  + Post Job
                </Link>
              )}
              {companyName && (
                <div className="navbar-user">
                  <span className="navbar-avatar">{companyName.charAt(0)}</span>
                  <span className="navbar-company">{companyName}</span>
                </div>
              )}
              <button onClick={() => { signOut(); closeMenu(); }} className="btn btn-outline btn-sm">Sign Out</button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary btn-sm" onClick={closeMenu}>Employer Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
