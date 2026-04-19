// FUMA Invoice — /invoice/reports/script.js
'use strict';

let allInvoices    = [];
let allAccounting  = [];
let selectedYear   = new Date().getFullYear();
let charts         = {};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function onUserReady(user) {
    renderSidebar('reports');
    await loadCurrency(user.uid);
    populateYearSelect();
    await Promise.all([fetchInvoices(user.uid), fetchAccounting(user.uid)]);
    buildReports();
    bindEvents();
}

async function fetchInvoices(uid) {
    try {
        const snap = await db.collection('invoices').where('ownerId','==',uid).get();
        allInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('fetchInvoices:', e); }
}

async function fetchAccounting(uid) {
    try {
        const snap = await db.collection('invoice_accounting').where('ownerId','==',uid).get();
        allAccounting = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('fetchAccounting:', e); }
}

function populateYearSelect() {
    const sel = document.getElementById('year-select');
    if (!sel) return;
    const curYear = new Date().getFullYear();
    for (let y = curYear; y >= curYear - 4; y--) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        if (y === selectedYear) opt.selected = true;
        sel.appendChild(opt);
    }
}

function buildReports() {
    const yearInvs = allInvoices.filter(inv => {
        const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : (inv.createdAt ? new Date(inv.createdAt) : null);
        return d && d.getFullYear() === selectedYear;
    });

    // ── KPIs ────────────────────────────────────────────────────
    const paidInvs    = yearInvs.filter(inv => ['paid','settled'].includes((inv.status||'').toLowerCase()));
    const annualRev   = paidInvs.reduce((s,inv) => s + parseFloat(inv.amountDue||inv.total||0), 0);
    const paidPct     = yearInvs.length ? Math.round(paidInvs.length / yearInvs.length * 100) : 0;
    const clientSet   = new Set(yearInvs.map(inv => inv.clientName || inv.clientEmail || '').filter(Boolean));
    const avgInv      = yearInvs.length ? yearInvs.reduce((s,inv) => s+parseFloat(inv.amountDue||inv.total||0),0)/yearInvs.length : 0;

    setText('r-annual',     fmt(annualRev));
    setText('r-annual-sub', `${paidInvs.length} paid invoice${paidInvs.length!==1?'s':''}`);
    setText('r-sent',       String(yearInvs.length));
    setText('r-paid-pct',   `${paidPct}% paid`);
    setText('r-clients',    String(clientSet.size));
    setText('r-avg',        fmt(avgInv));

    // ── Monthly data ─────────────────────────────────────────────
    const monthlyRevenue  = Array(12).fill(0);
    const monthlyPending  = Array(12).fill(0);
    const monthlyInvCount = Array(12).fill(0);

    yearInvs.forEach(inv => {
        const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : (inv.createdAt ? new Date(inv.createdAt) : null);
        if (!d) return;
        const m   = d.getMonth();
        const amt = parseFloat(inv.amountDue || inv.total || 0);
        const s   = (inv.status||'').toLowerCase();
        monthlyInvCount[m]++;
        if (['paid','settled'].includes(s)) monthlyRevenue[m] += amt;
        else monthlyPending[m] += amt;
    });

    // ── Monthly income vs expense (from accounting) ───────────────
    const monthlyIncome  = Array(12).fill(0);
    const monthlyExpense = Array(12).fill(0);
    allAccounting.forEach(e => {
        const d = e.date?.toDate ? e.date.toDate() : (e.date ? new Date(e.date) : null);
        if (!d || d.getFullYear() !== selectedYear) return;
        const m = d.getMonth();
        const a = parseFloat(e.amount||0);
        if (e.type === 'credit') monthlyIncome[m]  += a;
        else                      monthlyExpense[m] += a;
    });

    // ── Status counts ─────────────────────────────────────────────
    const now = new Date();
    const statusCounts = { Paid:0, Pending:0, Overdue:0, Draft:0 };
    yearInvs.forEach(inv => {
        const s = (inv.status||'Draft').toLowerCase();
        const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
        if (s==='pending' && due && due < now) statusCounts.Overdue++;
        else if (s==='paid'||s==='settled') statusCounts.Paid++;
        else if (s==='pending') statusCounts.Pending++;
        else statusCounts.Draft++;
    });

    // ── Client performance ────────────────────────────────────────
    const clientMap = {};
    yearInvs.forEach(inv => {
        const key = inv.clientName || inv.clientEmail || 'Unknown';
        if (!clientMap[key]) clientMap[key] = { name:key, total:0, paid:0, pending:0, count:0, payDays:[] };
        const c = clientMap[key];
        const amt = parseFloat(inv.amountDue||inv.total||0);
        const s   = (inv.status||'').toLowerCase();
        c.count++; c.total += amt;
        if (['paid','settled'].includes(s)) {
            c.paid += amt;
            const created = inv.createdAt?.toDate ? inv.createdAt.toDate() : null;
            const paid    = inv.paidAt?.toDate ? inv.paidAt.toDate() : null;
            if (created && paid) c.payDays.push(Math.round((paid-created)/86400000));
        } else c.pending += amt;
    });
    const topClients = Object.values(clientMap).sort((a,b) => b.total-a.total).slice(0, 10);

    // ── Render charts ─────────────────────────────────────────────
    renderRevenueChart(monthlyRevenue, monthlyPending);
    renderStatusChart(statusCounts);
    renderIncExpChart(monthlyIncome, monthlyExpense);
    renderClientsChart(topClients);

    // ── Render tables ─────────────────────────────────────────────
    renderClientTable(topClients);
    renderMonthlyTable(monthlyRevenue, monthlyPending, monthlyInvCount);
}

// ── Charts ────────────────────────────────────────────────────────
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function renderRevenueChart(revenue, pending) {
    destroyChart('revenue');
    const canvas = document.getElementById('revenue-chart');
    if (!canvas) return;
    charts.revenue = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: MONTHS,
            datasets: [
                { label: 'Collected', data: revenue, backgroundColor: 'rgba(16,185,129,.2)', borderColor: '#10B981', borderWidth: 2, borderRadius: 5, borderSkipped: false },
                { label: 'Pending',   data: pending, backgroundColor: 'rgba(245,158,11,.2)', borderColor: '#F59E0B', borderWidth: 2, borderRadius: 5, borderSkipped: false },
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ position:'top', labels:{ font:{size:11}, padding:12 } } },
            scales:{
                y:{ beginAtZero:true, grid:{color:'rgba(0,0,0,.04)'}, ticks:{ callback:v=>fmt(v), font:{size:11} } },
                x:{ grid:{display:false}, ticks:{font:{size:11}} }
            }
        }
    });
}

function renderStatusChart(counts) {
    destroyChart('status');
    const canvas = document.getElementById('status-chart');
    if (!canvas) return;
    charts.status = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{ data: Object.values(counts), backgroundColor: ['#10B981','#F59E0B','#EF4444','#E5E7EB'], borderWidth: 0, hoverOffset: 5 }]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            cutout:'68%',
            plugins:{ legend:{ position:'right', labels:{ font:{size:11}, padding:12 } } }
        }
    });
}

function renderIncExpChart(income, expense) {
    destroyChart('incexp');
    const canvas = document.getElementById('incexp-chart');
    if (!canvas) return;
    charts.incexp = new Chart(canvas, {
        type: 'line',
        data: {
            labels: MONTHS,
            datasets: [
                { label:'Income',  data:income,  borderColor:'#10B981', backgroundColor:'rgba(16,185,129,.1)', fill:true, tension:.4, pointRadius:4 },
                { label:'Expense', data:expense, borderColor:'#EF4444', backgroundColor:'rgba(239,68,68,.08)',  fill:true, tension:.4, pointRadius:4 },
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ position:'top', labels:{ font:{size:11} } } },
            scales:{
                y:{ beginAtZero:true, grid:{color:'rgba(0,0,0,.04)'}, ticks:{ callback:v=>fmt(v), font:{size:11} } },
                x:{ grid:{display:false}, ticks:{font:{size:11}} }
            }
        }
    });
}

function renderClientsChart(clients) {
    destroyChart('clients');
    const canvas = document.getElementById('clients-chart');
    if (!canvas) return;
    const top5 = clients.slice(0,5);
    charts.clients = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: top5.map(c => c.name.length > 14 ? c.name.substring(0,14)+'…' : c.name),
            datasets: [
                { label:'Paid',    data:top5.map(c=>c.paid),    backgroundColor:'rgba(16,185,129,.7)',  borderRadius:5, borderSkipped:false },
                { label:'Pending', data:top5.map(c=>c.pending), backgroundColor:'rgba(245,158,11,.7)', borderRadius:5, borderSkipped:false },
            ]
        },
        options: {
            indexAxis:'y', responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ position:'top', labels:{ font:{size:11} } } },
            scales:{
                x:{ beginAtZero:true, grid:{color:'rgba(0,0,0,.04)'}, ticks:{ callback:v=>fmt(v), font:{size:11} }, stacked:true },
                y:{ grid:{display:false}, ticks:{font:{size:11}}, stacked:true }
            }
        }
    });
}

// ── Tables ────────────────────────────────────────────────────────
function renderClientTable(clients) {
    const tbody = document.getElementById('client-table');
    if (!tbody) return;
    if (!clients.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:1.5rem;text-align:center;color:var(--muted)">No invoice data for selected year.</td></tr>`;
        return;
    }
    tbody.innerHTML = clients.map((c,i) => {
        const avgDays = c.payDays.length ? Math.round(c.payDays.reduce((s,d)=>s+d,0)/c.payDays.length) : '—';
        const paidPct = c.total ? Math.round(c.paid/c.total*100) : 0;
        return `<tr class="rank-${i+1}">
            <td><div class="rank-num">${i+1}</div></td>
            <td class="td-bold">${escHtml(c.name)}</td>
            <td>${c.count}</td>
            <td class="td-bold">${fmt(c.total)}</td>
            <td style="color:var(--success);font-weight:700">${fmt(c.paid)}</td>
            <td style="color:var(--warning);font-weight:700">${fmt(c.pending)}</td>
            <td><div style="display:flex;align-items:center;gap:4px">
                <div class="pct-bar"><div class="pct-fill" style="width:${paidPct}%"></div></div>
                <span style="font-size:.8rem;color:var(--muted)">${typeof avgDays==='number'?avgDays+'d':'—'}</span>
            </div></td>
        </tr>`;
    }).join('');
}

function renderMonthlyTable(revenue, pending, counts) {
    const tbody = document.getElementById('monthly-table');
    if (!tbody) return;
    tbody.innerHTML = MONTHS.map((m, i) => {
        const invoiced = revenue[i] + pending[i];
        const pct = invoiced > 0 ? Math.round(revenue[i]/invoiced*100) : 0;
        return `<tr>
            <td class="td-bold">${m} ${selectedYear}</td>
            <td>${fmt(invoiced)}</td>
            <td style="color:var(--success);font-weight:700">${fmt(revenue[i])}</td>
            <td style="color:var(--warning);font-weight:700">${fmt(pending[i])}</td>
            <td>${counts[i]}</td>
            <td>
                <div style="display:flex;align-items:center;gap:6px">
                    <div class="pct-bar" style="width:80px"><div class="pct-fill" style="width:${pct}%"></div></div>
                    <span style="font-size:.82rem;font-weight:600">${pct}%</span>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── Export ────────────────────────────────────────────────────────
function exportReport() {
    const yearInvs = allInvoices.filter(inv => {
        const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : (inv.createdAt ? new Date(inv.createdAt) : null);
        return d && d.getFullYear() === selectedYear;
    });
    const rows = [['Invoice #','Client','Amount','Status','Created','Due Date']];
    yearInvs.forEach(inv => {
        rows.push([inv.number||'', inv.clientName||'', parseFloat(inv.amountDue||inv.total||0).toFixed(2), inv.status||'', fmtDate(inv.createdAt), fmtDate(inv.dueDate)]);
    });
    const csv  = rows.map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `report-${selectedYear}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Report exported.', 'success');
}
window.exportReport = exportReport;

function bindEvents() {
    document.getElementById('year-select')?.addEventListener('change', e => {
        selectedYear = parseInt(e.target.value);
        buildReports();
    });
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }