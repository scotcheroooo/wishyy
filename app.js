/* =====================================================
   WISHYY — app.js — Phase 2
   Multi-family, multi-list gift platform
   ===================================================== */
'use strict';

// ── STORAGE KEYS ──────────────────────────────────────────────
const LS = {
  userId:       'wishyy.userId',
  userName:     'wishyy.userName',
  userPin:      'wishyy.userPin',
  familyCode:   'wishyy.familyCode',
  ownerSession: 'wishyy.ownerSession',
};

// ── STATE ─────────────────────────────────────────────────────
let db   = null;
let auth = null;
let currentUser   = null; // { id, name, pin }
let currentFamily = null; // { code, name, description, adminUserId }
let currentList   = null; // { id, name, ownerUid, ownerEmail, ... }
let giftsData     = {};
let giftsRef      = null;
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
  try { return btoa(unescape(encodeURIComponent(String(p)))); } catch { return btoa(p); }
}
function decodePin(p) {
  try { return decodeURIComponent(escape(atob(p))); } catch { return '??'; }
}
function pinMatches(entered, stored) {
  return encodePin(entered) === stored;
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
  if (p === '' || p === null || p === undefined) return '';
  const n = parseFloat(p);
  return isNaN(n) ? '' : '$' + n.toFixed(2);
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
  if (auth) auth.signOut().catch(() => {});
}

// ── FIREBASE ─────────────────────────────────────────────────
function initFirebase() {
  try {
    if (typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db   = firebase.database();
    auth = firebase.auth();
    return true;
  } catch (e) {
    console.warn('Firebase init failed:', e);
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
  const savedName = localStorage.getItem(LS.userName);
  const savedPin  = localStorage.getItem(LS.userPin);
  const savedCode = localStorage.getItem(LS.familyCode);

  if (savedId && savedName && savedPin) {
    currentUser = { id: savedId, name: savedName, pin: savedPin };
    if (savedCode) {
      await goToFamily(savedCode);
      return;
    }
    showScreen('noFamilyScreen');
    bindNoFamilyScreen();
    return;
  }

  showScreen('welcomeScreen');
  bindWelcomeScreen();
}

// ── WELCOME SCREEN ────────────────────────────────────────────
function bindWelcomeScreen() {
  $('createTab').onclick = () => switchTab('create');
  $('returnTab').onclick = () => switchTab('return');
  $('createForm').onsubmit = onCreateAccount;
  $('returnForm').onsubmit = onReturnAccount;
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
  const name   = $('newName').value.trim();
  const pin    = $('newPin').value.trim();
  const code   = $('newFamilyCode').value.trim().toUpperCase();
  const btn    = e.target.querySelector('button[type=submit]');
  const encodedPin = encodePin(pin);

  if (!name || !pin) return;
  btn.disabled = true;
  btn.textContent = 'Creating...';

  const userId = uid();
  currentUser  = { id: userId, name, pin: encodedPin };

  if (db) {
    await db.ref(`users/${userId}`).set({ name, pin: encodedPin, createdAt: Date.now() });
  }
  localStorage.setItem(LS.userId,   userId);
  localStorage.setItem(LS.userName, name);
  localStorage.setItem(LS.userPin,  encodedPin);

  btn.disabled = false;
  btn.textContent = 'Create account';

  if (code) {
    await joinFamily(code, 'authMessage');
  } else {
    showScreen('noFamilyScreen');
    bindNoFamilyScreen();
  }
}

async function onReturnAccount(e) {
  e.preventDefault();
  const pin  = $('returnPin').value.trim();
  const code = $('returnFamilyCode').value.trim().toUpperCase();

  const savedPin = localStorage.getItem(LS.userPin);
  if (!savedPin) { setMsg('authMessage', 'No account found. Create one first.'); return; }
  if (!pinMatches(pin, savedPin)) { setMsg('authMessage', 'Incorrect PIN.'); return; }

  currentUser = {
    id:   localStorage.getItem(LS.userId),
    name: localStorage.getItem(LS.userName),
    pin:  savedPin,
  };

  if (code) {
    await joinFamily(code, 'authMessage');
  } else {
    const saved = localStorage.getItem(LS.familyCode);
    if (saved) { await goToFamily(saved); }
    else        { showScreen('noFamilyScreen'); bindNoFamilyScreen(); }
  }
}

// ── NO-FAMILY SCREEN ──────────────────────────────────────────
function bindNoFamilyScreen() {
  // Clone to avoid double-binding on re-visits
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
  if (db) {
    const snap = await db.ref(`families/${code}`).get();
    if (!snap.exists()) { setMsg(msgId, 'Family code not found. Check the code and try again.'); return; }
    await db.ref(`userFamilies/${currentUser.id}/${code}`).set({ joinedAt: Date.now() });
    await db.ref(`familyMembers/${code}/${currentUser.id}`).set({ name: currentUser.name, joinedAt: Date.now() });
  }
  localStorage.setItem(LS.familyCode, code);
  await goToFamily(code);
}

// ── CREATE FAMILY DIALOG ──────────────────────────────────────
function bindCreateFamilyDialog() {
  $('createFamilyForm').onsubmit = e => {
    e.preventDefault();
    const name = $('cfName').value.trim();
    if (!name) return;
    $('cfStep1').classList.add('hidden');
    $('cfStep2').classList.remove('hidden');
    $('cfFamilyNameDisplay').textContent = '\u201c' + name + '\u201d';
  };

  $('createListForm').onsubmit = async e => {
    e.preventDefault();
    const familyName = $('cfName').value.trim();
    const familyDesc = $('cfDescription').value.trim();
    const listName   = $('clListName').value.trim();
    const email      = $('clEmail').value.trim();
    const password   = $('clPassword').value.trim();
    const msg        = $('createListMessage');

    if (password.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }

    msg.textContent = 'Creating your family...';

    try {
      let ownerUid = null;
      if (auth) {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        ownerUid = cred.user.uid;
        await auth.signOut();
      }

      let code = makeFamilyCode();
      if (db) {
        while ((await db.ref(`families/${code}`).get()).exists()) code = makeFamilyCode();

        const listId = db.ref('lists').push().key;

        await db.ref(`families/${code}`).set({
          name: familyName,
          description: familyDesc,
          disclaimer: 'All of the lists in this family could have items on them that do not link to big sellers, companies, or brands like Amazon, Walmart, or Etsy. The responsibility is upon the owner of the list to view, examine, and determine if the links are safe to buy from. Any issues that come about from the used links do not fall back to the developer of the site',
          adminUserId: currentUser.id,
          createdAt: Date.now(),
        });

        await db.ref(`lists/${listId}`).set({
          familyCode: code,
          name: listName,
          ownerUid,
          ownerEmail: email,
          createdAt: Date.now(),
          interestNote: '',
          quickNote: '',
        });

        await db.ref(`userFamilies/${currentUser.id}/${code}`).set({ joinedAt: Date.now() });
        await db.ref(`familyMembers/${code}/${currentUser.id}`).set({ name: currentUser.name, joinedAt: Date.now() });
      }

      localStorage.setItem(LS.familyCode, code);
      $('createFamilyDialog').close();
      resetCreateDialog();
      await goToFamily(code);

    } catch (err) {
      msg.textContent = err.message || 'Something went wrong. Try again.';
    }
  };

  $('cfBack').onclick = () => {
    $('cfStep1').classList.remove('hidden');
    $('cfStep2').classList.add('hidden');
  };

  $('cfCancel').onclick = () => {
    $('createFamilyDialog').close();
    resetCreateDialog();
  };

  $('createFamilyDialog').addEventListener('click', e => {
    if (e.target === $('createFamilyDialog')) { $('createFamilyDialog').close(); resetCreateDialog(); }
  });
}

function resetCreateDialog() {
  $('cfStep1').classList.remove('hidden');
  $('cfStep2').classList.add('hidden');
  $('createFamilyForm').reset();
  $('createListForm').reset();
  $('createListMessage').textContent = '';
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

    if (password.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }
    msg.textContent = 'Creating list...';

    try {
      let ownerUid = null;
      if (auth) {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        ownerUid = cred.user.uid;
        await auth.signOut();
      }
      if (db) {
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
      }
      $('addListDialog').close();
    } catch (err) {
      msg.textContent = err.message || 'Something went wrong.';
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

  const snap = await db.ref(`families/${code}`).get();
  if (!snap.exists()) {
    setMsg('authMessage', 'Family not found. Try a different code.');
    localStorage.removeItem(LS.familyCode);
    showScreen('welcomeScreen');
    bindWelcomeScreen();
    return;
  }

  currentFamily = { code, ...snap.val() };
  renderFamilyHeader();
  showScreen('familyScreen');
  setSyncStatus('online', 'Connected');

  db.ref('lists').orderByChild('familyCode').equalTo(code).on('value', snap => {
    renderListCards(snap.val() || {});
  });
}

function renderFamilyHeader() {
  $('familyPageName').textContent = currentFamily.name;
  $('familyPageCode').textContent = currentFamily.code;
  const descWrap = $('familyPageDescWrap');
  if (currentFamily.description) {
    $('familyPageDesc').textContent = currentFamily.description;
    descWrap.classList.remove('hidden');
  } else {
    descWrap.classList.add('hidden');
  }
}

function renderListCards(lists) {
  const container = $('familyListCards');
  container.innerHTML = '';

  const entries = Object.entries(lists);

  if (!entries.length) {
    container.innerHTML = `<p class="empty-note">No lists yet — use <strong>+ New list</strong> to create one.</p>`;
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
}

// ── RELATION DIALOG ───────────────────────────────────────────
function handleListClick(listId, list) {
  const relKey = `wishyy.rel.${listId}`;
  const saved  = localStorage.getItem(relKey);

  if (saved !== null) {
    openList(listId, list);
    return;
  }

  $('relListName').textContent = list.name;
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
  localStorage.setItem('wishyy.listId', listId);

  const rel = localStorage.getItem(`wishyy.rel.${listId}`);
  $('helloText').textContent = rel
    ? `Welcome, ${currentUser.name} (${rel})`
    : `Welcome, ${currentUser.name}`;

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
    $('interestText').textContent = data.interestNote || '';
    $('interestSection').classList.toggle('hidden', !data.interestNote);
    const hasNote = !!data.quickNote;
    if (hasNote) $('quickNoteText').textContent = data.quickNote;
    $('disclaimerStrip').classList.toggle('hidden', !hasNote);
  });
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
      ? (isMine ? `<button class="ghost-button undo-btn" data-id="${id}">Undo bought</button>` : `<span class="bought-label">Bought</span>`)
      : `<button class="primary-button buy-btn" data-id="${id}" data-name="${gift.name}">I bought this</button>`;

    const ownerHtml = ownerActive
      ? `<button class="ghost-button edit-btn" data-id="${id}">Edit</button>
         <button class="danger-button delete-btn" data-id="${id}">Delete</button>`
      : '';

    card.innerHTML = `
      <div class="gift-main">
        <div>
          <div class="gift-title-wrap">${titleHtml}${previewHtml}</div>
          ${gift.store || gift.price ? `<p class="meta">${[gift.store, fmtPrice(gift.price)].filter(Boolean).join(' · ')}</p>` : ''}
          ${gift.note ? `<p class="note">${gift.note}</p>` : ''}
        </div>
        <span class="price">${fmtPrice(gift.price)}</span>
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
  const dialog = $('buyDialog');
  dialog.showModal();

  $('confirmBoughtButton').onclick = async () => {
    dialog.close();
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
    if (ownerActive) {
      showOwnerPanel();
    } else {
      $('ownerUnlockForm').classList.remove('hidden');
      $('ownerPanel').classList.add('hidden');
      $('ownerMessage').textContent = '';
      $('ownerDialog').showModal();
    }
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
      const cred = await auth.signInWithEmailAndPassword(email, password);
      if (currentList.ownerUid && cred.user.uid !== currentList.ownerUid) {
        await auth.signOut();
        msg.textContent = 'These credentials are not the owner of this list.';
        return;
      }
      saveOwnerSession(currentList.id);
      ownerActive = true;
      showOwnerPanel();
      renderGifts();
    } catch {
      msg.textContent = 'Incorrect email or password.';
    }
  });

  $('saveInterestButton').addEventListener('click', async () => {
    if (!db || !currentList) return;
    await db.ref(`lists/${currentList.id}`).update({ interestNote: $('ownerInterest').value });
  });

  $('giftForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!db || !currentList) return;
    const editId = $('giftForm').dataset.editId;
    const data = {
      name:  $('giftName').value.trim(),
      price: parseFloat($('giftPrice').value) || 0,
      store: $('giftStore').value.trim(),
      url:   $('giftUrl').value.trim(),
      image: $('giftImage').value.trim(),
      note:  $('giftNote').value.trim(),
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
  });

  $('cancelEditButton').addEventListener('click', () => {
    $('giftForm').reset();
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
    db.ref(`lists/${currentList.id}/interestNote`).get()
      .then(s => { $('ownerInterest').value = s.val() || ''; });
  }

  const giftsList = $('ownerGiftsList');
  giftsList.innerHTML = '';
  Object.entries(giftsData).forEach(([id, g]) => {
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

  if (!Object.keys(giftsData).length) {
    giftsList.innerHTML = '<p style="color:var(--muted);margin:0">No gifts yet.</p>';
  }
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
  $('giftForm').dataset.editId = id;
  $('giftSubmitButton').textContent = 'Save changes';
  $('cancelEditButton').classList.remove('hidden');
  $('giftName').focus();
}

async function deleteGift(id) {
  if (!db || !currentList) return;
  if (confirm('Delete this gift?')) await db.ref(`gifts/${currentList.id}/${id}`).remove();
}

// ── SIGN OUT ──────────────────────────────────────────────────
function hardSignOut() {
  // Signs out of everything — account + owner tools
  clearOwnerSession();
  if (giftsRef) { giftsRef.off(); giftsRef = null; }
  currentList = currentFamily = currentUser = null;
  giftsData = {};
  ownerActive = false;

  localStorage.removeItem(LS.userId);
  localStorage.removeItem(LS.userName);
  localStorage.removeItem(LS.userPin);
  localStorage.removeItem(LS.familyCode);
  localStorage.removeItem('wishyy.listId');

  showScreen('welcomeScreen');
  $('createTab').classList.add('active');
  $('returnTab').classList.remove('active');
  $('createForm').classList.remove('hidden');
  $('returnForm').classList.add('hidden');
  setMsg('authMessage', '');
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
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindCreateFamilyDialog();
  bindFamilyPage();
  bindOwnerTools();
  bindGiftControls();
  await boot();
});