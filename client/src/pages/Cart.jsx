import { Link, useNavigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useDeliveryEstimate, PostcodeInput } from '../components/DeliveryEstimate.jsx';
import { fmtRange, money } from '../lib/format.js';

export default function Cart() {
  const { cart, subtotalCents, changeQty, removeItem, loading } = useShop();
  const navigate = useNavigate();
  const { estimate, error } = useDeliveryEstimate(cart.map((l) => ({ id: l.id, qty: l.qty })));
  const std = estimate?.options.standard;
  const soldOut = cart.filter((l) => l.qty > l.product.stock);

  if (loading) return <p className="hint" style={{ margin: '24px 0' }}>Loading…</p>;
  if (!cart.length) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
        <h1 className="serif" style={{ fontSize: 32 }}>Your cart is empty</h1>
        <p className="hint">Explore the collection to begin.</p>
        <Link className="btn" style={{ marginTop: 16, display: 'inline-block' }} to="/">Shop the collection</Link>
      </div>
    );
  }

  return (
    <>
      <div className="lead"><h1 className="serif">Your cart</h1></div>
      <div className="row">
        <div className="col"><div className="panel">
          {cart.map(({ id, qty, product }) => {
            const eta = estimate?.items.find((i) => i.productId === id);
            return (
              <div className="cartline" key={id}>
                <div>
                  <Link to={`/product/${id}`} className="nm">{product.name}</Link>
                  <div className="hint">{money(product.priceCents)} each</div>
                  <div className="hint" style={{ color: 'var(--ok)' }}>🚚 {eta ? `Arrives ${fmtRange(eta.from, eta.to)}` : product.eta}</div>
                  {qty > product.stock && <div className="hint" style={{ color: 'var(--warn)' }}>
                    {product.stock === 0 ? 'Now out of stock. Please remove it.' : `Only ${product.stock} left. Please reduce the quantity.`}</div>}
                </div>
                <div className="q">
                  <button className="qbtn" onClick={() => changeQty(id, -1)} aria-label={`Decrease quantity of ${product.name}`}>−</button>
                  <span aria-label={`Quantity ${qty}`}>{qty}</span>
                  <button className="qbtn" onClick={() => changeQty(id, 1)} disabled={qty >= product.stock}
                          aria-label={`Increase quantity of ${product.name}`}>+</button>
                  <button className="linkbtn" onClick={() => removeItem(id)} style={{ marginLeft: 12, color: 'var(--warn)' }}>Remove</button>
                </div>
              </div>
            );
          })}
          {estimate?.splitShipment && (
            <p className="hint" style={{ marginTop: 14 }}>
              ℹ️ These pieces come from different warehouses, so they may arrive on different days.
              You can choose <b style={{ color: 'var(--gold-soft)' }}>one combined delivery</b> for free at checkout.
            </p>
          )}
        </div></div>
        <div className="col" style={{ flex: '0 0 320px' }}><div className="panel">
          <h2 className="ph">Summary</h2>
          <PostcodeInput id="pcCart" />
          {error && <div className="hint" role="alert" style={{ color: 'var(--warn)' }}>{error}</div>}
          <div className="totrow" style={{ marginTop: 12 }}><span>Subtotal</span><span>{money(subtotalCents)}</span></div>
          <div className="totrow"><span>Delivery</span>
            <span>{std ? (std.cents ? money(std.cents) : 'Free') : 'Enter postcode'}</span></div>
          {std && <div className="hint" style={{ color: 'var(--ok)', marginTop: -4 }}>Everything by {fmtRange(std.to, std.to)} ({estimate.zoneLabel})</div>}
          <div className="totrow grand"><span>Total</span><span>{money(subtotalCents + (std?.cents || 0))}</span></div>
          <p className="hint">✓ Every cost shown before checkout. No pre-selected extras.</p>
          <button className="btn block" style={{ marginTop: 14 }} disabled={soldOut.length > 0} onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </button>
        </div></div>
      </div>
    </>
  );
}
