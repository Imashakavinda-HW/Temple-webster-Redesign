import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="cols">
          <div style={{ maxWidth: 260 }}>
            <div className="logo" style={{ fontSize: 22 }}>Temple <em>&amp;</em> Webster</div>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 12 }}>
              Australia's destination for beautiful, considered furniture — delivered securely, with care.
            </p>
          </div>
          <div><h2>Company</h2>
            <Link to="/about">Our story</Link><Link to="/about">Privacy Policy</Link><Link to="/about">Terms &amp; Conditions</Link>
          </div>
          <div><h2>Support</h2>
            <Link to="/about">Contact us</Link><Link to="/track">Track an order</Link>
            <Link to="/about">Returns &amp; refunds</Link><Link to="/about">Delivery info</Link>
          </div>
          <div><h2>Secure Shopping</h2>
            <span className="fnote">🔒 SSL / TLS encrypted</span><span className="fnote">💳 PCI DSS compliant</span>
            <span className="fnote">🛡️ Privacy Act 1988</span><span className="fnote">🔑 2-step sign-in on every account</span>
          </div>
        </div>
        <div className="bot">
          <span>© 2026 Temple &amp; Webster (demo). ABN 80 604 106 011.</span>
          <span>Prototype for BIT363 · secure e-business solution</span>
        </div>
      </div>
    </footer>
  );
}
