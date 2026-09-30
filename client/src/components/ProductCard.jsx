import { Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { money, stars } from '../lib/format.js';
import StockBadge from './StockBadge.jsx';

export function SaveButton({ product, className = 'save' }) {
  const { savedIds, toggleSaved } = useShop();
  const toast = useToast();
  const saved = savedIds.includes(product.id);
  return (
    <button type="button" className={className} aria-pressed={saved}
            aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`}
            onClick={() => { toggleSaved(product.id); toast(saved ? 'Removed from saved items' : 'Saved for later'); }}>
      {saved ? '♥' : '♡'}
    </button>
  );
}

export default function ProductCard({ product: p }) {
  const { addToCart } = useShop();
  const toast = useToast();

  return (
    <div className="card">
      <Link to={`/product/${p.id}`} className="art" aria-label={p.name}>
        {p.tag && <span className="tag">{p.tag}</span>}
        <span aria-hidden="true">{p.icon}</span>
      </Link>
      <SaveButton product={p} />
      <div className="info">
        <Link to={`/product/${p.id}`} className="nm">{p.name}</Link>
        <div className="rt">{stars(p)}</div>
        <div className="pr">{money(p.priceCents)}</div>
        <div className="et">🚚 {p.eta}</div>
        <StockBadge stock={p.stock} />
        <button className="btn block" disabled={p.stock <= 0} onClick={() => toast(addToCart(p.id))}>
          {p.stock <= 0 ? 'Out of stock' : 'Add to cart'}
        </button>
      </div>
    </div>
  );
}
