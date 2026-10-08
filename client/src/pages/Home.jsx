import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ArrowCounterClockwise, ArrowRight, ChatCircle, LockSimple, Truck } from '@phosphor-icons/react';
import { useShop } from '../context/ShopContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { Icon } from '../components/Icons.jsx';
import { Illustration } from '../components/Illustrations.jsx';
import ProductImage, { HeroImage } from '../components/ProductImage.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

// "Shop by room": storytelling entry points, as the skill recommends for home-decor retail,
// drawn as Hearth & Hollow-style round tiles.
const ROOMS = [
  { cat: 'Living', drawing: 'sofa', productId: 1, blurb: 'Sofas & dining' },
  { cat: 'Bedroom', drawing: 'bed', productId: 3, blurb: 'Beds & bedside' },
  { cat: 'Outdoor', drawing: 'outdoor', productId: 5, blurb: 'Alfresco living' },
  { cat: 'Décor', drawing: 'lamp', productId: 6, blurb: 'Lighting & rugs' },
  { cat: 'Office', drawing: 'chair', productId: 9, blurb: 'Work from home' },
];

// Colour-block panels in the Hearth & Hollow "offer" style, carrying real promises this shop
// keeps (no invented discount codes).
const PROMISES = [
  { cls: 'o1', title: 'Know the date before you buy', text: 'Enter your postcode on any piece to see the delivery cost and actual arrival dates.', cta: 'Try it on a sofa', to: '/product/1' },
  { cls: 'o2', title: 'One delivery, not five', text: 'Ordering from several warehouses? Choose free combined delivery at checkout.', cta: 'View your cart', to: '/cart' },
  { cls: 'o3', title: 'Refunds to your card', text: 'Change your mind within 30 days and the refund goes back to how you paid, not store credit.', cta: 'Read our promise', to: '/about' },
];

// Grey placeholder cards while the catalogue loads, so the page doesn't jump.
function SkeletonCard() {
  return (
    <div className="card skeleton" aria-hidden="true">
      <div className="art" />
      <div className="info"><div className="sk-line w70" /><div className="sk-line w40" /><div className="sk-line w30" /></div>
    </div>
  );
}

export default function Home() {
  const { products, loading } = useShop();
  const [heroPhoto, setHeroPhoto] = useState(false);
  useEffect(() => { api('/api/media').then((m) => setHeroPhoto(m.hero)).catch(() => {}); }, []);
  const [params] = useSearchParams();
  const cat = params.get('cat') || 'all';
  const q = (params.get('q') || '').toLowerCase();
  useDocumentTitle(cat === 'all' ? null : cat);

  const items = products.filter((p) =>
    (cat === 'all' || p.category === cat) && (!q || p.name.toLowerCase().includes(q)));
  const heading = q ? `Results for “${params.get('q')}”` : cat === 'all' ? 'Featured pieces' : cat;

  return (
    <>
      {cat === 'all' && !q && (
        <>
          <section className="hero" aria-labelledby="heroTitle">
            <div className={`hero-art${heroPhoto ? ' has-photo' : ''}`} aria-hidden="true">
              {heroPhoto ? <HeroImage fallback={<Illustration name="sofa" strokeWidth={1.1} />} /> : <Illustration name="sofa" strokeWidth={1.1} />}
            </div>
            <div className="hero-in">
            <div className="eyebrow">The Autumn Collection</div>
            <h1 id="heroTitle">Considered pieces for a considered home.</h1>
            <p>Over 200,000 designs from Australia's most-loved furniture destination — delivered securely, with care.</p>
            <a className="btn" href="#collection" onClick={(e) => {
              // Scroll to the collection and move keyboard/screen-reader focus with it.
              e.preventDefault();
              const title = document.getElementById('collectionTitle');
              title.scrollIntoView({ block: 'start' });
              title.focus({ preventScroll: true });
            }}>Explore the collection</a>
          </div></section>

          <div className="values">
            <div><div className="ic"><Icon as={LockSimple} size={28} weight="light" /></div><h2>Secure by design</h2><p>SSL/TLS · PCI DSS · Privacy Act 1988</p></div>
            <div><div className="ic"><Icon as={Truck} size={28} weight="light" /></div><h2>Delivery you can see</h2><p>Real dates for your postcode, before checkout</p></div>
            <div><div className="ic"><Icon as={ArrowCounterClockwise} size={28} weight="light" /></div><h2>30-day returns</h2><p>Refunded to your card, not store credit</p></div>
            <div><div className="ic"><Icon as={ChatCircle} size={28} weight="light" /></div><h2>After-sales care</h2><p>Real people on 1300 000 000</p></div>
          </div>

          <section aria-labelledby="roomsTitle">
            <div className="lead"><div><h2 className="serif" id="roomsTitle">Shop by room</h2><p>Start with the space you're styling</p></div></div>
            <ul className="rooms">
              {ROOMS.map((r) => (
                <li key={r.cat}>
                  <Link to={`/?cat=${encodeURIComponent(r.cat)}`} className="room">
                    <span className="circle">{(() => {
                      // A room shows its best-known product's photo, or the drawing until photos are added.
                      const p = products.find((x) => x.id === r.productId);
                      return p?.image ? <ProductImage product={p} sizes="150px" /> : <Illustration name={r.drawing} />;
                    })()}</span>
                    <span className="room-name">{r.cat}</span>
                    <span className="hint">{r.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="promiseTitle">
            <div className="lead"><div><h2 className="serif" id="promiseTitle">Our promises</h2><p>What shopping here is like, before you spend a cent</p></div></div>
            <ul className="offers">
              {PROMISES.map((o) => (
                <li key={o.cls} className={`offer ${o.cls}`}>
                  <div><h3>{o.title}</h3><p>{o.text}</p></div>
                  <Link className="btn" to={o.to}>{o.cta}</Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section aria-labelledby="collectionTitle" id="collection" className="anchor">
        <div className="lead">
          <div>
            {cat === 'all' && !q
              ? <h2 className="serif anchor" id="collectionTitle" tabIndex={-1}>{heading}</h2>
              : <h1 className="serif" id="collectionTitle">{heading}</h1>}
            <p>All prices in AUD, GST included · delivery shown on every item</p>
          </div>
          {(cat !== 'all' || q) && <Link className="link" to="/">View all <Icon as={ArrowRight} size={12} /></Link>}
        </div>
        <div className="grid" aria-busy={loading}>
          {loading ? Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)
            : items.length ? items.map((p, i) => <ProductCard key={p.id} product={p} eager={i < 4} />)
            : (
              <div className="panel center empty">
                <p>No pieces match {q ? `“${params.get('q')}”` : 'this filter'}.</p>
                <Link className="btn" to="/">Show all pieces</Link>
              </div>
            )}
        </div>
      </section>
    </>
  );
}
