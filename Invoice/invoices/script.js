// FUMA Invoice — /invoice/invoices/script.js
'use strict';

let allInvoices   = [];
let filtered      = [];
let selectedIds   = new Set();
let activeFilter  = 'all';
let activeSort    = 'newest';
let searchQuery   = '';
let _reminderMsg  = '';

// Called by shared.js after auth
async function onUserReady(user) {
    renderSidebar('invoices');
    await loadCurrency(user.uid);
    await fetchInvoices(user.uid);
    renderStats();
    renderTable();
    bindEvents();
}

// ── Fetch ────────────────────────────────────────────────────────
async function fetchInvoices(uid) {
    try {
        const snap = await db.collection('invoices')
            .where('ownerId', '==', uid)
            .orderBy('createdAt', 'desc')
            .get();
        allInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
        showToast('Failed to load invoices.', 'error');
        console.error(e);
    }
}

// ── Stats ────────────────────────────────────────────────────────
function renderStats() {
    const now = new Date();
    let paid = 0, paidC = 0, pending = 0, pendingC = 0, overdue = 0, overdueC = 0;
    allInvoices.forEach(inv => {
        const s   = (inv.status||'').toLowerCase();
        const amt = parseFloat(inv.amountDue || inv.total || 0);
        const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
        if (['paid','settled'].includes(s)) { paid += amt; paidC++; }
        else if (s === 'pending') {
            if (due && due < now) { overdue += amt; overdueC++; }
            else { pending += amt; pendingC++; }
        }
    });
    setText('stat-paid',          fmt(paid));
    setText('stat-paid-count',    `${paidC} invoice${paidC!==1?'s':''}`);
    setText('stat-pending',       fmt(pending));
    setText('stat-pending-count', `${pendingC} invoice${pendingC!==1?'s':''}`);
    setText('stat-overdue',       fmt(overdue));
    setText('stat-overdue-count', `${overdueC} invoice${overdueC!==1?'s':''}`);
    setText('stat-total',         String(allInvoices.length));
    const totalAmt = allInvoices.reduce((s,inv) => s + parseFloat(inv.amountDue||inv.total||0), 0);
    setText('stat-total-val',     fmt(totalAmt));
}

// ── Filter + sort + search ───────────────────────────────────────
function applyFilters() {
    const now = new Date();
    filtered = allInvoices.filter(inv => {
        const s   = (inv.status||'').toLowerCase();
        const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
        const ovr = s === 'pending' && due && due < now;

        if (activeFilter === 'overdue'  && !ovr) return false;
        if (activeFilter === 'pending'  && (s !== 'pending' || ovr)) return false;
        if (activeFilter === 'paid'     && !['paid','settled'].includes(s)) return false;
        if (activeFilter === 'draft'    && s !== 'draft') return false;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const match = (inv.number||'').toLowerCase().includes(q)
                || (inv.clientName||'').toLowerCase().includes(q)
                || (inv.clientEmail||'').toLowerCase().includes(q);
            if (!match) return false;
        }
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        if (activeSort === 'newest') return tsMs(b.createdAt) - tsMs(a.createdAt);
        if (activeSort === 'oldest') return tsMs(a.createdAt) - tsMs(b.createdAt);
        if (activeSort === 'amount-high') return parseFloat(b.amountDue||b.total||0) - parseFloat(a.amountDue||a.total||0);
        if (activeSort === 'amount-low')  return parseFloat(a.amountDue||a.total||0) - parseFloat(b.amountDue||b.total||0);
        if (activeSort === 'due') return tsMs(a.dueDate) - tsMs(b.dueDate);
        return 0;
    });
}

// ── Render table ─────────────────────────────────────────────────
function renderTable() {
    applyFilters();
    const tbody = document.getElementById('invoices-body');
    if (!tbody) return;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7">
            <div class="empty-state">
                <i class="fas fa-file-invoice"></i>
                <p>No invoices found.</p>
                <a href="/Invoice/builder/">Create your first invoice →</a>
            </div>
        </td></tr>`;
        return;
    }

    const now = new Date();
    tbody.innerHTML = filtered.map(inv => {
        const s   = (inv.status||'Draft').toLowerCase();
        const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
        const ovr = s === 'pending' && due && due < now;
        const displayStatus = ovr ? 'Overdue' : (inv.status || 'Draft');
        const badgeCls      = ovr ? 'badge-overdue' : `badge-${s}`;
        const amt           = parseFloat(inv.amountDue || inv.total || 0);
        const checked       = selectedIds.has(inv.id) ? 'checked' : '';

        return `<tr data-id="${inv.id}">
            <td><input type="checkbox" class="row-check" data-id="${inv.id}" ${checked}></td>
            <td class="td-bold">#${escHtml(inv.number||'—')}</td>
            <td>
                <div class="td-bold">${escHtml(inv.clientName||'—')}</div>
                <div class="td-muted">${escHtml(inv.clientEmail||'')}</div>
            </td>
            <td class="td-bold">${fmt(amt)}</td>
            <td class="${ovr?'amount-danger':''}">${due ? fmtDate(inv.dueDate) : '—'}</td>
            <td><span class="badge ${badgeCls}">${displayStatus}</span></td>
            <td>
                <div class="inv-actions">
                    <button class="icon-btn" title="View" onclick="openInvModal('${inv.id}')"><i class="fas fa-eye"></i></button>
                    <button class="icon-btn" title="Edit" onclick="editInvoice('${inv.id}')"><i class="fas fa-edit"></i></button>
                    <button class="icon-btn" title="Copy pay link" onclick="copyPayLink('${inv.id}')"><i class="fas fa-link"></i></button>
                    ${ovr ? `<button class="icon-btn remind" title="WhatsApp reminder" onclick="openReminder('${inv.id}','${escHtml(inv.clientName||'Client')}','${inv.number||'—'}','${amt}')"><i class="fab fa-whatsapp"></i></button>` : ''}
                    <button class="icon-btn danger" title="Delete" onclick="deleteInvoice('${inv.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Rebind checkboxes
    document.querySelectorAll('.row-check').forEach(cb => {
        cb.addEventListener('change', () => {
            cb.checked ? selectedIds.add(cb.dataset.id) : selectedIds.delete(cb.dataset.id);
            updateBulkBar();
        });
    });
}

// ── Modal ────────────────────────────────────────────────────────
function openInvModal(id) {
    const inv = allInvoices.find(i => i.id === id);
    if (!inv) return;

    const s   = (inv.status||'Draft').toLowerCase();
    const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
    const ovr = s === 'pending' && due && due < new Date();
    const displayStatus = ovr ? 'Overdue' : (inv.status||'Draft');
    const badgeCls      = ovr ? 'badge-overdue' : `badge-${s}`;

    setText('modal-inv-number', `Invoice #${inv.number||'—'}`);
    setText('modal-inv-client',  inv.clientName || inv.clientEmail || '—');

    const badge = document.getElementById('modal-status-badge');
    if (badge) { badge.textContent = displayStatus; badge.className = `badge ${badgeCls}`; }

    const grid = document.getElementById('inv-detail-grid');
    if (grid) {
        const items = [
            ['Invoice #', `#${inv.number||'—'}`],
            ['Client',    inv.clientName || '—'],
            ['Email',     inv.clientEmail || '—'],
            ['Phone',     inv.clientPhone || '—'],
            ['Amount',    fmt(inv.amountDue || inv.total || 0)],
            ['Tax',       inv.taxAmount ? fmt(inv.taxAmount) : '—'],
            ['Due Date',  due ? fmtDate(inv.dueDate) : '—'],
            ['Created',   inv.createdAt ? fmtDate(inv.createdAt) : '—'],
            ['Notes',     inv.notes || '—'],
            ['Terms',     inv.terms || '—'],
        ];
        grid.innerHTML = items.map(([l,v]) => `
            <div class="inv-detail-item">
                <div class="idl">${l}</div>
                <div class="idv">${escHtml(String(v))}</div>
            </div>`).join('');
    }

    // Button actions
    document.getElementById('modal-edit-btn')?.addEventListener('click', () => editInvoice(id), { once: true });
    document.getElementById('modal-pdf-btn')?.addEventListener('click', () => { window.location.href = `/Invoice/builder/?id=${id}&pdf=1`; }, { once: true });
    document.getElementById('modal-share-btn')?.addEventListener('click', () => { copyPayLink(id); closeModal(); }, { once: true });

    document.getElementById('inv-modal').classList.add('open');
}
window.openInvModal = openInvModal;

function closeModal() {
    document.getElementById('inv-modal')?.classList.remove('open');
}
window.closeModal = closeModal;

// ── Actions ───────────────────────────────────────────────────────
function editInvoice(id) { window.location.href = `/Invoice/builder/?id=${id}`; }
window.editInvoice = editInvoice;

function copyPayLink(id) {
    const url = `${window.location.origin}/Invoice/pay/?id=${id}`;
    navigator.clipboard?.writeText(url).then(() => showToast('Payment link copied!', 'success'))
        .catch(() => { prompt('Copy this link:', url); });
}
window.copyPayLink = copyPayLink;

async function deleteInvoice(id) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
        await db.collection('invoices').doc(id).delete();
        allInvoices = allInvoices.filter(i => i.id !== id);
        renderStats();
        renderTable();
        showToast('Invoice deleted.', 'info');
    } catch(e) { showToast('Delete failed.', 'error'); }
}
window.deleteInvoice = deleteInvoice;

// ── Reminders ─────────────────────────────────────────────────────
function openReminder(id, clientName, number, amount) {
    _reminderMsg = `Hi ${clientName},\n\nThis is a gentle reminder for Invoice *#${number}* amounting to *${fmt(parseFloat(amount))}*, which is currently overdue.\n\nPlease pay securely here:\n🔗 ${window.location.origin}/Invoice/pay/?id=${id}\n\nThank you!\n— Sent via FUMA Invoice by FUMA Technologies`;
    const ta = document.getElementById('reminder-msg');
    if (ta) ta.value = _reminderMsg;
    document.getElementById('reminder-modal')?.classList.add('open');
}
window.openReminder = openReminder;

function doSendReminder() {
    const msg = document.getElementById('reminder-msg')?.value || _reminderMsg;
    navigator.clipboard?.writeText(msg).catch(() => {});
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    document.getElementById('reminder-modal')?.classList.remove('open');
    showToast('WhatsApp opened! Message copied.', 'success');
}
window.doSendReminder = doSendReminder;

// ── Bulk operations ───────────────────────────────────────────────
function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    const cnt = document.getElementById('bulk-count');
    if (!bar) return;
    bar.style.display = selectedIds.size > 0 ? 'flex' : 'none';
    if (cnt) cnt.textContent = `${selectedIds.size} selected`;
}

function clearSelection() {
    selectedIds.clear();
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
    document.getElementById('select-all').checked = false;
    updateBulkBar();
}
window.clearSelection = clearSelection;

async function bulkMarkPaid() {
    if (!selectedIds.size) return;
    const batch = db.batch();
    selectedIds.forEach(id => {
        batch.update(db.collection('invoices').doc(id), {
            status: 'Paid',
            paidAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    try {
        await batch.commit();
        allInvoices.forEach(inv => {
            if (selectedIds.has(inv.id)) { inv.status = 'Paid'; inv.paidAt = new Date(); }
        });
        clearSelection();
        renderStats();
        renderTable();
        showToast('Marked as paid.', 'success');
    } catch(e) { showToast('Update failed.', 'error'); }
}
window.bulkMarkPaid = bulkMarkPaid;

async function bulkDelete() {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} invoice(s)?`)) return;
    const batch = db.batch();
    selectedIds.forEach(id => batch.delete(db.collection('invoices').doc(id)));
    try {
        await batch.commit();
        allInvoices = allInvoices.filter(i => !selectedIds.has(i.id));
        clearSelection();
        renderStats();
        renderTable();
        showToast('Invoices deleted.', 'info');
    } catch(e) { showToast('Delete failed.', 'error'); }
}
window.bulkDelete = bulkDelete;

// ── Bind events ───────────────────────────────────────────────────
function bindEvents() {
    // Search
    document.getElementById('search-input')?.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        renderTable();
    });
    // Filter pills
    document.getElementById('filter-pills')?.addEventListener('click', e => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.dataset.status;
        renderTable();
    });
    // Sort
    document.getElementById('sort-select')?.addEventListener('change', e => {
        activeSort = e.target.value;
        renderTable();
    });
    // Select all
    document.getElementById('select-all')?.addEventListener('change', e => {
        document.querySelectorAll('.row-check').forEach(cb => {
            cb.checked = e.target.checked;
            e.target.checked ? selectedIds.add(cb.dataset.id) : selectedIds.delete(cb.dataset.id);
        });
        updateBulkBar();
    });
    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(mb => {
        mb.addEventListener('click', e => { if (e.target === mb) mb.classList.remove('open'); });
    });
}

// ── Helpers ───────────────────────────────────────────────────────
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function tsMs(ts) {
    if (!ts) return 0;
    try { return ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime(); } catch { return 0; }
}