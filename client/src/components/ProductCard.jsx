import { Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Heart, Star, Truck } from '@phosphor-icons/react';
import { money } from '../lib/format.js';
import StockBadge from './StockBadge.jsx';
import { Icon } from './Icons.jsx';
import ProductImage from './ProductImage.jsx';
import { tileStyle } from './Illustrations.jsx';

// Star rating: the icon is decorative; screen readers get the full sentence.
export function Rating({ product: p, className = 'rt' }) {
  return (
    <div className={className}>
      <Icon as={Star} weight="fill" size={12} className="star" />{' '}
      <span aria-hidden="true">{p.rating} · {p.reviewCount} reviews</span>
      <span className="sr-only">Rated {p.rating} out of 5 from {p.reviewCount} reviews</span>
    </div>
  );
}

const ICON_SAVE = 20;

export function SaveButton({ product, className = 'save' }) {
  const { savedIds, toggleSaved } = useShop();
  const toast = useToast();
  const saved = savedIds.includes(product.id);
  return (
    <button type="button" className={className} aria-pressed={saved}
            aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`}
            onClick={() => { toggleSaved(product.id); toast(saved ? 'Removed from saved items' : 'Saved for later'); }}>
      <Icon as={Heart} size={ICON_SAVE} weight={saved ? 'fill' : 'regular'} />
    </button>
  );
}

export default function ProductCard({ product: p, eager = false }) {
  const { addToCart } = useShop();
  const toast = useToast();

  return (
    <div className="card">
      <Link to={`/product/${p.id}`} className={`art${p.image ? ' has-photo' : ''}`} aria-label={p.name} style={tileStyle(p.id)}>
        {p.tag && <span className="tag">{p.tag}</span>}
        <ProductImage product={p} eager={eager} />
      </Link>
      <SaveButton product={p} />
      <div className="info">
        <Link to={`/product/${p.id}`} className="nm">{p.name}</Link>
        <Rating product={p} />
        <div className="pr">{money(p.priceCents)}</div>
        <div className="et"><Icon as={Truck} /> {p.eta}</div>
        <StockBadge stock={p.stock} />
        <button className="btn block" disabled={p.stock <= 0} onClick={() => toast(addToCart(p.id))}>
          {p.stock <= 0 ? 'Out of stock' : 'Add to cart'}
        </button>
      </div>
    </div>
  );
}
