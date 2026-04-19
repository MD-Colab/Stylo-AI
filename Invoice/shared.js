// FUMA Invoice — shared.js (UPDATED — with FUMA Business Bridge)
// Include in every page: <script src="../shared.js"></script>
// Also include: <script src="../business-bridge.js"></script> (before shared.js)

'use strict';

// ── Firebase ─────────────────────────────────────────────────────
const _firebaseConfig = {
    apiKey:            "AIzaSyDQ097vz04Oj7QpHIZKNR9KVp5L0U03Fio",
    authDomain:        "md-colab-63228.firebaseapp.com",
    projectId:         "md-colab-63228",
    storageBucket:     "md-colab-63228.firebasestorage.app",
    messagingSenderId: "568580723297",
    appId:             "1:568580723297:web:1426515deda2d3d0a45020"
};
if (!firebase.apps.length) firebase.initializeApp(_firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Auth guard ───────────────────────────────────────────────────
let currentUser = null;

auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = '/Collab/create-account/'; return; }
    currentUser = user;

    // ── Load avatar ────────────────────────────────────────────────
    _loadAvatar(user);

    // ── Bridge: sync FUMA Business → FUMA Invoice (silent, async) ────
    // The bridge is a no-op if no business profile exists.
    if (window.MDBusinessBridge) {
        try { await MDBusinessBridge.init(user); } catch(e) { /* non-fatal */ }
    }

    // ── Page-specific callback ────────────────────────────────────
    if (typeof onUserReady === 'function') onUserReady(user);
});

async function _loadAvatar(user) {
    const el = document.getElementById('topbar-avatar');
    if (!el) return;
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().photoBase64) {
            el.innerHTML = `<img src="${doc.data().photoBase64}" alt="avatar">`;
            return;
        }
    } catch(e) {}
    el.textContent = (user.displayName || user.email || '?').charAt(0).toUpperCase();
}

// ── Sidebar toggle ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('hamburger')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.add('open');
        document.getElementById('sidebar-overlay')?.classList.add('active');
    });
    const close = () => {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
    };
    document.getElementById('sidebar-close')?.addEventListener('click', close);
    document.getElementById('sidebar-overlay')?.addEventListener('click', close);

    // Mark active nav item
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
        el.classList.toggle('active', path.includes(el.dataset.page));
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async e => {
        e.preventDefault();
        await auth.signOut();
        window.location.href = '/Collab/create-account/';
    });
});

// ── Toast ────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success:'check-circle', error:'exclamation-circle', info:'info-circle', warning:'exclamation-triangle' };
    t.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i><span>${msg}</span>`;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}
window.showToast = showToast;

// ── Currency / format helpers ────────────────────────────────────
const CURRENCY_SYM = { INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'د.إ', SGD:'S$' };
let _currency = localStorage.getItem('md_currency') || 'INR';

async function loadCurrency(uid) {
    try {
        const doc = await db.collection('invoice_settings').doc(uid).get();
        if (doc.exists && doc.data().currency) {
            _currency = doc.data().currency;
            localStorage.setItem('md_currency', _currency);
        }
    } catch(e) {}
    return _currency;
}

function fmt(n) {
    const sym = CURRENCY_SYM[_currency] || _currency;
    return sym + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
    if (!ts) return '—';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    } catch { return String(ts); }
}

function fmtDateInput(ts) {
    if (!ts) return '';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toISOString().split('T')[0];
    } catch { return ''; }
}

function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function isOverdue(inv) {
    const status = (inv.status||'').toLowerCase();
    const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
    return status === 'pending' && due && due < new Date();
}

window.fmt = fmt;
window.fmtDate = fmtDate;
window.fmtDateInput = fmtDateInput;
window.escHtml = escHtml;
window.isOverdue = isOverdue;
window.loadCurrency = loadCurrency;

// ── Sidebar HTML (injected by each page) ─────────────────────────
function renderSidebar(activePage) {
    const el = document.getElementById('sidebar');
    if (!el) return;

    // Get business badge HTML if bridge has data
    const biz = window.MDBusinessBridge?.getBizData?.();
    const bizBadgeHtml = biz ? `
        <div class="sidebar-biz-card">
            ${biz.businessLogoBase64
                ? `<img src="${biz.businessLogoBase64}" class="sbc-logo" alt="logo">`
                : `<div class="sbc-logo sbc-placeholder"><i class="fas fa-building"></i></div>`}
            <div class="sbc-info">
                <div class="sbc-name">${escHtml(biz.businessName || '')}</div>
                <div class="sbc-status ${biz.meta?.verified ? 'verified' : 'pending'}">
                    <span class="sbc-dot"></span>
                    ${biz.meta?.verified ? 'Verified' : 'Pending verification'}
                </div>
            </div>
        </div>` : '';

    el.innerHTML = `
        <div class="sidebar-header">
            <a href="/Invoice/dashboard/" class="sidebar-logo">
                <div class="logo-icon"><i class="fas fa-file-invoice"></i></div>
                <span>FUMA Invoice</span>
            </a>
            <button class="sidebar-close" id="sidebar-close"><i class="fas fa-times"></i></button>
        </div>

        ${bizBadgeHtml}

        <nav class="sidebar-nav">
            <a href="/Invoice/dashboard/"  class="nav-item ${activePage==='dashboard'?'active':''}"  data-page="dashboard"><i class="fas fa-th-large"></i><span>Dashboard</span></a>
            <a href="/Invoice/builder/"    class="nav-item ${activePage==='builder'?'active':''}"    data-page="builder"><i class="fas fa-plus-circle"></i><span>New Invoice</span></a>
            <a href="/Invoice/invoices/"   class="nav-item ${activePage==='invoices'?'active':''}"   data-page="invoices"><i class="fas fa-file-invoice-dollar"></i><span>Invoices</span></a>
            <a href="/Invoice/customers/index.html"  class="nav-item ${activePage==='customers'?'active':''}"  data-page="customers"><i class="fas fa-users"></i><span>Customers</span></a>
            <a href="/Invoice/products/"   class="nav-item ${activePage==='products'?'active':''}"   data-page="products"><i class="fas fa-box"></i><span>Products</span></a>
            <div class="nav-divider">Finance</div>
            <a href="/Invoice/accounting/" class="nav-item ${activePage==='accounting'?'active':''}" data-page="accounting"><i class="fas fa-book"></i><span>Accounting</span></a>
            <a href="/Invoice/reports/"    class="nav-item ${activePage==='reports'?'active':''}"    data-page="reports"><i class="fas fa-chart-bar"></i><span>Reports</span></a>
            <a href="/Invoice/ai-insights/" class="nav-item ${activePage==='ai-insights'?'active':''}" data-page="ai-insights"><i class="fas fa-robot"></i><span>AI Insights</span></a>
            <div class="nav-divider">Settings</div>
            <a href="/Invoice/settings/"   class="nav-item ${activePage==='settings'?'active':''}"   data-page="settings"><i class="fas fa-cog"></i><span>Settings</span></a>
            <a href="/Business/dashboard.html" class="nav-item" data-page="business">
                <i class="fas fa-building"></i><span>My Business</span>
            </a>
            <a href="#" class="nav-item nav-item-danger" id="logout-btn"><i class="fas fa-sign-out-alt"></i><span>Sign Out</span></a>
        </nav>
        <div class="sidebar-footer">
            <a href="https://fumatechnologies.vercel.app" target="_blank" class="sidebar-powered">
                <i class="fas fa-bolt"></i> Powered by FUMA Colab
            </a>
        </div>
    `;

    // Re-bind close & logout after innerHTML replacement
    document.getElementById('sidebar-close')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
    });
    document.getElementById('logout-btn')?.addEventListener('click', async e => {
        e.preventDefault();
        await auth.signOut();
        window.location.href = '/Collab/create-account/';
    });
}
window.renderSidebar = renderSidebar;