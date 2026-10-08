# UI/UX audit with the "UI/UX Pro Max" skill

The site was audited with the open-source **UI/UX Pro Max** skill
(https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). It is a searchable database of 119 UX rules, style and colour data, and a pre-delivery checklist.

## 1. How the skill was used

1. **Safety check first.** The skill's Python script was read before running: it uses only the standard library and local CSV files, with no network access and no shell commands.
2. **Product-wide recommendation** (`--design-system "luxury furniture e-commerce premium dark"`):
   - Typography: **luxury serif headings + clean sans body**, and "Premium dark + gold accent". This matched the existing design, so it was kept.
   - Style: "Liquid Glass". The tool itself says this is for Apple-platform navigation, which doesn't fit a furniture shop, so it was **rejected**. The skill says not to apply unverified matches.
3. **Narrower search** (`--domain product "furniture home decor ecommerce"`): the result was *Home Decoration & Interior Design*, with a minimalism + storytelling layout. This led to the "Shop by room" section and the promise panels.
4. **Targeted rule searches**, one concern at a time, for example:
   - `"focus not obscured sticky header"` found WCAG 2.2 AA: use `scroll-padding-top`
   - `"error summary validation"` found a focusable error summary with links to the fields
   - `"toast accessibility dismiss"` found: auto-dismiss after 3–5 s
   - `"touch target size"` found: 24px for web (WCAG 2.2 AA), 44/48 for touch
   - `--domain icons` found: **Phosphor** icons, one outline family, decorative icons hidden
   - `--stack react` found: `React.lazy` route splitting, and focus management in dialogs
5. **Full rule list** (`references/quick-reference.md`, all 10 categories) used as the checklist.

## 2. What the audit found and what was changed

| Priority | Rule | Before | After |
|---|---|---|---|
| 1 Accessibility | `focus-not-obscured` (WCAG 2.2 AA) | The sticky header could cover a focused field | `scroll-padding-top` offset; tested |
| 1 | `focus-on-route-change` | Focus stayed on the old link | Focus moves to the new page's `<h1>` |
| 1 | `escape-routes`, dialog focus | MFA dialog: no focus trap | Tab stays inside, Escape closes, focus returns to the trigger |
| 1 | Page titles (WCAG 2.4.2) | Every tab said the same thing | Each page has its own title |
| 2 Touch | `target-size` | 30px quantity buttons, ~17px links | 40px (44px on phones); links ≥24px; axe WCAG 2.2 target-size rule passes |
| 2 | `loading-buttons`, `press-feedback` | Some buttons had no busy state | "Signing in…", "Verifying…" and similar; scale-on-press |
| 3 Performance | `lazy-loading`, `bundle-splitting` | One 316 KB bundle | Pages load on demand; first download 97 → 82 KB (gzip) |
| 3 | `progressive-loading` | "Loading…" text | Shimmering placeholder cards |
| 4 Style | **`no-emoji-icons`** | About 30 emoji used as icons | Phosphor SVG icons plus line drawings; the test confirms no emoji remain |
| 5 Layout | `readable-font-size` | 14px form fields (iPhone zooms in) | 16px on phones |
| 5 | `content-priority` | The sticky header covered about a third of a phone screen | The header scrolls away on phones; hero text comes before the picture |
| 6 Typography | `number-tabular`, `heading-line-balance` | Prices jumped width; lone last words on headings | Tabular figures; `text-wrap: balance` |
| 7 Animation | `transform-performance`, `toast-dismiss` | `transition: all`; toast lasted 1.9 s | Only colour/opacity/transform animate; toast 4 s (7 s with Undo) |
| 8 Forms | `error-summary`, `error-placement`, `required-indicators` | Checkout errors were toasts only | Focused summary linking to each field, plus an error under each field; `*` markers |
| 8 | `password-toggle`, `undo-support` | None | Show/hide password; **Undo** after removing a cart item |
| 8 | `multi-step-progress` | All three steps always showed as "on" | Each step ticks off when that section is complete |
| 9 Navigation | `nav-state-active`, `nav-label-icon` | Current page not marked | Active item underlined (not colour alone); icon plus text label |
| 9 | `state-preservation` | Back jumped to the top | Back restores the exact scroll position |
| 9 | `breadcrumb-web` | "← Back" only | Collection › Category › Product |
| 6 | `color-semantic`, `dark-mode-pairing` | Hard-coded colours | Token-based themes: Daylight and Evening, both tested |

## 3. Verification loop

The loop was repeated until every item passed: build, then the API tests, then the browser test, then the accessibility audit, then fix and run again.

| Check | Result |
|---|---|
| API tests (`npm test`) | **15 / 15 pass** |
| Browser end-to-end checks (shopping, checkout, MFA, admin, returns, privacy, themes, keyboard, focus, scroll, mobile) | **85 / 85 pass** |
| axe accessibility audit, WCAG 2.0/2.1/**2.2** A+AA plus best practice | **0 violations** on 15 Daylight pages and 7 Evening pages |
| Emoji on screen | **None** |
| No sideways scrolling at 375×812, 390×844 and 844×390 (landscape), 7 pages each | **Pass** |
| Reduced-motion setting | Transitions switched off |
| `npm audit` | **0 vulnerabilities** |

Bugs the loop caught along the way:
- a stray fragment of the old favicon code was being rendered in the page
- category links overflowed on phones
- a clamped scroll value overwrote the saved Back position
- smooth scrolling made page changes glide slowly
- the "deliver together" choice could be sent after it no longer applied
