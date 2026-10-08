import { useState } from 'react';
import { ProductArt } from './Icons.jsx';

// A product's picture: the photo when one exists, otherwise its line drawing.
// UI/UX Pro Max rules applied:
//  - image-optimization: WebP in two sizes; the browser picks the right one via srcSet/sizes
//  - lazy-load-below-fold: off-screen photos load only when scrolled near
//  - image-dimension: width/height reserve the space, so nothing jumps while loading (CLS)
//  - alt-text: a description where the photo carries meaning; empty where a label already exists
// If a photo fails to load, it quietly falls back to the drawing instead of a broken icon.
// The default `sizes` matches the product grid: one column on phones, two on small tablets, ~280px on desktop.
export default function ProductImage({ product, sizes = '(max-width: 580px) calc(100vw - 32px), (max-width: 900px) 50vw, 280px', eager = false, alt = '' }) {
  const [failed, setFailed] = useState(false);
  if (!product.image || failed) return <ProductArt name={product.icon} />;

  const base = `/images/products/${product.image}`;
  return (
    <img
      className="photo"
      src={`${base}-480.webp`}
      srcSet={`${base}-480.webp 480w, ${base}-960.webp 960w`}
      sizes={sizes}
      width="960"
      height="960"
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

// The home-page banner photo, falling back to the sofa drawing if it isn't there.
export function HeroImage({ fallback }) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  return (
    <img
      className="photo"
      src="/images/hero-960.webp"
      srcSet="/images/hero-960.webp 960w, /images/hero-1600.webp 1600w"
      sizes="(max-width: 720px) 100vw, 620px"
      width="1600"
      height="1067"
      alt=""
      fetchPriority="high"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
