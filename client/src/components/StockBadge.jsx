import { stockInfo } from '../lib/format.js';

export default function StockBadge({ stock }) {
  const s = stockInfo(stock);
  return <div className={`stock ${s.cls}`}>{s.text}</div>;
}
