import { useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';

export default function Footer() {
  const { pathname } = useLocation();

  if (pathname === '/map') return null;

  return (
    <footer className="footer">
      <div className="footer-content">
        <span className="footer-copyright">
          &copy; {new Date().getFullYear()} Paramount Consulting Group. All rights reserved.
        </span>
        <a href="mailto:support@associationcareers.realestate" className="footer-support">
          <Mail size={14} /> Contact Support
        </a>
        <span className="footer-powered-by">
          Powered by <strong>Paramount Consulting Group</strong>
        </span>
      </div>
    </footer>
  );
}
