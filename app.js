/* =====================================================
   WISHYY — app.js — Phase 2 (cross-device accounts)
   ===================================================== */
'use strict';

// ── STORAGE KEYS (only non-sensitive session data) ────────────
const LS = {
  userId:       'wishyy.userId',      // just the ID, not pin/name
  familyCode:   'wishyy.familyCode',
  ownerSession: 'wishyy.ownerSession',
};

// ── STATE ─────────────────────────────────────────────────────
let db   = null;
let auth = null;
let currentUser   = null; // { id, name, pinEncoded }
let currentFamily = null; // { code, name, description, adminUserId }
let currentList   = null; // { id, name, ownerUid, ownerEmail, ... }
let giftsData     = {};
let giftsRef      = null;
let listsRef      = null;
let ownerActive   = false;

// ── UTILS ─────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function makeFamilyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function encodePin(p) {
  try { return btoa(unescape(encodeURIComponent(String(p)))); } catch { return btoa(String(p)); }
}

async function hashPassword(p) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(p)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function $(id) { return document.getElementById(id); }

function showScreen(id) {
  ['welcomeScreen','noFamilyScreen','familyScreen','giftScreen'].forEach(s => {
    const el = $(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
}

function setMsg(elId, text, ok = false) {
  const el = $(elId);
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? 'var(--accent-strong)' : 'var(--warning)';
}

function fmtPrice(p) {
  const n = parseFloat(p);
  return isNaN(n) ? '' : '$' + n.toFixed(2);
}

function setBtnLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : label;
}

// ── OWNER SESSION ─────────────────────────────────────────────
function saveOwnerSession(listId) {
  const exp = Date.now() + 24 * 3600 * 1000;
  localStorage.setItem(LS.ownerSession, JSON.stringify({ listId, exp }));
  ownerActive = true;
}

function getOwnerSession() {
  try {
    const s = JSON.parse(localStorage.getItem(LS.ownerSession) || 'null');
    if (s && s.exp > Date.now()) return s;
    localStorage.removeItem(LS.ownerSession);
  } catch {}
  return null;
}

function clearOwnerSession() {
  localStorage.removeItem(LS.ownerSession);
  ownerActive = false;
}

// ── FIREBASE ─────────────────────────────────────────────────
function initFirebase() {
  try {
    if (typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) firebase.initializeApp(window.GIFT_LIST_FIREBASE_CONFIG);
    db   = firebase.database();
    auth = firebase.auth();
    return true;
  } catch (e) {
    console.error('Firebase init failed:', e);
    return false;
  }
}

function setSyncStatus(mode, label) {
  const el = $('syncStatus');
  if (!el) return;
  el.textContent = label;
  el.dataset.mode = mode;
}

// ── BOOT ──────────────────────────────────────────────────────
async function boot() {
  initFirebase();

  const savedId   = localStorage.getItem(LS.userId);
  const savedCode = localStorage.getItem(LS.familyCode);

  if (savedId && db) {
    // Load user from Firebase using stored ID
    try {
      const snap = await db.ref(`users/${savedId}`).get();
      if (snap.exists()) {
        const u = snap.val();
        currentUser = { id: savedId, name: u.name, pinEncoded: u.pinEncoded };
        if (savedCode) {
          await goToFamily(savedCode);
          return;
        }
        showScreen('noFamilyScreen');
        bindNoFamilyScreen();
        return;
      }
    } catch (e) {
      console.warn('Failed to load user from Firebase:', e);
    }
    // User not found in Firebase — clear stale ID
    localStorage.removeItem(LS.userId);
  }

  showScreen('welcomeScreen');
  bindWelcomeScreen();
}

// ── WELCOME SCREEN ────────────────────────────────────────────
function bindWelcomeScreen() {
  $('createTab').onclick = () => switchTab('create');
  $('returnTab').onclick = () => switchTab('return');
  $('createForm').onsubmit  = onCreateAccount;
  $('returnForm').onsubmit  = onReturnAccount;
}

function switchTab(tab) {
  $('createTab').classList.toggle('active', tab === 'create');
  $('returnTab').classList.toggle('active', tab === 'return');
  $('createForm').classList.toggle('hidden', tab !== 'create');
  $('returnForm').classList.toggle('hidden', tab !== 'return');
  setMsg('authMessage', '');
}

async function onCreateAccount(e) {
  e.preventDefault();
  const name  = $('newName').value.trim();
  const pin   = $('newPin').value.trim();
  const code  = $('newFamilyCode').value.trim().toUpperCase();
  const btn   = e.target.querySelector('button[type=submit]');

  if (!name || !pin) return;
  setBtnLoading(btn, true, 'Create account');
  setMsg('authMessage', '');

  const pinEncoded = encodePin(pin);
  const userId     = uid();

  currentUser = { id: userId, name, pinEncoded };

  try {
    if (db) {
      await db.ref(`users/${userId}`).set({ name, pinEncoded, createdAt: Date.now() });
    }
    localStorage.setItem(LS.userId, userId);
    setBtnLoading(btn, false, 'Create account');

    if (code) {
      await joinFamily(code, 'authMessage');
    } else {
      showScreen('noFamilyScreen');
      bindNoFamilyScreen();
    }
  } catch (err) {
    setMsg('authMessage', 'Could not save your account. Check your connection.');
    setBtnLoading(btn, false, 'Create account');
    console.error('Create account error:', err);
  }
}

async function onReturnAccount(e) {
  e.preventDefault();
  const pin  = $('returnPin').value.trim();
  const code = $('returnFamilyCode').value.trim().toUpperCase();
  const btn  = e.target.querySelector('button[type=submit]');

  if (!pin) { setMsg('authMessage', 'Please enter your PIN.'); return; }
  setBtnLoading(btn, true, 'Sign in');
  setMsg('authMessage', 'Looking up your account...');

  const pinEncoded = encodePin(pin);

  try {
    if (!db) throw new Error('No database connection.');

    let foundUser = null;

    // Try indexed query first (fast), fall back to full scan (works without index)
    try {
      const snap = await db.ref('users')
        .orderByChild('pinEncoded')
        .equalTo(pinEncoded)
        .get();
      if (snap.exists()) {
        snap.forEach(child => {
          if (!foundUser) foundUser = { id: child.key, ...child.val() };
        });
      }
    } catch (indexErr) {
      // Index not yet published — fall back to full scan
      console.warn('Index query failed, falling back to full scan:', indexErr.message);
      const allSnap = await db.ref('users').get();
      if (allSnap.exists()) {
        allSnap.forEach(child => {
          const u = child.val();
          if (!foundUser && u.pinEncoded === pinEncoded) {
            foundUser = { id: child.key, ...u };
          }
        });
      }
    }

    if (!foundUser) {
      setMsg('authMessage', 'No account found with that PIN. Check you entered it correctly.');
      setBtnLoading(btn, false, 'Sign in');
      return;
    }

    currentUser = { id: foundUser.id, name: foundUser.name, pinEncoded: foundUser.pinEncoded };
    localStorage.setItem(LS.userId, foundUser.id);
    setBtnLoading(btn, false, 'Sign in');
    setMsg('authMessage', '');

    if (code) {
      await joinFamily(code, 'authMessage');
    } else {
      const saved = localStorage.getItem(LS.familyCode);
      if (saved) { await goToFamily(saved); }
      else        { showScreen('noFamilyScreen'); bindNoFamilyScreen(); }
    }
  } catch (err) {
    console.error('Sign in error:', err);
    setMsg('authMessage', `Sign in failed: ${err.message}`);
    setBtnLoading(btn, false, 'Sign in');
  }
}

// ── NO-FAMILY SCREEN ──────────────────────────────────────────
function bindNoFamilyScreen() {
  replaceListener('joinFamilyForm', 'submit', async e => {
    e.preventDefault();
    const code = $('joinFamilyCode').value.trim().toUpperCase();
    if (!code) return;
    await joinFamily(code, 'noFamilyMessage');
  });
  replaceListener('createFamilyBtn', 'click', () => {
    resetCreateDialog();
    $('createFamilyDialog').showModal();
  });
  replaceListener('nfSignOut', 'click', hardSignOut);
}

function replaceListener(id, event, fn) {
  const el = $(id);
  if (!el) return;
  const clone = el.cloneNode(true);
  el.replaceWith(clone);
  clone.addEventListener(event, fn);
}

async function joinFamily(code, msgId) {
  if (!code) { setMsg(msgId, 'Please enter a family code.'); return; }
  if (!db)   { setMsg(msgId, 'No database connection.'); return; }
  try {
    const snap = await db.ref(`families/${code}`).get();
    if (!snap.exists()) { setMsg(msgId, 'Family code not found. Check the code and try again.'); return; }
    await db.ref(`familyMembers/${code}/${currentUser.id}`).set({ name: currentUser.name, joinedAt: Date.now() });
    localStorage.setItem(LS.familyCode, code);
    await goToFamily(code);
  } catch (err) {
    setMsg(msgId, 'Could not join family. Check your connection.');
    console.error('Join family error:', err);
  }
}

// ── CREATE FAMILY DIALOG ──────────────────────────────────────
function bindCreateFamilyDialog() {
  $('createFamilyForm').onsubmit = e => {
    e.preventDefault();
    const name = $('cfName').value.trim();
    if (!name) return;
    // Store on the dialog element itself — survives step transitions
    $('createFamilyDialog').dataset.fname = name;
    $('createFamilyDialog').dataset.fdesc = $('cfDescription').value.trim();
    $('cfStep1').classList.add('hidden');
    $('cfStep2').classList.remove('hidden');
    $('cfFamilyNameDisplay').textContent = name;
  };

  $('createListForm').onsubmit  = onCreateListSubmit;
  $('skipListBtn').onclick      = onSkipList;
  $('cfBack').onclick           = () => {
    $('cfStep1').classList.remove('hidden');
    $('cfStep2').classList.add('hidden');
  };
  $('cfCancel').onclick = () => { $('createFamilyDialog').close(); resetCreateDialog(); };
  $('createFamilyDialog').addEventListener('click', e => {
    if (e.target === $('createFamilyDialog')) { $('createFamilyDialog').close(); resetCreateDialog(); }
  });
}

async function doCreateFamily(listName, email, password) {
  // Returns the new family code, or throws
  const familyName = $('createFamilyDialog').dataset.fname || '';
  const familyDesc = $('createFamilyDialog').dataset.fdesc || '';

  if (!familyName) throw new Error('Family name missing. Go back and enter it.');

  let code = makeFamilyCode();
  // Ensure unique code
  while ((await db.ref(`families/${code}`).get()).exists()) {
    code = makeFamilyCode();
  }

  // Hash password and store in DB — no Firebase Auth needed for list ownership
  // This allows same email across multiple families
  let ownerPasswordHash = null;
  if (listName && email && password) {
    ownerPasswordHash = await hashPassword(password);
  }

  // Write family
  await db.ref(`families/${code}`).set({
    name: familyName,
    description: familyDesc,
    disclaimer: 'All of the lists in this family could have items on them that do not link to big sellers, companies, or brands like Amazon, Walmart, or Etsy. The responsibility is upon the owner of the list to view, examine, and determine if the links are safe to buy from. Any issues that come about from the used links do not fall back to the developer of the site',
    adminUserId: currentUser.id,
    createdAt: Date.now(),
  });

  // Write first list (if not skipped)
  if (listName) {
    // Check if this email already has a list in this family
    const existingSnap = await db.ref('lists').get();
    if (existingSnap.exists()) {
      const conflict = Object.values(existingSnap.val()).some(
        l => l.familyCode === code && l.ownerEmail?.toLowerCase() === email.toLowerCase()
      );
      if (conflict) throw new Error('This email already has a list in this family.');
    }
    const listId = db.ref('lists').push().key;
    await db.ref(`lists/${listId}`).set({
      familyCode: code,
      name: listName,
      ownerEmail: email,
      ownerPasswordHash,
      createdAt: Date.now(),
      interestNote: '',
      quickNote: '',
    });
  }

  // Add creator as member + cache admin
  await db.ref(`familyMembers/${code}/${currentUser.id}`).set({ name: currentUser.name, joinedAt: Date.now() });
  localStorage.setItem(`wishyy.admin.${code}`, currentUser.id);

  // Sign out of Firebase Auth (we only created the owner user, not signing in as them)
  if (auth) await auth.signOut().catch(() => {});

  return code;
}

async function onCreateListSubmit(e) {
  e.preventDefault();
  const listName = $('clListName').value.trim();
  const email    = $('clEmail').value.trim();
  const password = $('clPassword').value.trim();
  const msg      = $('createListMessage');
  const btn      = e.target.querySelector('button[type=submit]');

  if (password.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }

  setBtnLoading(btn, true, 'Create family and list');
  msg.textContent = 'Creating your family...';

  try {
    const code = await doCreateFamily(listName, email, password);
    localStorage.setItem(LS.familyCode, code);
    $('createFamilyDialog').close();
    resetCreateDialog();
    await goToFamily(code);
  } catch (err) {
    msg.textContent = err.message || 'Something went wrong. Try again.';
    setBtnLoading(btn, false, 'Create family and list');
    console.error('Create family error:', err);
  }
}

async function onSkipList() {
  const msg = $('createListMessage');
  const btn = $('skipListBtn');
  setBtnLoading(btn, true, 'Skip for now');
  msg.textContent = 'Creating your family...';

  try {
    const code = await doCreateFamily('', '', '');
    localStorage.setItem(LS.familyCode, code);
    $('createFamilyDialog').close();
    resetCreateDialog();
    await goToFamily(code);
  } catch (err) {
    msg.textContent = err.message || 'Something went wrong.';
    setBtnLoading(btn, false, 'Skip for now');
    console.error('Skip list error:', err);
  }
}

function resetCreateDialog() {
  $('cfStep1').classList.remove('hidden');
  $('cfStep2').classList.add('hidden');
  $('createFamilyForm').reset();
  $('createListForm').reset();
  $('createListMessage').textContent = '';
  delete $('createFamilyDialog').dataset.fname;
  delete $('createFamilyDialog').dataset.fdesc;
}

// ── ADD LIST DIALOG ───────────────────────────────────────────
function bindAddListDialog() {
  $('addListBtn').onclick = () => {
    $('addListForm').reset();
    $('addListMessage').textContent = '';
    $('addListDialog').showModal();
  };
  $('addListCancel').onclick = () => $('addListDialog').close();
  $('addListDialog').addEventListener('click', e => {
    if (e.target === $('addListDialog')) $('addListDialog').close();
  });
  $('addListForm').onsubmit = async e => {
    e.preventDefault();
    const listName = $('alListName').value.trim();
    const email    = $('alEmail').value.trim();
    const password = $('alPassword').value.trim();
    const msg      = $('addListMessage');
    const btn      = e.target.querySelector('button[type=submit]');

    if (password.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }
    setBtnLoading(btn, true, 'Create list');
    msg.textContent = 'Creating list...';

    try {
      let ownerUid = null;
      if (auth) {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        ownerUid = cred.user.uid;
      }

      const listId = db.ref('lists').push().key;
      await db.ref(`lists/${listId}`).set({
        familyCode: currentFamily.code,
        name: listName,
        ownerUid,
        ownerEmail: email,
        createdAt: Date.now(),
        interestNote: '',
        quickNote: '',
      });

      if (auth) await auth.signOut().catch(() => {});

      $('addListDialog').close();
      $('addListForm').reset();
      msg.textContent = '';
    } catch (err) {
      msg.textContent = err.message || 'Something went wrong.';
      setBtnLoading(btn, false, 'Create list');
      console.error('Add list error:', err);
    }
  };
}

// ── FAMILY PAGE ───────────────────────────────────────────────
async function goToFamily(code) {
  setSyncStatus('connecting', 'Connecting');

  if (!db) {
    currentFamily = { code, name: 'My Family', description: '' };
    renderFamilyHeader();
    renderListCards({});
    showScreen('familyScreen');
    return;
  }

  try {
    const snap = await db.ref(`families/${code}`).get();
    if (!snap.exists()) {
      setMsg('authMessage', 'Family not found.');
      localStorage.removeItem(LS.familyCode);
      showScreen('welcomeScreen');
      bindWelcomeScreen();
      return;
    }

    currentFamily = { code, ...snap.val() };

    // Cache admin for reliable button display
    if (currentFamily.adminUserId) {
      localStorage.setItem(`wishyy.admin.${code}`, currentFamily.adminUserId);
    }

    renderFamilyHeader();
    showScreen('familyScreen');
    setSyncStatus('online', 'Connected');

    // Listen for lists — with client-side fallback
    if (listsRef) listsRef.off();
    listsRef = db.ref('lists');
    listsRef.on('value', snap => {
      const all   = snap.val() || {};
      // Filter client-side so we don't depend on the index
      const mine  = Object.fromEntries(
        Object.entries(all).filter(([, l]) => l.familyCode === code)
      );
      renderListCards(mine);
    });
  } catch (err) {
    console.error('goToFamily error:', err);
    setMsg('authMessage', 'Could not load family. Check your connection.');
  }
}

function renderFamilyHeader() {
  $('familyPageName').textContent = currentFamily.name || 'My Family';
  $('familyPageCode').textContent = currentFamily.code || '';

  const descWrap = $('familyPageDescWrap');
  if (currentFamily.description) {
    $('familyPageDesc').textContent = currentFamily.description;
    descWrap.classList.remove('hidden');
  } else {
    descWrap.classList.add('hidden');
  }

  // Show admin button only to the admin
  const adminBtn = $('familyAdminBtn');
  if (adminBtn) {
    const cachedAdmin = localStorage.getItem(`wishyy.admin.${currentFamily.code}`);
    const isAdmin = currentUser && (
      currentFamily.adminUserId === currentUser.id ||
      cachedAdmin === currentUser.id
    );
    adminBtn.classList.toggle('hidden', !isAdmin);
  }
}

function renderListCards(lists) {
  const container = $('familyListCards');
  container.innerHTML = '';
  const entries = Object.entries(lists);
  if (!entries.length) {
    container.innerHTML = `<p class="empty-note">No lists yet — use <strong>+ New list</strong> to add one.</p>`;
    return;
  }
  entries
    .sort(([,a],[,b]) => (a.createdAt||0) - (b.createdAt||0))
    .forEach(([listId, list]) => {
      const btn = document.createElement('button');
      btn.className = 'list-card';
      btn.type = 'button';
      btn.innerHTML = `
        <div class="list-card-body">
          <p class="list-card-name">${list.name}</p>
          <p class="list-card-sub">Tap to view gifts</p>
        </div>
        <span class="list-card-arrow" aria-hidden="true">&#8594;</span>
      `;
      btn.addEventListener('click', () => handleListClick(listId, list));
      container.appendChild(btn);
    });
}

function bindFamilyPage() {
  $('familySignOutBtn').onclick = hardSignOut;
  bindAddListDialog();
  bindFamilyAdminDialog();
}

// ── FAMILY ADMIN ──────────────────────────────────────────────
function bindFamilyAdminDialog() {
  const btn = $('familyAdminBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    $('faName').value        = currentFamily.name || '';
    $('faDescription').value = currentFamily.description || '';
    $('faMessage').textContent = '';
    $('familyAdminDialog').showModal();
  });
  $('faCancel').onclick = () => $('familyAdminDialog').close();
  $('familyAdminDialog').addEventListener('click', e => {
    if (e.target === $('familyAdminDialog')) $('familyAdminDialog').close();
  });
  $('familyAdminForm').onsubmit = async e => {
    e.preventDefault();
    const name = $('faName').value.trim();
    const desc = $('faDescription').value.trim();
    if (!name) return;
    if (db && currentFamily) {
      await db.ref(`families/${currentFamily.code}`).update({ name, description: desc });
      currentFamily.name = name;
      currentFamily.description = desc;
      renderFamilyHeader();
    }
    $('familyAdminDialog').close();
  };
}

// ── RELATION DIALOG ───────────────────────────────────────────
function handleListClick(listId, list) {
  const relKey = `wishyy.rel.${listId}`;
  const saved  = localStorage.getItem(relKey);
  if (saved !== null) { openList(listId, list); return; }

  // Pull just the first word of the list name so it reads "James is my..."
  const firstName = list.name.replace(/['']s.*$/i, '').split(' ')[0] || list.name;
  $('relListName').textContent = firstName;
  $('relInput').value = '';
  $('relationDialog').showModal();

  $('relationForm').onsubmit = e => {
    e.preventDefault();
    localStorage.setItem(relKey, $('relInput').value.trim());
    $('relationDialog').close();
    openList(listId, list);
  };
  $('relSkip').onclick = () => {
    localStorage.setItem(relKey, '');
    $('relationDialog').close();
    openList(listId, list);
  };
}

// ── GIFT SCREEN ───────────────────────────────────────────────
function openList(listId, list) {
  currentList = { id: listId, ...list };
  const rel = localStorage.getItem(`wishyy.rel.${listId}`);
  const listFirstName = currentList.name.replace(/['']s\b.*$/i, '').split(' ')[0] || currentList.name;
  $('helloText').textContent = rel
    ? `${listFirstName}'s list — for ${currentUser.name} (${rel})`
    : `${listFirstName}'s list`;

  const session = getOwnerSession();
  ownerActive = !!(session && session.listId === listId);

  showScreen('giftScreen');
  setSyncStatus('online', 'Connected');
  loadListMeta(listId);
  loadGifts(listId);
}

function loadListMeta(listId) {
  if (!db) return;
  db.ref(`lists/${listId}`).on('value', snap => {
    if (!snap.exists()) return;
    const data = snap.val();

    // Interest note
    $('interestText').textContent = data.interestNote || '';
    $('interestSection').classList.toggle('hidden', !data.interestNote);

    // Quick note
    if (data.quickNote) $('quickNoteText').textContent = data.quickNote;
    $('disclaimerStrip').classList.toggle('hidden', !data.quickNote);

    // Show edit/delete buttons on notes if owner is active
    if (ownerActive) showNoteEditButtons();
  });
}

function showNoteEditButtons() {
  $('editInterestBtn')?.classList.remove('hidden');
  $('deleteInterestBtn')?.classList.remove('hidden');
  $('editQuickNoteBtn')?.classList.remove('hidden');
  $('deleteQuickNoteBtn')?.classList.remove('hidden');
}

function loadGifts(listId) {
  if (giftsRef) giftsRef.off();
  if (!db) { giftsData = {}; renderGifts(); return; }
  giftsRef = db.ref(`gifts/${listId}`);
  giftsRef.on('value', snap => {
    giftsData = snap.val() || {};
    renderGifts();
  });
}

function renderGifts() {
  const search = ($('searchInput')?.value || '').toLowerCase().trim();
  const sort   = $('sortSelect')?.value || 'newest';
  const filter = $('filterSelect')?.value || 'all';

  let entries = Object.entries(giftsData);
  if (filter === 'available') entries = entries.filter(([,g]) => !g.boughtBy);
  if (filter === 'bought')    entries = entries.filter(([,g]) =>  g.boughtBy);
  if (search) entries = entries.filter(([,g]) =>
    (g.name||'').toLowerCase().includes(search) ||
    (g.store||'').toLowerCase().includes(search) ||
    (g.note||'').toLowerCase().includes(search)
  );
  if (sort === 'priceLow')  entries.sort(([,a],[,b]) => (a.price||0)-(b.price||0));
  if (sort === 'priceHigh') entries.sort(([,a],[,b]) => (b.price||0)-(a.price||0));
  if (sort === 'alpha')     entries.sort(([,a],[,b]) => (a.name||'').localeCompare(b.name||''));
  if (sort === 'newest')    entries.sort(([,a],[,b]) => (b.addedAt||0)-(a.addedAt||0));
  if (sort === 'wantHigh')  entries.sort(([,a],[,b]) => (b.want||0)-(a.want||0));
  if (sort === 'wantLow')   entries.sort(([,a],[,b]) => (a.want||0)-(b.want||0));

  const container = $('giftList');
  container.innerHTML = '';
  $('resultCount').textContent = `${entries.length} gift${entries.length !== 1 ? 's' : ''}`;

  if (!entries.length) {
    container.innerHTML = `<p class="empty-note" style="grid-column:1/-1">No gifts match your search.</p>`;
    return;
  }

  entries.forEach(([id, gift]) => {
    const isBought = !!gift.boughtBy;
    const isMine   = gift.boughtBy === currentUser?.id;
    const card = document.createElement('div');
    card.className = `gift-card${isBought ? ' bought' : ''}`;

    const titleHtml = isBought
      ? `<span class="gift-title disabled">${gift.name}</span>`
      : `<a class="gift-title" href="${gift.url}" target="_blank" rel="noopener">${gift.name}</a>`;

    const previewHtml = gift.image
      ? `<div class="preview"><img src="${gift.image}" alt="" loading="lazy" onerror="this.outerHTML='<span class=preview-fallback>No preview</span>'"></div>`
      : '';

    const actionsHtml = isBought
      ? (isMine ? `<button class="ghost-button undo-btn" data-id="${id}">Undo</button>` : `<span class="bought-label">Bought</span>`)
      : `<button class="primary-button buy-btn" data-id="${id}" data-name="${gift.name}">I bought this</button>`;

    const ownerHtml = ownerActive
      ? `<button class="ghost-button edit-btn" data-id="${id}">Edit</button>
         <button class="danger-button delete-btn" data-id="${id}">Delete</button>`
      : '';

    const wantBadge = (gift.want && gift.want > 0)
      ? `<span class="want-badge want-${gift.want}" title="Want level ${gift.want}/10">${gift.want}/10</span>`
      : '';
    card.innerHTML = `
      <div class="gift-main">
        <div>
          <div class="gift-title-wrap">${titleHtml}${previewHtml}</div>
          ${gift.store ? `<p class="meta">${gift.store}</p>` : ''}
          ${gift.note ? `<p class="note">${gift.note}</p>` : ''}
        </div>
        <div class="gift-aside">
          ${gift.price ? `<span class="price">${fmtPrice(gift.price)}</span>` : ''}
          ${wantBadge}
        </div>
      </div>
      <div class="gift-actions">${actionsHtml}${ownerHtml}</div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.buy-btn').forEach(b =>
    b.addEventListener('click', () => openBuyDialog(b.dataset.id, b.dataset.name)));
  container.querySelectorAll('.undo-btn').forEach(b =>
    b.addEventListener('click', () => undoBought(b.dataset.id)));
  if (ownerActive) {
    container.querySelectorAll('.edit-btn').forEach(b =>
      b.addEventListener('click', () => startEditGift(b.dataset.id)));
    container.querySelectorAll('.delete-btn').forEach(b =>
      b.addEventListener('click', () => deleteGift(b.dataset.id)));
  }
}

// ── BUY DIALOG ────────────────────────────────────────────────
function openBuyDialog(giftId, giftName) {
  $('buyDialogText').textContent = `Mark "${giftName}" as bought?`;
  $('buyDialog').showModal();
  $('confirmBoughtButton').onclick = async () => {
    $('buyDialog').close();
    if (db) await db.ref(`gifts/${currentList.id}/${giftId}`).update({
      boughtBy: currentUser.id,
      boughtAt: Date.now(),
    });
  };
}

async function undoBought(giftId) {
  if (!db) return;
  await db.ref(`gifts/${currentList.id}/${giftId}`).update({ boughtBy: null, boughtAt: null });
}

// ── OWNER TOOLS ───────────────────────────────────────────────
function bindOwnerTools() {
  $('ownerButton').addEventListener('click', () => {
    if (ownerActive) { showOwnerPanel(); return; }
    $('ownerUnlockForm').classList.remove('hidden');
    $('ownerPanel').classList.add('hidden');
    $('ownerMessage').textContent = '';
    $('ownerEmailInput').value = $('ownerPasswordInput').value = '';
    $('ownerDialog').showModal();
  });

  $('ownerCloseButton').addEventListener('click', () => $('ownerDialog').close());
  $('ownerDoneButton').addEventListener('click', () => $('ownerDialog').close());
  $('ownerDialog').addEventListener('click', e => {
    if (e.target === $('ownerDialog')) $('ownerDialog').close();
  });

  $('ownerUnlockForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email    = $('ownerEmailInput').value.trim();
    const password = $('ownerPasswordInput').value.trim();
    const msg      = $('ownerMessage');
    if (!auth) { msg.textContent = 'Firebase not available.'; return; }
    try {
      // Compare against stored hash — no Firebase Auth needed
      const entered = await hashPassword(password);
      const emailMatch = currentList.ownerEmail?.toLowerCase() === email.toLowerCase();
      const passMatch  = currentList.ownerPasswordHash === entered;

      if (!emailMatch || !passMatch) {
        msg.textContent = 'Incorrect email or password.';
        return;
      }
      saveOwnerSession(currentList.id);
      ownerActive = true;
      showOwnerPanel();
      renderGifts();
    } catch (err) {
      msg.textContent = 'Something went wrong. Try again.';
      console.error('Owner unlock error:', err);
    }
  });

  $('saveInterestButton').addEventListener('click', async () => {
    if (!db || !currentList) return;
    await db.ref(`lists/${currentList.id}`).update({ interestNote: $('ownerInterest').value });
  });

  $('saveListNameButton')?.addEventListener('click', async () => {
    if (!db || !currentList) return;
    const newName = $('ownerListName').value.trim();
    if (!newName) return;
    await db.ref(`lists/${currentList.id}`).update({ name: newName });
    currentList.name = newName;
  });

  $('saveQuickNoteButton')?.addEventListener('click', async () => {
    if (!db || !currentList) return;
    await db.ref(`lists/${currentList.id}`).update({ quickNote: $('ownerQuickNote').value });
  });

  // Inline note edit/delete buttons on the gift screen
  $('editInterestBtn')?.addEventListener('click', () => {
    $('inlineInterestInput').value = $('interestText').textContent;
    $('interestViewMode').classList.add('hidden');
    $('interestEditMode').classList.remove('hidden');
  });
  $('saveInterestInlineBtn')?.addEventListener('click', async () => {
    if (!db || !currentList) return;
    const val = $('inlineInterestInput').value.trim();
    await db.ref(`lists/${currentList.id}`).update({ interestNote: val });
    $('interestViewMode').classList.remove('hidden');
    $('interestEditMode').classList.add('hidden');
  });
  $('cancelInterestInlineBtn')?.addEventListener('click', () => {
    $('interestViewMode').classList.remove('hidden');
    $('interestEditMode').classList.add('hidden');
  });
  $('deleteInterestBtn')?.addEventListener('click', async () => {
    if (!db || !currentList) return;
    if (confirm('Delete the interest note?')) {
      await db.ref(`lists/${currentList.id}`).update({ interestNote: '' });
    }
  });

  $('editQuickNoteBtn')?.addEventListener('click', () => {
    $('inlineQuickNoteInput').value = $('quickNoteText').textContent;
    $('quickNoteViewMode').classList.add('hidden');
    $('quickNoteEditMode').classList.remove('hidden');
  });
  $('saveQuickNoteInlineBtn')?.addEventListener('click', async () => {
    if (!db || !currentList) return;
    const val = $('inlineQuickNoteInput').value.trim();
    await db.ref(`lists/${currentList.id}`).update({ quickNote: val });
    $('quickNoteViewMode').classList.remove('hidden');
    $('quickNoteEditMode').classList.add('hidden');
  });
  $('cancelQuickNoteInlineBtn')?.addEventListener('click', () => {
    $('quickNoteViewMode').classList.remove('hidden');
    $('quickNoteEditMode').classList.add('hidden');
  });
  $('deleteQuickNoteBtn')?.addEventListener('click', async () => {
    if (!db || !currentList) return;
    if (confirm('Delete the quick note?')) {
      await db.ref(`lists/${currentList.id}`).update({ quickNote: '' });
    }
  });

  $('giftForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!db || !currentList) return;
    const editId = $('giftForm').dataset.editId;
    const wantVal = parseInt($('giftWant').value, 10);
    const data = {
      name:  $('giftName').value.trim(),
      price: parseFloat($('giftPrice').value) || 0,
      store: $('giftStore').value.trim(),
      url:   $('giftUrl').value.trim(),
      image: $('giftImage').value.trim(),
      note:  $('giftNote').value.trim(),
      want:  isNaN(wantVal) ? null : wantVal,
    };
    if (editId) {
      await db.ref(`gifts/${currentList.id}/${editId}`).update(data);
      delete $('giftForm').dataset.editId;
      $('giftSubmitButton').textContent = 'Add gift';
      $('cancelEditButton').classList.add('hidden');
    } else {
      data.addedAt = Date.now();
      await db.ref(`gifts/${currentList.id}`).push(data);
    }
    $('giftForm').reset();
    $('giftWant').value = '';
    updateWantDisplay();
  });

  $('cancelEditButton').addEventListener('click', () => {
    $('giftForm').reset();
    $('giftWant').value = '';
    updateWantDisplay();
    delete $('giftForm').dataset.editId;
    $('giftSubmitButton').textContent = 'Add gift';
    $('cancelEditButton').classList.add('hidden');
  });
}

function showOwnerPanel() {
  $('ownerUnlockForm').classList.add('hidden');
  $('ownerPanel').classList.remove('hidden');
  $('ownerDialog').showModal();
  if (db && currentList) {
    db.ref(`lists/${currentList.id}`).get().then(s => {
      const d = s.val() || {};
      $('ownerListName').value  = d.name         || '';
      $('ownerInterest').value  = d.interestNote || '';
      $('ownerQuickNote').value = d.quickNote    || '';
    });
  }
  // Show inline note edit buttons now that owner is confirmed active
  showNoteEditButtons();
  const giftsList = $('ownerGiftsList');
  giftsList.innerHTML = '';
  const entries = Object.entries(giftsData);
  if (!entries.length) {
    giftsList.innerHTML = '<p style="color:var(--muted);margin:0">No gifts yet.</p>';
    return;
  }
  entries.forEach(([id, g]) => {
    const row = document.createElement('div');
    row.className = 'owner-list-row';
    row.innerHTML = `
      <div><strong>${g.name}</strong><p>${fmtPrice(g.price)}</p></div>
      <div class="owner-row-actions">
        <button class="ghost-button" data-edit="${id}">Edit</button>
        <button class="danger-button" data-del="${id}">Delete</button>
      </div>`;
    row.querySelector('[data-edit]').onclick = () => { startEditGift(id); $('ownerDialog').close(); };
    row.querySelector('[data-del]').onclick  = () => deleteGift(id);
    giftsList.appendChild(row);
  });
}

function startEditGift(id) {
  const g = giftsData[id];
  if (!g) return;
  $('giftName').value  = g.name  || '';
  $('giftPrice').value = g.price !== undefined ? g.price : '';
  $('giftStore').value = g.store || '';
  $('giftUrl').value   = g.url   || '';
  $('giftImage').value = g.image || '';
  $('giftNote').value  = g.note  || '';
  $('giftWant').value  = g.want !== undefined && g.want !== null ? g.want : '';
  updateWantDisplay();
  $('giftForm').dataset.editId = id;
  $('giftSubmitButton').textContent = 'Save changes';
  $('cancelEditButton').classList.remove('hidden');
  // Open the owner panel so the form is visible
  $('ownerUnlockForm').classList.add('hidden');
  $('ownerPanel').classList.remove('hidden');
  $('ownerDialog').showModal();
  // Scroll to the gift form after a tick so it's rendered
  setTimeout(() => $('giftForm').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

async function deleteGift(id) {
  if (!db || !currentList) return;
  if (confirm('Delete this gift?')) await db.ref(`gifts/${currentList.id}/${id}`).remove();
}

// ── EXPORT ────────────────────────────────────────────────────
async function exportList() {
  if (!db || !currentList) return;
  const [listSnap, giftsSnap] = await Promise.all([
    db.ref(`lists/${currentList.id}`).get(),
    db.ref(`gifts/${currentList.id}`).get(),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    list:  listSnap.val()  || {},
    gifts: giftsSnap.val() || {},
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(currentList.name || 'wishyy-list').replace(/[^a-z0-9]/gi, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── IMPORT ────────────────────────────────────────────────────
function importList(file) {
  if (!file || !db || !currentList) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const payload = JSON.parse(ev.target.result);
      const gifts   = payload.gifts || {};
      const updates = {};
      Object.entries(gifts).forEach(([id, gift]) => {
        // Strip bought status on import, keep everything else
        const { boughtBy, boughtAt, ...clean } = gift;
        updates[`gifts/${currentList.id}/${id}`] = { ...clean, importedAt: Date.now() };
      });
      if (payload.list?.interestNote) {
        updates[`lists/${currentList.id}/interestNote`] = payload.list.interestNote;
      }
      if (payload.list?.quickNote) {
        updates[`lists/${currentList.id}/quickNote`] = payload.list.quickNote;
      }
      await db.ref().update(updates);
      alert(`Imported ${Object.keys(gifts).length} gifts successfully.`);
    } catch (err) {
      alert('Import failed. Make sure you are using a valid wishyy export file.');
      console.error('Import error:', err);
    }
  };
  reader.readAsText(file);
}

// ── WANT SLIDER DISPLAY ───────────────────────────────────────
function updateWantDisplay() {
  const slider = $('giftWant');
  const label  = $('wantLabel');
  if (!slider || !label) return;
  const v = parseInt(slider.value, 10);
  if (!slider.value || isNaN(v)) {
    label.textContent = 'Not set';
    label.className   = 'want-display-label';
  } else {
    const desc = v >= 9 ? 'Must have' : v >= 7 ? 'Really want' : v >= 5 ? 'Would love' : v >= 3 ? 'Would like' : 'Nice to have';
    label.textContent = `${v}/10 — ${desc}`;
    label.className   = `want-display-label want-text-${v}`;
  }
}

// ── SIGN OUT ──────────────────────────────────────────────────
function hardSignOut() {
  clearOwnerSession();
  if (giftsRef) { giftsRef.off(); giftsRef = null; }
  if (listsRef) { listsRef.off(); listsRef = null; }
  currentList = currentFamily = null;
  giftsData = {};
  ownerActive = false;
  localStorage.removeItem(LS.familyCode);

  showScreen('welcomeScreen');
  $('returnTab').classList.add('active');
  $('createTab').classList.remove('active');
  $('returnForm').classList.remove('hidden');
  $('createForm').classList.add('hidden');
  setMsg('authMessage', '');
  $('returnPin').value = '';
  if ($('returnFamilyCode')) $('returnFamilyCode').value = '';
}

// ── CONTROLS ─────────────────────────────────────────────────
function bindGiftControls() {
  $('searchInput')?.addEventListener('input', renderGifts);
  $('sortSelect')?.addEventListener('change', renderGifts);
  $('filterSelect')?.addEventListener('change', renderGifts);
  $('signOutButton')?.addEventListener('click', hardSignOut);
  $('backToFamily')?.addEventListener('click', () => {
    if (giftsRef) { giftsRef.off(); giftsRef = null; }
    if (currentFamily) goToFamily(currentFamily.code);
    else showScreen('familyScreen');
  });
  $('exportListBtn')?.addEventListener('click', exportList);
  $('importListInput')?.addEventListener('change', e => {
    importList(e.target.files[0]);
    e.target.value = '';
  });
  $('giftWant')?.addEventListener('input', updateWantDisplay);

  $('wantClearBtn')?.addEventListener('click', () => {
    $('giftWant').value = '';
    updateWantDisplay();
  });
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindCreateFamilyDialog();
  bindFamilyPage();
  bindOwnerTools();
  bindGiftControls();
  await boot();
});