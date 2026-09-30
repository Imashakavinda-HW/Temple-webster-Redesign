// Line-art product "photography", in the Hearth & Hollow style: simple strokes on a 48×48
// grid, drawn with currentColor so each theme (and each pastel tile) sets the colour.
// Sofa, bed, rug, lamp, chair and outdoor come from the Hearth & Hollow reference design;
// table, bedside, lounge and desk were drawn to match.
const PATHS = {
  sofa: <><path d="M6 30v-8a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v8" /><path d="M4 30h40v8H4z" /><path d="M8 38v4M40 38v4" /><path d="M4 30a3 3 0 0 1 6 0" /><path d="M38 30a3 3 0 0 1 6 0" /></>,
  table: <><path d="M4 17h40v4H4z" /><path d="M8 21v20M40 21v20" /><path d="M13 21v5h22v-5" /></>,
  bed: <><path d="M4 38V14M44 38V26" /><path d="M4 26h40" /><path d="M4 32h40" /><rect x="8" y="19" width="10" height="7" rx="2" /></>,
  bedside: <><rect x="4" y="18" width="16" height="18" rx="1" /><path d="M4 27h16M11 22.5h2M11 31.5h2M6 36v4M18 36v4" /><rect x="28" y="18" width="16" height="18" rx="1" /><path d="M28 27h16M35 22.5h2M35 31.5h2M30 36v4M42 36v4" /></>,
  lounge: <><path d="M12 29V17a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v12" /><path d="M6 24a3 3 0 0 1 6 0v11H6zM36 24a3 3 0 0 1 6 0v11h-6z" /><path d="M12 28h24v7H12z" /><path d="M9 35v6M39 35v6" /><path d="M18 14v14M24 12v16M30 14v14" /></>,
  lamp: <><path d="M16 6h16l6 16H10z" /><path d="M24 22v18M16 42h16" /></>,
  rug: <><rect x="8" y="10" width="32" height="28" rx="2" /><rect x="14" y="16" width="20" height="16" /><path d="M8 14H4M8 20H4M8 26H4M8 32H4M40 14h4M40 20h4M40 26h4M40 32h4" /></>,
  chair: <><path d="M14 6h20v18H14z" /><path d="M10 24h28v6H10z" /><path d="M24 30v8M14 44l10-6 10 6" /></>,
  desk: <><rect x="17" y="4" width="14" height="9" rx="1" /><path d="M24 13v3" /><path d="M4 16h40v4H4z" /><path d="M12 20v22M36 20v22M8 42h8M32 42h8" /></>,
  outdoor: <><path d="M24 6c-10 0-18 6-18 12h36c0-6-8-12-18-12z" /><path d="M24 18v24M14 42h20" /></>,
  parcel: <><path d="M6 16 24 7l18 9v18l-18 9-18-9z" /><path d="M6 16l18 9 18-9M24 25v18" /></>,
};

export function Illustration({ name, className, strokeWidth = 1.5 }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name] || PATHS.parcel}
    </svg>
  );
}

// Database icon name → drawing, and the Hearth & Hollow tile colours for Daylight mode.
// Each tint/stroke pair was contrast-checked (all ≥ 4.3:1).
const PRODUCT_DRAWINGS = {
  Couch: 'sofa', Table: 'table', Bed: 'bed', Dresser: 'bedside', Armchair: 'lounge',
  Lamp: 'lamp', Rug: 'rug', OfficeChair: 'chair', Desk: 'desk',
};
const TINTS = ['#efe7dc', '#e4ece9', '#ece6f1', '#f3e3da', '#e6e9ee', '#f0ece2'];
const STROKES = ['#7a5c43', '#3b7169', '#5d4f7a', '#a0553b', '#4b5563', '#6b6b3b'];

export const productDrawing = (iconName) => PRODUCT_DRAWINGS[iconName] || 'parcel';

// CSS custom properties for a product's tile; the stylesheet only uses them in Daylight mode.
export const tileStyle = (productId) => ({
  '--tint': TINTS[(productId - 1) % TINTS.length],
  '--stroke': STROKES[(productId - 1) % STROKES.length],
});
