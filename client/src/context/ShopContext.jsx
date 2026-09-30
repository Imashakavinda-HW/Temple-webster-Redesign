import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, track } from '../lib/api.js';

const ShopContext = createContext(null);
const CART_KEY = 'tw_cart';

// Holds the product catalogue (loaded once from the API) and the shopping cart.
// The cart stores ONLY product ids and quantities. Names and prices are always looked
// up from the catalogue, and the server re-prices everything at checkout, so an edited
// localStorage value can never change what a customer pays.
export function ShopProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartIds, setCartIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  });

  useEffect(() => {
    api('/api/products').then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cartIds));
  }, [cartIds]);

  const addToCart = useCallback((id) => {
    setCartIds((c) => {
      const line = c.find((l) => l.id === id);
      return line ? c.map((l) => (l.id === id ? { ...l, qty: Math.min(l.qty + 1, 20) } : l)) : [...c, { id, qty: 1 }];
    });
    track('add_to_cart');
  }, []);

  const changeQty = useCallback((id, delta) => {
    setCartIds((c) => c.map((l) => (l.id === id ? { ...l, qty: Math.min(l.qty + delta, 20) } : l)).filter((l) => l.qty > 0));
  }, []);

  const removeItem = useCallback((id) => setCartIds((c) => c.filter((l) => l.id !== id)), []);
  const clearCart = useCallback(() => setCartIds([]), []);

  // Join cart lines with catalogue data; drop anything no longer in the catalogue.
  const cart = useMemo(() => cartIds
    .map((l) => ({ ...l, product: products.find((p) => p.id === l.id) }))
    .filter((l) => l.product), [cartIds, products]);

  const value = {
    products, loading, cart,
    cartCount: cart.reduce((s, l) => s + l.qty, 0),
    subtotalCents: cart.reduce((s, l) => s + l.product.priceCents * l.qty, 0),
    addToCart, changeQty, removeItem, clearCart,
  };
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
