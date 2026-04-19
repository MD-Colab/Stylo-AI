// FUMA Invoice — /invoice/settings/script.js (UPDATED — with Business tab)
'use strict';

let settingsData = {};

async function onUserReady(user) {
    renderSidebar('settings');
    await Promise.all([
        loadSettings(user),
        loadBusinessTab(user.uid)
    ]);
    bindEvents();
}

// ── Load all settings ─────────────────────────────────────────────
async function loadSettings(user) {
    document.getElementById('profile-display-name').textContent  = user.displayName || user.email || '—';
    document.getElementById('profile-display-email').textContent = user.email || '';
    document.getElementById('s-display-name').value              = user.displayName || '';

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const d = userDoc.data();
            setVal('s-personal-phone', d.phone || '');
            if (d.photoBase64) {
                const avatarEl = document.getElementById('profile-avatar');
                avatarEl.innerHTML = `<img src="${d.photoBase64}">`;
            } else {
                document.getElementById('profile-avatar').textContent =
                    (user.displayName || user.email || '?').charAt(0).toUpperCase();
            }
        }
    } catch(e) {}

    try {
        const doc = await db.collection('invoice_settings').doc(user.uid).get();
        if (doc.exists) {
            settingsData = doc.data();
            const d = settingsData;

            setVal('s-biz-name',       d.businessName    || '');
            setVal('s-biz-type',       d.businessType    || 'freelancer');
            setVal('s-biz-email',      d.companyEmail    || '');
            setVal('s-biz-phone',      d.businessPhone   || '');
            setVal('s-biz-address',    [d.address?.street, d.address?.city, d.address?.state, d.address?.country].filter(Boolean).join(', ') || '');
            setVal('s-biz-gst',        d.taxId           || '');
            setVal('s-biz-pan',        d.panNumber       || '');
            setVal('s-logo-url',       d.logoUrl         || '');
            setVal('s-website',        d.website         || '');
            setVal('s-signature',      d.emailSignature  || '');
            setVal('s-currency',       d.currency        || 'INR');
            setVal('s-default-tax',    d.defaultTax      != null ? d.defaultTax : 18);
            setVal('s-inv-prefix',     d.invoicePrefix   || 'INV');
            setVal('s-pay-terms',      d.paymentTerms    || 30);
            setVal('s-default-notes',  d.defaultNotes    || '');
            setVal('s-default-terms',  d.defaultTerms    || '');

            if (d.defaultTemplate) {
                const radio = document.querySelector(`input[name="s-template"][value="${d.defaultTemplate}"]`);
                if (radio) radio.checked = true;
            }
            setCheck('s-notify-payment',  d.notifyPayment  !== false);
            setCheck('s-notify-overdue',  !!d.notifyOverdue);
            setCheck('s-notify-whatsapp', !!d.notifyWhatsapp);
            setVal('s-rzp-key',     d.linkedAccount?.accountId || '');
            setVal('s-rzp-mode',    d.razorpayMode || 'live');
            setVal('s-rzp-account', d.linkedAccount?.accountId || '');

            // Payment status from linked account
            const la = d.linkedAccount;
            const psEl = document.getElementById('ps-status');
            if (la?.status === 'active') {
                psEl.textContent = '✅ Active — ' + (la.bankName || la.businessName || 'Account linked');
                psEl.style.color = 'var(--success)';
            } else if (la?.accountId && la?.accountId !== 'Pending') {
                psEl.textContent = '⏳ Pending verification — account ID: ' + la.accountId;
                psEl.style.color = 'var(--warning)';
            } else {
                psEl.textContent = 'Not configured';
            }

            showLogoPreview(d.logoUrl || '');
        }
    } catch(e) { console.error('loadSettings:', e); }
}

// ── Load Business tab ─────────────────────────────────────────────
/**
 * Reads businesses/{uid} directly and renders a read-only panel.
 * Fields shown match exact Firestore structure from screenshots.
 *
 * businesses/{uid} schema:
 *   businessName, businessEmail, businessPhone, businessLogoBase64
 *   businessType, businessCategory, businessDescription
 *   address.{ addressLine, city, state, country, postalCode }
 *   identity.{ gstNumber, panNumber }
 *   bank.{ bankAccountHolder, bankAccountNumber, bankIFSC }
 *   meta.{ verified, razorpayAccountId, mdinvoiceLinked, mddropshipLinked, createdAt }
 */
async function loadBusinessTab(uid) {
    const container = document.getElementById('biz-tab-content');
    if (!container) return;

    try {
        const snap = await db.collection('businesses').doc(uid).get();

        if (!snap.exists) {
            container.innerHTML = `
                <div class="biz-not-connected">
                    <i class="fas fa-store-slash"></i>
                    <div>
                        No business profile found.
                        <a href="/Business/index.html">Create your FUMA Business profile →</a>
                        to unlock Razorpay payment links and business verification.
                    </div>
                </div>`;
            return;
        }

        const b = snap.data();
        const isVerified = b.meta?.verified === true;
        const rzpId      = b.meta?.razorpayAccountId || 'Pending';
        const isLinked   = b.meta?.mdinvoiceLinked    === true;

        const logoHtml = b.businessLogoBase64
            ? `<img src="${b.businessLogoBase64}" class="bcc-logo" alt="logo">`
            : `<div class="bcc-logo bcc-placeholder"><i class="fas fa-building"></i></div>`;

        const addr = b.address || {};
        const addressFull = [addr.addressLine, addr.city, addr.state, addr.country, addr.postalCode]
            .filter(Boolean).join(', ');

        const bankFull = b.bank?.bankAccountHolder
            ? `${b.bank.bankAccountHolder} · A/C: ${b.bank.bankAccountNumber || '—'} · IFSC: ${b.bank.bankIFSC || '—'}`
            : '—';

        container.innerHTML = `
            <!-- Header card -->
            <div class="biz-connected-card">
                ${logoHtml}
                <div class="bcc-info">
                    <div class="bcc-name">${escHtml(b.businessName || '—')}</div>
                    <div class="bcc-meta">${escHtml(b.businessEmail || '')} ${b.businessPhone ? '· ' + b.businessPhone : ''}</div>
                    <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
                        <span class="bcc-badge ${isVerified ? 'verified' : 'pending'}">
                            <i class="fas fa-${isVerified ? 'check-circle' : 'clock'}"></i>
                            ${isVerified ? 'Verified Business' : 'Verification Pending'}
                        </span>
                        ${isLinked ? `<span class="bcc-badge verified"><i class="fas fa-link"></i> FUMA Invoice Connected</span>` : `<span class="bcc-badge pending"><i class="fas fa-unlink"></i> Not Connected to Invoice</span>`}
                    </div>
                </div>
                <a href="/Business/dashboard.html" class="btn btn-secondary btn-sm">
                    <i class="fas fa-external-link-alt"></i> Open Business
                </a>
            </div>

            <!-- Read-only fields -->
            <div class="biz-field-row">
                <div class="biz-field-readonly">
                    <div class="bfr-label">Business Name</div>
                    <div class="bfr-val">${escHtml(b.businessName || '—')}</div>
                </div>
                <div class="biz-field-readonly">
                    <div class="bfr-label">Business Type</div>
                    <div class="bfr-val" style="text-transform:capitalize">${escHtml(b.businessType || '—')}</div>
                </div>
            </div>
            <div class="biz-field-row">
                <div class="biz-field-readonly">
                    <div class="bfr-label">Business Email</div>
                    <div class="bfr-val">${escHtml(b.businessEmail || '—')}</div>
                </div>
                <div class="biz-field-readonly">
                    <div class="bfr-label">Phone</div>
                    <div class="bfr-val">${escHtml(b.businessPhone || '—')}</div>
                </div>
            </div>
            <div class="biz-field-row" style="grid-template-columns:1fr">
                <div class="biz-field-readonly">
                    <div class="bfr-label">Address</div>
                    <div class="bfr-val">${escHtml(addressFull || '—')}</div>
                </div>
            </div>
            <div class="biz-field-row">
                <div class="biz-field-readonly">
                    <div class="bfr-label">GST Number</div>
                    <div class="bfr-val">${escHtml(b.identity?.gstNumber || '—')}</div>
                </div>
                <div class="biz-field-readonly">
                    <div class="bfr-label">PAN Number</div>
                    <div class="bfr-val">${escHtml(b.identity?.panNumber || '—')}</div>
                </div>
            </div>
            <div class="biz-field-row" style="grid-template-columns:1fr">
                <div class="biz-field-readonly">
                    <div class="bfr-label">Bank Details</div>
                    <div class="bfr-val">${escHtml(bankFull)}</div>
                </div>
            </div>
            <div class="biz-field-row">
                <div class="biz-field-readonly">
                    <div class="bfr-label">Razorpay Account ID</div>
                    <div class="bfr-val" style="color:${rzpId === 'Pending' ? 'var(--warning)' : 'var(--success)'}">
                        ${escHtml(rzpId)}
                    </div>
                </div>
                <div class="biz-field-readonly">
                    <div class="bfr-label">Business Category</div>
                    <div class="bfr-val" style="text-transform:capitalize">${escHtml(b.businessCategory || '—')}</div>
                </div>
            </div>

            ${!isLinked ? `
            <div style="margin-top:1rem;padding:1rem;background:rgba(255,111,0,0.06);border:1px solid rgba(255,111,0,0.2);border-radius:8px;font-size:.86rem;color:var(--text-soft)">
                <i class="fas fa-info-circle" style="color:var(--brand);margin-right:6px"></i>
                Your FUMA Invoice is not yet connected to this business profile. 
                Go to <a href="/Business/dashboard.html" style="color:var(--brand);font-weight:700">FUMA Business Dashboard</a> 
                and confirm the FUMAInvoice connection, then your business data will auto-sync here.
            </div>` : ''}

            <p style="font-size:.72rem;color:var(--muted);margin-top:1rem">
                <i class="fas fa-lock"></i> Business details are read-only here. 
                Edit them in <a href="/Business/index.html" style="color:var(--brand)">FUMA Business</a>.
            </p>
        `;

    } catch(e) {
        console.error('loadBusinessTab:', e);
        container.innerHTML = `<div class="biz-not-connected"><i class="fas fa-exclamation-circle"></i><div>Could not load business data. ${e.message}</div></div>`;
    }
}
window.loadBusinessTab = loadBusinessTab;

// ── Save all settings ─────────────────────────────────────────────
async function saveAllSettings() {
    const user = currentUser;
    if (!user) return;

    const template = document.querySelector('input[name="s-template"]:checked')?.value || 'modern';

    const data = {
        businessName:    getVal('s-biz-name'),
        businessType:    getVal('s-biz-type'),
        companyEmail:    getVal('s-biz-email'),
        businessPhone:   getVal('s-biz-phone'),
        taxId:           getVal('s-biz-gst'),
        panNumber:       getVal('s-biz-pan'),
        logoUrl:         getVal('s-logo-url'),
        website:         getVal('s-website'),
        emailSignature:  getVal('s-signature'),
        currency:        getVal('s-currency'),
        defaultTax:      parseFloat(getVal('s-default-tax') || 18),
        invoicePrefix:   getVal('s-inv-prefix') || 'INV',
        paymentTerms:    parseInt(getVal('s-pay-terms') || 30),
        defaultNotes:    getVal('s-default-notes'),
        defaultTerms:    getVal('s-default-terms'),
        defaultTemplate: template,
        notifyPayment:   getCheck('s-notify-payment'),
        notifyOverdue:   getCheck('s-notify-overdue'),
        notifyWhatsapp:  getCheck('s-notify-whatsapp'),
        razorpayMode:    getVal('s-rzp-mode'),
        updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
        await db.collection('invoice_settings').doc(user.uid).set(data, { merge: true });

        const newName = getVal('s-display-name');
        if (newName && newName !== user.displayName) {
            await user.updateProfile({ displayName: newName });
        }
        await db.collection('users').doc(user.uid).set({
            phone: getVal('s-personal-phone'),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        localStorage.setItem('md_currency', data.currency);
        showToast('Settings saved!', 'success');
    } catch(e) { showToast('Save failed: ' + e.message, 'error'); }
}
window.saveAllSettings = saveAllSettings;

// ── Password change ───────────────────────────────────────────────
async function changePassword() {
    const newPass = getVal('s-new-pass');
    const confirm = getVal('s-confirm-pass');
    if (!newPass)           { showToast('Enter a new password.', 'error'); return; }
    if (newPass.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
    if (newPass !== confirm) { showToast('Passwords do not match.', 'error'); return; }
    try {
        await currentUser.updatePassword(newPass);
        setVal('s-new-pass',''); setVal('s-confirm-pass','');
        showToast('Password updated!', 'success');
    } catch(e) {
        if (e.code === 'auth/requires-recent-login') {
            showToast('Please sign out and back in, then try again.', 'error');
        } else {
            showToast('Error: ' + e.message, 'error');
        }
    }
}
window.changePassword = changePassword;

// ── Test payment setup ────────────────────────────────────────────
async function testPaymentSetup() {
    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const resp = await fetch('/api/payment-webhook');
        const data = await resp.json();
        document.getElementById('ps-status').textContent = '✅ Webhook active';
        document.getElementById('ps-status').style.color = 'var(--success)';
        showToast('Payment webhook is active!', 'success');
    } catch(e) {
        document.getElementById('ps-status').textContent = '❌ Could not reach webhook';
        showToast('Could not reach payment endpoint.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plug"></i> Test';
    }
}
window.testPaymentSetup = testPaymentSetup;

// ── Danger zone ───────────────────────────────────────────────────
async function resetOnboarding() {
    if (!confirm('Reset onboarding?')) return;
    try {
        await db.collection('invoice_settings').doc(currentUser.uid).update({ onboardingDone: false });
        showToast('Onboarding reset.', 'info');
    } catch(e) { showToast('Failed: ' + e.message, 'error'); }
}
window.resetOnboarding = resetOnboarding;

function clearCache() {
    const uid = currentUser?.uid;
    if (uid) {
        sessionStorage.removeItem(`md_invoices_${uid}`);
        sessionStorage.removeItem(`md_invoices_ts_${uid}`);
        localStorage.removeItem('md_currency');
    }
    showToast('Cache cleared!', 'success');
}
window.clearCache = clearCache;

async function confirmDeleteAll() {
    const input = prompt('Type DELETE to confirm. This removes all invoices, customers, and products.');
    if (input !== 'DELETE') { showToast('Cancelled.', 'info'); return; }
    showToast('Deleting…', 'warning');
    const uid = currentUser.uid;
    const collections = ['invoices','invoice_customers','invoice_products','accounting'];
    try {
        for (const col of collections) {
            const snap = await db.collection(col).where('ownerId','==',uid).get();
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            if (snap.docs.length) await batch.commit();
        }
        clearCache();
        showToast('All data deleted.', 'success');
    } catch(e) { showToast('Deletion failed: ' + e.message, 'error'); }
}
window.confirmDeleteAll = confirmDeleteAll;

// ── Tab switching ─────────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.stab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
}
window.switchTab = switchTab;

function showLogoPreview(url) {
    const img = document.getElementById('s-logo-preview');
    if (!img) return;
    img.src = url;
    img.style.display = url ? 'block' : 'none';
    img.onerror = () => { img.style.display = 'none'; };
}

function bindEvents() {
    document.getElementById('s-logo-url')?.addEventListener('input', e => showLogoPreview(e.target.value.trim()));
    document.querySelectorAll('.modal-backdrop').forEach(mb => {
        mb.addEventListener('click', e => { if (e.target === mb) mb.classList.remove('open'); });
    });
}

function getVal(id)     { return document.getElementById(id)?.value || ''; }
function setVal(id, v)  { const el = document.getElementById(id); if (el) el.value = v || ''; }
function getCheck(id)   { return document.getElementById(id)?.checked || false; }
function setCheck(id,v) { const el = document.getElementById(id); if (el) el.checked = !!v; }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }