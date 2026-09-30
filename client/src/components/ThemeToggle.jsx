import { useState } from 'react';
import { Moon } from '@phosphor-icons/react';
import { Icon } from './Icons.jsx';

// Switches between Daylight (Hearth & Hollow palette, default) and Evening (the original
// dark + gold design). public/theme-init.js applies the saved choice before first paint.
export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next ? '#0f0d0c' : '#ffffff');
    try { localStorage.setItem('tw_theme', next ? 'dark' : 'light'); } catch { /* private mode: choice lasts this visit */ }
  };

  // A toggle keeps one fixed name and reports on/off with aria-pressed.
  return (
    <button type="button" className="theme-toggle" aria-pressed={dark} onClick={toggle} title="Switch to the dark Evening theme">
      <Icon as={Moon} weight={dark ? 'fill' : 'regular'} /> Evening
    </button>
  );
}
