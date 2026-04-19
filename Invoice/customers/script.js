// FUMA Invoice — /invoice/customers/script.js
'use strict';

let allCustomers = [];
let allInvoices  = [];
let searchQ = '';

async function onUserReady(user) {
    renderSidebar('customers');
    await loadCurrency(user.uid);
    await Promise.all([fetchCustomers(user.uid), fetchInvoices(user.uid)]);
    computeTotals();
    renderStats();
    renderCards();
    bindEvents();
}

// ── Fetch ──────────────────────────────────────────────────────────
async function fetchCustomers(uid) {
    try {
        const snap = await db.collection('invoice_customers').where('ownerId','==',uid).orderBy('name').get();
        allCustomers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('fetchCustomers:', e); }
}

async function fetchInvoices(uid) {
    try {
        const snap = await db.collection('invoices').where('ownerId','==',uid).get();
        allInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('fetchInvoices:', e); }
}

// ── Compute totals per customer ───────────────────────────────────
function computeTotals() {
    const now = new Date();
    allCustomers.forEach(c => {
        const invs = allInvoices.filter(inv =>
            inv.clientId === c.id ||
            (inv.clientEmail && inv.clientEmail === c.email) ||
            (inv.clientName  && inv.clientName  === c.name)
        );
        let invoiced = 0, paid = 0, pending = 0, overdue = 0;
        invs.forEach(inv => {
            const s   = (inv.status||'').toLowerCase();
            const amt = parseFloat(inv.amountDue || inv.total || 0);
            const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
            invoiced += amt;
            if (['paid','settled'].includes(s)) paid += amt;
            else if (s === 'pending') {
                if (due && due < now) overdue += amt;
                else pending += amt;
            }
        });
        c._invoices  = invs;
        c._invoiced  = invoiced;
        c._paid      = paid;
        c._pending   = pending + overdue;
        c._overdue   = overdue;
        c._invCount  = invs.length;
    });
}

// ── Stats bar ─────────────────────────────────────────────────────
function renderStats() {
    const totalInvoiced     = allCustomers.reduce((s,c) => s + c._invoiced, 0);
    const totalOutstanding  = allCustomers.reduce((s,c) => s + c._pending, 0);
    const totalOverdue      = allCustomers.reduce((s,c) => s + c._overdue, 0);
    setText('st-clients',       String(allCustomers.length));
    setText('st-invoiced',      fmt(totalInvoiced));
    setText('st-outstanding',   fmt(totalOutstanding));
    setText('st-overdue',       fmt(totalOverdue));
    const overdueClients = allCustomers.filter(c => c._overdue > 0).length;
    setText('st-overdue-sub', `${overdueClients} client${overdueClients!==1?'s':''}`);
}

// ── Render cards ──────────────────────────────────────────────────
function renderCards() {
    const grid = document.getElementById('cust-grid');
    if (!grid) return;

    let list = allCustomers;
    if (searchQ) {
        const q = searchQ.toLowerCase();
        list = list.filter(c =>
            (c.name||'').toLowerCase().includes(q) ||
            (c.email||'').toLowerCase().includes(q) ||
            (c.phone||'').toLowerCase().includes(q)
        );
    }

    if (!list.length) {
        grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state">
            <i class="fas fa-users"></i>
            <p>No customers found.</p>
            <a href="#" onclick="openCustomerModal()">Add your first customer →</a>
        </div></div>`;
        return;
    }

    grid.innerHTML = list.map(c => {
        const initials = (c.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        const hasOverdue = c._overdue > 0;
        return `<div class="cust-card" onclick="openLedger('${c.id}')">
            <div class="cust-card-header">
                <div class="cust-avatar">${initials}</div>
                <div class="cust-info">
                    <div class="cust-name">${escHtml(c.name||'—')}</div>
                    <div class="cust-email">${escHtml(c.email||'—')}</div>
                    <div class="cust-phone">${escHtml(c.phone||'')}</div>
                </div>
                <div class="cust-card-actions" onclick="event.stopPropagation()">
                    ${hasOverdue ? `<button class="cca-btn" title="Send reminder" onclick="sendQuickReminder('${c.id}')"><i class="fab fa-whatsapp" style="color:#25D366"></i></button>` : ''}
                    <button class="cca-btn" title="New invoice" onclick="window.location.href='/Invoice/builder/?clientId=${c.id}'"><i class="fas fa-plus"></i></button>
                    <button class="cca-btn" title="Edit" onclick="openCustomerModal('${c.id}')"><i class="fas fa-edit"></i></button>
                    <button class="cca-btn danger" title="Delete" onclick="deleteCustomer('${c.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="cust-stats-bar">
                <div class="csb-item">
                    <div class="csb-label">Invoiced</div>
                    <div class="csb-value">${fmt(c._invoiced)}</div>
                </div>
                <div class="csb-item csb-paid">
                    <div class="csb-label">Paid</div>
                    <div class="csb-value">${fmt(c._paid)}</div>
                </div>
                <div class="csb-item csb-pending">
                    <div class="csb-label">Pending</div>
                    <div class="csb-value">${fmt(c._pending)}</div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Ledger modal ──────────────────────────────────────────────────
function openLedger(custId) {
    const c = allCustomers.find(x => x.id === custId);
    if (!c) return;
    const now = new Date();

    setText('ledger-modal-title', c.name || 'Client Ledger');
    setText('ledger-modal-sub', `${c.email||''} ${c.phone ? '· '+c.phone : ''}`);

    const statsEl = document.getElementById('ledger-stats');
    if (statsEl) statsEl.innerHTML = `
        <div class="ls-item"><div class="ls-label">Invoiced</div><div class="ls-value">${fmt(c._invoiced)}</div></div>
        <div class="ls-item ls-paid"><div class="ls-label">Paid</div><div class="ls-value">${fmt(c._paid)}</div></div>
        <div class="ls-item ls-pend"><div class="ls-label">Pending</div><div class="ls-value">${fmt(c._pending)}</div></div>
    `;

    const tbody = document.getElementById('ledger-body');
    if (!tbody) return;

    if (!c._invoices?.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="padding:1.5rem;text-align:center;color:var(--muted)">No invoices for this client.</td></tr>`;
    } else {
        const sorted = [...c._invoices].sort((a,b) => tsMs(b.createdAt) - tsMs(a.createdAt));
        tbody.innerHTML = sorted.map(inv => {
            const s   = (inv.status||'Draft').toLowerCase();
            const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
            const ovr = s === 'pending' && due && due < now;
            const ds  = ovr ? 'Overdue' : (inv.status||'Draft');
            const bc  = ovr ? 'badge-overdue' : `badge-${s}`;
            const rowCls = ovr ? 'ledger-overdue' : (['paid','settled'].includes(s) ? 'ledger-paid' : '');
            const amt = parseFloat(inv.amountDue || inv.total || 0);
            return `<tr class="${rowCls}">
                <td class="td-bold">#${escHtml(inv.number||'—')}</td>
                <td>${fmtDate(inv.createdAt)}</td>
                <td class="${ovr?'amount-danger':''}">${due?fmtDate(inv.dueDate):'—'}</td>
                <td class="td-bold">${fmt(amt)}</td>
                <td><span class="badge ${bc}">${ds}</span></td>
                <td>
                    <a href="/Invoice/builder/?id=${inv.id}" class="btn btn-secondary btn-sm" style="text-decoration:none"><i class="fas fa-eye"></i></a>
                    ${ovr?`<button class="btn btn-secondary btn-sm" style="color:#25D366;border-color:#25D366" onclick="sendQuickReminder('${custId}','${inv.id}','${inv.number||'—'}','${amt}')"><i class="fab fa-whatsapp"></i></button>`:''}
                </td>
            </tr>`;
        }).join('');
    }

    document.getElementById('ledger-modal').classList.add('open');
}
window.openLedger = openLedger;

// ── WhatsApp reminder ─────────────────────────────────────────────
function sendQuickReminder(custId, invoiceId, number, amount) {
    const c = allCustomers.find(x => x.id === custId);
    if (!c) return;
    // Find first overdue invoice if not specified
    if (!invoiceId) {
        const ovr = c._invoices?.find(inv => {
            const s = (inv.status||'').toLowerCase();
            const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
            return s === 'pending' && due && due < new Date();
        });
        if (!ovr) return;
        invoiceId = ovr.id; number = ovr.number; amount = ovr.amountDue || ovr.total;
    }
    const msg = `Hi ${c.name},\n\nThis is a gentle reminder for Invoice *#${number}* amounting to *${fmt(parseFloat(amount))}*, which is overdue.\n\nPay here: ${window.location.origin}/Invoice/pay/?id=${invoiceId}\n\n— Sent via FUMA Invoice`;
    navigator.clipboard?.writeText(msg).catch(()=>{});
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    showToast('WhatsApp opened! Message copied.', 'success');
}
window.sendQuickReminder = sendQuickReminder;

// ── Add / Edit customer modal ─────────────────────────────────────
function openCustomerModal(custId) {
    const isEdit = !!custId;
    setText('cust-modal-title', isEdit ? 'Edit Customer' : 'Add Customer');
    document.getElementById('edit-cust-id').value = custId || '';

    if (isEdit) {
        const c = allCustomers.find(x => x.id === custId);
        if (!c) return;
        document.getElementById('cust-name').value    = c.name    || '';
        document.getElementById('cust-email').value   = c.email   || '';
        document.getElementById('cust-phone').value   = c.phone   || '';
        document.getElementById('cust-address').value = c.address || '';
        document.getElementById('cust-gst').value     = c.gst     || '';
    } else {
        ['cust-name','cust-email','cust-phone','cust-address','cust-gst'].forEach(id => { document.getElementById(id).value = ''; });
    }
    document.getElementById('cust-modal').classList.add('open');
}
window.openCustomerModal = openCustomerModal;

function closeCustModal() { document.getElementById('cust-modal').classList.remove('open'); }
window.closeCustModal = closeCustModal;

async function saveCustomer() {
    const name = document.getElementById('cust-name').value.trim();
    if (!name) { showToast('Name is required.', 'error'); return; }

    const custId  = document.getElementById('edit-cust-id').value;
    const isEdit  = !!custId;
    const data = {
        name,
        email:   document.getElementById('cust-email').value.trim(),
        phone:   document.getElementById('cust-phone').value.trim(),
        address: document.getElementById('cust-address').value.trim(),
        gst:     document.getElementById('cust-gst').value.trim(),
        ownerId: currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (!isEdit) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    try {
        if (isEdit) {
            await db.collection('invoice_customers').doc(custId).update(data);
            const idx = allCustomers.findIndex(c => c.id === custId);
            if (idx > -1) allCustomers[idx] = { ...allCustomers[idx], ...data };
        } else {
            const ref = await db.collection('invoice_customers').add(data);
            const newC = { id: ref.id, ...data, _invoices:[], _invoiced:0, _paid:0, _pending:0, _overdue:0, _invCount:0 };
            allCustomers.push(newC);
        }
        closeCustModal();
        renderStats();
        renderCards();
        showToast(isEdit ? 'Customer updated.' : 'Customer added.', 'success');
    } catch(e) { showToast('Save failed: ' + e.message, 'error'); }
}
window.saveCustomer = saveCustomer;

async function deleteCustomer(custId) {
    if (!confirm('Delete this customer? Their invoices will not be deleted.')) return;
    try {
        await db.collection('invoice_customers').doc(custId).delete();
        allCustomers = allCustomers.filter(c => c.id !== custId);
        renderStats();
        renderCards();
        showToast('Customer deleted.', 'info');
    } catch(e) { showToast('Delete failed.', 'error'); }
}
window.deleteCustomer = deleteCustomer;

// ── Bind events ───────────────────────────────────────────────────
function bindEvents() {
    document.getElementById('cust-search')?.addEventListener('input', e => {
        searchQ = e.target.value.trim();
        renderCards();
    });
    document.querySelectorAll('.modal-backdrop').forEach(mb => {
        mb.addEventListener('click', e => { if (e.target === mb) mb.classList.remove('open'); });
    });
}

// ── Helpers ───────────────────────────────────────────────────────
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function tsMs(ts) { try { return ts?.toDate ? ts.toDate().getTime() : new Date(ts||0).getTime(); } catch { return 0; } }

// CSS vars for amount colouring (injected inline via classes, defined here)
const style = document.createElement('style');
style.textContent = '.amount-danger{color:var(--error)!important}';
document.head.appendChild(style);