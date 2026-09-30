import { Link, useNavigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { money } from '../lib/format.js';

export default function Cart() {
  const { cart, subtotalCents, changeQty, removeItem } = useShop();
  const navigate = useNavigate();

  if (!cart.length) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
        <h2 className="serif" style={{ fontSize: 32 }}>Your cart is empty</h2>
        <p className="hint">Explore the collection to begin.</p>
        <Link className="btn" style={{ marginTop: 16, display: 'inline-block' }} to="/">Shop the collection</Link>
      </div>
    );
  }

  return (
    <>
      <div className="lead"><h2 className="serif">Your cart</h2></div>
      <div className="row">
        <div className="col"><div className="panel">
          {cart.map(({ id, qty, product }) => (
            <div className="cartline" key={id}>
              <div><div className="nm">{product.name}</div><div className="hint">{money(product.priceCents)} each · 🚚 {product.eta}</div></div>
              <div className="q">
                <button className="qbtn" onClick={() => changeQty(id, -1)} aria-label="Decrease quantity">−</button>
                {qty}
                <button className="qbtn" onClick={() => changeQty(id, 1)} aria-label="Increase quantity">+</button>
                <a onClick={() => removeItem(id)} style={{ marginLeft: 12, color: 'var(--warn)' }}>Remove</a>
              </div>
            </div>
          ))}
        </div></div>
        <div className="col" style={{ flex: '0 0 320px' }}><div className="panel">
          <h3 className="ph">Summary</h3>
          <div className="totrow"><span>Subtotal</span><span>{money(subtotalCents)}</span></div>
          <div className="totrow"><span>Delivery</span><span>At checkout</span></div>
          <div className="totrow grand"><span>Total</span><span>{money(subtotalCents)}</span></div>
          <p className="hint">✓ All costs shown upfront — no pre-selected extras.</p>
          <button className="btn block" style={{ marginTop: 14 }} onClick={() => navigate('/checkout')}>Proceed to checkout</button>
        </div></div>
      </div>
    </>
  );
}
