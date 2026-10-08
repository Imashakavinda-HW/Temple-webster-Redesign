import { Link, useParams } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import SecureBadge from '../components/SecureBadge.jsx';
import StockBadge from '../components/StockBadge.jsx';
import DeliveryEstimate from '../components/DeliveryEstimate.jsx';
import ProductCard, { Rating, SaveButton } from '../components/ProductCard.jsx';
import { Icon } from '../components/Icons.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { tileStyle } from '../components/Illustrations.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { CaretRight } from '@phosphor-icons/react';
import { money } from '../lib/format.js';

export default function Product() {
  const { id } = useParams();
  const { products, loading, addToCart } = useShop();
  const toast = useToast();
  const p = products.find((x) => x.id === Number(id));
  useDocumentTitle(p?.name);

  if (loading) return <p className="hint" style={{ margin: '24px 0' }}>Loading…</p>;
  if (!p) return <div className="panel center"><h1 className="serif">Product not found</h1><Link className="btn" to="/">Back to collection</Link></div>;

  // "You may also like": same room first, then other pieces, never this one or sold-out items.
  const related = [...products.filter((x) => x.id !== p.id && x.category === p.category),
    ...products.filter((x) => x.id !== p.id && x.category !== p.category)]
    .filter((x) => x.stock > 0).slice(0, 4);

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <ol>
          <li><Link to="/">Collection</Link><Icon as={CaretRight} size={12} /></li>
          <li><Link to={`/?cat=${encodeURIComponent(p.category)}`}>{p.category}</Link><Icon as={CaretRight} size={12} /></li>
          <li aria-current="page">{p.name}</li>
        </ol>
      </nav>
      <div className="row">
        <div className="col product-media" style={{ flex: '0 0 46%' }}>
          {p.image ? (
            <div className="art big has-photo" style={tileStyle(p.id)}>
              <ProductImage product={p} eager sizes="(max-width: 720px) 100vw, 540px" alt={`${p.name}, product photo`} />
            </div>
          ) : (
            <div className="art big" role="img" aria-label={`Illustration of the ${p.name}`} style={tileStyle(p.id)}>
              <ProductImage product={p} />
            </div>
          )}
        </div>
        <div className="col">
          {p.tag && <span className="pill">{p.tag}</span>}
          <h1 className="serif" style={{ fontSize: 40, fontWeight: 600, margin: '14px 0 6px', lineHeight: 1.15 }}>{p.name}</h1>
          <Rating product={p} className="hint" />
          <div style={{ fontFamily: 'var(--serif)', fontSize: 34, color: 'var(--accent-text)', fontWeight: 700, margin: '16px 0' }}>{money(p.priceCents)}</div>
          <p style={{ color: 'var(--text-2)', opacity: 0.85 }}>{p.description}</p>
          <StockBadge stock={p.stock} />
          <DeliveryEstimate items={[{ id: p.id, qty: 1 }]} />
          <SecureBadge>Secure payment · <b>PCI DSS compliant</b> · your data is protected under the Privacy Act 1988.</SecureBadge>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn block" disabled={p.stock <= 0} onClick={() => toast(addToCart(p.id))}>
              {p.stock <= 0 ? 'Out of stock' : 'Add to cart'}
            </button>
            <SaveButton product={p} className="btn ghost savebig" />
          </div>
          <p className="hint" style={{ marginTop: 20, lineHeight: 1.7 }}>
            <b style={{ color: 'var(--emphasis)' }}>Legal &amp; ethical:</b> Free returns within 30 days under Australian Consumer Law, refunded to
            your original payment method, not store credit. Arrived damaged? We collect it for free. Supplied via our vetted supplier
            network and quality-checked before dispatch. No hidden fees: optional extras are always opt-in.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="relatedTitle">
          <div className="lead"><div><h2 className="serif" id="relatedTitle">You may also like</h2><p>More pieces for your {p.category.toLowerCase()} and beyond</p></div></div>
          <div className="grid">{related.map((r) => <ProductCard key={r.id} product={r} />)}</div>
        </section>
      )}
    </>
  );
}
