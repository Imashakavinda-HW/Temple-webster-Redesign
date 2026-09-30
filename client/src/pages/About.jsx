export default function About() {
  const p = { fontSize: 13, lineHeight: 1.7 };
  const b = { color: 'var(--gold-soft)' };
  return (
    <>
      <div className="lead"><h1 className="serif">Our story &amp; commitments</h1></div>
      <div className="panel" style={{ maxWidth: 760 }}>
        <p style={{ color: 'var(--sand)', opacity: 0.9 }}>
          Temple &amp; Webster is an ASX-listed Australian online retailer of furniture and homewares, founded in 2011. We operate a
          hybrid model: a drop-ship supplier network offering an exceptional range, complemented by private-label pieces we design,
          brand and hold ourselves.
        </p>
        <h2 className="ph" style={{ marginTop: 24 }}>Privacy Policy (summary)</h2>
        <p className="hint" style={p}>
          We collect only the personal information needed to fulfil your order — name, delivery address, contact details and a payment
          token. We obtain your <b style={b}>active consent</b> at checkout before collecting this data, in line with the Australian
          Privacy Principles (Privacy Act 1988). We never sell your data, and you may request access or deletion at any time.
        </p>
        <h2 className="ph" style={{ marginTop: 24 }}>Security</h2>
        <p className="hint" style={p}>
          Every page uses SSL/TLS encryption. Card data is tokenised and never stored on our servers (PCI DSS compliant). Passwords are
          stored only as salted bcrypt hashes, and accounts are protected by multi-factor authentication.
        </p>
        <h2 className="ph" style={{ marginTop: 24 }}>Your consumer rights</h2>
        <p className="hint" style={p}>
          Under the Australian Consumer Law you're entitled to repair, replacement or refund for faulty goods. We offer free returns
          within 30 days, and all optional add-ons are opt-in — we never pre-select charges.
        </p>
        <h2 className="ph" style={{ marginTop: 24 }}>Contact &amp; after-sales support</h2>
        <p className="hint" style={p}>
          support@templeandwebster.demo · 1300 000 000 · Live chat 9am–6pm AEST. A dedicated after-sales team supports delivery,
          assembly and returns.
        </p>
      </div>
    </>
  );
}
