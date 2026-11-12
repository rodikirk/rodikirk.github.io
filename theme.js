// Site-wide colour theme: one palette for every page, remembered as you move between pages,
// and drawn into the favicon so the tab shifts colour with the site.
var THEMES = [
  { bg: "#1a1916", fg: "#faf8f4" },
  { bg: "#b4452e", fg: "#faf8f4" },
  { bg: "#e8b23a", fg: "#1a1916" },
  { bg: "#2f5d50", fg: "#faf8f4" },
  { bg: "#2a3fd1", fg: "#faf8f4" },
  { bg: "#f2a7c3", fg: "#2a0d18" },
  { bg: "#faf8f4", fg: "#1a1916" },
];
let themeIndex = (() => {
  try { const i = parseInt(localStorage.getItem("rk-theme"), 10); return i >= 0 && i < THEMES.length ? i : 0; } catch (e) { return 0; }
})();
const theme = () => THEMES[themeIndex];

// Favicon: three strings, the middle one plucked.
function iconSVG(t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${t.bg}"/>` +
    `<g fill="none" stroke="${t.fg}" stroke-width="5" stroke-linecap="round"><path d="M13 19H51"/><path d="M13 32Q32 45 51 32"/><path d="M13 45H51"/></g></svg>`;
}

function applyTheme() {
  const t = theme(), root = document.documentElement.style;
  root.setProperty("--bg", t.bg); root.setProperty("--fg", t.fg);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", t.bg);
  const icon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (icon) icon.href = "data:image/svg+xml," + encodeURIComponent(iconSVG(t));
}
function setTheme(i) {
  themeIndex = ((i % THEMES.length) + THEMES.length) % THEMES.length;
  try { localStorage.setItem("rk-theme", themeIndex); } catch (e) {}
  applyTheme();
}
function nextTheme() { setTheme(themeIndex + 1); }
applyTheme();
