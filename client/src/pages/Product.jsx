import { Link, useParams } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import SecureBadge from '../components/SecureBadge.jsx';
import { money, stars } from '../lib/format.js';

export default function Product() {
  const { id } = useParams();
  const { products, loading, addToCart } = useShop();
  const toast = useToast();
  const p = products.find((x) => x.id === Number(id));

  if (loading) return <p className="hint" style={{ margin: '24px 0' }}>Loading…</p>;
  if (!p) return <div className="panel center"><h2 className="serif">Product not found</h2><Link className="btn" to="/">Back to collection</Link></div>;

  return (
    <>
      <p className="hint" style={{ margin: '24px 0' }}><Link to="/" style={{ color: 'var(--gold)' }}>← Back to collection</Link></p>
      <div className="row">
        <div className="col" style={{ flex: '0 0 46%' }}>
          <div className="art" style={{ aspectRatio: 1, fontSize: 130, background: 'linear-gradient(160deg,#241f1a,#15110e)',
            border: '1px solid var(--line)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {p.icon}
          </div>
        </div>
        <div className="col">
          {p.tag && <span className="pill">{p.tag}</span>}
          <h2 className="serif" style={{ fontSize: 40, fontWeight: 600, margin: '14px 0 6px' }}>{p.name}</h2>
          <div className="hint" style={{ fontSize: 13 }}>{stars(p)}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 34, color: 'var(--gold)', fontWeight: 700, margin: '16px 0' }}>{money(p.priceCents)}</div>
          <p style={{ color: 'var(--sand)', opacity: 0.85 }}>{p.description}</p>
          <div style={{ color: 'var(--ok)', fontSize: 13, margin: '14px 0' }}>🚚 Estimated delivery: {p.eta}</div>
          <SecureBadge>Secure payment · <b>PCI DSS compliant</b> · your data is protected under the Privacy Act 1988.</SecureBadge>
          <button className="btn block" onClick={() => { addToCart(p.id); toast(`${p.name} added`); }}>Add to cart</button>
          <p className="hint" style={{ marginTop: 20, lineHeight: 1.7 }}>
            <b style={{ color: 'var(--gold-soft)' }}>Legal &amp; ethical:</b> Free returns within 30 days under Australian Consumer Law.
            Supplied via our vetted supplier network and quality-checked before dispatch. No hidden fees — optional extras are always opt-in.
          </p>
        </div>
      </div>
    </>
  );
}
