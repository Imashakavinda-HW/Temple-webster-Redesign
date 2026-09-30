import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, track } from '../lib/api.js';

const ShopContext = createContext(null);

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: ignore */ }
};

// Holds the product catalogue (loaded once from the API), the cart, the wishlist and the
// customer's postcode.
// The cart stores ONLY product ids and quantities. Names and prices are always looked
// up from the catalogue, and the server re-prices everything at checkout, so an edited
// localStorage value can never change what a customer pays.
export function ShopProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartIds, setCartIds] = useState(() => load('tw_cart', []));
  const [savedIds, setSavedIds] = useState(() => load('tw_saved', []));
  const [postcode, setPostcode] = useState(() => load('tw_postcode', ''));

  const refreshProducts = useCallback(() =>
    api('/api/products').then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false)), []);
  useEffect(() => { refreshProducts(); }, [refreshProducts]);

  useEffect(() => save('tw_cart', cartIds), [cartIds]);
  useEffect(() => save('tw_saved', savedIds), [savedIds]);
  useEffect(() => save('tw_postcode', postcode), [postcode]);

  // Returns a message for the toast. Won't let the cart exceed real stock.
  const addToCart = useCallback((id) => {
    const product = products.find((p) => p.id === id);
    if (!product) return 'Product unavailable';
    const inCart = cartIds.find((l) => l.id === id)?.qty || 0;
    if (product.stock <= 0) return `${product.name} is out of stock`;
    if (inCart >= Math.min(product.stock, 20)) return `Only ${product.stock} available`;
    setCartIds((c) => (c.some((l) => l.id === id)
      ? c.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l))
      : [...c, { id, qty: 1 }]));
    track('add_to_cart');
    return `${product.name} added`;
  }, [products, cartIds]);

  const changeQty = useCallback((id, delta) => {
    const max = Math.min(products.find((p) => p.id === id)?.stock ?? 20, 20);
    setCartIds((c) => c.map((l) => (l.id === id ? { ...l, qty: Math.min(l.qty + delta, max) } : l)).filter((l) => l.qty > 0));
  }, [products]);

  const removeItem = useCallback((id) => setCartIds((c) => c.filter((l) => l.id !== id)), []);
  // Puts a removed line back in its original position (for the Undo button).
  const restoreItem = useCallback((line, index) => setCartIds((c) => (c.some((l) => l.id === line.id)
    ? c : [...c.slice(0, index), line, ...c.slice(index)])), []);
  const clearCart = useCallback(() => setCartIds([]), []);
  const toggleSaved = useCallback((id) =>
    setSavedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), []);

  // Join cart lines with catalogue data; drop anything no longer in the catalogue.
  const cart = useMemo(() => cartIds
    .map((l) => ({ ...l, product: products.find((p) => p.id === l.id) }))
    .filter((l) => l.product), [cartIds, products]);

  const value = {
    products, loading, refreshProducts, cart,
    cartCount: cart.reduce((s, l) => s + l.qty, 0),
    subtotalCents: cart.reduce((s, l) => s + l.product.priceCents * l.qty, 0),
    addToCart, changeQty, removeItem, restoreItem, clearCart,
    savedIds, toggleSaved, postcode, setPostcode,
  };
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
