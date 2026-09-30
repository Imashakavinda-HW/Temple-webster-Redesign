import { Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

// Wishlist. Stored only in this browser (no account needed), like the cart.
export default function Saved() {
  const { products, savedIds, loading } = useShop();
  const items = products.filter((p) => savedIds.includes(p.id));

  return (
    <>
      <div className="lead"><div><h1 className="serif">Saved for later</h1><p>Tap ♡ on any piece to keep it here.</p></div></div>
      {loading ? <p className="hint">Loading…</p> : items.length
        ? <div className="grid">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        : <div className="panel center"><p className="hint">Nothing saved yet.</p><Link className="btn" to="/">Browse the collection</Link></div>}
    </>
  );
}
