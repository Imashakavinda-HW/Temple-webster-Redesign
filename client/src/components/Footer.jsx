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
          <div><h4>Company</h4>
            <Link to="/about">Our story</Link><Link to="/about">Privacy Policy</Link><Link to="/about">Terms &amp; Conditions</Link>
          </div>
          <div><h4>Support</h4>
            <Link to="/about">Contact us</Link><Link to="/track">Track an order</Link>
            <Link to="/about">Returns &amp; refunds</Link><Link to="/about">Delivery info</Link>
          </div>
          <div><h4>Secure Shopping</h4>
            <a>🔒 SSL / TLS encrypted</a><a>💳 PCI DSS compliant</a><a>🛡️ Privacy Act 1988</a>
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
