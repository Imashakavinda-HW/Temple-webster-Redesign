// Applies the visitor's saved theme before the page is drawn, so it never flashes the wrong
// colours. It lives in its own file because the Content-Security-Policy blocks inline scripts.
(function () {
  var theme = 'light';
  try { if (localStorage.getItem('tw_theme') === 'dark') theme = 'dark'; } catch (e) { /* storage blocked: use default */ }
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f0d0c' : '#ffffff');
})();
