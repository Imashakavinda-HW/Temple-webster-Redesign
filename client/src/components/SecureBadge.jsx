import { LockSimple } from '@phosphor-icons/react';
import { Icon, ICON } from './Icons.jsx';

// The gold "secure payment" panel. Shown on product pages, sign-in and checkout so
// customers can see their payment and data are protected before they commit.
// `icon` is any Phosphor icon component (a lock by default).
export default function SecureBadge({ icon = LockSimple, children, style, role }) {
  return (
    <div className="secure" style={style} role={role}>
      <Icon as={icon} size={ICON.md} /> <span>{children}</span>
    </div>
  );
}
