// UI icons: one family (Phosphor, outline) for every interface icon, as the UI/UX Pro Max
// skill recommends. SVG icons render identically on every device and take their colour
// from CSS, whereas emoji look different on Apple, Android and Windows.
// Product pictures are a separate visual layer: the line drawings in Illustrations.jsx.
import { Illustration, productDrawing } from './Illustrations.jsx';

// Shared size tokens so icons keep a consistent rhythm (pro-rules: "Consistent Icon Sizing").
export const ICON = { sm: 16, md: 20, lg: 24 };

// Decorative icon placed next to visible text: hidden from screen readers.
// Pass `label` instead when the icon carries meaning on its own.
export function Icon({ as: Glyph, size = ICON.sm, label, weight = 'regular', className, style }) {
  return (
    <Glyph size={size} weight={weight} className={`ico${className ? ` ${className}` : ''}`} style={style}
           {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' })} />
  );
}

// A product's picture: its line drawing (the icon name comes from the database).
export function ProductArt({ name }) {
  return <Illustration name={productDrawing(name)} />;
}
