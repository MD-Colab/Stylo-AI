'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   FUMA Invoice — /invoice/builder/script.js
   Fixes & new features:
   ✅ Currency symbols: plain JS literals (no encoding bug)
   ✅ Mobile: "Preview" toggle button in form to show/hide the live preview
   ✅ Save & Send: saves invoice to Firestore AND opens WhatsApp with invoice
      image (captured via html2canvas) + pay link
   ✅ WhatsApp button: captures invoice preview as image → downloads + opens WA
   ✅ Copy Pay Link: copies shareable payment link
   ✅ Share Link modal button: captures invoice image and shares via WhatsApp
   ✅ Client picker / Product picker / Template switcher / recalc — all intact
   ✅ saveDraft: saves without sending
   ✅ exportPDF: html2canvas → jsPDF
   ✅ Edit mode: pre-fills form when ?id= is in URL
══════════════════════════════════════════════════════════════════════════ */

/* ── Firebase ─────────────────────────────────────────────────────────── */
const _fc = {
  apiKey:            'AIzaSyDQ097vz04Oj7QpHIZKNR9KVp5L0U03Fio',
  authDomain:        'md-colab-63228.firebaseapp.com',
  projectId:         'md-colab-63228',
  storageBucket:     'md-colab-63228.firebasestorage.app',
  messagingSenderId: '568580723297',
  appId:             '1:568580723297:web:1426515deda2d3d0a45020',
};
if (!firebase.apps.length) firebase.initializeApp(_fc);
const db   = firebase.firestore();
const auth = firebase.auth();

/* ── Constants ────────────────────────────────────────────────────────── */
const CSYM = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' };

const TEMPLATES = {
  modern: {
    '--inv-accent':    '#FF6F00',
    '--inv-accent-lt': '#FFF3E0',
    '--inv-header-bg': '#FF6F00',
    '--inv-header-fg': '#FFFFFF',
    '--inv-border':    '#FFE0B2',
    '--inv-font':      "'Segoe UI', sans-serif",
    '--inv-radius':    '8px',
  },
  minimal: {
    '--inv-accent':    '#1F2937',
    '--inv-accent-lt': '#F9FAFB',
    '--inv-header-bg': '#FFFFFF',
    '--inv-header-fg': '#1F2937',
    '--inv-border':    '#E5E7EB',
    '--inv-font':      "'IBM Plex Sans', sans-serif",
    '--inv-radius':    '0px',
  },
  corporate: {
    '--inv-accent':    '#1E40AF',
    '--inv-accent-lt': '#EFF6FF',
    '--inv-header-bg': '#1E3A8A',
    '--inv-header-fg': '#FFFFFF',
    '--inv-border':    '#BFDBFE',
    '--inv-font':      "'Poppins', sans-serif",
    '--inv-radius':    '4px',
  },
};

/* ── State ────────────────────────────────────────────────────────────── */
let currentUser    = null;
let editingId      = null;
let currentTpl     = 'modern';
let lineItems      = [];
let allClients     = [];
let allProducts    = [];
let settings       = {};

/* ═══════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  /* Default dates */
  const today = new Date();
  const due30 = new Date(today); due30.setDate(due30.getDate() + 30);
  document.getElementById('inv-date').value = fmtInputDate(today);
  document.getElementById('inv-due').value  = fmtInputDate(due30);

  /* Auto invoice number */
  document.getElementById('inv-number').value = `INV-${String(Date.now()).slice(-6)}`;

  /* Template pills (topbar) — sync */
  document.querySelectorAll('.tpl-pill').forEach(p =>
    p.addEventListener('click', () => setTemplate(p.dataset.tpl))
  );

  /* Live preview on any input change */
  document.getElementById('builder-form').addEventListener('input', renderPreview);
  document.getElementById('builder-form').addEventListener('change', renderPreview);

  /* Currency change → recalc */
  document.getElementById('inv-currency').addEventListener('change', recalc);

  /* Mobile preview toggle */
  injectMobilePreviewToggle();

  /* Add first line item */
  addItem();

  /* Auth */
  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = '../auth/'; return; }
    currentUser = user;
    await loadSettings();
    await loadClientsAndProducts();
    checkEditMode();
    renderPreview();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   MOBILE PREVIEW TOGGLE
   On <1024px the right panel is hidden by CSS.
   We inject a floating "👁 Preview" button into the form panel.
═══════════════════════════════════════════════════════════════════════ */
function injectMobilePreviewToggle() {
  const btn = document.createElement('button');
  btn.id        = 'mobile-preview-btn';
  btn.className = 'btn btn-secondary';
  btn.innerHTML = '<i class="fas fa-eye"></i> Preview Invoice';
  btn.style.cssText = `
    position:fixed;bottom:1.5rem;right:1.5rem;z-index:300;
    box-shadow:0 4px 20px rgba(0,0,0,.18);
    display:none;
  `;

  const wrap = document.getElementById('builder-preview-wrap') || document.querySelector('.builder-preview-wrap');

  btn.addEventListener('click', () => {
    const isVisible = wrap && wrap.style.display === 'flex';
    if (wrap) {
      wrap.style.display    = isVisible ? '' : 'flex';
      wrap.style.position   = 'fixed';
      wrap.style.inset      = '0';
      wrap.style.zIndex     = '400';
      wrap.style.overflowY  = 'auto';
      wrap.style.background = '#E5E7EB';
    }
    btn.innerHTML = isVisible
      ? '<i class="fas fa-eye"></i> Preview Invoice'
      : '<i class="fas fa-times"></i> Close Preview';
    if (!isVisible) renderPreview();
  });

  document.body.appendChild(btn);

  /* Show/hide based on viewport */
  const mq = window.matchMedia('(max-width:1023px)');
  const toggle = q => { btn.style.display = q.matches ? 'inline-flex' : 'none'; };
  toggle(mq);
  mq.addEventListener('change', toggle);

  /* Close preview when clicking outside the preview wrap */
  document.addEventListener('click', e => {
    if (wrap && wrap.style.position === 'fixed') {
      if (!wrap.contains(e.target) && e.target !== btn) {
        wrap.style.display  = '';
        wrap.style.position = '';
        wrap.style.inset    = '';
        wrap.style.zIndex   = '';
        btn.innerHTML = '<i class="fas fa-eye"></i> Preview Invoice';
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   SETTINGS LOAD
═══════════════════════════════════════════════════════════════════════ */
async function loadSettings() {
  try {
    const snap = await db.collection('invoice_settings').doc(currentUser.uid).get();
    if (snap.exists) {
      settings = snap.data();
      const addr = [settings.address?.street, settings.address?.city,
                    settings.address?.state, settings.address?.pincode]
        .filter(Boolean).join(', ');

      setVal('biz-name',    settings.businessName || '');
      setVal('biz-email',   settings.companyEmail || settings.businessEmail || '');
      setVal('biz-phone',   settings.businessPhone || '');
      setVal('biz-address', addr);
      setVal('biz-gst',     settings.taxId || settings.gstNumber || '');
      setVal('biz-logo',    settings.logoUrl || '');
    }
  } catch (e) { console.warn('Settings load:', e); }
}

/* ═══════════════════════════════════════════════════════════════════════
   CLIENTS & PRODUCTS
═══════════════════════════════════════════════════════════════════════ */
async function loadClientsAndProducts() {
  try {
    const [cSnap, pSnap] = await Promise.all([
      db.collection('customers').where('ownerId', '==', currentUser.uid).get(),
      db.collection('products' ).where('ownerId', '==', currentUser.uid).get(),
    ]);
    allClients  = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allProducts = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('Load clients/products:', e); }
}

/* ── Client picker ─────────────────────────────────────────────────── */
function openClientPicker() {
  renderPickerList('client');
  document.getElementById('client-picker-modal').classList.add('open');
}
window.openClientPicker = openClientPicker;

function renderPickerList(type) {
  const listId  = type === 'client' ? 'client-picker-list'  : 'product-picker-list';
  const searchId = type === 'client' ? 'client-picker-search' : 'product-picker-search';
  const items   = type === 'client' ? allClients : allProducts;
  const el      = document.getElementById(listId);
  const q       = (document.getElementById(searchId)?.value || '').toLowerCase();

  const filtered = items.filter(i =>
    (i.name || i.businessName || i.title || '').toLowerCase().includes(q)
  );

  if (!filtered.length) { el.innerHTML = '<p style="padding:1rem;color:var(--muted)">No results found.</p>'; return; }

  el.innerHTML = filtered.map(i => {
    if (type === 'client') {
      const name = i.name || i.businessName || '';
      return `<div class="picker-item" onclick="selectClient(${JSON.stringify(JSON.stringify(i))})">
        <div class="pi-icon">${name.charAt(0).toUpperCase()}</div>
        <div><div class="pi-name">${esc(name)}</div><div class="pi-sub">${esc(i.email || '')}</div></div>
      </div>`;
    } else {
      const name  = i.title || i.name || '';
      const price = i.price || i.sellingPrice || 0;
      const cur   = getVal('inv-currency') || 'INR';
      return `<div class="picker-item" onclick="selectProduct(${JSON.stringify(JSON.stringify(i))})">
        <div class="pi-icon"><i class="fas fa-box"></i></div>
        <div><div class="pi-name">${esc(name)}</div><div class="pi-sub">${esc(i.category || '')}</div></div>
        <div class="pi-price">${CSYM[cur] || '₹'}${price}</div>
      </div>`;
    }
  }).join('');

  /* Search live filter */
  document.getElementById(searchId).oninput = () => renderPickerList(type);
}

function selectClient(jsonStr) {
  const c = JSON.parse(jsonStr);
  setVal('client-name',    c.name || c.businessName || '');
  setVal('client-email',   c.email || '');
  setVal('client-phone',   c.phone || c.mobile || '');
  setVal('client-address', c.address || '');
  setVal('client-gst',     c.gstNumber || '');
  document.getElementById('client-picker-modal').classList.remove('open');
  renderPreview();
}
window.selectClient = selectClient;

/* ── Product picker ────────────────────────────────────────────────── */
function openProductPicker() {
  renderPickerList('product');
  document.getElementById('product-picker-modal').classList.add('open');
}
window.openProductPicker = openProductPicker;

function selectProduct(jsonStr) {
  const p = JSON.parse(jsonStr);
  addItem({
    desc:  p.title || p.name || '',
    qty:   1,
    unit:  p.unit || 'pcs',
    price: p.price || p.sellingPrice || 0,
    tax:   p.taxRate || p.tax || 0,
  });
  document.getElementById('product-picker-modal').classList.remove('open');
}
window.selectProduct = selectProduct;

/* ═══════════════════════════════════════════════════════════════════════
   LINE ITEMS
═══════════════════════════════════════════════════════════════════════ */
function addItem(data = {}) {
  const id  = Date.now() + Math.random();
  lineItems.push({ id, desc: data.desc||'', qty: data.qty||1, unit: data.unit||'pcs', price: data.price||0, tax: data.tax||0, total:0 });
  renderItemsTable();
  recalc();
}
window.addItem = addItem;

function removeItem(id) {
  lineItems = lineItems.filter(i => i.id !== id);
  renderItemsTable();
  recalc();
}
window.removeItem = removeItem;

function renderItemsTable() {
  const tbody = document.getElementById('items-body');
  tbody.innerHTML = lineItems.map(item => `
    <tr data-id="${item.id}">
      <td><input type="text"   class="item-desc"  value="${esc(item.desc)}"  placeholder="Item description" oninput="updateItem(${item.id},'desc',this.value)"></td>
      <td><input type="number" class="item-qty"   value="${item.qty}"   min="0.01" step="0.01" oninput="updateItem(${item.id},'qty',this.value)"></td>
      <td><input type="text"   class="item-unit"  value="${esc(item.unit)}"  placeholder="pcs" oninput="updateItem(${item.id},'unit',this.value)"></td>
      <td><input type="number" class="item-price" value="${item.price}" min="0" step="0.01" oninput="updateItem(${item.id},'price',this.value)"></td>
      <td><input type="number" class="item-tax"   value="${item.tax}"   min="0" max="100" step="0.01" oninput="updateItem(${item.id},'tax',this.value)"></td>
      <td><span class="item-total">${fmtAmt(item.total, getVal('inv-currency'))}</span></td>
      <td><button class="del-item-btn" onclick="removeItem(${item.id})" title="Remove"><i class="fas fa-times"></i></button></td>
    </tr>
  `).join('');
}

function updateItem(id, field, val) {
  const item = lineItems.find(i => i.id === id);
  if (!item) return;
  item[field] = (field === 'desc' || field === 'unit') ? val : parseFloat(val) || 0;
  recalc();
}
window.updateItem = updateItem;

/* ═══════════════════════════════════════════════════════════════════════
   RECALC TOTALS
═══════════════════════════════════════════════════════════════════════ */
function recalc() {
  const cur      = getVal('inv-currency') || 'INR';
  const discPct  = parseFloat(document.getElementById('discount-pct')?.value || 0);
  const shipping = parseFloat(document.getElementById('shipping')?.value      || 0);

  let subtotal = 0;
  let taxTotal = 0;

  lineItems.forEach(item => {
    const lineBase = (item.qty || 0) * (item.price || 0);
    const lineTax  = lineBase * ((item.tax || 0) / 100);
    item.total     = lineBase + lineTax;
    subtotal      += lineBase;
    taxTotal      += lineTax;
  });

  const discAmt = subtotal * (discPct / 100);
  const grand   = subtotal - discAmt + taxTotal + shipping;

  setText('t-subtotal', fmtAmt(subtotal, cur));
  setText('t-discount',  fmtAmt(discAmt,  cur));
  setText('t-tax',       fmtAmt(taxTotal, cur));
  setText('t-shipping',  fmtAmt(shipping, cur));
  setText('t-total',     fmtAmt(grand,    cur));

  /* Re-render item totals */
  document.querySelectorAll('#items-body tr').forEach(tr => {
    const id   = parseFloat(tr.dataset.id);
    const item = lineItems.find(i => i.id === id);
    if (item) {
      const span = tr.querySelector('.item-total');
      if (span) span.textContent = fmtAmt(item.total, cur);
    }
  });

  renderPreview();
}
window.recalc = recalc;

/* ═══════════════════════════════════════════════════════════════════════
   TEMPLATE
═══════════════════════════════════════════════════════════════════════ */
function setTemplate(tpl) {
  if (!TEMPLATES[tpl]) return;
  currentTpl = tpl;

  document.querySelectorAll('.tpl-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.tpl === tpl);
  });

  const preview = document.getElementById('invoice-preview');
  if (preview) {
    const vars = TEMPLATES[tpl];
    Object.entries(vars).forEach(([k, v]) => preview.style.setProperty(k, v));
  }

  renderPreview();
}
window.setTemplate = setTemplate;

/* ═══════════════════════════════════════════════════════════════════════
   LIVE PREVIEW RENDERER
═══════════════════════════════════════════════════════════════════════ */
function renderPreview() {
  const preview = document.getElementById('invoice-preview');
  if (!preview) return;

  /* Apply template vars */
  const vars = TEMPLATES[currentTpl] || TEMPLATES.modern;
  Object.entries(vars).forEach(([k, v]) => preview.style.setProperty(k, v));

  const cur  = getVal('inv-currency') || 'INR';
  const sym  = CSYM[cur] || '₹';
  const discPct  = parseFloat(document.getElementById('discount-pct')?.value || 0);
  const shipping = parseFloat(document.getElementById('shipping')?.value      || 0);

  let subtotal = 0, taxTotal = 0;
  lineItems.forEach(i => {
    const base = (i.qty || 0) * (i.price || 0);
    subtotal  += base;
    taxTotal  += base * ((i.tax || 0) / 100);
  });
  const discAmt = subtotal * (discPct / 100);
  const grand   = subtotal - discAmt + taxTotal + shipping;

  const logoUrl  = getVal('biz-logo');
  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" style="max-height:48px;max-width:120px;object-fit:contain;border-radius:4px" onerror="this.remove()">`
    : '';

  preview.innerHTML = `
    <div class="prv-header">
      <div>
        ${logoHtml}
        <div class="prv-logo-name">${esc(getVal('biz-name') || 'Your Business')}</div>
        <div class="prv-logo-sub">${esc(getVal('biz-email') || '')} ${getVal('biz-phone') ? '· ' + esc(getVal('biz-phone')) : ''}</div>
        ${getVal('biz-gst') ? `<div class="prv-logo-sub">GST: ${esc(getVal('biz-gst'))}</div>` : ''}
      </div>
      <div>
        <div class="prv-inv-title">INVOICE</div>
        <div class="prv-inv-num">${esc(getVal('inv-number') || 'INV-0001')}</div>
        ${getVal('inv-po') ? `<div class="prv-inv-num">PO: ${esc(getVal('inv-po'))}</div>` : ''}
      </div>
    </div>

    <div class="prv-meta">
      <div class="prv-meta-block">
        <h4>Bill To</h4>
        <p><strong>${esc(getVal('client-name') || 'Client Name')}</strong><br>
        ${esc(getVal('client-email') || '')}${getVal('client-phone') ? '<br>' + esc(getVal('client-phone')) : ''}
        ${getVal('client-address') ? '<br>' + esc(getVal('client-address')) : ''}
        ${getVal('client-gst') ? '<br>GST: ' + esc(getVal('client-gst')) : ''}</p>
      </div>
      <div class="prv-meta-block">
        <h4>From</h4>
        <p><strong>${esc(getVal('biz-name') || 'Your Business')}</strong><br>
        ${getVal('biz-address') ? esc(getVal('biz-address')) : ''}</p>
      </div>
    </div>

    <div class="prv-dates">
      <div class="prv-date-item">Issue Date: <span>${esc(getVal('inv-date') || '—')}</span></div>
      <div class="prv-date-item">Due Date: <span>${esc(getVal('inv-due') || '—')}</span></div>
    </div>

    <div class="prv-items">
      <table class="prv-items-table">
        <thead><tr>
          <th>Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>Tax%</th><th>Total</th>
        </tr></thead>
        <tbody>
          ${lineItems.length
            ? lineItems.map(i => `<tr>
                <td>${esc(i.desc || '—')}</td>
                <td>${i.qty}</td>
                <td>${esc(i.unit || '')}</td>
                <td>${sym}${Number(i.price || 0).toFixed(2)}</td>
                <td>${i.tax || 0}%</td>
                <td>${sym}${Number(i.total || 0).toFixed(2)}</td>
              </tr>`).join('')
            : `<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:12px">No items added yet</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <div class="prv-totals">
      <div class="prv-totals-inner">
        <div class="prv-total-row"><span>Subtotal</span><span>${sym}${subtotal.toFixed(2)}</span></div>
        ${discAmt > 0 ? `<div class="prv-total-row"><span>Discount (${discPct}%)</span><span>-${sym}${discAmt.toFixed(2)}</span></div>` : ''}
        ${taxTotal > 0 ? `<div class="prv-total-row"><span>Tax</span><span>${sym}${taxTotal.toFixed(2)}</span></div>` : ''}
        ${shipping > 0 ? `<div class="prv-total-row"><span>Shipping</span><span>${sym}${shipping.toFixed(2)}</span></div>` : ''}
        <div class="prv-total-row prv-total-grand"><span>Total Due</span><span>${sym}${grand.toFixed(2)}</span></div>
      </div>
    </div>

    ${getVal('inv-notes') || getVal('inv-terms') ? `
      <div class="prv-notes">
        ${getVal('inv-notes')  ? `<strong>Notes:</strong> ${esc(getVal('inv-notes'))}<br>` : ''}
        ${getVal('inv-terms') ? `<strong>Terms:</strong> ${esc(getVal('inv-terms'))}` : ''}
      </div>` : ''}

    <div class="prv-footer">⚡ Generated by FUMA Invoice · fumatechnologies.vercel.app</div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════
   COLLECT FORM DATA
═══════════════════════════════════════════════════════════════════════ */
function collectInvoiceData(status = 'Pending') {
  const cur      = getVal('inv-currency') || 'INR';
  const discPct  = parseFloat(document.getElementById('discount-pct')?.value || 0);
  const shipping = parseFloat(document.getElementById('shipping')?.value      || 0);

  let subtotal = 0, taxTotal = 0;
  lineItems.forEach(i => {
    const base = (i.qty || 0) * (i.price || 0);
    subtotal  += base;
    taxTotal  += base * ((i.tax || 0) / 100);
  });
  const discAmt  = subtotal * (discPct / 100);
  const amountDue = subtotal - discAmt + taxTotal + shipping;

  const invDate = getVal('inv-date');
  const invDue  = getVal('inv-due');

  return {
    ownerId:      currentUser.uid,
    number:       getVal('inv-number'),
    businessName: getVal('biz-name'),
    businessEmail:getVal('biz-email'),
    businessPhone:getVal('biz-phone'),
    businessAddress: getVal('biz-address'),
    businessGst:  getVal('biz-gst'),
    logoUrl:      getVal('biz-logo'),
    clientName:   getVal('client-name'),
    clientEmail:  getVal('client-email'),
    clientPhone:  getVal('client-phone'),
    clientAddress:getVal('client-address'),
    clientGst:    getVal('client-gst'),
    currency:     cur,
    poNumber:     getVal('inv-po'),
    invoiceDate:  invDate  || null,
    dueDate:      invDue   || null,
    items:        lineItems.map(({ id, ...rest }) => rest),
    subtotal,
    discountPct:  discPct,
    discountAmt:  discAmt,
    taxTotal,
    shipping,
    amountDue,
    total:        amountDue,
    notes:        getVal('inv-notes'),
    terms:        getVal('inv-terms'),
    template:     currentTpl,
    status,
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    ...(editingId ? {} : { createdAt: firebase.firestore.FieldValue.serverTimestamp() }),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   SAVE DRAFT (no sending)
═══════════════════════════════════════════════════════════════════════ */
async function saveDraft() {
  if (!validate()) return;
  showToast('Saving draft…', 'info');
  try {
    const data = collectInvoiceData('Draft');
    if (editingId) {
      await db.collection('invoices').doc(editingId).update(data);
    } else {
      const ref = await db.collection('invoices').add(data);
      editingId = ref.id;
      history.replaceState(null, '', `?id=${editingId}`);
    }
    showToast('Draft saved!', 'success');
    document.getElementById('builder-title').textContent = 'Edit Invoice';
  } catch (e) {
    console.error(e);
    showToast('Failed to save draft: ' + e.message, 'error');
  }
}
window.saveDraft = saveDraft;

/* ═══════════════════════════════════════════════════════════════════════
   SAVE INVOICE + CAPTURE IMAGE + SEND WHATSAPP
   "Save & Send" button
═══════════════════════════════════════════════════════════════════════ */
async function saveInvoice() {
  if (!validate()) return;
  showToast('Saving invoice…', 'info');

  try {
    const data = collectInvoiceData('Pending');
    let docId  = editingId;

    if (docId) {
      await db.collection('invoices').doc(docId).update(data);
    } else {
      const ref = await db.collection('invoices').add(data);
      docId = ref.id;
      editingId = docId;
      history.replaceState(null, '', `?id=${docId}`);
    }

    showToast('Invoice saved! Preparing to share…', 'success');
    document.getElementById('builder-title').textContent = 'Edit Invoice';

    /* Capture invoice image & open WhatsApp */
    await shareViaWhatsApp(docId, data, true);

  } catch (e) {
    console.error(e);
    showToast('Error: ' + e.message, 'error');
  }
}
window.saveInvoice = saveInvoice;

/* ═══════════════════════════════════════════════════════════════════════
   CAPTURE INVOICE PREVIEW AS IMAGE (html2canvas)
   Returns a data-URL (PNG).
═══════════════════════════════════════════════════════════════════════ */
async function captureInvoiceImage() {
  /* Make sure preview is rendered */
  renderPreview();

  const preview = document.getElementById('invoice-preview');
  if (!preview) throw new Error('Preview element not found');

  /* Temporarily make preview visible if hidden on mobile */
  const prevWrap = document.querySelector('.builder-preview-wrap');
  let wasHidden  = false;
  if (prevWrap && getComputedStyle(prevWrap).display === 'none') {
    prevWrap.style.display   = 'block';
    prevWrap.style.position  = 'fixed';
    prevWrap.style.left      = '-9999px';
    prevWrap.style.top       = '0';
    prevWrap.style.zIndex    = '-1';
    wasHidden = true;
  }

  try {
    const canvas = await html2canvas(preview, {
      scale:           2,
      useCORS:         true,
      backgroundColor: '#ffffff',
      logging:         false,
      width:           preview.offsetWidth  || 500,
      height:          preview.scrollHeight || 700,
    });
    return canvas.toDataURL('image/png');
  } finally {
    if (wasHidden && prevWrap) {
      prevWrap.style.display  = '';
      prevWrap.style.position = '';
      prevWrap.style.left     = '';
      prevWrap.style.top      = '';
      prevWrap.style.zIndex   = '';
    }
  }
}

/* ── Download image locally ─────────────────────────────────────────── */
function downloadInvoiceImage(dataUrl, invoiceNum) {
  const a    = document.createElement('a');
  a.href     = dataUrl;
  a.download = `Invoice-${invoiceNum || 'FUMA'}.png`;
  a.click();
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARE VIA WHATSAPP
   1. Capture image → auto-download (saved to device)
   2. Open WhatsApp with pay link + instructions to attach the downloaded image
═══════════════════════════════════════════════════════════════════════ */
async function shareViaWhatsApp(docId, data, autoSave = false) {
  try {
    showToast('Capturing invoice image…', 'info');

    const imgDataUrl    = await captureInvoiceImage();
    const invNum        = data?.number || getVal('inv-number') || 'Invoice';
    const clientName    = data?.clientName || getVal('client-name') || 'Client';
    const clientPhone   = (data?.clientPhone || getVal('client-phone') || '').replace(/\D/g, '');
    const cur           = data?.currency || getVal('inv-currency') || 'INR';
    const sym           = CSYM[cur] || '₹';
    const amount        = data?.amountDue ?? parseFloat(document.getElementById('t-total')?.textContent?.replace(/[^\d.]/g, '') || 0);
    const dueDate       = data?.dueDate   || getVal('inv-due') || '';
    const payUrl        = `${window.location.origin}/invoice/pay/?id=${docId || editingId}`;
    const bizName       = data?.businessName || getVal('biz-name') || 'Us';

    /* Auto-download image so user can attach it on WhatsApp */
    downloadInvoiceImage(imgDataUrl, invNum);

    /* WhatsApp message */
    const msg = `Hello ${clientName},\n\nPlease find your invoice *${invNum}* from *${bizName}*.\n\n💰 *Amount Due:* ${sym}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n📅 *Due Date:* ${dueDate || '—'}\n\n✅ *Pay securely here:*\n${payUrl}\n\n📎 _(The invoice image has been downloaded — please attach it to this message)_\n\nThank you!`;

    const waUrl = clientPhone
      ? `https://wa.me/${clientPhone.startsWith('91') ? clientPhone : '91' + clientPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    showToast('Invoice image downloaded! Opening WhatsApp…', 'success');
    setTimeout(() => window.open(waUrl, '_blank'), 800);

  } catch (e) {
    console.error('WhatsApp share error:', e);
    showToast('Could not capture image: ' + e.message, 'error');
  }
}

/* ── WhatsApp button (standalone) ──────────────────────────────────── */
async function sendWhatsApp() {
  if (!editingId) {
    /* Save first */
    if (!validate()) return;
    showToast('Saving invoice first…', 'info');
    try {
      const data = collectInvoiceData('Pending');
      const ref  = await db.collection('invoices').add(data);
      editingId  = ref.id;
      history.replaceState(null, '', `?id=${editingId}`);
      await shareViaWhatsApp(editingId, data);
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
    return;
  }
  const data = collectInvoiceData('Pending');
  await shareViaWhatsApp(editingId, data);
}
window.sendWhatsApp = sendWhatsApp;

/* ═══════════════════════════════════════════════════════════════════════
   COPY PAY LINK
═══════════════════════════════════════════════════════════════════════ */
async function copyPayLink() {
  if (!editingId) {
    if (!validate()) return;
    showToast('Saving invoice…', 'info');
    try {
      const data = collectInvoiceData('Pending');
      const ref  = await db.collection('invoices').add(data);
      editingId  = ref.id;
      history.replaceState(null, '', `?id=${editingId}`);
    } catch (e) {
      showToast('Error saving: ' + e.message, 'error');
      return;
    }
  }
  const link = `${window.location.origin}/invoice/pay/?id=${editingId}`;
  try {
    await navigator.clipboard.writeText(link);
    showToast('Pay link copied! 📋', 'success');
  } catch {
    prompt('Copy this pay link:', link);
  }
}
window.copyPayLink = copyPayLink;

/* ═══════════════════════════════════════════════════════════════════════
   MODAL "Share Link" BUTTON  — capture image + share
═══════════════════════════════════════════════════════════════════════ */
/* This is wired in the invoices list page's modal — we expose it globally */
window.shareInvoiceImage = async function(docId, invData) {
  await shareViaWhatsApp(docId, invData);
};

/* ═══════════════════════════════════════════════════════════════════════
   EXPORT PDF
═══════════════════════════════════════════════════════════════════════ */
async function exportPDF() {
  showToast('Generating PDF…', 'info');
  try {
    renderPreview();
    const imgDataUrl = await captureInvoiceImage();
    const { jsPDF }  = window.jspdf;
    const pdf        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const img    = new Image();
    img.src      = imgDataUrl;
    await new Promise(res => { img.onload = res; });

    const pageW  = 210;
    const pageH  = 297;
    const ratio  = img.height / img.width;
    const imgH   = Math.min(pageW * ratio, pageH);

    pdf.addImage(imgDataUrl, 'PNG', 0, 0, pageW, imgH);
    const invNum = getVal('inv-number') || 'Invoice';
    pdf.save(`${invNum}.pdf`);
    showToast('PDF downloaded!', 'success');
  } catch (e) {
    console.error(e);
    showToast('PDF export failed: ' + e.message, 'error');
  }
}
window.exportPDF = exportPDF;

/* ═══════════════════════════════════════════════════════════════════════
   EDIT MODE  (?id=xxx in URL)
═══════════════════════════════════════════════════════════════════════ */
async function checkEditMode() {
  const p  = new URLSearchParams(window.location.search);
  const id = p.get('id') || p.get('invoiceId');
  if (!id) return;

  editingId = id;
  document.getElementById('builder-title').textContent = 'Edit Invoice';

  try {
    const snap = await db.collection('invoices').doc(id).get();
    if (!snap.exists) { showToast('Invoice not found', 'error'); return; }
    const inv = snap.data();

    /* Fill form */
    setVal('biz-name',      inv.businessName    || '');
    setVal('biz-email',     inv.businessEmail   || '');
    setVal('biz-phone',     inv.businessPhone   || '');
    setVal('biz-address',   inv.businessAddress || '');
    setVal('biz-gst',       inv.businessGst     || '');
    setVal('biz-logo',      inv.logoUrl         || '');
    setVal('client-name',   inv.clientName      || '');
    setVal('client-email',  inv.clientEmail     || '');
    setVal('client-phone',  inv.clientPhone     || '');
    setVal('client-address',inv.clientAddress   || '');
    setVal('client-gst',    inv.clientGst       || '');
    setVal('inv-number',    inv.number          || '');
    setVal('inv-currency',  inv.currency        || 'INR');
    setVal('inv-date',      inv.invoiceDate     || '');
    setVal('inv-due',       inv.dueDate         || '');
    setVal('inv-po',        inv.poNumber        || '');
    setVal('inv-notes',     inv.notes           || '');
    setVal('inv-terms',     inv.terms           || '');

    if (document.getElementById('discount-pct'))
      document.getElementById('discount-pct').value = inv.discountPct || 0;
    if (document.getElementById('shipping'))
      document.getElementById('shipping').value = inv.shipping || 0;

    /* Items */
    lineItems = (inv.items || []).map((i, idx) => ({ id: Date.now() + idx, ...i }));
    renderItemsTable();

    /* Template */
    if (inv.template) setTemplate(inv.template);

    recalc();
  } catch (e) {
    console.error(e);
    showToast('Error loading invoice: ' + e.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════════════════ */
function validate() {
  if (!getVal('client-name').trim()) {
    showToast('Client name is required', 'error');
    document.getElementById('client-name').focus();
    return false;
  }
  if (!getVal('inv-number').trim()) {
    showToast('Invoice number is required', 'error');
    document.getElementById('inv-number').focus();
    return false;
  }
  if (!lineItems.length) {
    showToast('Add at least one line item', 'error');
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════════════════ */
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function fmtAmt(n, cur) {
  return (CSYM[cur] || cur || '₹') +
    parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInputDate(d) {
  return d.toISOString().split('T')[0];
}
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Toast ──────────────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  /* Use shared.js showToast if available */
  if (typeof window.showToast === 'function' && window.showToast !== showToast) {
    window.showToast(msg, type); return;
  }
  const container = document.getElementById('toast-container');
  if (!container) { console.log(`[Toast ${type}]`, msg); return; }
  const t       = document.createElement('div');
  t.className   = `toast toast-${type}`;
  t.textContent = msg;
  t.style.cssText = `
    background:${type==='error'?'#EF4444':type==='success'?'#10B981':'#3B82F6'};
    color:#fff;padding:.75rem 1.25rem;border-radius:10px;font-size:.88rem;
    font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.2);
    animation:slideUp .3s ease;margin-top:.5rem;
  `;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}