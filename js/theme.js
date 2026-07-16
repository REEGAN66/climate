/**
 * theme.js — Climate Update
 * Dark / Light theme management.
 *  - Reads localStorage on load, falls back to prefers-color-scheme
 *  - Toggles data-theme on <html>
 *  - Persists choice to localStorage
 *  - Updates the toggle button icon & accessible label
 */

const STORAGE_KEY = 'climate-update-theme';
const ROOT        = document.documentElement;  // <html>

// ────────────────────────────────────────────────────────────
// Core helpers
// ────────────────────────────────────────────────────────────

/** Return the system colour-scheme preference */
function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Get the resolved theme: 'dark' | 'light' */
function getResolvedTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return systemPrefersDark() ? 'dark' : 'light';
}

/** Apply theme to the <html> element and update the toggle button */
function applyUITheme(theme) {
  ROOT.setAttribute('data-theme', theme);
  updateToggleButton(theme);
}

/** Persist and apply a theme */
function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyUITheme(theme);
}

/** Flip between dark and light */
function toggleTheme() {
  const current = ROOT.getAttribute('data-theme') ?? 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// ────────────────────────────────────────────────────────────
// Toggle Button UI
// ────────────────────────────────────────────────────────────

/** SVG icons for the toggle button */
const ICON_SUN = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" class="theme-icon theme-icon-sun">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41
             M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>`;

const ICON_MOON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" class="theme-icon theme-icon-moon">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;

function updateToggleButton(theme) {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;

  if (theme === 'dark') {
    // Dark mode is active → show sun (to switch to light)
    btn.innerHTML = ICON_SUN + '<span class="theme-toggle-label">Light</span>';
    btn.setAttribute('aria-label', 'Switch to light mode');
    btn.setAttribute('title', 'Switch to light mode');
    btn.setAttribute('aria-pressed', 'true');
  } else {
    // Light mode is active → show moon (to switch to dark)
    btn.innerHTML = ICON_MOON + '<span class="theme-toggle-label">Dark</span>';
    btn.setAttribute('aria-label', 'Switch to dark mode');
    btn.setAttribute('title', 'Switch to dark mode');
    btn.setAttribute('aria-pressed', 'false');
  }
}

// ────────────────────────────────────────────────────────────
// Initialise
// ────────────────────────────────────────────────────────────

export function initTheme() {
  // Apply theme before first paint (no flash)
  const theme = getResolvedTheme();
  applyUITheme(theme);

  // Wire toggle button (may or may not exist yet)
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }

  // React to system preference changes (if user hasn't set a manual pref)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyUITheme(e.matches ? 'dark' : 'light');
    }
  });
}
