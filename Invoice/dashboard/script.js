// FUMA Invoice — /Invoice/dashboard/script.js — FIXED v3
'use strict';

// ── Firebase ──────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey:            "AIzaSyDQ097vz04Oj7QpHIZKNR9KVp5L0U03Fio",
    authDomain:        "md-colab-63228.firebaseapp.com",
    projectId:         "md-colab-63228",
    storageBucket:     "md-colab-63228.firebasestorage.app",
    messagingSenderId: "568580723297",
    appId:             "1:568580723297:web:1426515deda2d3d0a45020"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── State ──────────────────────────────────────────────────────────
let currentUser       = null;
let invoicesCache     = [];
let accountingCache   = [];
let chartsInited      = false;
let revenueChart      = null;
let statusChart       = null;
let _reminderMsg      = '';

const CURRENCY_SYM = { INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'د.إ', SGD:'S$' };
let _currency = localStorage.getItem('md_currency') || 'INR';

// ── Auth ───────────────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = '/Collab/create-account/'; return; }
    currentUser = user;

    // Load avatar
    _loadAvatar(user);

    // Business bridge (optional)
    if (window.MDBusinessBridge) {
        try { await MDBusinessBridge.init(user); } catch(e) {}
    }

    await initDashboard(user);
});

async function _loadAvatar(user) {
    const el = document.getElementById('topbar-avatar');
    if (!el) return;
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().photoBase64) {
            el.innerHTML = `<img src="${doc.data().photoBase64}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
            return;
        }
    } catch(e) {}
    el.textContent = (user.displayName || user.email || '?').charAt(0).toUpperCase();
}

// ── Init ───────────────────────────────────────────────────────────
async function initDashboard(user) {
    setGreeting(user);
    renderSidebarNav();

    // Load currency
    await _loadCurrencyFromSettings(user.uid);

    // Fetch data in parallel
    await Promise.all([
        loadInvoices(user.uid),
        loadAccounting(user.uid),
    ]);

    // Render everything
    renderKPIs();
    renderRecentInvoices();
    renderRecentTransactions();   // accounting section (pro mode)

    // Apply saved mode
    const savedMode = localStorage.getItem('md_dash_mode') || 'simple';
    setDashMode(savedMode, false);

    // Sidebar active
    _markSidebarActive();

    // Bind sidebar controls (dashboard has inline sidebar HTML)
    _bindSidebarControls();
}

// ── Sidebar (dashboard has its own inline sidebar) ─────────────────
function renderSidebarNav() {
    // Dashboard has sidebar HTML inline — just inject business card if bridge loaded
    if (!window.MDBusinessBridge) return;
    const biz = MDBusinessBridge.getBizData();
    if (!biz) return;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Inject business card after sidebar-header
    const header = sidebar.querySelector('.sidebar-header');
    if (!header || sidebar.querySelector('.sidebar-biz-card')) return;

    const card = document.createElement('a');
    card.href  = '/Business/dashboard.html';
    card.className = 'sidebar-biz-card';
    const logoHtml = biz.businessLogoBase64
        ? `<img src="${biz.businessLogoBase64}" class="sbc-logo" alt="logo">`
        : `<div class="sbc-logo sbc-placeholder"><i class="fas fa-building"></i></div>`;
    card.innerHTML = `
        ${logoHtml}
        <div class="sbc-info">
            <div class="sbc-name">${_esc(biz.businessName || '')}</div>
            <div class="sbc-status ${biz.meta?.verified ? 'verified' : 'pending'}">
                <span class="sbc-dot"></span>
                ${biz.meta?.verified ? 'Verified' : 'Pending'}
            </div>
        </div>`;
    header.insertAdjacentElement('afterend', card);
}

function _bindSidebarControls() {
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
    document.getElementById('logout-btn')?.addEventListener('click', async e => {
        e.preventDefault();
        await auth.signOut();
        window.location.href = '/Collab/create-account/';
    });
}

function _markSidebarActive() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
        el.classList.toggle('active', path.includes(el.dataset.page));
    });
}

// ── Currency ───────────────────────────────────────────────────────
async function _loadCurrencyFromSettings(uid) {
    try {
        const doc = await db.collection('invoice_settings').doc(uid).get();
        if (doc.exists && doc.data().currency) {
            _currency = doc.data().currency;
            localStorage.setItem('md_currency', _currency);
        }
    } catch(e) {}
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

// ── Greeting ───────────────────────────────────────────────────────
function setGreeting(user) {
    const h    = new Date().getHours();
    const text = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    _setText('greeting-text', text);
    _setText('user-name', (user.displayName || user.email || '').split(' ')[0] || 'there');
}

// ── Load invoices (5-min session cache) ───────────────────────────
async function loadInvoices(uid) {
    const key = `md_inv_${uid}`, tsKey = `md_inv_ts_${uid}`;
    const age = Date.now() - parseInt(sessionStorage.getItem(tsKey) || '0');
    if (age < 300000) {
        try {
            const cached = JSON.parse(sessionStorage.getItem(key) || '[]');
            if (cached.length) { invoicesCache = cached; return; }
        } catch(e) {}
    }
    try {
        const snap = await db.collection('invoices')
            .where('ownerId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        invoicesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        try {
            sessionStorage.setItem(key, JSON.stringify(invoicesCache));
            sessionStorage.setItem(tsKey, String(Date.now()));
        } catch(e) {}
    } catch(e) {
        console.error('[Dashboard] loadInvoices:', e);
        invoicesCache = [];
    }
}

// ── Load accounting (invoice_accounting collection) ────────────────
async function loadAccounting(uid) {
    try {
        const snap = await db.collection('invoice_accounting')
            .where('ownerId', '==', uid)
            .orderBy('date', 'desc')
            .limit(50)
            .get();
        accountingCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
        console.error('[Dashboard] loadAccounting:', e);
        accountingCache = [];
    }
}

// ── KPI Cards ──────────────────────────────────────────────────────
function renderKPIs() {
    const now  = new Date();
    const m    = now.getMonth(), y = now.getFullYear();

    let revenue = 0, pending = 0, pendingC = 0, overdue = 0, overdueC = 0;
    const clientSet = new Set(), newClients = new Set();

    invoicesCache.forEach(inv => {
        const s   = (inv.status || '').toLowerCase();
        const due = _ts(inv.dueDate);
        const cr  = _ts(inv.createdAt);
        const amt = parseFloat(inv.amountDue || inv.total || 0);

        if (inv.clientId || inv.clientEmail) {
            const ck = inv.clientId || inv.clientEmail;
            clientSet.add(ck);
            if (cr && cr.getMonth() === m && cr.getFullYear() === y) newClients.add(ck);
        }

        if (['paid','settled'].includes(s)) revenue += amt;
        if (s === 'pending') {
            if (due && due < now) { overdue += amt; overdueC++; }
            else { pending += amt; pendingC++; }
        }
    });

    _setText('kpi-revenue',       fmt(revenue));
    _setText('kpi-pending',       fmt(pending));
    _setText('kpi-overdue',       fmt(overdue));
    _setText('kpi-clients',       String(clientSet.size));
    _setText('kpi-pending-count', `${pendingC} invoice${pendingC !== 1 ? 's' : ''}`);
    _setText('kpi-overdue-count', `${overdueC} invoice${overdueC !== 1 ? 's' : ''}`);
    _setText('kpi-clients-new',   `${newClients.size} new this month`);
    _setText('kpi-revenue-delta', 'All time');
}

// ── Recent Invoices Table ──────────────────────────────────────────
function renderRecentInvoices() {
    const tbody = document.getElementById('recent-inv-body');
    if (!tbody) return;

    const list = invoicesCache.slice(0, 10);
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#9CA3AF">
            No invoices yet.
            <a href="/Invoice/builder/" style="color:#FF6F00;font-weight:600;margin-left:4px">Create your first →</a>
        </td></tr>`;
        return;
    }

    const now = new Date();
    tbody.innerHTML = list.map(inv => {
        const s      = (inv.status || 'Draft').toLowerCase();
        const due    = _ts(inv.dueDate);
        const isOvr  = s === 'pending' && due && due < now;
        const ds     = isOvr ? 'Overdue' : (inv.status || 'Draft');
        const bc     = isOvr ? 'status-overdue' : `status-${s}`;
        const amt    = parseFloat(inv.amountDue || inv.total || 0);

        return `<tr>
            <td class="inv-number">#${_esc(inv.number || '—')}</td>
            <td class="inv-client">${_esc(inv.clientName || inv.clientEmail || '—')}</td>
            <td class="inv-amount">${fmt(amt)}</td>
            <td>${due ? fmtDate(inv.dueDate) : '—'}</td>
            <td><span class="status-badge ${bc}">${ds}</span></td>
            <td>
                <button class="action-btn" onclick="viewInvoice('${inv.id}')"><i class="fas fa-eye"></i> View</button>
                ${isOvr ? `<button class="action-btn remind" onclick="openReminderModal('${inv.id}','${_esc(inv.clientName||'Client')}','${_esc(inv.number||'—')}','${amt}')"><i class="fab fa-whatsapp"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

// ── Recent Transactions (accounting section, Pro mode) ─────────────
function renderRecentTransactions() {
    const tbody = document.getElementById('accounting-body');
    if (!tbody) return;

    const list = accountingCache.slice(0, 8);
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:1.5rem">
            No transactions yet. <a href="/Invoice/accounting/" style="color:#FF6F00">Add entries →</a>
        </td></tr>`;
        return;
    }

    let bal = 0;
    // Sort ascending for running balance
    const sorted = [...accountingCache].sort((a,b) => _tsMs(a.date)-_tsMs(b.date));
    sorted.forEach(e => {
        const a = parseFloat(e.amount||0);
        if (e.type==='credit') bal += a; else bal -= a;
    });

    // Show newest 8
    tbody.innerHTML = list.map(e => {
        const isC  = e.type === 'credit';
        const aBal = Math.abs(bal);   // Use final balance for simplicity in dashboard view
        return `<tr>
            <td>${fmtDate(e.date)}</td>
            <td class="td-bold">${_esc(e.description||'—')}</td>
            <td><span class="status-badge ${isC?'status-paid':'status-overdue'}">${isC?'Income':'Expense'}</span></td>
            <td style="font-weight:700;color:${isC?'#10B981':'#EF4444'}">${isC?'+':'−'}${fmt(e.amount||0)}</td>
            <td style="font-weight:700;color:${bal>=0?'#10B981':'#EF4444'}">${fmt(aBal)}</td>
        </tr>`;
    }).join('');
}

// ── Simple / Pro Mode ──────────────────────────────────────────────
function setDashMode(mode, save = true) {
    const isSimple = mode === 'simple';
    document.body.classList.toggle('pro-mode', !isSimple);
    document.getElementById('pill-simple')?.classList.toggle('active', isSimple);
    document.getElementById('pill-pro')?.classList.toggle('active', !isSimple);
    if (save) localStorage.setItem('md_dash_mode', mode);

    // Init charts lazily when switching to Pro
    if (!isSimple) {
        // Use setTimeout to ensure DOM is visible before chart.js measures canvas
        setTimeout(() => {
            if (!chartsInited) {
                chartsInited = true;
                _initCharts();
            } else {
                // Force resize on existing charts (fixes blank canvas bug)
                Object.values({ revenueChart, statusChart }).forEach(c => {
                    try { c?.resize(); } catch(e) {}
                });
            }
        }, 80);
    }
}
window.setDashMode = setDashMode;

// ── Charts ─────────────────────────────────────────────────────────
function _initCharts() {
    _initRevenueChart();
    _initStatusChart();
}

function _initRevenueChart() {
    const canvas = document.getElementById('revenue-chart');
    if (!canvas) return;

    // Destroy previous instance if exists
    if (revenueChart) { revenueChart.destroy(); revenueChart = null; }

    const months = [], data = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }));
        let total = 0;
        invoicesCache.forEach(inv => {
            const s    = (inv.status||'').toLowerCase();
            if (!['paid','settled'].includes(s)) return;
            const paid = _ts(inv.paidAt || inv.updatedAt);
            if (paid && paid.getMonth() === d.getMonth() && paid.getFullYear() === d.getFullYear()) {
                total += parseFloat(inv.amountDue || inv.total || 0);
            }
        });
        data.push(parseFloat(total.toFixed(2)));
    }

    // If all zeros, use createdAt fallback
    if (data.every(v => v === 0)) {
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            let total = 0;
            invoicesCache.forEach(inv => {
                const cr = _ts(inv.createdAt);
                if (cr && cr.getMonth() === d.getMonth() && cr.getFullYear() === d.getFullYear()) {
                    total += parseFloat(inv.amountDue || inv.total || 0);
                }
            });
            data[5 - i] = parseFloat(total.toFixed(2));
        }
    }

    revenueChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Revenue',
                data,
                backgroundColor: 'rgba(255,111,0,0.18)',
                borderColor: '#FF6F00',
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600 },
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { callback: v => fmt(v), font: { size: 11 } }
                },
                x: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
        }
    });
}

function _initStatusChart() {
    const canvas = document.getElementById('status-chart');
    if (!canvas) return;

    if (statusChart) { statusChart.destroy(); statusChart = null; }

    const counts = { Paid: 0, Pending: 0, Overdue: 0, Draft: 0 };
    const now    = new Date();

    invoicesCache.forEach(inv => {
        const s   = (inv.status || 'Draft');
        const sl  = s.toLowerCase();
        const due = _ts(inv.dueDate);
        if (sl === 'pending' && due && due < now)      counts.Overdue++;
        else if (sl === 'paid' || sl === 'settled')    counts.Paid++;
        else if (sl === 'pending')                     counts.Pending++;
        else                                           counts.Draft++;
    });

    // Don't render if all zeros (blank chart looks wrong)
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
        const parent = canvas.parentElement;
        parent.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#9CA3AF;font-size:.85rem">No invoice data yet</div>`;
        return;
    }

    statusChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data:            Object.values(counts),
                backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#E5E7EB'],
                borderWidth: 0,
                hoverOffset: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600 },
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 11 }, padding: 12 }
                }
            }
        }
    });
}

// ── Reminder Modal ─────────────────────────────────────────────────
function openReminderModal(invId, clientName, number, amount) {
    _reminderMsg = `Hi ${clientName},\n\nHope you're well! This is a gentle reminder for Invoice *#${number}* amounting to *${fmt(parseFloat(amount))}*, which is currently overdue.\n\nPay securely here:\n🔗 ${window.location.origin}/Invoice/pay/?id=${invId}\n\nThank you!\n— Sent via FUMA Invoice`;
    const ta = document.getElementById('reminder-msg');
    if (ta) ta.value = _reminderMsg;
    document.getElementById('reminder-modal')?.classList.add('open');
}
window.openReminderModal = openReminderModal;

function closeReminderModal() { document.getElementById('reminder-modal')?.classList.remove('open'); }
window.closeReminderModal = closeReminderModal;

function sendReminder() {
    const msg = document.getElementById('reminder-msg')?.value || _reminderMsg;
    navigator.clipboard?.writeText(msg).catch(()=>{});
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    closeReminderModal();
    showToast('WhatsApp opened! Message copied.', 'success');
}
window.sendReminder = sendReminder;

function viewInvoice(id) { window.location.href = `/Invoice/invoices/?id=${id}`; }
window.viewInvoice = viewInvoice;

// ── Toast ──────────────────────────────────────────────────────────
function showToast(msg, type='info') {
    let c = document.getElementById('toast-container');
    if (!c) { c=document.createElement('div'); c.id='toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = {success:'check-circle',error:'exclamation-circle',info:'info-circle',warning:'exclamation-triangle'};
    t.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i><span>${msg}</span>`;
    c.appendChild(t);
    requestAnimationFrame(()=>t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),400); }, 3500);
}
window.showToast = showToast;

// ── Helpers ────────────────────────────────────────────────────────
function _setText(id, v) { const el=document.getElementById(id); if(el) el.textContent=v; }
function _esc(s)          { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function _ts(val) {
    if (!val) return null;
    try { return val.toDate ? val.toDate() : new Date(val); } catch { return null; }
}

function _tsMs(val) {
    const d = _ts(val);
    return d ? d.getTime() : 0;
}