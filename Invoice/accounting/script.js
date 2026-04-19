// FUMA Invoice — /invoice/accounting/script.js
'use strict';
let allEntries  = [];
let acctFilter  = 'all';
let acctSearch  = '';
let acctMonth   = '';

async function onUserReady(user) {
    renderSidebar('accounting');
    await loadCurrency(user.uid);
    // Set month filter to current month
    const now = new Date();
    const monthInput = document.getElementById('month-filter');
    if (monthInput) {
        const m = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        monthInput.value = m;
        acctMonth = m;
    }
    // Sync invoices as income entries automatically
    await syncInvoicePayments(user.uid);
    await fetchEntries(user.uid);
    renderStats();
    renderLedger();
    bindEvents();
}

// Auto-sync paid invoices as income entries
async function syncInvoicePayments(uid) {
    try {
        const [invSnap, entSnap] = await Promise.all([
            db.collection('invoices').where('ownerId','==',uid).where('status','in',['Paid','Settled']).get(),
            db.collection('invoice_accounting').where('ownerId','==',uid).where('source','==','invoice').get()
        ]);
        const existing = new Set(entSnap.docs.map(d => d.data().invoiceId));
        const batch = db.batch();
        let synced = 0;
        invSnap.docs.forEach(doc => {
            const inv = doc.data();
            if (!existing.has(doc.id)) {
                const ref = db.collection('invoice_accounting').doc();
                batch.set(ref, {
                    ownerId:     uid,
                    date:        inv.paidAt || inv.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                    description: `Invoice #${inv.number||doc.id} — ${inv.clientName||'Client'}`,
                    type:        'credit',
                    category:    'invoice',
                    amount:      parseFloat(inv.amountDue || inv.total || 0),
                    notes:       '',
                    source:      'invoice',
                    invoiceId:   doc.id,
                    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
                });
                synced++;
            }
        });
        if (synced > 0) await batch.commit();
    } catch(e) { console.warn('syncInvoicePayments:', e); }
}

async function fetchEntries(uid) {
    try {
        const snap = await db.collection('invoice_accounting')
            .where('ownerId','==',uid)
            .orderBy('date','desc')
            .get();
        allEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('fetchEntries:', e); }
}

function renderStats() {
    let income = 0, expense = 0;
    let incC = 0, expC = 0;
    allEntries.forEach(e => {
        const a = parseFloat(e.amount||0);
        if (e.type==='credit') { income+=a; incC++; }
        else                   { expense+=a; expC++; }
    });
    const balance = income - expense;
    setText('st-income',     fmt(income));
    setText('st-expense',    fmt(expense));
    setText('st-balance',    fmt(balance));
    setText('st-entries',    String(allEntries.length));
    setText('st-income-sub', `${incC} credits`);
    setText('st-expense-sub',`${expC} debits`);

    const balEl = document.getElementById('st-balance');
    if (balEl) balEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--error)';
}

function renderLedger() {
    const tbody = document.getElementById('acct-body');
    if (!tbody) return;

    let list = [...allEntries];

    // Month filter
    if (acctMonth) {
        list = list.filter(e => {
            const d = e.date?.toDate ? e.date.toDate() : (e.date ? new Date(e.date) : null);
            if (!d) return false;
            const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            return ym === acctMonth;
        });
    }
    // Type filter
    if (acctFilter !== 'all') list = list.filter(e => e.type === acctFilter);
    // Search
    if (acctSearch) {
        const q = acctSearch.toLowerCase();
        list = list.filter(e => (e.description||'').toLowerCase().includes(q) || (e.category||'').toLowerCase().includes(q));
    }

    // Sort by date ascending for running balance
    const sorted = [...list].sort((a,b) => tsMs(a.date) - tsMs(b.date));

    // Compute running balance
    let runningBal = 0;
    const withBal = sorted.map(e => {
        const a = parseFloat(e.amount||0);
        if (e.type==='credit') runningBal += a;
        else runningBal -= a;
        return { ...e, runningBal };
    });

    // Display newest first
    withBal.reverse();

    if (!withBal.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-book"></i><p>No entries for this period.</p><a href="#" onclick="openEntryModal()">Add an entry →</a></div></td></tr>`;
        return;
    }

    const CATS = { invoice:'Invoice', salary:'Salary', rent:'Rent', utilities:'Utilities', marketing:'Marketing', tools:'Tools', travel:'Travel', other:'Other' };

    tbody.innerHTML = withBal.map(e => {
        const isCredit = e.type === 'credit';
        const rowCls   = isCredit ? 'credit-row' : 'debit-row';
        const amtCls   = isCredit ? 'amt-credit'  : 'amt-debit';
        const balCls   = e.runningBal >= 0 ? 'bal-positive' : 'bal-negative';
        const autoSrc  = e.source === 'invoice' ? '<span class="badge badge-info" style="font-size:.65rem;margin-left:4px">Auto</span>' : '';
        return `<tr class="${rowCls}">
            <td>${fmtDate(e.date)}</td>
            <td class="td-bold">${escHtml(e.description||'—')}${autoSrc}</td>
            <td><span class="badge badge-draft">${CATS[e.category]||e.category||'—'}</span></td>
            <td><span class="badge ${isCredit?'badge-credit':'badge-debit'}">${isCredit?'Income':'Expense'}</span></td>
            <td class="${amtCls}">${isCredit?'+':'−'}${fmt(e.amount||0)}</td>
            <td class="${balCls}">${fmt(Math.abs(e.runningBal))} ${e.runningBal<0?'(loss)':''}</td>
            <td>
                ${e.source!=='invoice' ? `<div style="display:flex;gap:.3rem">
                    <button class="btn btn-secondary btn-sm" onclick="openEntryModal('${e.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteEntry('${e.id}')"><i class="fas fa-trash"></i></button>
                </div>` : '<span class="td-muted" style="font-size:.78rem">Auto-sync</span>'}
            </td>
        </tr>`;
    }).join('');
}

function openEntryModal(entryId) {
    const isEdit = !!entryId;
    setText('entry-modal-title', isEdit ? 'Edit Entry' : 'Add Entry');
    document.getElementById('edit-entry-id').value = entryId || '';

    if (isEdit) {
        const e = allEntries.find(x => x.id === entryId);
        if (!e) return;
        document.getElementById('entry-date').value     = fmtDateInput(e.date);
        document.getElementById('entry-type').value     = e.type      || 'credit';
        document.getElementById('entry-desc').value     = e.description || '';
        document.getElementById('entry-amount').value   = e.amount    || '';
        document.getElementById('entry-category').value = e.category  || 'other';
        document.getElementById('entry-notes').value    = e.notes     || '';
    } else {
        document.getElementById('entry-date').value     = new Date().toISOString().split('T')[0];
        document.getElementById('entry-type').value     = 'credit';
        document.getElementById('entry-desc').value     = '';
        document.getElementById('entry-amount').value   = '';
        document.getElementById('entry-category').value = 'other';
        document.getElementById('entry-notes').value    = '';
    }
    document.getElementById('entry-modal').classList.add('open');
}
window.openEntryModal = openEntryModal;

function closeEntryModal() { document.getElementById('entry-modal').classList.remove('open'); }
window.closeEntryModal = closeEntryModal;

async function saveEntry() {
    const desc   = document.getElementById('entry-desc').value.trim();
    const amount = parseFloat(document.getElementById('entry-amount').value) || 0;
    const date   = document.getElementById('entry-date').value;
    if (!desc)   { showToast('Description is required.', 'error'); return; }
    if (!amount) { showToast('Amount must be > 0.', 'error'); return; }
    if (!date)   { showToast('Date is required.', 'error'); return; }

    const entryId = document.getElementById('edit-entry-id').value;
    const isEdit  = !!entryId;
    const data = {
        description: desc,
        type:        document.getElementById('entry-type').value,
        amount,
        date:        firebase.firestore.Timestamp.fromDate(new Date(date)),
        category:    document.getElementById('entry-category').value,
        notes:       document.getElementById('entry-notes').value.trim(),
        ownerId:     currentUser.uid,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (!isEdit) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    try {
        if (isEdit) {
            await db.collection('invoice_accounting').doc(entryId).update(data);
            const idx = allEntries.findIndex(e => e.id === entryId);
            if (idx > -1) allEntries[idx] = { ...allEntries[idx], ...data };
        } else {
            const ref = await db.collection('invoice_accounting').add(data);
            allEntries.unshift({ id: ref.id, ...data });
        }
        closeEntryModal();
        renderStats();
        renderLedger();
        showToast(isEdit ? 'Entry updated.' : 'Entry added.', 'success');
    } catch(e) { showToast('Save failed: ' + e.message, 'error'); }
}
window.saveEntry = saveEntry;

async function deleteEntry(entryId) {
    if (!confirm('Delete this entry?')) return;
    try {
        await db.collection('invoice_accounting').doc(entryId).delete();
        allEntries = allEntries.filter(e => e.id !== entryId);
        renderStats();
        renderLedger();
        showToast('Entry deleted.', 'info');
    } catch(e) { showToast('Delete failed.', 'error'); }
}
window.deleteEntry = deleteEntry;

function exportCSV() {
    const rows = [['Date','Description','Category','Type','Amount','Running Balance']];
    const sorted = [...allEntries].sort((a,b) => tsMs(a.date)-tsMs(b.date));
    let bal = 0;
    sorted.forEach(e => {
        const a = parseFloat(e.amount||0);
        if (e.type==='credit') bal+=a; else bal-=a;
        rows.push([fmtDate(e.date), e.description||'', e.category||'', e.type, a.toFixed(2), bal.toFixed(2)]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
}
window.exportCSV = exportCSV;

function bindEvents() {
    document.getElementById('acct-search')?.addEventListener('input', e => { acctSearch = e.target.value.trim(); renderLedger(); });
    document.getElementById('month-filter')?.addEventListener('change', e => { acctMonth = e.target.value; renderLedger(); });
    document.getElementById('type-pills')?.addEventListener('click', e => {
        const pill = e.target.closest('.filter-pill'); if (!pill) return;
        document.querySelectorAll('#type-pills .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active'); acctFilter = pill.dataset.type; renderLedger();
    });
    document.querySelectorAll('.modal-backdrop').forEach(mb => { mb.addEventListener('click', e => { if (e.target===mb) mb.classList.remove('open'); }); });
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function tsMs(ts) { try { return ts?.toDate ? ts.toDate().getTime() : new Date(ts||0).getTime(); } catch { return 0; } }