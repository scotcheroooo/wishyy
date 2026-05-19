/* =====================================================
   WISHY WHIMSY — themes.js
   Handles dark/light mode toggle and theme switching
   ===================================================== */

const LIGHT_THEMES = [
  { value: 'fairy',    label: '🌸 Fairy Garden' },
  { value: 'forest',   label: '🌿 Enchanted Forest' },
  { value: 'rosegold', label: '🌹 Rose Gold' },
  { value: 'ocean',    label: '🌊 Ocean Mist' },
];

const DARK_THEMES = [
  { value: 'midnight',  label: '🌙 Midnight Fairy' },
  { value: 'darkforest',label: '🌲 Dark Forest' },
  { value: 'velvet',    label: '✨ Velvet Night' },
];

const MODE_KEY   = 'wishyWhimsy.mode.v1';
const THEME_KEY  = 'wishyWhimsy.theme.v1';

function getSavedMode()  { return localStorage.getItem(MODE_KEY)  || 'light'; }
function getSavedTheme() { return localStorage.getItem(THEME_KEY) || 'fairy'; }

function applyMode(mode) {
  document.documentElement.setAttribute('data-mode', mode);
  localStorage.setItem(MODE_KEY, mode);
  const btn = document.getElementById('modeToggle');
  if (btn) btn.textContent = mode === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
}

function applyTheme(theme, mode) {
  // For default themes the attribute is absent (handled by :root / [data-mode="dark"])
  const allThemes = [...LIGHT_THEMES, ...DARK_THEMES];
  const themeExists = allThemes.some(t => t.value === theme);
  if (themeExists && theme !== 'fairy' && theme !== 'midnight') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(THEME_KEY, theme);
}

function populateThemeSelect(mode) {
  const sel = document.getElementById('themeSelect');
  if (!sel) return;
  const themes = mode === 'dark' ? DARK_THEMES : LIGHT_THEMES;
  sel.innerHTML = themes.map(t =>
    `<option value="${t.value}">${t.label}</option>`
  ).join('');
}

function pickDefaultThemeForMode(mode) {
  return mode === 'dark' ? 'midnight' : 'fairy';
}

function initThemes() {
  const mode  = getSavedMode();
  let   theme = getSavedTheme();

  // If saved theme is from the wrong mode, reset to default
  const lightValues = LIGHT_THEMES.map(t => t.value);
  const darkValues  = DARK_THEMES.map(t => t.value);
  if (mode === 'light' && !lightValues.includes(theme)) theme = 'fairy';
  if (mode === 'dark'  && !darkValues.includes(theme))  theme = 'midnight';

  applyMode(mode);
  populateThemeSelect(mode);
  applyTheme(theme, mode);

  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = theme;

  // Mode toggle
  document.getElementById('modeToggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-mode') || 'light';
    const next    = current === 'dark' ? 'light' : 'dark';
    const newTheme = pickDefaultThemeForMode(next);
    applyMode(next);
    populateThemeSelect(next);
    applyTheme(newTheme, next);
    if (sel) sel.value = newTheme;
  });

  // Theme select
  sel?.addEventListener('change', () => {
    const currentMode = document.documentElement.getAttribute('data-mode') || 'light';
    applyTheme(sel.value, currentMode);
  });
}

document.addEventListener('DOMContentLoaded', initThemes);
