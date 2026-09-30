import { Suspense, lazy, useEffect, useRef } from 'react';
import { Link, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Product from './pages/Product.jsx';
import { track } from './lib/api.js';
import { useDocumentTitle } from './lib/useDocumentTitle.js';

// Route-level code splitting: the shopping pages load immediately; the rest are fetched
// only when first visited, so the home page downloads less JavaScript.
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Confirmation = lazy(() => import('./pages/Confirmation.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Track = lazy(() => import('./pages/Track.jsx'));
const Saved = lazy(() => import('./pages/Saved.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

function NotFound() {
  useDocumentTitle('Page not found');
  return <div className="panel center"><h1 className="serif">Page not found</h1><Link className="btn" to="/">Back to the collection</Link></div>;
}

// Back/forward restores where you were on the page; new pages start at the top.
// After a page change, focus moves to the new page's heading so screen-reader users
// hear where they are (WCAG: focus-on-route-change).
function useScrollAndFocus() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef(new Map());
  const firstRender = useRef(true);
  const lastPath = useRef(location.pathname);

  // Remember the scroll position for each history entry. The browser updates history
  // *before* React renders the next page, and the next (shorter) page can clamp the scroll
  // position; checking that history still points at this entry stops that clamped value
  // from overwriting the real one.
  useEffect(() => {
    let frame;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if ((window.history.state?.key ?? 'default') === location.key) positions.current.set(location.key, window.scrollY);
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => { window.removeEventListener('scroll', save); cancelAnimationFrame(frame); };
  }, [location.key]);

  // We restore positions ourselves, so switch off the browser's own attempt.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    const pathChanged = lastPath.current !== location.pathname;
    lastPath.current = location.pathname;

    let frame;
    if (navType === 'POP' && positions.current.has(location.key)) {
      // Pages that load lazily may not be tall enough yet, so retry for up to ~1 second.
      const target = positions.current.get(location.key);
      let tries = 0;
      const restore = () => {
        window.scrollTo({ top: target, behavior: 'instant' });
        if (Math.abs(window.scrollY - target) > 1 && tries++ < 60) frame = requestAnimationFrame(restore);
      };
      restore();
    } else if ((navType === 'PUSH' || pathChanged) && !location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' }); // no smooth glide on page change; includes replace-navigations to a new page (e.g. checkout → confirmation)
    }

    const cancel = () => cancelAnimationFrame(frame);
    if (firstRender.current) { firstRender.current = false; return cancel; }
    // Don't pull focus away from someone typing in the search box.
    if (!pathChanged || document.activeElement?.matches('input[type=search]')) return cancel;
    const heading = document.querySelector('#main h1') || document.getElementById('main');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    return cancel;
  }, [location.key, location.pathname, location.hash, navType]);
}

export default function App() {
  useScrollAndFocus();

  // Count one visit per browser session (not every refresh) for the analytics funnel.
  useEffect(() => {
    try {
      if (!sessionStorage.getItem('tw_visited')) {
        sessionStorage.setItem('tw_visited', '1');
        track('visit');
      }
    } catch { track('visit'); }
  }, []);

  return (
    <>
      <Header />
      <main className="wrap" id="main" tabIndex={-1}>
        <Suspense fallback={<p className="hint" style={{ margin: '40px 0' }} role="status">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:id" element={<Product />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:id" element={<Confirmation />} />
            <Route path="/account" element={<Account />} />
            <Route path="/about" element={<About />} />
            <Route path="/track" element={<Track />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/analytics" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
