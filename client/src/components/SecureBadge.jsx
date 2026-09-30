// The gold "secure payment" panel. Shown on product pages, sign-in and checkout so
// customers can see their payment and data are protected before they commit.
export default function SecureBadge({ icon = '🔒', children, style }) {
  return <div className="secure" style={style}>{icon} <span>{children}</span></div>;
}
