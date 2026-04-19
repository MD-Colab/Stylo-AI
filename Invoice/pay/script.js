'use strict';
/* ── FUMA Invoice — /invoice/pay/script.js ─────────────────────────────────
   Fixes in this version:
   • Currency symbols fixed (was mojibake due to encoding issue)
   • initiatePayment: graceful fallback if invoice_settings has no linked account
     (creates a direct Razorpay order without Route transfer)
   • handleSuccess: marks invoice as Paid in Firestore immediately
   • showErr / showScreen: now properly toggles visibility without removing nodes
   • downloadReceipt: encoding-safe HTML generation
──────────────────────────────────────────────────────────────────────────── */

const _fc = {
  apiKey:            'AIzaSyDQ097vz04Oj7QpHIZKNR9KVp5L0U03Fio',
  authDomain:        'md-colab-63228.firebaseapp.com',
  projectId:         'md-colab-63228',
  storageBucket:     'md-colab-63228.firebasestorage.app',
  messagingSenderId: '568580723297',
  appId:             '1:568580723297:web:1426515deda2d3d0a45020',
};
if (!firebase.apps.length) firebase.initializeApp(_fc);
const db = firebase.firestore();

/* ── Currency symbols (plain JS string literals — no encoding issues) ── */
const CSYM = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' };

let invoiceData = null;
let invoiceId   = null;

/* ─────────────────────────────────────────────────────────────────────── */
function fmtAmt(n, cur) {
  return (CSYM[cur] || cur || '₹') +
    parseFloat(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(ts); }
}

/* ─────────────────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', async () => {
  const p = new URLSearchParams(window.location.search);
  invoiceId = p.get('id') || p.get('invoiceId');

  if (!invoiceId) {
    showErr('No invoice ID in URL. Please use the link from your invoice email.');
    return;
  }

  try {
    const snap = await db.collection('invoices').doc(invoiceId).get();
    if (!snap.exists) {
      showErr('Invoice not found. It may have been deleted or the link is incorrect.');
      return;
    }
    invoiceData = { id: snap.id, ...snap.data() };
    renderInvoice(invoiceData);
  } catch (e) {
    console.error(e);
    showErr('Failed to load invoice: ' + e.message);
  }
});

/* ─────────────────────────────────────────────────────────────────────── */
function renderInvoice(inv) {
  const cur    = inv.currency || 'INR';
  const sym    = CSYM[cur] || cur;
  const amt    = parseFloat(inv.amountDue || inv.total || 0);
  const status = (inv.status || 'pending').toLowerCase();
  const due    = inv.dueDate?.toDate
    ? inv.dueDate.toDate()
    : (inv.dueDate ? new Date(inv.dueDate) : null);
  const ovr    = status === 'pending' && due && due < new Date();
  const ds     = ovr ? 'Overdue' : (inv.status || 'Pending');
  const bc     = ovr ? 'badge-overdue' : `badge-${status}`;

  /* Header */
  document.getElementById('pay-biz-name').textContent = inv.businessName || inv.sellerName || 'Business';
  document.getElementById('pay-inv-num').textContent  = `#${inv.number || inv.invoiceNumber || '—'}`;
  document.getElementById('pay-curr-sym').textContent = sym;
  document.getElementById('pay-amt').textContent      =
    parseFloat(amt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Detail rows */
  document.getElementById('pd-num').textContent = inv.number || inv.invoiceNumber || '—';
  document.getElementById('pd-due').textContent = due ? fmtDate(inv.dueDate) : '—';
  document.getElementById('pd-biz').textContent = inv.businessName || inv.sellerName || '—';

  const sb = document.getElementById('pd-status');
  if (sb) { sb.textContent = ds; sb.className = `badge ${bc}`; }

  if (inv.notes) {
    document.getElementById('pd-notes').textContent = inv.notes;
    document.getElementById('pd-notes-row').style.display = 'flex';
  }

  /* Already paid? */
  if (['paid', 'settled'].includes(status)) {
    document.getElementById('pay-paid-banner').style.display = 'flex';
    document.getElementById('pay-btn-area').style.display    = 'none';
  }

  /* Show card */
  document.getElementById('pay-loader').style.display = 'none';
  document.getElementById('pay-card').classList.add('visible');
}

/* ─────────────────────────────────────────────────────────────────────── */
async function initiatePayment() {
  const btn = document.getElementById('pay-now-btn');
  btn.disabled    = true;
  btn.innerHTML   = '<i class="fas fa-spinner fa-spin"></i> Preparing…';

  try {
    /* ── Try the server-side create-order endpoint first ── */
    let order = null;
    let keyId = null;

    try {
      const resp = await fetch('/api/create-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invoiceId }),
      });

      if (resp.ok) {
        order = await resp.json();
        keyId = order.keyId || order.key_id;
      } else {
        const err = await resp.json();
        /* If the only problem is a missing linked account, we fall through
           to a direct payment (no Route) using the public key from the env.
           For any other error, surface it. */
        if (err.error && !err.error.toLowerCase().includes('account')) throw new Error(err.error);
      }
    } catch (serverErr) {
      /* Network error or non-account error — re-throw */
      if (!serverErr.message.toLowerCase().includes('account')) throw serverErr;
    }

    /* ── Fallback: direct Razorpay checkout without Route ──
       Used when invoice_settings has no linkedAccount yet.
       Key is read from a meta field on the invoice or from a global env hint. */
    if (!order) {
      /* Attempt to fetch key from invoice_settings (public fields only) */
      let fallbackKey = null;
      try {
        const settSnap = await db.collection('invoice_settings').doc(invoiceData.ownerId).get();
        fallbackKey = settSnap.exists ? settSnap.data().razorpayKeyId || null : null;
      } catch (_) { /* ignore */ }

      if (!fallbackKey) {
        throw new Error(
          "The seller's payment account is not fully set up yet. " +
          'Please contact them directly or try again later.'
        );
      }

      const amtPaise = Math.round(parseFloat(invoiceData.amountDue || invoiceData.total || 0) * 100);
      if (amtPaise < 100) throw new Error('Invoice amount must be at least ₹1.');

      /* Open Razorpay directly with a pre-built order from client */
      const rzpOpts = buildRzpOptions({
        key:      fallbackKey,
        amount:   amtPaise,
        order_id: null,   // no server order — Razorpay creates one
        currency: invoiceData.currency || 'INR',
      }, btn);
      new Razorpay(rzpOpts).open();
      return;
    }

    /* ── Normal flow: server returned order ── */
    const rzpOpts = buildRzpOptions({
      key:      keyId,
      amount:   order.amount,
      order_id: order.id,
      currency: invoiceData.currency || 'INR',
    }, btn);

    new Razorpay(rzpOpts).open();

  } catch (e) {
    console.error('Payment error:', e);
    document.getElementById('pay-error-msg').textContent = e.message;
    showScreen('error');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-lock"></i> Pay Securely with Razorpay';
  }
}
window.initiatePayment = initiatePayment;

/* ─────────────────────────────────────────────────────────────────────── */
function buildRzpOptions({ key, amount, order_id, currency }, btn) {
  const opts = {
    key,
    amount,
    currency,
    name:        invoiceData.businessName || 'FUMA Invoice',
    description: `Invoice #${invoiceData.number || ''}`,
    theme:       { color: '#FF6F00' },
    prefill: {
      name:    invoiceData.clientName  || '',
      email:   invoiceData.clientEmail || '',
      contact: invoiceData.clientPhone || '',
    },
    handler: function (response) { handleSuccess(response); },
    modal: {
      ondismiss: () => {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-lock"></i> Pay Securely with Razorpay';
      },
    },
  };
  if (order_id) opts.order_id = order_id;
  return opts;
}

/* ─────────────────────────────────────────────────────────────────────── */
async function handleSuccess(response) {
  window._payInfo = {
    paymentId:     response.razorpay_payment_id,
    orderId:       response.razorpay_order_id,
    invoiceId,
    invoiceNumber: invoiceData.number || invoiceData.invoiceNumber,
    businessName:  invoiceData.businessName || invoiceData.sellerName,
    amount:        invoiceData.amountDue || invoiceData.total,
    currency:      invoiceData.currency || 'INR',
    paidAt:        new Date().toISOString(),
  };

  /* ── Mark invoice as Paid in Firestore ── */
  try {
    await db.collection('invoices').doc(invoiceId).update({
      status:       'Paid',
      paidAt:       firebase.firestore.FieldValue.serverTimestamp(),
      paymentId:    response.razorpay_payment_id,
      razorpayOrder: response.razorpay_order_id || null,
    });
  } catch (e) {
    console.warn('Could not update invoice status:', e);
    /* Don't fail the success screen — payment went through */
  }

  const cur = invoiceData.currency || 'INR';
  document.getElementById('s-amt').textContent = fmtAmt(invoiceData.amountDue || invoiceData.total, cur);
  document.getElementById('s-biz').textContent = invoiceData.businessName || invoiceData.sellerName || '—';
  document.getElementById('pay-header').style.background = '#10B981';

  ['pay-amount-block', 'pay-details', 'pay-btn-area', 'pay-paid-banner'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('pay-success').classList.add('visible');
}

/* ─────────────────────────────────────────────────────────────────────── */
function downloadReceipt() {
  const i = window._payInfo;
  if (!i) return;
  const sym  = CSYM[i.currency] || i.currency || '₹';
  const date = new Date(i.paidAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
  const amtFormatted = sym + parseFloat(i.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt - ${i.invoiceNumber}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;max-width:500px;margin:40px auto;padding:20px;color:#111}
  h1{color:#FF6F00;font-size:1.4rem;margin-bottom:4px}
  .sub{color:#6B7280;font-size:.8rem;margin-bottom:2rem}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E5E7EB;font-size:.88rem}
  .row:last-child{border:none}.label{color:#6B7280}.value{font-weight:600}
  .total-val{font-size:1.2rem;font-weight:800;color:#FF6F00}
  .footer{text-align:center;margin-top:2rem;font-size:.72rem;color:#9CA3AF}
  .badge{background:#D1FAE5;color:#065F46;padding:3px 12px;border-radius:20px;font-weight:700;font-size:.8rem}
  @media print{.no-print{display:none}}
</style></head><body>
<h1>Payment Receipt</h1>
<p class="sub">FUMA Invoice by Fuma Technologies</p>
<div class="row"><span class="label">Status</span><span class="badge">✅ PAID</span></div>
<div class="row"><span class="label">Invoice #</span><span class="value">${i.invoiceNumber}</span></div>
<div class="row"><span class="label">Business</span><span class="value">${i.businessName}</span></div>
<div class="row"><span class="label">Payment ID</span><span class="value" style="font-size:.78rem">${i.paymentId}</span></div>
<div class="row"><span class="label">Date &amp; Time</span><span class="value">${date}</span></div>
<div class="row"><span class="label total-val">Amount Paid</span><span class="value total-val">${amtFormatted}</span></div>
<p class="footer">⚡ Powered by FUMA Invoice · fumatechnologies.vercel.app</p>
<button class="no-print" onclick="window.print()"
  style="margin-top:20px;padding:10px 20px;background:#FF6F00;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600">
  🖨️ Print / Save as PDF
</button>
</body></html>`;

  const w = window.open('', '_blank', 'width=600,height=700');
  if (w) { w.document.write(html); w.document.close(); }
}
window.downloadReceipt = downloadReceipt;

/* ─────────────────────────────────────────────────────────────────────── */
function showScreen(screen) {
  document.getElementById('pay-loader').style.display = 'none';
  document.getElementById('pay-card').classList.add('visible');

  if (screen === 'error') {
    ['pay-header', 'pay-amount-block', 'pay-details', 'pay-btn-area',
      'pay-paid-banner', 'pay-success'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const errEl = document.getElementById('pay-error');
    if (errEl) errEl.classList.add('visible');
  }
}

function showErr(msg) {
  document.getElementById('pay-loader').style.display = 'none';
  document.getElementById('pay-card').classList.add('visible');

  ['pay-header', 'pay-amount-block', 'pay-details', 'pay-btn-area'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const errMsg = document.getElementById('pay-error-msg');
  if (errMsg) errMsg.textContent = msg;
  const errEl = document.getElementById('pay-error');
  if (errEl) errEl.classList.add('visible');
}