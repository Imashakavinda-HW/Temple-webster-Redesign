import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ChartBar, Heart, MagnifyingGlass, Package, ShoppingBag, Star, User } from '@phosphor-icons/react';
import { Icon } from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export const CATEGORIES = ['Living', 'Bedroom', 'Outdoor', 'Décor', 'Office'];

export default function Header() {
  const { cartCount, savedIds } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');

  // Keep the box in sync when the URL changes (e.g. clicking the logo clears the search).
  useEffect(() => { if (pathname === '/') setQuery(params.get('q') || ''); }, [pathname, params]);

  // Search and category live in the URL (e.g. /?cat=Office&q=desk) so results can be
  // bookmarked, shared, and survive a page refresh.
  const onSearch = (value) => {
    setQuery(value);
    const next = new URLSearchParams(pathname === '/' ? params : undefined);
    if (value.trim()) next.set('q', value.trim()); else next.delete('q');
    navigate({ pathname: '/', search: next.toString() }, { replace: pathname === '/' });
  };

  const activeCat = pathname === '/' ? params.get('cat') || 'all' : null;
  const catLink = (cat) => (cat === 'all' ? '/' : `/?cat=${encodeURIComponent(cat)}`);

  return (
    <>
      <a className="skip" href="#main">Skip to main content</a>
      <aside className="ann" aria-label="Store announcements">
        <span>Complimentary delivery over $500</span>
        <span className="ann-extra"> · <span><b>4.6<Icon as={Star} weight="fill" size={11} /></b> Trustpilot</span> ·{' '}
          <span>30-day returns under Australian Consumer Law</span></span> · <span>Talk to a real person: <b>1300 000 000</b></span>
      </aside>
      <header className="top">
        <div className="wrap">
          <div className="topbar">
            <Link to="/" className="logo" aria-label="Temple & Webster home">
              Temple <em>&amp;</em> Webster<small>Fine Furniture &amp; Homewares</small>
            </Link>
            <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
              <Icon as={MagnifyingGlass} />
              <input type="search" placeholder="Search sofas, rugs, lamps…" value={query}
                     onChange={(e) => onSearch(e.target.value)} aria-label="Search the collection" />
            </form>
            <nav className="nav" aria-label="Main">
              {/* NavLink marks the current page with class "active" and aria-current="page".
                  Every item has an icon AND a visible text label (skill: nav-label-icon). */}
              <NavLink to="/track"><Icon as={Package} /> Track Order</NavLink>
              <NavLink to="/saved"><Icon as={Heart} /> Saved{savedIds.length > 0 && ` (${savedIds.length})`}</NavLink>
              <NavLink to="/account"><Icon as={User} /> {user ? `Hi, ${user.name.split(' ')[0]}` : 'Account'}</NavLink>
              {user?.role === 'admin' && <NavLink to="/analytics"><Icon as={ChartBar} /> Analytics</NavLink>}
              <NavLink to="/cart" className="cartbtn" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
                <Icon as={ShoppingBag} /> Cart<span className="badge" aria-hidden="true">{cartCount}</span>
              </NavLink>
              <ThemeToggle />
            </nav>
          </div>
          <nav className="cats" aria-label="Categories">
            <Link to={catLink('all')} onClick={() => setQuery('')} aria-current={activeCat === 'all' ? 'page' : undefined}>Collection</Link>
            {CATEGORIES.map((c) => (
              <Link key={c} to={catLink(c)} onClick={() => setQuery('')} aria-current={activeCat === c ? 'page' : undefined}>{c}</Link>
            ))}
            <Link to="/about">Our Story</Link>
          </nav>
        </div>
      </header>
    </>
  );
}
