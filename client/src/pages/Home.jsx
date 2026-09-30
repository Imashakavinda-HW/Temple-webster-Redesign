import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const { products, loading } = useShop();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cat = params.get('cat') || 'all';
  const q = (params.get('q') || '').toLowerCase();

  const items = products.filter((p) =>
    (cat === 'all' || p.category === cat) && (!q || p.name.toLowerCase().includes(q)));

  return (
    <>
      <section className="hero"><div className="hero-in">
        <div className="eyebrow">The Autumn Collection</div>
        <h1>Considered pieces for a considered home.</h1>
        <p>Over 200,000 designs from Australia's most-loved furniture destination — delivered securely, with care.</p>
        <button className="btn" onClick={() => navigate('/')}>Explore the collection</button>
      </div></section>

      <div className="values">
        <div><div className="ic">🔒</div><h2>Secure by design</h2><p>SSL/TLS · PCI DSS · Privacy Act 1988</p></div>
        <div><div className="ic">🚚</div><h2>Delivery you can see</h2><p>Estimated dates on every product</p></div>
        <div><div className="ic">↩️</div><h2>30-day returns</h2><p>Under Australian Consumer Law</p></div>
        <div><div className="ic">💬</div><h2>After-sales care</h2><p>Dedicated support team</p></div>
      </div>

      <div className="lead">
        <div>
          <h2 className="serif">{cat === 'all' ? 'Featured pieces' : cat}</h2>
          <p>All prices in AUD, GST included · delivery shown on every item</p>
        </div>
        <Link className="link" to="/">View all →</Link>
      </div>
      <div className="grid">
        {loading ? <p className="hint">Loading the collection…</p>
          : items.length ? items.map((p) => <ProductCard key={p.id} product={p} />)
          : <p className="hint">No pieces match your search.</p>}
      </div>
    </>
  );
}
