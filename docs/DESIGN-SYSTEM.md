# Design system

The site has **two themes built from one set of semantic colour tokens**:

| Theme | Source | Used when |
|---|---|---|
| **Daylight** (default) | The Hearth & Hollow reference design (`docs/reference-hearth-and-hollow.html`). White, teal, warm tiles and line-art drawings, close to the real templeandwebster.com.au. | Always, unless the visitor chooses Evening |
| **Evening** | The original dark and gold design (`docs/original-design.html`) | The visitor presses the **Evening** button in the header (the choice is remembered) |

Components never use raw hex colours. They use tokens such as `var(--accent-text)`, and each theme sets the tokens (`client/src/styles.css`). This follows the UI/UX Pro Max skill's rules `color-semantic`, "token-driven theming" and `dark-mode-pairing`: both themes were designed and tested together.

## Colour tokens

| Token | Purpose | Daylight | Evening |
|---|---|---|---|
| `--bg` / `--surface` | Page / cards and panels | `#ffffff` / `#ffffff` | `#0f0d0c` / `#1a1714` |
| `--surface-2` | Tiles (room circles) | `#f1efec` | `#1a1714` |
| `--text` / `--text-2` / `--muted` | Main / secondary / quiet text | `#2f2f2f` / `#4a4a4a` / `#6b6b6b` | `#f4efe7` / `#e8ddca` / `#9a9187` |
| `--accent` | Decorative accent (borders, lines) | `#4f8f86` | `#c8a45c` |
| `--accent-text` | Accent used for **text** and links | `#3b7169` | `#c8a45c` |
| `--accent-soft` | Tinted backgrounds | `#e6f1ef` | gold at 8% |
| `--btn-bg` / `--btn-text` | Primary button | `#2f2f2f` / `#ffffff` | `#c8a45c` / `#12100e` |
| `--success` / `--danger` | Good news / errors | `#276b2b` / `#c8372d` | `#7bbf8f` / `#d98a5a` |
| `--input-border` | Form field outline | `#8a8a8a` | `#6f665b` |
| `--badge-bg` | Cart count | `#c8372d` (sale red) | `#c8a45c` |

## Contrast: every pair measured (WCAG 2.1 AA)

Normal text needs **4.5:1**. Large text, icons and field borders need **3:1**. Where the reference design's own colours failed, a darker shade was used:

| Pair | Ratio | Result |
|---|---|---|
| White on reference teal `#4f8f86` | 3.75 | ❌ fails for text, so buttons, the promo bar and links use `#3b7169` instead |
| White on `#3b7169` | 5.60 | ✅ |
| `#3b7169` text on white | 5.60 | ✅ |
| Reference input border `#cfcfcf` on white | 1.56 | ❌ fails 3:1, so replaced by `#8a8a8a` (3.45) ✅ |
| Reference star colour `#e0a100` on white | 2.27 | ❌ replaced by `#9a6700` (4.87) ✅ |
| Hero eyebrow `#3b7169` on beige `#e9e2d6` | 4.35 | ❌ replaced by `#2f5d57` (5.78) ✅ |
| Success `#2e7d32` on soft teal | 4.44 | ❌ replaced by `#276b2b` (5.64) ✅ |
| Muted `#6b6b6b` on white / on tile | 5.33 / 4.64 | ✅ |
| Sale red `#c8372d` with white | 5.20 | ✅ |
| Footer text `#cfcfcf` on `#2b2b2b` | 9.09 | ✅ |
| Product line colours on their pastel tiles (6 pairs) | 4.36 – 6.21 | ✅ |
| Evening field border `#6f665b` on panel | 3.17 | ✅ |

The automated axe audit then confirmed **0 violations on 15 Daylight pages and 7 Evening pages**.

## Typography

| | Daylight | Evening |
|---|---|---|
| Headings | Playfair Display 600/700 | Cormorant Garamond 600/700 |
| Body | Montserrat 400 | Inter 300 |
| Labels and buttons | Sentence case | Uppercase, letter-spaced |

Both pairings are listed in one Google Fonts request. Browsers download only the font files a page actually uses. Prices use tabular (fixed-width) figures, and headings use balanced wrapping.

## Pictures and icons: two separate layers

1. **Product and room pictures**: line drawings on a 48×48 grid (`client/src/components/Illustrations.jsx`).
   - The sofa, bed, rug, lamp, chair and outdoor umbrella come from the Hearth & Hollow reference.
   - The dining table, bedside pair, rattan lounge and standing desk were drawn to match.
   - They use `currentColor`. In Daylight each product sits on its own pastel tile with a matching line colour; in Evening they are gold on dark.
2. **Interface icons**: Phosphor Icons (outline), one family everywhere, as the skill recommends. Decorative icons next to text are hidden from screen readers.

No emoji are used anywhere. The browser test scans every page's text to confirm this.

## Theme switching

- `client/public/theme-init.js` runs in the page `<head>`, before anything is drawn, and applies the saved theme, so the wrong colours never flash. It's a separate file because the Content-Security-Policy blocks inline scripts.
- `ThemeToggle.jsx` is a button with `aria-pressed` that saves the choice to `localStorage`.
- Daylight is the default for everyone, as requested, rather than following the operating system's dark-mode setting.

## Spacing, shape and motion

- Corner radius: Daylight `10px` (cards) and `14px` (hero, panels); Evening `4px`.
- Motion tokens: `--dur-fast` 150 ms (press), `--dur` 250 ms (colour), with ease-out timing. Only colour, opacity and transform are animated. Everything is switched off when the visitor has **reduce motion** turned on.
- Touch targets: at least 24px everywhere and 44px for the main controls on phones.
