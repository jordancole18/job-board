import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Briefcase, Shield, Menu, X, ChevronDown, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onEditProfile?: () => void;
}

export default function Navbar({ onEditProfile }: NavbarProps) {
  const { user, companyName, isAdmin, isApproved, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function closeMenu() {
    setMenuOpen(false);
    setDropdownOpen(false);
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen]);

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
              {/* Desktop: dropdown. Mobile: inline items */}
              {companyName && (
                <>
                  {/* Desktop dropdown */}
                  <div className="navbar-profile-dropdown" ref={dropdownRef}>
                    <button
                      className="navbar-user"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                      <span className="navbar-avatar">{companyName.charAt(0)}</span>
                      <span className="navbar-company">{companyName}</span>
                      <ChevronDown size={14} className={`navbar-chevron ${dropdownOpen ? 'navbar-chevron-open' : ''}`} />
                    </button>
                    {dropdownOpen && (
                      <div className="navbar-dropdown-menu">
                        <button
                          className="navbar-dropdown-item"
                          onClick={() => { onEditProfile?.(); closeMenu(); }}
                        >
                          <User size={14} /> Edit Profile
                        </button>
                        <button
                          className="navbar-dropdown-item"
                          onClick={() => { signOut(); closeMenu(); }}
                        >
                          <LogOut size={14} /> Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Mobile: inline items */}
                  <button
                    className="navbar-mobile-profile-btn"
                    onClick={() => { onEditProfile?.(); closeMenu(); }}
                  >
                    <User size={14} /> Edit Profile
                  </button>
                  <button
                    className="navbar-mobile-profile-btn"
                    onClick={() => { signOut(); closeMenu(); }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </>
              )}
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary btn-sm" onClick={closeMenu}>Employer Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
