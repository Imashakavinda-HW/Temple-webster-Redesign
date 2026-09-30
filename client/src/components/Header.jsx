import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export const CATEGORIES = ['Living', 'Bedroom', 'Outdoor', 'Décor', 'Office'];

export default function Header() {
  const { cartCount } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');

  // Search and category live in the URL (e.g. /?cat=Office&q=desk) so results can be
  // bookmarked, shared, and survive a page refresh.
  const onSearch = (value) => {
    setQuery(value);
    const next = new URLSearchParams(params);
    if (value.trim()) next.set('q', value.trim()); else next.delete('q');
    navigate({ pathname: '/', search: next.toString() }, { replace: true });
  };

  const filterCat = (cat) => {
    setQuery('');
    navigate(cat === 'all' ? '/' : `/?cat=${encodeURIComponent(cat)}`);
  };

  return (
    <>
      <div className="ann">
        Complimentary delivery over $500 &nbsp;·&nbsp; <b>4.6★</b> Trustpilot &nbsp;·&nbsp; 30-day returns under Australian Consumer Law
      </div>
      <header className="top">
        <div className="wrap">
          <div className="topbar">
            <Link to="/" className="logo" onClick={() => setQuery('')}>
              Temple <em>&amp;</em> Webster<small>Fine Furniture &amp; Homewares</small>
            </Link>
            <div className="search">
              <input type="text" placeholder="Search the collection…" value={query}
                     onChange={(e) => onSearch(e.target.value)} aria-label="Search the collection" />
            </div>
            <nav className="nav">
              <Link to="/about">Our Story</Link>
              <Link to="/account">{user ? `Hi, ${user.name.split(' ')[0]}` : 'Account'}</Link>
              <Link to="/analytics">Analytics</Link>
              <Link to="/cart" className="cartbtn">Cart<span className="badge">{cartCount}</span></Link>
            </nav>
          </div>
          <div className="cats">
            <a onClick={() => filterCat('all')}>Collection</a>
            {CATEGORIES.map((c) => <a key={c} onClick={() => filterCat(c)}>{c}</a>)}
          </div>
        </div>
      </header>
    </>
  );
}
