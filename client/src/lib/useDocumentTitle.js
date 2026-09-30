import { useEffect } from 'react';

const BRAND = 'Temple & Webster';

// Every page gets its own browser-tab title (WCAG 2.4.2 "Page Titled"). Screen readers
// announce it on navigation, and it makes tabs, bookmarks and history readable.
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND}` : `${BRAND} — Fine Furniture & Homewares`;
  }, [title]);
}
