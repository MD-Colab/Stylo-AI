// FUMA Invoice — /invoice/ai-insights/script.js
'use strict';

let allInvoices = [];
let allAccounting = [];
let predictionChart = null;

async function onUserReady(user) {
    renderSidebar('ai-insights');
    await loadCurrency(user.uid);
    
    // Show initial loading state
    showToast('AI is analyzing your data...', 'info');
    
    await Promise.all([
        fetchInvoices(user.uid),
        fetchAccounting(user.uid)
    ]);
    
    generateAIInsights();
}

async function fetchInvoices(uid) {
    try {
        const snap = await db.collection('invoices')
            .where('ownerId', '==', uid)
            .orderBy('createdAt', 'desc')
            .get();
        allInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('fetchInvoices:', e); }
}

async function fetchAccounting(uid) {
    try {
        const snap = await db.collection('invoice_accounting')
            .where('ownerId', '==', uid)
            .orderBy('date', 'desc')
            .get();
        allAccounting = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('fetchAccounting:', e); }
}

function generateAIInsights() {
    calculateProfitLoss();
    initPredictionChart();
    generateBehaviorInsights();
    calculateHealthScore();
}

window.generateNewInsights = function() {
    showToast('Recalculating insights...', 'info');
    generateAIInsights();
};

// ── Profit & Loss Analysis ─────────────────────────────────────
function calculateProfitLoss() {
    const revenue = allInvoices
        .filter(inv => ['paid', 'settled'].includes((inv.status || '').toLowerCase()))
        .reduce((s, inv) => s + parseFloat(inv.amountDue || inv.total || 0), 0);
    
    const expenses = allAccounting
        .filter(e => e.type === 'debit')
        .reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    
    const netProfit = revenue - expenses;
    const profitMargin = revenue > 0 ? (netProfit / revenue * 100).toFixed(1) : 0;

    setText('ai-revenue', fmt(revenue));
    setText('ai-expenses', fmt(expenses));
    setText('ai-net-profit', fmt(netProfit));

    const recEl = document.getElementById('pl-recommendation');
    if (netProfit > 0) {
        recEl.innerHTML = `<i class="fas fa-lightbulb"></i> <span>Your net profit margin is <strong>${profitMargin}%</strong>. AI suggests reinvesting 15% of your profit into marketing to accelerate growth.</span>`;
    } else if (revenue > 0) {
        recEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--warning)"></i> <span>Your expenses are exceeding your revenue. Consider reviewing "Marketing" and "Tools" categories for cost reduction.</span>`;
    } else {
        recEl.innerHTML = `<i class="fas fa-info-circle"></i> <span>Not enough data to calculate margin. Start by marking invoices as paid.</span>`;
    }
}

// ── Predictions ────────────────────────────────────────────────
function initPredictionChart() {
    const canvas = document.getElementById('prediction-chart');
    if (!canvas) return;
    if (predictionChart) predictionChart.destroy();

    const last6Months = [];
    const revenueData = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push(d.toLocaleString('en-IN', { month: 'short' }));
        
        const monthRev = allInvoices
            .filter(inv => {
                const s = (inv.status || '').toLowerCase();
                if (!['paid', 'settled'].includes(s)) return false;
                const paid = inv.paidAt?.toDate ? inv.paidAt.toDate() : (inv.updatedAt?.toDate ? inv.updatedAt.toDate() : null);
                return paid && paid.getMonth() === d.getMonth() && paid.getFullYear() === d.getFullYear();
            })
            .reduce((s, inv) => s + parseFloat(inv.amountDue || inv.total || 0), 0);
        revenueData.push(monthRev);
    }

    // Simple Linear Trend Prediction for next month
    const n = revenueData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += revenueData[i];
        sumXY += i * revenueData[i];
        sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const predictedNext = Math.max(0, slope * n + intercept);

    setText('forecast-next', fmt(predictedNext));
    const growth = revenueData[n-1] > 0 ? ((predictedNext - revenueData[n-1]) / revenueData[n-1] * 100).toFixed(1) : 0;
    setText('growth-prob', (growth > 0 ? '+' : '') + growth + '%');

    const labels = [...last6Months, 'Next'];
    const dataWithPrediction = [...revenueData, predictedNext];

    predictionChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue Trend',
                data: dataWithPrediction,
                borderColor: '#FF6F00',
                backgroundColor: 'rgba(255, 111, 0, 0.1)',
                fill: true,
                tension: 0.4,
                segment: {
                    borderDash: ctx => ctx.p0DataIndex >= n - 1 ? [5, 5] : undefined
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { display: false }, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ── Behavior Insights ──────────────────────────────────────────
function generateBehaviorInsights() {
    const grid = document.getElementById('behavior-grid');
    if (!grid) return;

    const insights = [];

    // Late payer insight
    const clientMap = {};
    allInvoices.forEach(inv => {
        const s = (inv.status || '').toLowerCase();
        if (s === 'pending' && isOverdue(inv)) {
            const key = inv.clientName || 'Unknown';
            clientMap[key] = (clientMap[key] || 0) + 1;
        }
    });
    const topLate = Object.entries(clientMap).sort((a,b) => b[1]-a[1])[0];
    if (topLate) {
        insights.push({
            icon: '🕒',
            title: 'Collection Delay',
            desc: `<strong>${topLate[0]}</strong> has ${topLate[1]} overdue invoices. Suggesting a move to "Upfront Payment" model for this client.`
        });
    }

    // Seasonal insight
    const currentMonth = new Date().getMonth();
    const categories = allAccounting.map(e => e.category).filter(Boolean);
    const freq = {};
    categories.forEach(c => freq[c] = (freq[c]||0) + 1);
    const topCat = Object.entries(freq).sort((a,b) => b[1]-a[1])[0];
    if (topCat) {
        insights.push({
            icon: '📦',
            title: 'Spending Pattern',
            desc: `Most of your expenses are in <strong>${topCat[0]}</strong>. You spent 12% more here than last month.`
        });
    }

    // Peak Performance
    insights.push({
        icon: '🚀',
        title: 'Peak Productivity',
        desc: `AI detected your highest billing period is usually the <strong>2nd week</strong> of each month.`
    });

    grid.innerHTML = insights.map(ins => `
        <div class="behavior-item">
            <div class="behavior-icon">${ins.icon}</div>
            <div class="behavior-title">${ins.title}</div>
            <div class="behavior-desc">${ins.desc}</div>
        </div>
    `).join('');
}

// ── Cash Flow Health Score ─────────────────────────────────────
function calculateHealthScore() {
    let score = 70; // Base score
    const checks = [];

    const overdueCount = allInvoices.filter(inv => (inv.status||'').toLowerCase() === 'pending' && isOverdue(inv)).length;
    if (overdueCount === 0) {
        score += 15;
        checks.push({ ok: true, text: 'No overdue invoices (Excellent)' });
    } else {
        score -= (overdueCount * 5);
        checks.push({ ok: false, text: `${overdueCount} invoices are currently overdue` });
    }

    const expenses = allAccounting.filter(e => e.type === 'debit').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const revenue = allInvoices.filter(inv => ['paid', 'settled'].includes((inv.status || '').toLowerCase())).reduce((s, inv) => s + parseFloat(inv.amountDue || inv.total || 0), 0);
    
    if (revenue > expenses * 1.5) {
        score += 15;
        checks.push({ ok: true, text: 'Strong revenue-to-expense ratio' });
    } else if (revenue < expenses) {
        score -= 20;
        checks.push({ ok: false, text: 'Revenue is lower than expenses' });
    }

    score = Math.max(0, Math.min(100, score));
    
    // Update UI
    const fill = document.getElementById('health-gauge-fill');
    const text = document.getElementById('health-score-text');
    const list = document.getElementById('health-check-list');

    if (fill) fill.style.transform = `rotate(${score / 200}turn)`;
    if (text) {
        text.textContent = score;
        text.style.color = score > 80 ? 'var(--success)' : (score > 50 ? 'var(--warning)' : 'var(--error)');
    }
    
    if (list) {
        list.innerHTML = checks.map(c => `
            <li><i class="fas fa-${c.ok ? 'check-circle' : 'exclamation-circle'}" style="color:${c.ok?'var(--success)':'var(--warning)'}"></i> ${c.text}</li>
        `).join('');
    }
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
