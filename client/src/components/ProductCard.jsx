import { useNavigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { money, stars } from '../lib/format.js';

export default function ProductCard({ product: p }) {
  const navigate = useNavigate();
  const { addToCart } = useShop();
  const toast = useToast();
  const open = () => navigate(`/product/${p.id}`);

  return (
    <div className="card">
      <div className="art" onClick={open}>
        {p.tag && <span className="tag">{p.tag}</span>}{p.icon}
      </div>
      <div className="info">
        <div className="nm" onClick={open}>{p.name}</div>
        <div className="rt">{stars(p)}</div>
        <div className="pr">{money(p.priceCents)}</div>
        <div className="et">🚚 {p.eta}</div>
        <button className="btn block" onClick={() => { addToCart(p.id); toast(`${p.name} added`); }}>Add to cart</button>
      </div>
    </div>
  );
}
