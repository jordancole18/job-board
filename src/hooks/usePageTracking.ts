import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Fires one GA4 page_view per client-side route change. The gtag snippet in
 * index.html is configured with send_page_view:false, so the initial load and
 * every subsequent navigation are counted here (and only here) — no double-count.
 */
export default function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    const page_path = location.pathname + location.search;
    window.gtag('event', 'page_view', {
      page_path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);
}
