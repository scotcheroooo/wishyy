const LIGHT_THEMES = [
  { value:'forest',      label:'Enchanted Forest', accent:'#2e7d32', paper:'#f4faf2' },
  { value:'fairy',       label:'Fairy Garden',     accent:'#9b4dca', paper:'#fdf6fb' },
  { value:'rosegold',    label:'Rose Gold',        accent:'#c0725a', paper:'#fdf8f5' },
  { value:'ocean',       label:'Ocean Mist',       accent:'#1a6fa8', paper:'#f4f9fc' },
  { value:'lavender',    label:'Lavender Fields',  accent:'#7c5cbf', paper:'#f8f5ff' },
  { value:'peach',       label:'Peach Blossom',    accent:'#d4693a', paper:'#fff8f4' },
  { value:'mint',        label:'Mint Julep',       accent:'#2a9d7c', paper:'#f2fcf8' },
  { value:'sakura',      label:'Cherry Blossom',   accent:'#c8527a', paper:'#fff5f8' },
  { value:'lemon',       label:'Lemon Drop',       accent:'#b09020', paper:'#fffef0' },
  { value:'sage',        label:'Sage & Cream',     accent:'#5a8a5a', paper:'#f6faf4' },
  { value:'candy',       label:'Cotton Candy',     accent:'#e060a8', paper:'#fef5fc' },
  { value:'coral',       label:'Coral Reef',       accent:'#e8604a', paper:'#fff6f4' },
  { value:'periwinkle',  label:'Periwinkle',       accent:'#5060cc', paper:'#f5f6ff' },
  { value:'dustyrose',   label:'Dusty Rose',       accent:'#b06080', paper:'#fdf5f7' },
  { value:'skyblue',     label:'Sky Blue',         accent:'#2888cc', paper:'#f3f9ff' },
  { value:'sand',        label:'Warm Sand',        accent:'#9a6a30', paper:'#fdfaf4' },
  { value:'lilac',       label:'Lilac Dream',      accent:'#9060c0', paper:'#faf5ff' },
  { value:'pistachio',   label:'Pistachio',        accent:'#5a9060', paper:'#f4fbf5' },
  { value:'watermelon',  label:'Watermelon',       accent:'#d04060', paper:'#fff5f6' },
  { value:'bluebell',    label:'Bluebell',         accent:'#4858b8', paper:'#f5f7ff' },
  { value:'seafoam',     label:'Seafoam',          accent:'#2a9898', paper:'#f2fafa' },
  { value:'marigold',    label:'Marigold',         accent:'#c87020', paper:'#fffaf2' },
  { value:'wisteria',    label:'Wisteria',         accent:'#8858b8', paper:'#faf4ff' },
  { value:'butter',      label:'Buttercup',        accent:'#c88a20', paper:'#fffdf0' },
  { value:'honeydew',    label:'Honeydew',         accent:'#489858', paper:'#f4fdf5' },
  { value:'bubblegum',   label:'Bubblegum',        accent:'#e0409a', paper:'#fff5fc' },
  { value:'slate',       label:'Warm Slate',       accent:'#3a6080', paper:'#f4f6f8' },
];

const DARK_THEMES = [
  { value:'darkforest',  label:'Dark Forest',      accent:'#4caf50', paper:'#0d180d' },
  { value:'midnight',    label:'Midnight Fairy',   accent:'#c47dff', paper:'#1a0f1e' },
  { value:'velvet',      label:'Velvet Night',     accent:'#e040fb', paper:'#100818' },
  { value:'deepocean',   label:'Deep Ocean',       accent:'#40a8ff', paper:'#080e18' },
  { value:'ember',       label:'Ember',            accent:'#ff6030', paper:'#180a04' },
  { value:'neoncity',    label:'Neon City',        accent:'#00f0a8', paper:'#080c10' },
  { value:'bloodmoon',   label:'Blood Moon',       accent:'#ff4040', paper:'#180808' },
  { value:'obsidian',    label:'Obsidian',         accent:'#a0b0c0', paper:'#0c0e10' },
  { value:'galaxy',      label:'Galaxy',           accent:'#8878ff', paper:'#07080f' },
  { value:'darkrose',    label:'Dark Rose',        accent:'#ff6898', paper:'#180810' },
  { value:'twilight',    label:'Twilight',         accent:'#a08aff', paper:'#0c0818' },
  { value:'witches',     label:"Witch's Brew",     accent:'#40d8a0', paper:'#080f0c' },
  { value:'amethyst',    label:'Amethyst',         accent:'#c878ff', paper:'#0e0818' },
  { value:'coppernight', label:'Copper Night',     accent:'#e8904a', paper:'#130900' },
  { value:'noir',        label:'Noir',             accent:'#e0d8cc', paper:'#080808' },
  { value:'darksakura',  label:'Dark Sakura',      accent:'#ff88a8', paper:'#180810' },
  { value:'phantom',     label:'Phantom',          accent:'#78a8e8', paper:'#08101a' },
  { value:'duskgold',    label:'Dusk Gold',        accent:'#e8b040', paper:'#100c00' },
  { value:'abyssal',     label:'Abyssal',          accent:'#4888ff', paper:'#030508' },
  { value:'inferno',     label:'Inferno',          accent:'#ff8020', paper:'#120600' },
  { value:'aurora',      label:'Aurora',           accent:'#40e8c0', paper:'#080f10' },
  { value:'darklavender',label:'Dark Lavender',    accent:'#b090ff', paper:'#0c0814' },
  { value:'stealth',     label:'Stealth',          accent:'#60ff80', paper:'#050805' },
  { value:'wine',        label:'Aged Wine',        accent:'#e06888', paper:'#12060a' },
  { value:'darkmint',    label:'Dark Mint',        accent:'#30d8a8', paper:'#060f0a' },
];

const MODE_KEY  = 'wishyy.mode.v1';
const THEME_KEY = 'wishyy.theme.v1';

const FONT_LOCK_KEY = 'wishyy.fontLock.v1';

function getSavedMode() {
  const saved = localStorage.getItem(MODE_KEY);
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedTheme() { return localStorage.getItem(THEME_KEY) || null; }

function getDefaultTheme(mode) {
  return mode === 'dark' ? 'darkforest' : 'forest';
}

function isFontLocked() {
  return localStorage.getItem(FONT_LOCK_KEY) === 'true';
}

function applyMode(mode) {
  document.documentElement.setAttribute('data-mode', mode);
  localStorage.setItem(MODE_KEY, mode);
  const toggle = document.getElementById('modeToggle');
  // UIverse toggle: checked = light (sun/day), unchecked = dark (moon/stars)
  if (toggle) toggle.checked = mode === 'light';
}

function applyTheme(theme, skipFontSave) {
  const all = [...LIGHT_THEMES, ...DARK_THEMES];
  const found = all.find(t => t.value === theme);

  if (isFontLocked()) {
    // Apply theme but preserve the default font
    const mode = document.documentElement.getAttribute('data-mode') || 'light';
    // Store previous font vars, apply theme, then re-override fonts
    if (found && theme !== 'forest' && theme !== 'darkforest') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    // Enforce default font via style override
    const defaultFont = mode === 'dark'
      ? "'DM Serif Display', Georgia, serif"
      : "'DM Serif Display', Georgia, serif";
    const defaultBody = "'Nunito', sans-serif";
    document.documentElement.style.setProperty('--font-display', defaultFont);
    document.documentElement.style.setProperty('--font-body', defaultBody);
  } else {
    // Normal — let theme control fonts
    document.documentElement.style.removeProperty('--font-display');
    document.documentElement.style.removeProperty('--font-body');
    if (found && theme !== 'forest' && theme !== 'darkforest') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  if (!skipFontSave) localStorage.setItem(THEME_KEY, theme);
}

function buildThemeDialog() {
  const existing = document.getElementById('themeDialog');
  if (existing) existing.remove();

  const mode    = document.documentElement.getAttribute('data-mode') || 'light';
  const themes  = mode === 'dark' ? DARK_THEMES : LIGHT_THEMES;
  const current = getSavedTheme();

  const dialog = document.createElement('dialog');
  dialog.id = 'themeDialog';
  dialog.className = 'modal theme-dialog';
  dialog.innerHTML = `
    <div class="theme-dialog-header">
      <h3>Choose a theme</h3>
      <button class="ghost-button theme-dialog-close" type="button">&#x2715;</button>
    </div>
    <div class="theme-swatch-grid">
      ${themes.map(t => `
        <button class="swatch-btn${t.value === current ? ' active' : ''}" data-theme="${t.value}" type="button">
          <span class="swatch-dots">
            <span style="background:${t.paper};border:1px solid #ccc8"></span>
            <span style="background:${t.accent}"></span>
          </span>
          <span class="swatch-label">${t.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  document.body.appendChild(dialog);

  dialog.querySelector('.theme-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  dialog.querySelectorAll('.swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
      dialog.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  return dialog;
}

function initThemes() {
  const mode  = getSavedMode();
  let   theme = getSavedTheme();

  const lightVals = LIGHT_THEMES.map(t => t.value);
  const darkVals  = DARK_THEMES.map(t => t.value);
  // Default themes: Enchanted Forest (light), Dark Forest (dark)
  if (!theme || (mode === 'light' && !lightVals.includes(theme))) theme = getDefaultTheme('light');
  if (mode === 'dark' && !darkVals.includes(theme)) theme = getDefaultTheme('dark');

  applyMode(mode);
  applyTheme(theme);

  // Font lock toggle
  const fontLockBtn = document.getElementById('fontLockToggle');
  if (fontLockBtn) {
    fontLockBtn.textContent = isFontLocked() ? 'Fonts: locked' : 'Fonts: theme';
    fontLockBtn.classList.toggle('font-locked', isFontLocked());
    fontLockBtn.addEventListener('click', () => {
      const nowLocked = !isFontLocked();
      localStorage.setItem(FONT_LOCK_KEY, nowLocked);
      fontLockBtn.textContent = nowLocked ? 'Fonts: locked' : 'Fonts: theme';
      fontLockBtn.classList.toggle('font-locked', nowLocked);
      // Re-apply current theme to trigger font logic
      const currentTheme = getSavedTheme() || getDefaultTheme(getSavedMode());
      applyTheme(currentTheme);
    });
  }

  // Listen for system theme changes — only if user hasn't set a manual preference
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem(MODE_KEY)) {
      const next = e.matches ? 'dark' : 'light';
      const newTheme = getDefaultTheme(next);
      applyMode(next);
      applyTheme(newTheme);
      const tog = document.getElementById('modeToggle');
      if (tog) tog.checked = next === 'light';
    }
  });

  document.getElementById('modeToggle')?.addEventListener('change', function() {
    // UIverse: checked = light, unchecked = dark
    const next     = this.checked ? 'light' : 'dark';
    const newTheme = getDefaultTheme(next);
    localStorage.setItem(MODE_KEY, next);
    applyMode(next);
    applyTheme(newTheme);
  });

  document.getElementById('themesButton')?.addEventListener('click', () => {
    buildThemeDialog().showModal();
  });
}

document.addEventListener('DOMContentLoaded', initThemes);