import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Confirmation from './pages/Confirmation.jsx';
import Account from './pages/Account.jsx';
import About from './pages/About.jsx';
import Track from './pages/Track.jsx';
import Admin from './pages/Admin.jsx';
import Saved from './pages/Saved.jsx';
import { track } from './lib/api.js';

export default function App() {
  const { pathname } = useLocation();

  // Scroll to the top on every page change, like the original design's go() function.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

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
          <Route path="*" element={<div className="panel center"><h1 className="serif">Page not found</h1><Link className="btn" to="/">Back to the collection</Link></div>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
